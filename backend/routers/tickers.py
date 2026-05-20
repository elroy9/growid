from fastapi import APIRouter, HTTPException
from database import supabase

router = APIRouter()

@router.get("/")
async def get_tracked_tickers():
    """Ambil daftar ticker yang sedang di-track"""
    res = supabase.table("tracked_tickers").select("id, ticker, added_at").order("ticker", desc=False).execute()
    return res.data

@router.post("/{ticker}")
async def add_ticker(ticker: str):
    """Tambah ticker baru ke daftar track"""
    ticker = ticker.upper().strip()
    
    # Validasi format
    if not (2 <= len(ticker) <= 5 and ticker.isalpha()):
        raise HTTPException(400, f"Format ticker tidak valid: {ticker}")
    
    # Cek sudah ada atau belum
    res = supabase.table("tracked_tickers").select("ticker").eq("ticker", ticker).execute()
    if res.data:
        raise HTTPException(400, f"Ticker {ticker} sudah terdaftar")
    
    # Insert ticker baru
    data = {"ticker": ticker}
    supabase.table("tracked_tickers").insert(data).execute()
    return {"message": f"Ticker {ticker} ditambahkan. Scheduler akan fetch dalam update berikutnya."}

@router.delete("/{ticker}")
async def remove_ticker(ticker: str):
    """Hapus ticker dari daftar track"""
    ticker = ticker.upper().strip()
    supabase.table("tracked_tickers").delete().eq("ticker", ticker).execute()
    return {"message": f"Ticker {ticker} dihapus dari daftar track"}

@router.post("/{ticker}/fetch-now")
async def fetch_ticker_now(ticker: str):
    """Fetch ticker sekarang tanpa menunggu scheduler"""
    from scraper.tv_scraper import fetch_and_calculate
    
    ticker = ticker.upper().strip()
    try:
        data = fetch_and_calculate(ticker)
        if data:
            supabase.table("stocks").upsert(data, on_conflict="ticker").execute()
            return {"message": f"Ticker {ticker} berhasil di-fetch dan disimpan"}
        else:
            raise HTTPException(500, f"Gagal fetch {ticker} dari yfinance")
    except Exception as e:
        raise HTTPException(500, f"Error fetch {ticker}: {str(e)}")
