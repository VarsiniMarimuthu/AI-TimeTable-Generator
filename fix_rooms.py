
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client.orodha_timetable

def fix_rooms_sync():
    print("--- CHECKING ROOMS (SYNC) ---")
    current_rooms = list(db.rooms.find({}))
    print(f"Current count: {len(current_rooms)}")
    existing_nos = [r['room_no'] for r in current_rooms]
    print(f"Existing: {existing_nos}")

    # Aggressive addition strategy
    required_rooms = [
        {"room_no": "Classroom B", "capacity": 60, "type": "Classroom"},
        {"room_no": "Classroom C", "capacity": 60, "type": "Classroom"},
        {"room_no": "IT Lab New", "capacity": 30, "type": "Lab"}
    ]

    added = 0
    for r in required_rooms:
        if r['room_no'] not in existing_nos:
            db.rooms.insert_one(r)
            print(f"Authorized & Added Room: {r['room_no']}")
            added += 1
    
    if added == 0:
        print("Sufficient rooms appear to exist.")
    else:
        print(f"Added {added} new rooms.")

if __name__ == "__main__":
    fix_rooms_sync()
