from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from database import supabase

router = APIRouter()
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login")

class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginBody(BaseModel):
    email: EmailStr
    password: str

@router.post("/register")
async def register(body: RegisterBody):
    try:
        res = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {"name": body.name}}
        })
        if res.user is None:
            raise HTTPException(400, "Registrasi gagal")
        return {"message": "Registrasi berhasil", "user_id": res.user.id}
    except Exception as e:
        raise HTTPException(400, str(e))

@router.post("/login")
async def login(body: LoginBody):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password
        })
        if res.user is None:
            raise HTTPException(401, "Email atau password salah")
        return {
            "access_token": res.session.access_token,
            "token_type": "bearer",
            "user": {
                "id":    res.user.id,
                "email": res.user.email,
                "name":  res.user.user_metadata.get("name", "")
            }
        }
    except Exception as e:
        raise HTTPException(401, "Email atau password salah")

async def get_current_user(token: str = Depends(oauth2)):
    try:
        res = supabase.auth.get_user(token)
        return res.user
    except:
        raise HTTPException(401, "Token tidak valid atau expired")