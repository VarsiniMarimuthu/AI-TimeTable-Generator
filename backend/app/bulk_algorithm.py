from typing import List, Dict, Optional
import random

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
SLOTS_PER_DAY = 7  # Periods 1 to 7

class BulkTimetableCSP:
    def __init__(self, courses: List[dict], faculty_list: List[dict], rooms_list: List[dict]):
        self.courses = courses
        self.faculty = {f["_id"]: f for f in faculty_list}
        self.rooms = {r["room_no"]: r for r in rooms_list}
        
        # State
        # schedule[day][slot] = { "dept_year_sem_sec": course_obj }
        self.timetable = {day: [{} for _ in range(SLOTS_PER_DAY)] for day in DAYS}
        
        # Tracking for constraints
        self.faculty_occupied = {f["_id"]: {d: [False]*SLOTS_PER_DAY for d in DAYS} for f in faculty_list}
        self.room_occupied = {r["room_no"]: {d: [False]*SLOTS_PER_DAY for d in DAYS} for r in rooms_list}
        
        # Track daily subject assignment to prevent 2 theory classes of same subject in one day
        self.daily_subject_tracking = {} # group_key -> {day -> set(subject_code)}

        # Load limits per week
        self.faculty_load = {f["_id"]: 0 for f in faculty_list}
        self.faculty_max_load = {f["_id"]: f.get("max_load_per_week", 15) for f in faculty_list}

        self.class_queue = self._prepare_class_queue()
        
    def _get_group_key(self, course):
        return f"{course.get('department_code', 'ALL')}_{course.get('year')}_{course.get('semester')}_{course.get('section', 'A')}"

    def _prepare_class_queue(self):
        queue = []
        for course in self.courses:
            count = course.get("weekly_hours", 3)
            is_lab = course.get("type") == "Lab"
            is_project = course.get("type", "") in ["Project Work", "Project", "PW-I", "PW-II", "Main Project", "Project Phase"]
            
            # Setup daily tracker for this class
            group_key = self._get_group_key(course)
            if group_key not in self.daily_subject_tracking:
                self.daily_subject_tracking[group_key] = {d: set() for d in DAYS}

            faculty_ids = course.get("faculty_ids") or ([] if not course.get("faculty_id") else [course["faculty_id"]])
            faculty_ids = [str(f) for f in faculty_ids]

            # Block size logic
            if is_lab:
                # Labs usually take 2 or 3 slots
                if count >= 3:
                    queue.append(self._create_queue_item(course, 3, faculty_ids))
                    if count > 3:
                        queue.append(self._create_queue_item(course, count - 3, faculty_ids))
                else:
                    queue.append(self._create_queue_item(course, count, faculty_ids))
            elif is_project:
                # Group projects into blocks of 2 or 3 where possible
                remaining = count
                while remaining > 0:
                    sz = min(3, remaining)
                    if sz == 1 and remaining > 1: sz = 2
                    queue.append(self._create_queue_item(course, sz, faculty_ids))
                    remaining -= sz
            else:
                # Theory classes: 1 period each
                for i in range(count):
                    queue.append(self._create_queue_item(course, 1, faculty_ids))
        
        # Sort queue: Labs/Projects first (duration > 1) to make placement easier
        queue.sort(key=lambda x: x["duration"], reverse=True)
        return queue

    def _create_queue_item(self, course, duration, faculty_ids):
        return {
            "course_id": str(course["_id"]),
            "code": course.get("code"),
            "name": course["name"],
            "type": course.get("type", "Theory"),
            "department_code": course.get("department_code"),
            "year": course.get("year"),
            "semester": course.get("semester"),
            "section": course.get("class_name", "A"),
            "faculty_ids": faculty_ids,
            "duration": duration,
            "assigned_room": course.get("room_no")
        }

    def is_safe(self, class_obj, day, slot_idx, room_no):
        duration = class_obj["duration"]
        
        # 1. Check bounds
        if slot_idx + duration > SLOTS_PER_DAY: 
            return False
            
        group_key = f"{class_obj['department_code']}_{class_obj['year']}_{class_obj['semester']}_{class_obj['section']}"

        # 2. Check Student Availability (Section Collision)
        for i in range(duration):
            if group_key in self.timetable[day][slot_idx + i]:
                return False

        # 3. Check Same Subject not twice in a day (for theory)
        if class_obj["type"] not in ["Lab", "Project Work"] and class_obj["code"] in self.daily_subject_tracking[group_key][day]:
            return False

        # 4. Check Faculty Availability & Load
        fac_ids = class_obj["faculty_ids"]
        for fid in fac_ids:
            if self.faculty_load[fid] + duration > self.faculty_max_load[fid]:
                return False
            for i in range(duration):
                if self.faculty_occupied[fid][day][slot_idx + i]:
                    return False

        # 5. Check Room Availability
        if room_no:
            for i in range(duration):
                if self.room_occupied[room_no][day][slot_idx + i]:
                    return False

        return True

    def assign(self, class_obj, day, slot_idx, room_no):
        duration = class_obj["duration"]
        group_key = f"{class_obj['department_code']}_{class_obj['year']}_{class_obj['semester']}_{class_obj['section']}"

        # Assign in state
        val = {**class_obj, "room_no": room_no}
        for i in range(duration):
            self.timetable[day][slot_idx + i][group_key] = val
            for fid in class_obj["faculty_ids"]:
                self.faculty_occupied[fid][day][slot_idx + i] = True
            if room_no:
                self.room_occupied[room_no][day][slot_idx + i] = True
        
        self.daily_subject_tracking[group_key][day].add(class_obj["code"])
        for fid in class_obj["faculty_ids"]:
            self.faculty_load[fid] += duration

    def unassign(self, class_obj, day, slot_idx, room_no):
        duration = class_obj["duration"]
        group_key = f"{class_obj['department_code']}_{class_obj['year']}_{class_obj['semester']}_{class_obj['section']}"

        for i in range(duration):
            del self.timetable[day][slot_idx + i][group_key]
            for fid in class_obj["faculty_ids"]:
                self.faculty_occupied[fid][day][slot_idx + i] = False
            if room_no:
                self.room_occupied[room_no][day][slot_idx + i] = False
        
        self.daily_subject_tracking[group_key][day].remove(class_obj["code"])
        for fid in class_obj["faculty_ids"]:
            self.faculty_load[fid] -= duration

    def solve(self, index=0):
        if index >= len(self.class_queue):
            return True

        current_class = self.class_queue[index]
        
        # Shuffle days safely
        days_shuffled = list(DAYS)
        random.shuffle(days_shuffled)
        
        # Decide applicable rooms
        applicable_rooms = []
        if current_class["assigned_room"]:
            applicable_rooms = [current_class["assigned_room"]]
        else:
            applicable_rooms = [r for r in self.rooms.keys()]
            random.shuffle(applicable_rooms)
            # Add a None room as fallback if no room concept is strictly enforced, but better to enforce
            if not applicable_rooms: applicable_rooms = ["TBA Room"]

        for day in days_shuffled:
            for slot in range(SLOTS_PER_DAY):
                for room in applicable_rooms:
                    if self.is_safe(current_class, day, slot, room):
                        self.assign(current_class, day, slot, room)
                        
                        if self.solve(index + 1):
                            return True
                        
                        self.unassign(current_class, day, slot, room)

        # If we reach here, we failed for this branch
        print(f"Failed to place {current_class['name']} ({current_class['code']}) for {current_class['year']}-{current_class['section']}")
        return False

    def get_structured_schedules(self):
        """
        Converts the raw timetable state into a list of timetable objects
        (one per distinct group_key)
        """
        # Collect distinct group keys
        # Format: { "dept_year_sem_sec": [ { day, period, subject, room... } ] }
        schedules_by_group = {}
        
        for day in DAYS:
            for slot in range(SLOTS_PER_DAY):
                group_dict = self.timetable[day][slot]
                period = slot + 1
                for group_key, class_obj in group_dict.items():
                    if group_key not in schedules_by_group:
                        schedules_by_group[group_key] = []
                    
                    fac_names = []
                    for fid in class_obj["faculty_ids"]:
                        if fid in self.faculty:
                            fac_names.append(self.faculty[fid]["name"])
                    
                    schedules_by_group[group_key].append({
                        "day": day,
                        "period": period,
                        "subject": class_obj.get("name"),
                        "subject_code": class_obj.get("code"),
                        "faculty": ", ".join(fac_names) if fac_names else "TBA",
                        "faculty_ids": class_obj.get("faculty_ids"),
                        "room": class_obj.get("room_no") or "TBA",
                        "type": class_obj.get("type")
                    })
        
        return schedules_by_group

def generate_bulk_timetable_logic(courses, faculty, rooms):
    solver = BulkTimetableCSP(courses, faculty, rooms)
    success = solver.solve()
    if success:
        return {"status": "success", "schedules": solver.get_structured_schedules()}
    else:
        # Partial result
        return {"status": "partial", "schedules": solver.get_structured_schedules()}
