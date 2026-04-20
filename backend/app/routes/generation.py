from fastapi import APIRouter, Body, HTTPException
from typing import List, Optional, Any
from app.database import database
from app.models import GenerateRequest, TimetableResponse, TimetableSlot, CustomizeSlotRequest
from bson import ObjectId
import random
from datetime import datetime, timedelta, timezone

router = APIRouter()

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
PERIODS = 7  # 7 teaching periods per day

def process_substitutions(schedule: List[Any]):
    current_time = datetime.now(timezone.utc)
    for slot in schedule:
        valid_until_str = slot.get('substitute_valid_until')
        if valid_until_str:
            try:
                valid_until = datetime.fromisoformat(valid_until_str.replace('Z', '+00:00'))
                if valid_until > current_time:
                    if slot.get('substitute_faculty'):
                        slot['faculty'] = slot['substitute_faculty']
                    if slot.get('substitute_faculty_ids'):
                        slot['faculty_ids'] = slot['substitute_faculty_ids']
            except (ValueError, TypeError):
                pass
    return schedule

def get_target_date(day_name):
    days_map = {day: i for i, day in enumerate(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])}
    now = datetime.now(timezone.utc)
    current_day_idx = now.weekday() # 0 is Monday
    target_day_idx = days_map.get(day_name, 0)
    
    days_ahead = target_day_idx - current_day_idx
    if days_ahead < 0: 
        days_ahead += 7
    
    return now + timedelta(days=days_ahead)

