from fastapi import APIRouter
from typing import List
from app.database import database, common_helper

router = APIRouter()

@router.get("/departments", response_model=List[dict])
async def get_departments():
    """Public endpoint for students to view departments"""
    departments = []
    async for dept in database.departments.find():
        departments.append(common_helper(dept))
    return departments

@router.get("/timetable")
async def get_timetable():
    return {"message": "Public Timetable View"}
 