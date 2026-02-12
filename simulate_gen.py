
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.orodha_timetable

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
PERIODS = 7

async def simulate():
    print("--- SIMULATING GENERATION ---")
    
    # Payload Simulation
    req_dept = "BTECH IT"
    req_year = 1
    req_sem = 2
    req_class = "B"
    
    print(f"Config: {req_dept} {req_year} {req_class}")

    # 1. Fetch Subjects (Logic from generation.py)
    base_query = {
        "department_code": req_dept, 
        "year": req_year,
        "semester": req_sem
    }
    subjects = await db.subjects.find(base_query).to_list(200)
    print(f"Base Query Subjects: {len(subjects)}") # Expected small (Tamils etc)

    # 2. Simulate requested codes (ALL subjects for this class)
    # Fetch ALL class B subjects to simulate "Allocations"
    all_b_cursor = db.subjects.find({
        "year": req_year, "semester": req_sem, "class_name": req_class
    })
    all_b = await all_b_cursor.to_list(100)
    requested_codes = [s['code'] for s in all_b]
    print(f"Requested Codes (Simulated): {requested_codes}")

    # 3. Extras Query (The fix)
    extra_cursor = db.subjects.find({
        "code": {"$in": requested_codes},
        "$or": [
            {"class_name": req_class},
            {"class_name": {"$exists": False}}
        ]
    })
    extras = await extra_cursor.to_list(50)
    print(f"Extras Found: {len(extras)}")

    # Merge
    existing_ids = {str(s['_id']) for s in subjects}
    for e in extras:
        if str(e['_id']) not in existing_ids:
            subjects.append(e)
            
    print(f"Total Subjects to Schedule: {len(subjects)}")
    for s in subjects:
        print(f" -> {s['name']} ({s['code']}) Fac: {s.get('faculty_id')}")

    # 4. Fetch Rooms
    rooms = await db.rooms.find({}).to_list(100)
    print(f"Total Rooms: {len(rooms)}")
    for r in rooms: print(f"  R: {r['room_no']}")

    # 5. Populate Busy (Logic from generation.py)
    faculty_busy = {day: {p: set() for p in range(1, PERIODS + 1)} for day in DAYS}
    room_busy = {day: {p: set() for p in range(1, PERIODS + 1)} for day in DAYS}

    # Fetch Class A timetable
    existing_tts = await db.timetables.find({}).to_list(100)
    for tt in existing_tts:
        if tt.get('class_name') == req_class: continue
        print(f"Processing Existing TT: {tt.get('class_name')}")
        for slot in tt.get('schedule', []):
            d, p = slot.get('day'), slot.get('period')
            fid, rno = slot.get('faculty_id'), slot.get('room')
            if d in faculty_busy:
                if fid: faculty_busy[d][p].add(fid)
                if rno: room_busy[d][p].add(rno)

    # Debug Busy State
    print("Busy State (Sample Mon P1):")
    print(f"  Fac Busy: {faculty_busy['Monday'][1]}")
    print(f"  Room Busy: {room_busy['Monday'][1]}")

    # 6. Try Schedule PE-II (Example)
    pe = next((s for s in subjects if "English" in s['name']), None)
    if not pe:
        print("PE-II Not found!")
        return

    print(f"\nScheduling {pe['name']} ({pe.get('weekly_hours', 4)} hours)...")
    fac_id = pe['faculty_id']
    weekly_hours = pe.get('weekly_hours', 4)
    
    if weekly_hours == 1: block_patterns = [[1]]
    elif weekly_hours == 2: block_patterns = [[2], [1, 1]]
    elif weekly_hours == 3: block_patterns = [[2, 1], [1, 1, 1]]
    elif weekly_hours == 4: block_patterns = [[2, 2], [2, 1, 1]]
    elif weekly_hours == 5: block_patterns = [[3, 2], [2, 2, 1], [2, 1, 1, 1]]
    else:
         blocks = [2] * (weekly_hours // 2)
         if weekly_hours % 2 == 1: blocks.append(1)
         block_patterns = [blocks]
    
    hours_scheduled = 0
    
    # Minimalistic schedule logic
    for pattern in block_patterns:
        if hours_scheduled >= weekly_hours: break
        print(f"  Trying Pattern: {pattern}")
        for block_size in pattern:
            if hours_scheduled >= weekly_hours: break
            
            # Try 50 attempts
            for i in range(50):
                day = random.choice(DAYS)
                valid_starts = [p for p in range(1, PERIODS - block_size + 2) if p not in [2, 5, 8]]
                if not valid_starts: continue
                start_period = random.choice(valid_starts)
                
                # Check
                periods_in_block = list(range(start_period, start_period + block_size))
                
                # Interval check
                if 2 in periods_in_block and 3 in periods_in_block: continue # Interval
                if 4 in periods_in_block and 5 in periods_in_block: continue # Lunch

                # Busy check
                fail_reason = ""
                can = True
                
                # Room check
                selected_room = None
                for r in rooms:
                    r_ok = True
                    for p in periods_in_block:
                        if r['room_no'] in room_busy[day][p]: 
                            r_ok = False
                            break
                    if r_ok:
                        selected_room = r['room_no']
                        break
                
                if not selected_room:
                    fail_reason = "No Rooms Free"
                    can = False
                
                if can and fac_id:
                    for p in periods_in_block:
                        if fac_id in faculty_busy[day][p]:
                            fail_reason = f"Faculty Busy ({fac_id})"
                            can = False
                            break
                
                if can:
                    print(f"    SUCCESS! {day} P{start_period}, Room: {selected_room}")
                    hours_scheduled += block_size
                    break
                else:
                    if i < 2: # Print first few fails
                        print(f"    Fail {day} P{start_period}: {fail_reason}")

    if hours_scheduled < weekly_hours:
        print(f"FAILED to schedule all hours. Only {hours_scheduled}/4")

if __name__ == "__main__":
    asyncio.run(simulate())
