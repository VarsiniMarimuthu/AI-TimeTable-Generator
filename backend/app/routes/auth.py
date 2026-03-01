from fastapi import APIRouter, Body, HTTPException
from app.database import database
from app.models import UserSchema
from pydantic import BaseModel

router = APIRouter()

class LoginModel(BaseModel):
    username: str
    password: str

@router.post("/register")
async def register(user: UserSchema = Body(...)):
    user_data = user.model_dump()
    
    # Check if user exists
    existing_user = await database.users.find_one({"username": user_data["username"]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = await database.users.insert_one(user_data)
    return {"message": "User registered successfully", "id": str(new_user.inserted_id)}

@router.post("/login")
async def login(details: LoginModel = Body(...)):
    user = await database.users.find_one({"username": details.username, "password": details.password})
    
    if user:
        return {
            "status": "success",
            "role": user.get("role", "admin"),
            "username": user["username"],
            "message": "Login successful"
        }
    
    raise HTTPException(status_code=401, detail="Invalid Credentials")
