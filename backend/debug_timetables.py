import asyncio
import os
import sys
from datetime import datetime, timezone

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import database
from app.routes.generation import process_substitutions
from app.models import TimetableSlot

async def debug_load():
    try:
        cursor = database.timetables.find({})
        all_tts = await cursor.to_list(length=500)
        print(f"Found {len(all_tts)} timetables")
        
        for tt in all_tts:
            dept = tt.get('department_code')
            year = tt.get('year')
            cls = tt.get('class_name')
            print(f"Checking {dept} Y{year} {cls}")
            
            schedule = tt.get("schedule", [])
            # simulate process_substitutions
            try:
                processed = process_substitutions(list(schedule))
            except Exception as e:
                print(f"Error in process_substitutions for {dept} Y{year} {cls}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
                
            for i, s in enumerate(processed):
                try:
                    TimetableSlot(**s)
                except Exception as e:
                    print(f"Validation Error in slot {i} of {dept} Y{year} {cls}:")
                    print(f"Slot data: {s}")
                    print(f"Error: {e}")
                    
        print("Done debugging.")
        
    except Exception as e:
        print(f"Global error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_load())
