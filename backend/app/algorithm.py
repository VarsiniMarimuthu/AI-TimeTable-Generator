from typing import List, Dict, Optional
import random

# Constants
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
SLOTS_PER_DAY = 7  # e.g., 9-10, 10-11, 11-12, 12-1, 1-2, 2-3, 3-4
LUNCH_SLOT_INDEX = 3 # 4th slot 12-1 is lunch (Fixed)

class TimetableCSP:
    def __init__(self, courses: List[dict], faculty: List[dict]):
        self.courses = courses
        self.faculty = {f["_id"]: f for f in faculty} # Map ID to Faculty Obj
        
        # State
        # schedule[day][slot] = { "section_A": course_obj, "section_B": ... }
        self.timetable = {day: [{} for _ in range(SLOTS_PER_DAY)] for day in DAYS}
        
        # Tracking for constraints
        # faculty_occupied[faculty_id][day][slot] = True/False
        self.faculty_occupied = {f["_id"]: {d: [False]*SLOTS_PER_DAY for d in DAYS} for f in faculty}

        # Flatten courses into individual class sessions needed
        # e.g. "Math" (3 lectures) -> [Math_1, Math_2, Math_3]
        self.class_queue = self._prepare_class_queue()

    def _prepare_class_queue(self):
        queue = []
        for course in self.courses:
            # We assume course has 'lectures_per_week', 'faculty_id', 'semester', 'section'
            # If section missing, default to 'A'
            count = course.get("lectures_per_week", 3)
            is_lab = course.get("type", "Theory") == "Lab"
            
            for i in range(count):
                queue.append({
                    "course_id": str(course["_id"]),
                    "name": course["name"],
                    "faculty_ids": [str(fid) for fid in (course.get("faculty_ids") or ([course["faculty_id"]] if course.get("faculty_id") else []))],
                    "semester": course["semester"],
                    "section": course.get("section", "A"),
                    "is_lab": is_lab,
                    "duration": 2 if is_lab else 1 # Labs take 2 slots
                })
        
        # Heuristic: Sort Labs first, then others
        queue.sort(key=lambda x: x["duration"], reverse=True)
        return queue

    def is_safe(self, class_obj, day, slot_idx):
        """
        Check hard constraints.
        """
        # 1. Check bounds
        if slot_idx >= SLOTS_PER_DAY: 
            return False
        
        # 2. Check duration (for Labs)
        duration = class_obj["duration"]
        if slot_idx + duration > SLOTS_PER_DAY: 
            return False
            
        # 3. Check LUNCH collision
        # If class covers the Lunch slot (Index 3), INVALID. 
        # (Assuming Lunch is free for everyone)
        for i in range(duration):
            if (slot_idx + i) == LUNCH_SLOT_INDEX:
                return False

        # 4. Check Faculty Availability
        fac_ids = class_obj["faculty_ids"]
        for i in range(duration):
            for fid in fac_ids:
                if self.faculty_occupied[fid][day][slot_idx + i]:
                    return False

        # 5. Check Student Availability (Section Collision)
        sec = class_obj["section"]
        sem = class_obj["semester"]
        group_key = f"{sem}_{sec}"
        
        for i in range(duration):
            # Check if this group already has a class in this slot
            existing_class = self.timetable[day][slot_idx + i].get(group_key)
            if existing_class:
                return False

        return True

    def assign(self, class_obj, day, slot_idx):
        duration = class_obj["duration"]
        fac_id = class_obj["faculty_id"]
        sem = class_obj["semester"]
        sec = class_obj["section"]
        group_key = f"{sem}_{sec}"

        for i in range(duration):
            self.timetable[day][slot_idx + i][group_key] = class_obj
            for fid in class_obj["faculty_ids"]:
                self.faculty_occupied[fid][day][slot_idx + i] = True

    def unassign(self, class_obj, day, slot_idx):
        duration = class_obj["duration"]
        fac_id = class_obj["faculty_id"]
        sem = class_obj["semester"]
        sec = class_obj["section"]
        group_key = f"{sem}_{sec}"

        for i in range(duration):
            del self.timetable[day][slot_idx + i][group_key]
            for fid in class_obj["faculty_ids"]:
                self.faculty_occupied[fid][day][slot_idx + i] = False

    def solve(self, index=0):
        if index >= len(self.class_queue):
            return True

        current_class = self.class_queue[index]
        
        # Try all days and slots
        # Randomize start day to distribute load? Or deterministic? 
        # Deterministic is better for debugging.
        
        for day in DAYS:
            for slot in range(SLOTS_PER_DAY):
                if self.is_safe(current_class, day, slot):
                    self.assign(current_class, day, slot)
                    
                    if self.solve(index + 1):
                        return True
                    
                    self.unassign(current_class, day, slot) # Backtrack
        
        return False # No solution found for this branch

    def get_schedule(self):
        """Format the output for frontend"""
        return self.timetable

def generate_timetable_logic(courses, faculty):
    solver = TimetableCSP(courses, faculty)
    success = solver.solve()
    if success:
        return {"status": "success", "schedule": solver.get_schedule()}
    else:
        return {"status": "failed", "message": "Could not generate a conflict-free schedule."}