@router.post("/generate", response_model=TimetableResponse)
async def generate_timetable(request: GenerateRequest = Body(...)):
    # 1. Fetch related data
    try:
        requested_codes = [a['subject_code'] for a in request.subject_allocations if a.get('subject_code')]
        base_query = {
            "department_code": request.department_code, 
            "year": request.year,
            "semester": request.semester
        }
        
        subjects_cursor = database.subjects.find(base_query)
        year_subjects = await subjects_cursor.to_list(length=200)
        
        filtered_subjects = []
        for s in year_subjects:
            s_class = s.get('class_name')
            if not s_class or str(s_class) == str(request.class_name):
                filtered_subjects.append(s)
                
        if requested_codes:
            extra_cursor = database.subjects.find({"code": {"$in": requested_codes}})
            extras = await extra_cursor.to_list(length=50)
            existing_ids = {str(s['_id']) for s in filtered_subjects}
            for e in extras:
                if str(e['_id']) not in existing_ids:
                    e_class = e.get('class_name')
                    if not e_class or str(e_class) == str(request.class_name):
                        filtered_subjects.append(e)

        subjects = filtered_subjects
        rooms_cursor = database.rooms.find({})
        rooms = await rooms_cursor.to_list(length=100)
        random.shuffle(rooms) 
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data Fetch Error: {str(e)}")
        
    if not subjects:
        raise HTTPException(status_code=404, detail="No subjects found. Check Year, Semester, and Class.")
    
    # 2. GLOBAL Conflict Tracking
    faculty_busy = {day: {p: set() for p in range(1, PERIODS + 1)} for day in DAYS}
    room_busy = {day: {p: set() for p in range(1, PERIODS + 1)} for day in DAYS}
    
    year4_shared_room = None
    existing_tts_cursor = database.timetables.find({})
    async for tt in existing_tts_cursor:
        # CONFLICT BYPASS: Only for Year 4 Sem 8 (Priority EH combined)
        is_priority_group = (int(request.year) == 4 and int(request.semester) == 8)
        is_same_group = (str(tt.get('department_code')) == str(request.department_code) and 
                         str(tt.get('year')) == str(request.year) and 
                         str(tt.get('semester')) == str(request.semester))
                         
        if is_priority_group and is_same_group:
            if not year4_shared_room:
                for slot in tt.get('schedule', []):
                    if slot.get('room'):
                        year4_shared_room = slot.get('room')
                        break
            continue
            
        # Regular logic: Skip only if it's the EXACT same class we are generating
        if (str(tt.get('department_code')) == str(request.department_code) and 
            str(tt.get('year')) == str(request.year) and 
            str(tt.get('class_name')) == str(request.class_name)):
            continue

        raw_schedule = tt.get('schedule', [])
        active_schedule = process_substitutions(raw_schedule)
        for slot in active_schedule:
            d, p = slot.get('day'), slot.get('period')
            fids, rno = slot.get('faculty_ids', []), slot.get('room')
            if d in faculty_busy and p in faculty_busy[d]:
                if fids:
                    for fid in fids: faculty_busy[d][p].add(fid)
                if rno: room_busy[d][p].add(rno)

    # Helper Functions
    async def get_faculty_name(fids):
        if not fids: return "TBA"
        if isinstance(fids, str): fids = [fids]
        names = []
        for fid in fids:
            try:
                fac = await database.faculty.find_one({"_id": ObjectId(fid)})
                if fac: names.append(fac['name'])
            except: continue
        return ", ".join(names) if names else "Unknown"

    async def can_schedule_block(day, start_p, size, fids, room_no, is_lab=False, is_tutorial=False):
        if start_p + size - 1 > PERIODS: return False
        periods = list(range(start_p, start_p + size))
        if 4 in periods and 5 in periods: return False 
        for p in periods:
            for s in schedule:
                if s.day == day and s.period == p: return False
            if fids:
                if isinstance(fids, str): fids = [fids]
                # RELAXATION: For labs AND tutorials with multiple faculty, only primary must be free
                is_relaxable = is_lab or is_tutorial
                check_fids = [fids[0]] if (is_relaxable and len(fids) > 1) else fids
                for fid in check_fids:
                     if fid in faculty_busy[day][p]: return False
            if room_no and room_no in room_busy[day][p]: return False
        return True

    async def find_room_for_block(day, start, size, fids, preferred=None, is_lab=False, is_tutorial=False):
        if preferred and await can_schedule_block(day, start, size, fids, preferred, is_lab=is_lab, is_tutorial=is_tutorial):
            return preferred
        for r in rooms:
            room_type = str(r.get('type', '')).upper()
            is_room_lab = 'LAB' in room_type or 'LAB' in str(r.get('room_no', '')).upper()
            # If Classroom, avoid Labs. If Lab, avoid Classrooms.
            # EXCEPTION: For Tutorials (is_tutorial=True), allow ANY room at the end if Classroom is busy.
            if is_lab and not is_room_lab: continue
            if (not is_lab and is_room_lab) and not is_tutorial: continue
            
            if await can_schedule_block(day, start, size, fids, r['room_no'], is_lab=is_lab, is_tutorial=is_tutorial):
                return r['room_no']
        return None

    def generate_acronym(name):
        if not name: return "???"
        if "Project Work" in name: return "PW-I" if "Phase I" in name else "PW-II"
        words = name.split()
        if len(words) == 1: return words[0][:4].upper()
        acr = "".join(w[0].upper() for w in words if w.lower() not in {'and', 'of', 'for', 'in', 'the', 'to', 'a', '&'} and w[0].isalnum())
        return acr

    def schedule_block(day, start, size, sub, fids, f_name, room):
        acronym = sub.get('acronym') or generate_acronym(sub['name'])
        if acronym.lower() == 'mh' or 'Mentor Hour' in sub['name']: acronym = 'MH'
        for i in range(size):
            p = start + i
            slot = TimetableSlot(
                day=day, period=p, subject=sub['name'], subject_code=sub['code'],
                acronym=acronym, faculty=f_name, faculty_ids=fids if isinstance(fids, list) else [fids],
                room=room, type=sub['type']
            )
            schedule.append(slot)
            if fids:
                for fid in (fids if isinstance(fids, list) else [fids]): faculty_busy[day][p].add(fid)
            if room:
                room_busy[day][p].add(room)

    def parse_hours(val):
        if not val: return 0, 0
        if isinstance(val, str) and '+' in val:
            parts = val.split('+')
            try: 
                return int(parts[0].strip()), int(parts[1].strip())
            except: pass
        try: return int(float(str(val))), 0
        except: return 0, 0

    schedule: List[TimetableSlot] = []
    allocation_map = {item['subject_code']: item.get('faculty_ids', []) for item in request.subject_allocations}
    
    # 3. Separate subjects
    open_electives = [s for s in subjects if s.get('type') == 'Open Elective']
    lab_subjects = [s for s in subjects if 'LAB' in (s.get('type') or '').upper() or 'LABORATORY' in (s.get('name') or '').upper()]
    project_types = ['Project Work', 'Project', 'PW-I', 'PW-II', 'Main Project', 'Internship']
    project_subjects = [s for s in subjects if (s.get('type') in project_types or 'Project' in s.get('name', '') or 'PW' in s.get('code', '') or 'Internship' in s.get('name', ''))]
    skill_types = ['Library/Skill Development', 'Skill Development', 'Mini Project', 'GSD', 'Career Skill Development', 'Research Skill Development', 'Research Skill']
    skill_subjects = [s for s in subjects if (s.get('type') in skill_types or 'Skill Development' in s.get('type', '') or 'Research Skill' in s.get('name', '') or s.get('code') == 'MH' or 'Mentor Hour' in s.get('name', ''))]
    skill_subjects = [s for s in skill_subjects if s not in project_subjects and s not in lab_subjects]
    theory_subjects = [s for s in subjects if s['type'] not in ['Open Elective'] and s not in lab_subjects and s not in skill_subjects and s not in project_subjects]

    # 4. ABSOLUTE PRIORITY: Year 4 Semester 8
    if int(request.year) == 4 and int(request.semester) == 8:
        eh_sub = next((s for s in theory_subjects if s.get('acronym') == 'EH' or 'Ethical Hacking' in s.get('name', '')), None)
        pw_sub = next((s for s in project_subjects if s.get('code') == 'PW-II' or 'Project Work' in s.get('name', '')), None)
        mh_sub = next((s for s in skill_subjects if s.get('code') == 'MH' or 'Mentor Hour' in s.get('name', '')), None)

        if eh_sub and pw_sub:
            room_pref = year4_shared_room or eh_sub.get('room_no') or pw_sub.get('room_no') or "I-202"
            for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
                facs_eh = allocation_map.get(eh_sub['code']) or eh_sub.get('faculty_ids') or []
                name_eh = await get_faculty_name(facs_eh)
                r_eh = await find_room_for_block(d, 1, 4, facs_eh, room_pref)
                schedule_block(d, 1, 4, eh_sub, facs_eh, name_eh, r_eh or room_pref)
                facs_pw = allocation_map.get(pw_sub['code']) or pw_sub.get('faculty_ids') or []
                name_pw = await get_faculty_name(facs_pw)
                r_pw = await find_room_for_block(d, 5, 3, facs_pw, room_pref)
                schedule_block(d, 5, 3, pw_sub, facs_pw, name_pw, r_pw or room_pref)
            
            facs_pw = allocation_map.get(pw_sub['code']) or pw_sub.get('faculty_ids') or []
            name_pw = await get_faculty_name(facs_pw)
            schedule_block("Saturday", 1, 3, pw_sub, facs_pw, name_pw, (await find_room_for_block("Saturday", 1, 3, facs_pw, room_pref)) or room_pref)
            if mh_sub:
                facs_mh = allocation_map.get(mh_sub['code']) or mh_sub.get('faculty_ids') or []
                name_mh = await get_faculty_name(facs_mh)
                schedule_block("Saturday", 4, 1, mh_sub, facs_mh, name_mh, (await find_room_for_block("Saturday", 4, 1, facs_mh, room_pref)) or room_pref)
                schedule_block("Saturday", 7, 1, mh_sub, facs_mh, name_mh, (await find_room_for_block("Saturday", 7, 1, facs_mh, room_pref)) or room_pref)
            schedule_block("Saturday", 5, 2, pw_sub, facs_pw, name_pw, (await find_room_for_block("Saturday", 5, 2, facs_pw, room_pref)) or room_pref)

            if eh_sub in theory_subjects: theory_subjects.remove(eh_sub)
            if pw_sub in project_subjects: project_subjects.remove(pw_sub)
            if mh_sub in skill_subjects: skill_subjects.remove(mh_sub)

    # 5. Labs (Priority scheduling for DBMS Laboratory etc.)
    for lab in lab_subjects:
        sub_code = lab['code']
        facs = allocation_map.get(sub_code) or lab.get('faculty_ids') or []
        name = await get_faculty_name(facs)
        assigned_h = 0
        # Correctly identify DBMS Lab and ensure 4-hour block if defined
        target_h = 4 if ('DBMS' in sub_code or 'DBMS' in lab['name'].upper()) else int(lab.get('weekly_hours', 3))
        
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        random.shuffle(days)
        # Class B prefers afternoon (5, 3), Class A prefers morning (1, 4)
        pref_configs = [(1, 4), (5, 3)] if request.class_name == "A" else [(5, 3), (1, 4)]
        
        # FIRST PASS: Try to find a single CONTIGUOUS block of target_h (usually 4)
        for d in days:
            if assigned_h >= target_h: break
            if any(s.day == d and 'LAB' in (s.type or '').upper() for s in schedule): continue
            
            for start, size in [(1, 4), (5, 3)]:
                if d == "Monday" and start == 1: continue 
                if size < target_h: continue # Only try full blocks in first pass
                
                r = await find_room_for_block(d, start, target_h, facs, lab.get('room_no'), is_lab=True)
                if r:
                    schedule_block(d, start, target_h, lab, facs, name, r)
                    assigned_h += target_h
                    break
        
        # SECOND PASS: If not found, try preferred config sizes (splitting if necessary)
        if assigned_h < target_h:
            for d in days:
                if assigned_h >= target_h: break
                if any(s.day == d and 'LAB' in (s.type or '').upper() for s in schedule): continue
                
                for start, size in pref_configs:
                    if d == "Monday" and start == 1: continue 
                    needed = min(size, target_h - assigned_h)
                    r = await find_room_for_block(d, start, needed, facs, lab.get('room_no'), is_lab=True)
                    if r:
                        schedule_block(d, start, needed, lab, facs, name, r)
                        assigned_h += needed
                        break

    # 6. Mentor Hour Fallback
    for mh in [s for s in skill_subjects if s.get('code') == 'MH' or 'Mentor Hour' in s.get('name', '')]:
        facs = allocation_map.get(mh['code']) or mh.get('faculty_ids') or []
        name = await get_faculty_name(facs)
        r4 = await find_room_for_block("Saturday", 4, 1, facs, mh.get('room_no'))
        if r4: schedule_block("Saturday", 4, 1, mh, facs, name, r4)
        r7 = await find_room_for_block("Saturday", 7, 1, facs, mh.get('room_no'))
        if r7: schedule_block("Saturday", 7, 1, mh, facs, name, r7)
        if mh in skill_subjects: skill_subjects.remove(mh)

    # 7. Open Electives
    for oe in open_electives:
        facs = allocation_map.get(oe['code']) or oe.get('faculty_ids') or []
        name = await get_faculty_name(facs)
        # Fixed institutional slots
        if int(request.year) in [2, 3] or (int(request.year) == 4 and int(request.semester) == 7):
            r1 = await find_room_for_block("Monday", 1, 2, facs, oe.get('room_no'))
            if r1: 
                schedule_block("Monday", 1, 2, oe, facs, name, r1)
                r2 = await find_room_for_block("Wednesday", 3, 1, facs, oe.get('room_no'))
                if r2: schedule_block("Wednesday", 3, 1, oe, facs, name, r2)
                continue

    # 8. Skill Development (Fixed NPTEL duplicate)
    nptel_scheduled = False
    for skill in skill_subjects:
        s_code = skill.get('code', '').upper()
        s_name = skill.get('name', '').upper()
        
        # NPTEL/TT strict 1-hour cap
        is_nptel = 'NPTEL' in s_name or 'TT' in s_code or 'TECHNICAL TRAINING' in s_name
        if is_nptel and nptel_scheduled: continue
        
        facs = allocation_map.get(skill['code']) or skill.get('faculty_ids') or []
        name = await get_faculty_name(facs)
        
        # Institutional Slots
        target = None
        if is_nptel:
            if int(request.year) == 2: target = ("Tuesday", 6) if request.class_name == "A" else ("Wednesday", 5)
            elif int(request.year) == 3: target = ("Tuesday", 6)
        
        if target:
            d, p = target
            r = await find_room_for_block(d, p, 1, facs, skill.get('room_no'))
            if r:
                schedule_block(d, p, 1, skill, facs, name, r)
                if is_nptel: nptel_scheduled = True
                continue

        # Fallback
        for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]:
            p_starts = [5, 6, 7, 3]
            random.shuffle(p_starts)
            for p in p_starts:
                r = await find_room_for_block(d, p, 1, facs, skill.get('room_no'))
                if r:
                    schedule_block(d, p, 1, skill, facs, name, r)
                    if is_nptel: nptel_scheduled = True
                    break
            if nptel_scheduled if is_nptel else True: break

    # 9. Theory & Tutorials
    theory_list = []
    for s in theory_subjects:
        th, tut = parse_hours(s.get('weekly_hours', 3))
        # Add Theory portion
        s_th = s.copy()
        s_th['weekly_hours'] = th
        theory_list.append(s_th)
        # Add Tutorial portion
        if tut > 0:
            s_tut = s.copy()
            s_tut['name'] = f"{s['name']} (TUT)"
            s_tut['weekly_hours'] = tut
            theory_list.append(s_tut)
    
    total_needed = sum(s.get('weekly_hours', 0) for s in theory_list)
    available_c = (len(DAYS) * PERIODS) - len(schedule)
    
    # FILL ALL REMAINING SLOTS (Remove 10 cap)
    if available_c > total_needed and theory_list:
        extra = available_c - total_needed
        # Prioritize Discrete Mathematics (TUT) for extra periods as per user request
        dm_tut = next((s for s in theory_list if '(TUT)' in s['name'] and 'Discrete' in s['name']), None)
        if not dm_tut: # Fallback to Theory if TUT not found
             dm_tut = next((s for s in theory_list if 'Discrete' in s['name']), theory_list[0])
        
        for _ in range(extra):
            if _ < 6: # Give significantly more extra hours to DM TUT specifically
                dm_tut['weekly_hours'] += 1
            else:
                theory_list[_ % len(theory_list)]['weekly_hours'] += 1

    # Global Filling Pass (To ensure 42/42)
    # 1. First Pass: Satisfy base requirements
    for s in theory_list:
        needed = s.get('weekly_hours', 0)
        count = 0
        preferred_room = s.get('room_no')
        facs = allocation_map.get(s['code']) or s.get('faculty_ids') or []
        name = await get_faculty_name(facs)
        is_tut = '(TUT)' in s['name']
        
        all_free_slots = [(d, p) for d in DAYS for p in range(1, PERIODS + 1) 
                          if not any(x.day == d and x.period == p for x in schedule)]
        random.shuffle(all_free_slots)

        for d, p in all_free_slots:
            if count >= needed: break
            # Priority 1: Preferred Room
            r = await find_room_for_block(d, p, 1, facs, preferred_room, is_tutorial=is_tut)
            if r:
                schedule_block(d, p, 1, s, facs, name, r)
                count += 1
            else:
                # Priority 2: Any Fallback Room
                r_fallback = await find_room_for_block(d, p, 1, facs, None, is_tutorial=is_tut)
                if r_fallback:
                    schedule_block(d, p, 1, s, facs, name, r_fallback)
                    count += 1
        s['scheduled_count'] = count # Tracking

    # 2. Final Gap-Filling Pass: For any remaining blanks
    all_final_blanks = [(d, p) for d in DAYS for p in range(1, PERIODS + 1) 
                        if not any(x.day == d and x.period == p for x in schedule)]
    
    if all_final_blanks:
        for d, p in all_final_blanks:
            # Try to place under-scheduled subjects first
            under_scheduled = sorted([t for t in theory_list if t.get('scheduled_count', 0) < t.get('weekly_hours', 0)], 
                                    key=lambda x: x.get('weekly_hours', 0) - x.get('scheduled_count', 0), reverse=True)
            
            filled = False
            for s in (under_scheduled + theory_list):
                facs = allocation_map.get(s['code']) or s.get('faculty_ids') or []
                is_tut = '(TUT)' in s['name']
                # AGGRESSIVE: For blanks, we ignore the 'needed' hours if we still have gaps to fill
                # But we MUST still respect Faculty Conflicts
                if await can_schedule_block(d, p, 1, facs, None, is_tutorial=is_tut):
                     r = await find_room_for_block(d, p, 1, facs, s.get('room_no'), is_tutorial=True) # TUT flag allows Labs too
                     if r:
                         name = await get_faculty_name(facs)
                         schedule_block(d, p, 1, s, facs, name, r)
                         s['scheduled_count'] = s.get('scheduled_count', 0) + 1
                         filled = True
                         break
            if not filled: # Try Library or Mentor if nothing else fits?
                 pass # Still no faculty free?
    
    # 10. Return without saving (Preview Only)
    return TimetableResponse(department=request.department_code, semester=request.semester, schedule=schedule)

