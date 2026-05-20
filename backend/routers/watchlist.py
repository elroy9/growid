from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from routers.auth import get_current_user

router = APIRouter()

@router.get("/")
async def get_watchlist(user=Depends(get_current_user)):
    res = (supabase.table("watchlist")
           .select("ticker, added_at, stocks(company_name, sector, overall_score, price)")
           .eq("user_id", user.id)
           .order("added_at", desc=True)
           .execute())
    return res.data

@router.post("/{ticker}")
async def add_watchlist(ticker: str, user=Depends(get_current_user)):
    try:
        supabase.table("watchlist").insert({
            "user_id": user.id,
            "ticker":  ticker.upper()
        }).execute()
        return {"message": f"{ticker} ditambahkan ke watchlist"}
    except Exception as e:
        raise HTTPException(400, "Gagal menambahkan ke watchlist atau saham sudah ada")

@router.delete("/{ticker}")
async def remove_watchlist(ticker: str, user=Depends(get_current_user)):
    supabase.table("watchlist").delete().\
        eq("user_id", user.id).eq("ticker", ticker.upper()).execute()
    return {"message": f"{ticker} dihapus dari watchlist"}