from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict
from pydantic import BaseModel
from app.database import database
from app.models import TimetableResponse
from app.bulk_algorithm import generate_bulk_timetable_logic
from bson import ObjectId

router = APIRouter()

class BulkGenerateRequest(BaseModel):
    department_code: str
    semester_type: str # "ODD" or "EVEN"

class BulkResponse(BaseModel):
    status: str
    message: str
    generated_count: int

@router.post("/bulk_generate", response_model=BulkResponse)
async def bulk_generate_timetable(request: BulkGenerateRequest):
    semesters = [1, 3, 5, 7] if request.semester_type.upper() == "ODD" else [2, 4, 6, 8]
    
    # Fetch all matching subjects
    subjects_cursor = database.subjects.find({
        "department_code": request.department_code,
        "semester": {"$in": semesters}
    })
    subjects = await subjects_cursor.to_list(length=1000)
    
    if not subjects:
        raise HTTPException(status_code=404, detail="No subjects found for this criteria.")
        
    # Standardize data structure for algorithm
    for s in subjects:
        s["_id"] = str(s["_id"])
        if "faculty_id" in s and not s.get("faculty_ids"):
             s["faculty_ids"] = [s["faculty_id"]]

    # Fetch faculty
    faculty_cursor = database.faculty.find({"department_code": request.department_code})
    faculty = await faculty_cursor.to_list(length=500)
    for f in faculty:
        f["_id"] = str(f["_id"])

    # Fetch rooms
    rooms_cursor = database.rooms.find({})
    rooms = await rooms_cursor.to_list(length=100)
    
    # Run Algorithm
    result = generate_bulk_timetable_logic(subjects, faculty, rooms)

    if not result["schedules"]:
        raise HTTPException(status_code=500, detail="Failed to schedule anything.")
        
    generated_count = 0
    # Save the structured schedules
    for group_key, schedule in result["schedules"].items():
        parts = group_key.split('_')
        # format: CS_2_3_A (Dept_Year_Sem_Section)
        dept = parts[0]
        year = int(parts[1])
        sem = int(parts[2])
        sec = parts[3]
        
        timetable_doc = {
            "department_code": dept,
            "year": year,
            "semester": sem,
            "class_name": sec,
            "schedule": schedule,
            "created_at": "now"
        }
        
        await database.timetables.update_one(
            {"department_code": dept, "year": year, "class_name": sec},
            {"$set": timetable_doc},
            upsert=True
        )
        generated_count += 1

    return BulkResponse(
        status=result["status"],
        message=f"Timetables generated for {generated_count} classes.",
        generated_count=generated_count
    )

@router.get("/faculty_timetable")
async def get_faculty_timetable(faculty_id: str, semester_type: Optional[str] = "ODD"):
    # First get the faculty name
    faculty = await database.faculty.find_one({"_id": ObjectId(faculty_id)})
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    semesters = [1, 3, 5, 7] if semester_type.upper() == "ODD" else [2, 4, 6, 8]
    
    # Find all timetables for this semester type
    tts_cursor = database.timetables.find({"semester": {"$in": semesters}})
    all_tts = await tts_cursor.to_list(length=500)
    
    faculty_schedule = []
    
    for tt in all_tts:
        class_label = f"Year {tt.get('year')} {tt.get('class_name')} Sec"
        for slot in tt.get('schedule', []):
            if faculty_id in slot.get('faculty_ids', []):
                faculty_schedule.append({
                    "day": slot.get("day"),
                    "period": slot.get("period"),
                    "subject": slot.get("subject"),
                    "room": slot.get("room"),
                    "class_name": class_label,
                    "target_department": tt.get("department_code")
                })
                
    return {
        "faculty_name": faculty["name"],
        "schedule": faculty_schedule
    }