@router.post("/save")
async def save_timetable(request: dict = Body(...)):
    await database.timetables.update_one(
        {"department_code": request.get("department_code"), "year": int(request.get("year")), "class_name": request.get("class_name")},
        {"$set": request}, upsert=True
    )
    return {"message": "Saved"}

@router.get("/timetable", response_model=TimetableResponse)
async def get_timetable(department_code: str, semester: int, year: Optional[int] = None, class_name: Optional[str] = None):
    query = {"department_code": department_code, "semester": int(semester)}
    if year: query["year"] = int(year)
    if class_name: query["class_name"] = class_name
    doc = await database.timetables.find_one(query)
    if not doc: return TimetableResponse(department=department_code, semester=semester, schedule=[])
    
    schedule = doc.get("schedule", [])
    active_schedule = process_substitutions(schedule)
    return TimetableResponse(department=department_code, semester=semester, schedule=[TimetableSlot(**s) for s in active_schedule])

@router.get("/all")
async def get_all_timetables(department_code: Optional[str] = None):
    query = {"department_code": department_code} if department_code else {}
    cursor = database.timetables.find(query)
    all_tts = await cursor.to_list(length=500)
    
    results = []
    for t in all_tts:
        t['schedule'] = process_substitutions(t.get('schedule', []))
        results.append({
            "department_code": t['department_code'], 
            "year": t['year'], 
            "semester": t['semester'], 
            "class_name": t['class_name'], 
            "schedule": t['schedule'], 
            "id": str(t['_id'])
        })
    return results

