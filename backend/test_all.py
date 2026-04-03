import asyncio
import sys
import traceback
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    try:
        from app.database import database
        from app.models import TimetableSlot
        cursor = database.timetables.find({})
        all_tts = await cursor.to_list(length=500)
        print("Found", len(all_tts), "timetables")
        for tt in all_tts:
            schedule = tt.get('schedule', [])
            for s in schedule:
                try:
                    TimetableSlot(**s)
                except Exception as e:
                    print("Error parsing slot:", s)
                    traceback.print_exc()
        print("All parsing done")
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    import os
    os.environ["MONGO_URI"] = "mongodb+srv://admin:admin123@cluster0.abc.mongodb.net/test?retryWrites=true&w=majority"
    asyncio.run(run())
