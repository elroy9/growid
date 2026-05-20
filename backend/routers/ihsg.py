from fastapi import APIRouter
from database import supabase

router = APIRouter()

@router.get("/daily")
async def get_ihsg_daily(days: int = 30):
    """Ambil data IHSG daily untuk chart — default 30 hari"""
    try:
        res = (supabase.table("ihsg_daily")
               .select("date, open, high, low, close, volume")
               .order("date", desc=True)
               .limit(days)
               .execute())
        # Balik urutan: terlama dulu (untuk chart kiri-ke-kanan)
        return list(reversed(res.data)) if res.data else []
    except Exception as e:
        return []