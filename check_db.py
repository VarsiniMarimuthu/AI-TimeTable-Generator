
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client.orodha_timetable

def check_db():
    print("--- CHECKING CLASS B SUBJECTS ---")
    subjects = list(db.subjects.find({"class_name": { "$in": ["B", "b"] }}))
    if not subjects:
        # Fallback if class_name is not set or diff format
        print("No subjects found with class_name='B'. Checking all and filtering...")
        all_subs = list(db.subjects.find({"year": 1, "semester": 2}))
        subjects = [s for s in all_subs if s.get("class_name") == "B"]

    print(f"Total Class B Subjects: {len(subjects)}")
    for s in subjects:
        fac = s.get('faculty_id')
        hours = s.get('weekly_hours', 0)
        print(f"[{s.get('code')}] {s.get('name')} | Hours: {hours} | Fac: {fac}")

    print("\n--- CHECKING ROOMS ---")
    rooms = list(db.rooms.find({}))
    for r in rooms:
        print(f"Room: {r.get('room_no')} ({r.get('type')})")

if __name__ == "__main__":
    check_db()