@router.get("/faculty_timetable")
async def get_faculty_timetable(faculty_id: str, semester_type: str = "ODD"):
    target_semesters = [1, 3, 5, 7] if semester_type == "ODD" else [2, 4, 6, 8]
    
    faculty_doc = await database.faculty.find_one({"_id": ObjectId(faculty_id)})
    faculty_name = faculty_doc.get("name") if faculty_doc else "Unknown Faculty"
    
    # 2. Get All relevant Timetables
    all_tt_cursor = database.timetables.find({"semester": {"$in": target_semesters}})
    all_tt = await all_tt_cursor.to_list(length=1000)
    
    faculty_schedule = []
    for tt_doc in all_tt:
        raw_schedule = tt_doc.get("schedule", [])
        active_schedule = process_substitutions(raw_schedule)
        
        for slot in active_schedule:
            fids = slot.get('faculty_ids') or []
            if faculty_id in fids:
                # Add metadata for the UI (Which class/semester?)
                slot["class_name"] = f"Y{tt_doc.get('year')} {tt_doc.get('class_name')} ({tt_doc.get('department_code')})"
                faculty_schedule.append(slot)
                
    return {"faculty_name": faculty_name, "schedule": faculty_schedule}

@router.post("/customize_slot")
async def customize_slot(request: CustomizeSlotRequest = Body(...)):
    # 1. Find the timetable
    tt_query = {
        "department_code": request.department_code, 
        "year": request.year, 
        "class_name": request.class_name
    }
    tt = await database.timetables.find_one(tt_query)
    if not tt: raise HTTPException(status_code=404, detail="Timetable not found for this class.")
    
    # 2. Fetch substitute faculty details
    faculty_doc = await database.faculty.find_one({"_id": ObjectId(request.new_faculty_id)})
    if not faculty_doc: raise HTTPException(status_code=404, detail="Substitute Faculty not found.")
    
    # 3. Update the specific slot
    new_schedule = tt.get("schedule", [])
    found = False
    
    # RELATIVE EXPIRY: Find the date of the next occurrence of the Day we are editing
    base_date = get_target_date(request.day)
    # Set expiry to the end of that day (plus any extra days requested)
    valid_until = (base_date + timedelta(days=request.number_of_days - 1)).replace(hour=23, minute=59, second=59, microsecond=0)
    
    for slot in new_schedule:
        if slot["day"] == request.day and slot["period"] == request.period:
            slot["substitute_faculty"] = faculty_doc["name"]
            slot["substitute_faculty_ids"] = [str(request.new_faculty_id)]
            slot["substitute_valid_until"] = valid_until.isoformat()
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail=f"Slot {request.day} P{request.period} not found in this timetable.")
    
    # 4. Save to Database
    await database.timetables.update_one(
        {"_id": tt["_id"]},
        {"$set": {"schedule": new_schedule}}
    )
    return {"message": "Slot substitution successful."}

@router.delete("/{id}")
async def delete_timetable(id: str):
    await database.timetables.delete_one({"_id": ObjectId(id)})
    return {"message": "Deleted"}