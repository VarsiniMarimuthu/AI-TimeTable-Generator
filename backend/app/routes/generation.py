from fastapi import APIRouter, Body, HTTPException
from typing import List, Optional
from app.database import database, common_helper
from app.models import GenerateRequest, TimetableResponse, TimetableSlot
from bson import ObjectId
import random
from datetime import datetime, timedelta, timezone

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

    async def can_schedule_block(day, start_period, block_size, fac_ids, room_no):
         if start_period + block_size - 1 > PERIODS: return False
         periods_in_block = list(range(start_period, start_period + block_size))
         # Allow breakfast/morning blocks (2-3)
         # Only block Lunch (4-5)
         if 4 in periods_in_block and 5 in periods_in_block: return False
         for p in periods_in_block:
             if fac_ids:
                 # Check each faculty ID in the list
                 if isinstance(fac_ids, str): fac_ids = [fac_ids]
                 for fid in fac_ids:
                    if fid in faculty_busy[day][p]: return False
             if room_no in room_busy[day][p]: return False
         return True
    
    def generate_acronym(name):
        if not name: return "???"
        # Handle "Project Work Phase I" -> "PW-I"
        if "Project Work" in name:
            if "Phase I" in name: return "PW-I"
            if "Phase II" in name: return "PW-II"
        # Common pattern: take first letter of each word
        words = name.split()
        if len(words) == 1:
            return words[0][:4].upper()
        return "".join(word[0].upper() for word in words if word[0].isalnum())

    def schedule_block(day, start_period, block_size, sub, fac_ids, fac_name, room_no):
        sub_acronym = sub.get('acronym') or generate_acronym(sub['name'])
        for i in range(block_size):
            p = start_period + i
            if isinstance(fac_ids, str): fac_ids = [fac_ids]
            slot_entry = TimetableSlot(
                day=day, period=p, subject=sub['name'], subject_code=sub['code'],
                acronym=sub_acronym,
                faculty=fac_name, faculty_ids=fac_ids or [],
                room=room_no, type=sub['type']
            )
            schedule.append(slot_entry)
            if fac_ids:
                for fid in fac_ids:
                   faculty_busy[day][p].add(fid)
            room_busy[day][p].add(room_no)

    # 4. Separate subjects and Schedule Labs/Theory (Keep existing logic)
    # 4. Separate subjects (Open Electives, Labs, Skill/Library, Project, Theory)
    open_electives = [s for s in subjects if s.get('type') == 'Open Elective']
    lab_subjects = [s for s in subjects if s['type'] == 'Lab']
    
    # Project Work classification
    project_types = ['Project Work', 'Project', 'PW-I', 'PW-II', 'Main Project', 'Project Phase']
    project_subjects = [s for s in subjects if s.get('type') in project_types or 'Project' in s.get('name', '')]
    
    # Skill Development
    skill_types = ['Library/Skill Development', 'Skill Development', 'Mini Project', 'GSD', 'Career Skill Development']
    skill_subjects = [s for s in subjects if s.get('type') in skill_types or 'Skill Development' in s.get('type', '')]
    skill_subjects = [s for s in skill_subjects if s not in project_subjects]
    
    theory_subjects = [s for s in subjects if s['type'] not in ['Lab', 'Open Elective'] and s not in skill_subjects and s not in project_subjects]
    
    # 5. Schedule OPEN ELECTIVES
    for oe in open_electives:
        weekly_hours = oe.get('weekly_hours', 3)
        sub_code = oe['code']
        fac_ids = allocation_map.get(sub_code) or oe.get('faculty_ids') or []
        if isinstance(fac_ids, str): fac_ids = [fac_ids]
        fac_name = await get_faculty_name(fac_ids)
        
        # YEAR 2, 3 & 4 (S7) SPECIFIC PATTERN
        if int(request.year) in [2, 3] or (int(request.year) == 4 and int(request.semester) == 7):
            # OE at Monday(1-2) and Wednesday(3)
            # Try to place 2 hours on Monday(1-2)
            if weekly_hours >= 2:
                if await can_schedule_block("Monday", 1, 2, fac_ids, oe.get('room_no') or rooms[0]['room_no']):
                    schedule_block("Monday", 1, 2, oe, fac_ids, fac_name, oe.get('room_no') or rooms[0]['room_no'])
                    # Try to place remaining 1 hour on Wednesday(3)
                    if weekly_hours > 2:
                        if await can_schedule_block("Wednesday", 3, 1, fac_ids, oe.get('room_no') or rooms[0]['room_no']):
                            schedule_block("Wednesday", 3, 1, oe, fac_ids, fac_name, oe.get('room_no') or rooms[0]['room_no'])
                continue

        # YEAR 4+ (S8 or others) PATTERN (Priority morning 1-2, then 5-7)
        patterns = []
        if weekly_hours >= 2:
            patterns.append(2) # First block: 1-2
            if weekly_hours - 2 > 0:
                patterns.append(weekly_hours - 2) # Second block: after lunch
        else:
            patterns.append(weekly_hours)

        block_scheduled_count = 0
        attempts = 0
        preferred_days = list(DAYS)
        random.shuffle(preferred_days)

        for day in preferred_days:
            # Try to fit the whole pattern on the same day if possible
            # Block 1: Period 1, Size 2
            if patterns[0] == 2:
                if await can_schedule_block(day, 1, 2, fac_ids, oe.get('room_no') or rooms[0]['room_no']):
                    # Check if second block fits after lunch on same day
                    if len(patterns) > 1:
                        # Try periods 5, 6, or 7
                        possible_starts = [5, 6]
                        second_block_start = None
                        for ps in possible_starts:
                            if await can_schedule_block(day, ps, patterns[1], fac_ids, oe.get('room_no') or rooms[0]['room_no']):
                                second_block_start = ps
                                break
                        
                        if second_block_start:
                            # Assign both
                            schedule_block(day, 1, 2, oe, fac_ids, fac_name, oe.get('room_no') or rooms[0]['room_no'])
                            schedule_block(day, second_block_start, patterns[1], oe, fac_ids, fac_name, oe.get('room_no') or rooms[0]['room_no'])
                            block_scheduled_count = len(patterns)
                            break
                    else:
                        # Only one block
                        schedule_block(day, 1, 2, oe, fac_ids, fac_name, oe.get('room_no') or rooms[0]['room_no'])
                        block_scheduled_count = 1
                        break
            else:
                # Single hour or odd case
                if await can_schedule_block(day, 1, patterns[0], fac_ids, oe.get('room_no') or rooms[0]['room_no']):
                    schedule_block(day, 1, patterns[0], oe, fac_ids, fac_name, oe.get('room_no') or rooms[0]['room_no'])
                    block_scheduled_count = 1
                    break
        
        # Fallback if preferred pattern fails
        if block_scheduled_count < len(patterns) and attempts < 100:
            # Standard random scheduling if strict pattern fails
            pass 

    # 6. Schedule LAB subjects (Prefer 4 in morning or 3 in afternoon)
    # [Rest of scheduling code omitted for brevity as it shouldn't change, 
    # except we need to ensure we don't accidentally replace it with empty placeholder]

    # RE-INSERTING THE SCHEDULING LOGIC HERE TO BE SAFE SINCE REPLACE BLOCK IS LARGE
    for lab in lab_subjects:
        weekly_hours = lab.get('weekly_hours', 3)
        sub_code = lab['code']
        fac_ids = allocation_map.get(sub_code) or lab.get('faculty_ids') or []
        if isinstance(fac_ids, str): fac_ids = [fac_ids]
        fac_name = await get_faculty_name(fac_ids)
        
        # Requirement: 4 hours morning (1-4) or 3 hours afternoon (5-7)
        if int(request.year) == 2:
            # Year 2 always 3 hours after lunch
            possible_configs = [(5, 3)]
        elif weekly_hours == 4:
            possible_configs = [(1, 4)] 
        elif weekly_hours == 3:
            possible_configs = [(5, 3)]
        else:
            # Fallback for other hours
            if weekly_hours > 4:
                possible_configs = [(1, 4), (5, weekly_hours-4)] if weekly_hours <= 7 else [(1, 4)]
            else:
                possible_configs = [(1, weekly_hours), (5, weekly_hours)]

        block_scheduled = False
        attempts = 0
        while not block_scheduled and attempts < 100:
            attempts += 1
            # Restriction: Year 1 any day, Year 2 Tue/Wed, Year 3 Tue/Thu/Fri, Year 4 (S7) Mon/Tue/Fri
            if int(request.year) == 1:
                lab_days = DAYS
            elif int(request.year) == 2:
                lab_days = ["Tuesday", "Wednesday"]
            elif int(request.year) == 3:
                lab_days = ["Tuesday", "Thursday", "Friday"]
            elif int(request.year) == 4 and int(request.semester) == 7:
                lab_days = ["Monday", "Tuesday", "Friday"]
            else:
                lab_days = ["Wednesday", "Thursday", "Friday"]
            
            day = random.choice(lab_days)
            
            temp_allocations = []
            success_count = 0
            
            for start, size in possible_configs:
                assigned_room = lab.get('room_no')
                if assigned_room:
                    if await can_schedule_block(day, start, size, fac_ids, assigned_room):
                        temp_allocations.append((day, start, size, assigned_room))
                        success_count += 1
                else:
                    for room in rooms:
                        if await can_schedule_block(day, start, size, fac_ids, room['room_no']):
                            temp_allocations.append((day, start, size, room['room_no']))
                            success_count += 1
                            break
            
            if success_count == len(possible_configs):
                for d, s, sz, r in temp_allocations:
                    schedule_block(d, s, sz, lab, fac_ids, fac_name, r)
                block_scheduled = True

    # 6.5 Schedule SKILL DEVELOPMENT
    for skill in skill_subjects:
        sub_code = skill['code']
        fac_ids = allocation_map.get(sub_code) or skill.get('faculty_ids') or []
        if isinstance(fac_ids, str): fac_ids = [fac_ids]
        fac_name = await get_faculty_name(fac_ids)
        
        block_scheduled = False
        attempts = 0
        while not block_scheduled and attempts < 100:
            attempts += 1
            
            # Pattern from Image (Year 2): Wednesday (1-2)
            if int(request.year) == 2:
                if await can_schedule_block("Wednesday", 1, 2, fac_ids, skill.get('room_no') or rooms[0]['room_no']):
                    schedule_block("Wednesday", 1, 2, skill, fac_ids, fac_name, skill.get('room_no') or rooms[0]['room_no'])
                    block_scheduled = True
                break # Only one attempt for fixed slot
            
            # Pattern from Image (Year 3): Wednesday (6-7)
            if int(request.year) == 3:
                if await can_schedule_block("Wednesday", 6, 2, fac_ids, skill.get('room_no') or rooms[0]['room_no']):
                    schedule_block("Wednesday", 6, 2, skill, fac_ids, fac_name, skill.get('room_no') or rooms[0]['room_no'])
                    block_scheduled = True
                break # Only one attempt for fixed slot

            # General/Year 1 patterns
            day = random.choice(DAYS)
            possible_starts = [3, 6] 
            random.shuffle(possible_starts)
            
            for start in possible_starts:
                assigned_room = skill.get('room_no')
                selected_room = assigned_room
                if not selected_room:
                    for r in rooms:
                        if await can_schedule_block(day, start, 2, fac_ids, r['room_no']):
                            selected_room = r['room_no']
                            break
                
                if selected_room and await can_schedule_block(day, start, 2, fac_ids, selected_room):
                    schedule_block(day, start, 2, skill, fac_ids, fac_name, selected_room)
                    block_scheduled = True
                    break

    # 6.6 Schedule PROJECT WORK (Year 4)
    for proj in project_subjects:
        weekly_hours = proj.get('weekly_hours', 12) # Often high hours for project
        sub_code = proj['code']
        fac_ids = allocation_map.get(sub_code) or proj.get('faculty_ids') or []
        if isinstance(fac_ids, str): fac_ids = [fac_ids]
        fac_name = await get_faculty_name(fac_ids)
        
        assigned_room = proj.get('room_no')
        
        # YEAR 4 SEMESTER 8: Strict Afternoon Split
        if int(request.year) == 4 and int(request.semester) == 8:
            # Project always periods 5-7 every day
            for day in DAYS:
                selected_room = assigned_room or (rooms[0]['room_no'] if rooms else "Main Project Hall")
                if await can_schedule_block(day, 5, 3, fac_ids, selected_room):
                    schedule_block(day, 5, 3, proj, fac_ids, fac_name, selected_room)
            continue

        # YEAR 4 SEMESTER 7: Block Scheduling for PW-I
        if int(request.year) == 4 and int(request.semester) == 7:
            # Pattern from image (Approximate for generator stability): 
            # Blocks: Thu(3-4), Fri(5-7) + individual slots
            blocks = [("Thursday", 3, 2), ("Friday", 5, 3), ("Wednesday", 4, 1), ("Wednesday", 7, 1), ("Friday", 4, 1)]
            for day, start, size in blocks:
                selected_room = assigned_room or (rooms[0]['room_no'] if rooms else "Project Lab")
                if await can_schedule_block(day, start, size, fac_ids, selected_room):
                    schedule_block(day, start, size, proj, fac_ids, fac_name, selected_room)
            continue

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
            
            # YEAR 4 SEMESTER 8: Only morning for theory
            if int(request.year) == 4 and int(request.semester) == 8:
                if period > 4: continue

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
                sub_acronym = sub.get('acronym') or generate_acronym(sub['name'])
                slot_entry = TimetableSlot(
                    day=day, period=period, subject=sub['name'], subject_code=sub_code,
                    acronym=sub_acronym,
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
        "schedule": [s.model_dump() for s in schedule],
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

def process_substitutions(schedule: List[dict]):
    current_time = datetime.now(timezone.utc)
    for slot in schedule:
        valid_until_str = slot.get('substitute_valid_until')
        if valid_until_str:
            try:
                valid_until = datetime.fromisoformat(valid_until_str)
                if valid_until >= current_time:
                    # Safely override with substitute data if it exists
                    slot['faculty'] = slot.get('substitute_faculty', slot.get('faculty', 'TBA'))
                    slot['faculty_ids'] = slot.get('substitute_faculty_ids', slot.get('faculty_ids', []))
            except (ValueError, TypeError):
                pass
    return schedule

@router.get("/timetable", response_model=TimetableResponse)
async def get_timetable(department_code: str, semester: int, year: Optional[int] = None, class_name: Optional[str] = None):
    query = {"department_code": department_code}
    if semester: query["semester"] = semester
    if year: query["year"] = year
    if class_name: query["class_name"] = class_name

    doc = await database.timetables.find_one(query)
    if not doc:
        return TimetableResponse(department=department_code, semester=semester or 0, schedule=[])
        
    schedule = process_substitutions(doc.get("schedule", []))
    return TimetableResponse(
        department=doc["department_code"],
        semester=doc.get("semester", 0),
        schedule=[TimetableSlot(**s) for s in schedule]
    )

@router.get("/faculty_timetable")
async def get_faculty_timetable(faculty_id: str, semester_type: Optional[str] = "ODD"):
    from bson import ObjectId
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
        schedule = process_substitutions(tt.get('schedule', []))
        for slot in schedule:
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

@router.get("/all")
async def get_all_timetables(department_code: Optional[str] = None):
    query = {}
    if department_code:
        query["department_code"] = department_code
    
    cursor = database.timetables.find(query)
    all_tts = await cursor.to_list(length=500)
    
    result = []
    for tt in all_tts:
        schedule = process_substitutions(tt.get("schedule", []))
        result.append({
            "department_code": tt.get("department_code"),
            "year": tt.get("year"),
            "semester": tt.get("semester"),
            "class_name": tt.get("class_name"),
            "schedule": [TimetableSlot(**s).model_dump() for s in schedule],
            "id": str(tt.get("_id"))
        })
    return result

@router.delete("/{id}")
async def delete_timetable(id: str):
    from bson import ObjectId
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid timetable ID format")
        
    result = await database.timetables.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found")
        
    return {"message": "Timetable deleted successfully"}

@router.post("/customize_slot")
async def customize_slot(request: dict = Body(...)):
    dept = request.get("department_code")
    year = request.get("year")
    class_name = request.get("class_name")
    day = request.get("day")
    period = request.get("period")
    new_faculty_id = request.get("new_faculty_id")
    number_of_days = request.get("number_of_days")
    
    if not all([dept, year, class_name, day, period, new_faculty_id, number_of_days]):
        raise HTTPException(status_code=400, detail="Missing required parameters")
        
    try:
        period = int(period)
        number_of_days = float(number_of_days)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid period or number_of_days type")
        
    # Get the substitute faculty details
    fac = await database.faculty.find_one({"_id": ObjectId(new_faculty_id)})
    if not fac:
        raise HTTPException(status_code=404, detail="Substitute Faculty not found")
        
    faculty_name = fac["name"]
    valid_until = (datetime.now(timezone.utc) + timedelta(days=number_of_days)).isoformat()
    
    # -----------------------------
    # User Requirement: Check if substitute faculty is already assigned in ANOTHER class 
    # at the same day + period.
    # -----------------------------
    existing_tts_cursor = database.timetables.find({})
    async for tt in existing_tts_cursor:
        tt_dept = tt.get('department_code')
        tt_year = tt.get('year')
        tt_class = tt.get('class_name')
        
        # Don't check the class we're updating against itself, wait, actually if it's the 
        # same day/period in the SAME class, we are overriding it, so that's fine.
        # Check against all timetables (if it's another class, or same class)
        # But wait, what if the faculty is ALREADY teaching this exact slot? (i.e. we are just swapping their own slot)
        # We should check if the substitute is busy in ANY class at this day and period, except if the slot they are assigned to is the one we are modifying!
        
        is_target_tt = (tt_dept == dept and int(tt_year) == int(year) and tt_class == class_name)
        
        processed_schedule = process_substitutions(tt.get('schedule', []))
        for slot in processed_schedule:
            if slot.get('day') == day and slot.get('period') == period:
                fac_ids = slot.get('faculty_ids', [])
                if new_faculty_id in fac_ids:
                    # If it's the exact same class and slot, we are just overriding, but normally the substitute 
                    # shouldn't be the same person. If it's another class, reject!
                    if not is_target_tt:
                        raise HTTPException(
                            status_code=409, 
                            detail=f"Faculty {faculty_name} is already assigned to Year {tt_year} Sec {tt_class} at Day: {day}, Period: {period}. Change rejected."
                        )

    # -----------------------------
    
    # Get the target timetable
    query = {"department_code": dept, "year": int(year), "class_name": class_name}
    doc = await database.timetables.find_one(query)
    
    if not doc:
        raise HTTPException(status_code=404, detail="Timetable not found")
        
    # Find the specific slot and update it
    schedule = doc.get("schedule", [])
    updated = False
    for slot in schedule:
        if slot.get("day") == day and slot.get("period") == period:
            slot["substitute_faculty"] = faculty_name
            slot["substitute_faculty_ids"] = [new_faculty_id]
            slot["substitute_valid_until"] = valid_until
            updated = True
            break
            
    if not updated:
        raise HTTPException(status_code=404, detail="Slot not found in the timetable")
        
    await database.timetables.update_one(
        {"_id": doc["_id"]},
        {"$set": {"schedule": schedule}}
    )
    
    return {"message": "Timetable slot customized successfully."}
