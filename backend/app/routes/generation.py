from fastapi import APIRouter, Body, HTTPException
from typing import List, Optional
from app.database import database, common_helper
from app.models import GenerateRequest, TimetableResponse, TimetableSlot
import random

router = APIRouter()

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
PERIODS = 7  # 7 teaching periods per day

@router.post("/generate", response_model=TimetableResponse)
async def generate_timetable(request: GenerateRequest = Body(...)):
    # 1. Fetch related data
    try:
        # Fetch subjects that match Year/Dept/Sem AND Class OR are explicitly requested
        requested_codes = [a['subject_code'] for a in request.subject_allocations if a.get('subject_code')]
        subject_query = {
            "$or": [
                {
                    "department_code": request.department_code, 
                    "year": request.year,
                    "semester": request.semester,
                    # Handle backward compatibility (some subjects might not have class_name yet)
                    "$or": [
                        {"class_name": request.class_name},
                        {"class_name": {"$exists": False}}, # For old data
                        {"class_name": "A"} # Default assumption if missing
                    ]
                },
                {"code": {"$in": requested_codes}}
            ]
        }
        # Simplify query logic for class_name
        base_query = {
            "department_code": request.department_code, 
            "year": request.year,
            "semester": request.semester
        }
        
        # We fetch all matching year/sem subjects first, then filter by class manually for safety
        subjects_cursor = database.subjects.find(base_query)
        year_subjects = await subjects_cursor.to_list(length=200)
        
        filtered_subjects = []
        for s in year_subjects:
            # If subject has class_name specific, check it match. 
            # If subject has no class_name, assumed common or 'A'.
            # Ideally data should be clean. Let's assume inclusive for now.
            s_class = s.get('class_name')
            if not s_class or s_class == request.class_name:
                filtered_subjects.append(s)
                
        # Also fetch requested codes explicitly
        if requested_codes:
            extra_cursor = database.subjects.find({
                "code": {"$in": requested_codes},
                "$or": [
                    {"class_name": request.class_name},
                    {"class_name": {"$exists": False}}
                    # {"class_name": "A"} # Removed implicit A here to avoid conflict if B is requested
                ]
            })
            extras = await extra_cursor.to_list(length=50)
            # Merge unique
            existing_ids = {str(s['_id']) for s in filtered_subjects}
            for e in extras:
                if str(e['_id']) not in existing_ids:
                    filtered_subjects.append(e)

        subjects = filtered_subjects
        
        rooms_cursor = database.rooms.find({})
        rooms = await rooms_cursor.to_list(length=100)
        random.shuffle(rooms) 
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data Fetch Error: {str(e)}")
        
    if not subjects:
        raise HTTPException(status_code=404, detail="No subjects found. Check Year, Semester, and Class.")
    
    # ... (Conflict tracking code remains same) ...
    # 2. GLOBAL Conflict Tracking
    # Populate busy status from ALL other classes
    faculty_busy = {day: {p: set() for p in range(1, PERIODS + 1)} for day in DAYS}
    room_busy = {day: {p: set() for p in range(1, PERIODS + 1)} for day in DAYS}

    # Fetch existing timetables to prevent conflicts
    existing_tts_cursor = database.timetables.find({})
    async for tt in existing_tts_cursor:
        if (str(tt.get('department_code')) == str(request.department_code) and 
            str(tt.get('year')) == str(request.year) and 
            str(tt.get('class_name')) == str(request.class_name)):
            continue
            
        for slot in tt.get('schedule', []):
            d, p = slot.get('day'), slot.get('period')
            fid, rno = slot.get('faculty_id'), slot.get('room')
            if d in faculty_busy and p in faculty_busy[d]:
                if fid: faculty_busy[d][p].add(fid)
                if rno: room_busy[d][p].add(rno)

    schedule: List[TimetableSlot] = []
    allocation_map = {item['subject_code']: item.get('faculty_ids', []) for item in request.subject_allocations}
    
    # ... (Helper functions remain same) ...
    async def get_faculty_name(fids):
        from bson import ObjectId
        if not fids: return "TBA"
        if isinstance(fids, str): fids = [fids] # Backward compatibility
        
        names = []
        for fid in fids:
            try:
                fac = await database.faculty.find_one({"_id": ObjectId(fid)})
                if fac: names.append(fac['name'])
            except: continue
        return ", ".join(names) if names else "Unknown"

    def can_schedule_block(day, start_period, block_size, fac_ids, room_no):
         # ... existing implementation ... 
         if start_period + block_size - 1 > PERIODS: return False
         periods_in_block = list(range(start_period, start_period + block_size))
         if 2 in periods_in_block and 3 in periods_in_block: return False
         if 4 in periods_in_block and 5 in periods_in_block: return False
         for p in periods_in_block:
             if fac_ids:
                 # Check each faculty ID in the list
                 if isinstance(fac_ids, str): fac_ids = [fac_ids]
                 for fid in fac_ids:
                    if fid in faculty_busy[day][p]: return False
             if room_no in room_busy[day][p]: return False
         return True
    
    def schedule_block(day, start_period, block_size, sub, fac_ids, fac_name, room_no):
         # ... existing implementation ...
         for i in range(block_size):
             p = start_period + i
             if isinstance(fac_ids, str): fac_ids = [fac_ids]
             slot_entry = TimetableSlot(
                 day=day, period=p, subject=sub['name'], subject_code=sub['code'],
                 acronym=sub.get('acronym'),
                 faculty=fac_name, faculty_ids=fac_ids or [],
                 room=room_no, type=sub['type']
             )
             schedule.append(slot_entry)
             if fac_ids:
                 for fid in fac_ids:
                    faculty_busy[day][p].add(fid)
             room_busy[day][p].add(room_no)

    # 4. Separate subjects and Schedule Labs/Theory (Keep existing logic)
    lab_subjects = [s for s in subjects if s['type'] == 'Lab']
    theory_subjects = [s for s in subjects if s['type'] != 'Lab']
    
    # ... (Keep existing scheduling loops for Labs and Theory) ...
    # [Rest of scheduling code omitted for brevity as it shouldn't change, 
    # except we need to ensure we don't accidentally replace it with empty placeholder]

    # RE-INSERTING THE SCHEDULING LOGIC HERE TO BE SAFE SINCE REPLACE BLOCK IS LARGE
    for lab in lab_subjects:
         # ... (lab scheduling logic) ...
         weekly_hours = lab.get('weekly_hours', 3)
         sub_code = lab['code']
         fac_ids = allocation_map.get(sub_code) or lab.get('faculty_ids') or []
         if isinstance(fac_ids, str): fac_ids = [fac_ids]
         fac_name = await get_faculty_name(fac_ids)
         
         if weekly_hours == 1: block_patterns = [[1]]
         elif weekly_hours == 2: block_patterns = [[2], [1, 1]]
         elif weekly_hours == 3: block_patterns = [[2, 1], [1, 1, 1]]
         elif weekly_hours == 4: block_patterns = [[2, 2], [2, 1, 1]]
         elif weekly_hours == 5: block_patterns = [[3, 2], [2, 2, 1], [2, 1, 1, 1]]
         else:
             # General case for large hours (e.g. 6, 7)
             # Prefer 2-hour blocks
             blocks = [2] * (weekly_hours // 2)
             if weekly_hours % 2 == 1: blocks.append(1)
             block_patterns = [blocks]
         
         hours_scheduled = 0
         days_used = []
         attempts = 0
         max_attempts = 200
         for pattern in block_patterns:
             if hours_scheduled >= weekly_hours: break
             for block_size in pattern:
                 if hours_scheduled >= weekly_hours: break
                 block_scheduled = False
                 attempts = 0
                 while not block_scheduled and attempts < max_attempts:
                     attempts += 1
                     available_days = [d for d in DAYS if d not in days_used]
                     if not available_days: available_days = DAYS
                     day = random.choice(available_days)
                     valid_starts = [p for p in range(1, PERIODS - block_size + 2) if p not in [2, 5, 8]]
                     if not valid_starts: continue
                     start_period = random.choice(valid_starts)
                     assigned_room = lab.get('room_no')
                     if assigned_room:
                         if can_schedule_block(day, start_period, block_size, fac_ids, assigned_room):
                             schedule_block(day, start_period, block_size, lab, fac_ids, fac_name, assigned_room)
                             hours_scheduled += block_size
                             if day not in days_used: days_used.append(day)
                             block_scheduled = True
                     else:
                         for room in rooms:
                             if can_schedule_block(day, start_period, block_size, fac_ids, room['room_no']):
                                 schedule_block(day, start_period, block_size, lab, fac_ids, fac_name, room['room_no'])
                                 hours_scheduled += block_size
                                 if day not in days_used: days_used.append(day)
                                 block_scheduled = True
                                 break
                     if block_scheduled: break

    # 6. Schedule THEORY subjects
    # Calculate total needed vs available to determine if we need to over-schedule for fillers
    total_theory_hours = sum(s.get('weekly_hours', 3) for s in theory_subjects)
    total_lab_hours = sum(l.get('weekly_hours', 3) for l in lab_subjects)
    
    # 6.5. Year-Specific Filler Requirements
    year_int = int(request.year)
    lib_hours_target = 2 if year_int <= 2 else 0
    
    # Pre-schedule Library slots if needed
    lib_slots = []
    if lib_hours_target > 0:
        preferred_slots = [4, 7] # Before lunch or last hour
        placed = 0
        attempts = 0
        while placed < lib_hours_target and attempts < 100:
            attempts += 1
            d = random.choice(DAYS)
            p = random.choice(preferred_slots)
            
            # Check availability
            if (d, p) not in [(s.day, s.period) for s in schedule]:
                # Temporary hold
                lib_slots.append((d, p))
                placed += 1
                # Mark busy to prevent overlap during main scheduling
                # (We will add the actual slots at the end to keep clean)
                # But actually, best to add them now or mark busy
                room_busy[d][p].add("Library") 
    
    for sub in theory_subjects:
        needed_hours = sub.get('weekly_hours', 3)
        sub_code = sub['code']
        fac_ids = allocation_map.get(sub_code) or sub.get('faculty_ids') or []
        if isinstance(fac_ids, str): fac_ids = [fac_ids]
        fac_name = await get_faculty_name(fac_ids)
        
        assigned_count = 0
        attempts = 0
        
        while assigned_count < needed_hours and attempts < 500:
            attempts += 1
            day = random.choice(DAYS)
            period = random.randint(1, PERIODS)
            
            # Respect pre-reserved Library slots logic (conceptual check)
            if "Library" in room_busy[day][period]:  
                continue

            # Check faculty and room availability
            is_free = True
            selected_room_no = None
            assigned_room_no = sub.get('room_no')

            if assigned_room_no:
                if assigned_room_no not in room_busy[day][period]:
                    selected_room_no = assigned_room_no
            else:
                for r in rooms:
                    if r['room_no'] not in room_busy[day][period]:
                        selected_room_no = r['room_no']
                        break
            
            if not selected_room_no: continue
            
            if fac_ids:
                if isinstance(fac_ids, str): fac_ids = [fac_ids]
                for fid in fac_ids:
                    if fid in faculty_busy[day][period]: 
                        is_free = False
                        break
            
            if is_free:
                slot_entry = TimetableSlot(
                    day=day, period=period, subject=sub['name'], subject_code=sub_code,
                    acronym=sub.get('acronym'),
                    faculty=fac_name, faculty_ids=fac_ids or [],
                    room=selected_room_no, type=sub['type']
                )
                schedule.append(slot_entry)
                if fac_ids:
                    for fid in fac_ids:
                        faculty_busy[day][period].add(fid)
                room_busy[day][period].add(selected_room_no)
                assigned_count += 1
    
    # 7. ADD RESERVED LIBRARY SLOTS
    for (d, p) in lib_slots:
        schedule.append(TimetableSlot(
            day=d, period=p, subject="Library", subject_code="LIB",
            faculty="TBA", faculty_id=None, room="Library", type="Theory"
        ))

    # 8. FILL REMAINING GAPS -> EXTEND EXISTING SUBJECTS (Auto-fill)
    existing_pos = {(s.day, s.period) for s in schedule}
    empty_slots = []
    for d in DAYS:
        for p in range(1, PERIODS + 1):
            if (d, p) not in existing_pos:
                empty_slots.append((d, p))
    
    # Shuffle empty slots to distribute fillers randomly
    random.shuffle(empty_slots)
    
    if theory_subjects:
        # Round-robin assign existing theory subjects to empty slots
        subj_idx = 0
        for (d, p) in empty_slots:
            # Pick a subject
            sub = theory_subjects[subj_idx % len(theory_subjects)]
            subj_idx += 1
            
            sub_code = sub['code']
            fac_ids = allocation_map.get(sub_code) or sub.get('faculty_ids') or []
            if isinstance(fac_ids, str): fac_ids = [fac_ids]
            fac_name = await get_faculty_name(fac_ids)
            
            # Try to start it here (find room, check fac)
            # Since this is filler/padding, we try our best. 
            # If faculty is busy, we skip to next subject? 
            # For simplicity, let's try to fit ANY subject.
            
            scheduled_filler = False
            start_idx = subj_idx # constraint to avoid infinite loop
            
            # rapid try for any subject
            for _ in range(len(theory_subjects)):
                candidate = theory_subjects[subj_idx % len(theory_subjects)]
                c_fac_ids = allocation_map.get(candidate['code']) or candidate.get('faculty_ids') or []
                if isinstance(c_fac_ids, str): c_fac_ids = [c_fac_ids]
                
                # Check conflicts
                can_fill = True
                if c_fac_ids:
                    for fid in c_fac_ids:
                        if fid in faculty_busy[d][p]:
                             can_fill = False
                             break
                if not can_fill:
                     subj_idx += 1
                     continue
                
                # Find room
                room_found = None
                for r in rooms:
                    if r['room_no'] not in room_busy[d][p]:
                        room_found = r['room_no']
                        break
                
                if room_found:
                    c_fac_name = await get_faculty_name(c_fac_ids)
                    schedule.append(TimetableSlot(
                        day=d, period=p, subject=candidate['name'], subject_code=candidate['code'],
                        acronym=candidate.get('acronym'),
                        faculty=c_fac_name, faculty_ids=c_fac_ids or [],
                        room=room_found, type=candidate['type']
                    ))
                    if c_fac_ids:
                        for fid in c_fac_ids:
                            faculty_busy[d][p].add(fid)
                    room_busy[d][p].add(room_found)
                    scheduled_filler = True
                    subj_idx += 1 # rotate
                    break
                
                subj_idx += 1
            
            if not scheduled_filler:
                # If cannot fill with subject (all busy), fallback to Self Study
                schedule.append(TimetableSlot(
                    day=d, period=p, subject="Self Study", subject_code="STUDY",
                    faculty="TBA", faculty_id=None, room="Classroom", type="Theory"
                ))

    # 9. Schedule Saturday as Mentor Hour (All Periods)
    # 9. Schedule Saturday: Now handled as a regular day


    # 4. Save to DB
    timetable_doc = {
        "department_code": request.department_code,
        "year": request.year,
        "semester": request.semester,
        "class_name": request.class_name,
        "schedule": [s.dict() for s in schedule],
        "created_at": "now"
    }
    
    await database.timetables.update_one(
        {"department_code": request.department_code, "year": request.year, "class_name": request.class_name},
        {"$set": timetable_doc},
        upsert=True
    )

    return TimetableResponse(department=request.department_code, semester=request.semester, schedule=schedule)

@router.post("/save", response_model=TimetableResponse)
async def save_timetable(request: dict = Body(...)):
    # Simple endpoint to directly save a manually edited timetable
    # Validation could be added here similar to generate_timetable
    doc = {
        "department_code": request.get("department_code"),
        "year": request.get("year"),
        "semester": request.get("semester"),
        "class_name": request.get("class_name"),
        "schedule": request.get("schedule"),
        "updated_at": "now"
    }
    await database.timetables.update_one(
        {"department_code": doc["department_code"], "year": doc["year"], "class_name": doc["class_name"]},
        {"$set": doc},
        upsert=True
    )
    return TimetableResponse(
        department=doc["department_code"], semester=doc["semester"],
        schedule=[TimetableSlot(**s) for s in doc["schedule"]]
    )

@router.get("/timetable", response_model=TimetableResponse)
async def get_timetable(department_code: str, semester: int, year: Optional[int] = None, class_name: Optional[str] = None):
    query = {"department_code": department_code}
    if semester: query["semester"] = semester
    if year: query["year"] = year
    if class_name: query["class_name"] = class_name

    doc = await database.timetables.find_one(query)
    if not doc:
        return TimetableResponse(department=department_code, semester=semester or 0, schedule=[])
        
    return TimetableResponse(
        department=doc["department_code"],
        semester=doc.get("semester", 0),
        schedule=[TimetableSlot(**s) for s in doc["schedule"]]
    )
