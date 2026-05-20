from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from database import supabase
from scraper.tv_scraper import fetch_and_calculate

router = APIRouter()

@router.get("/")
async def get_all_stocks():
    """List semua saham yang sudah ada di database"""
    res = (supabase.table("stocks")
           .select("ticker, company_name, sector, overall_score, price, market_cap, last_updated")
           .order("overall_score", desc=True)
           .execute())
    return res.data

@router.get("/search")
async def search_stocks(q: str = Query(min_length=1, max_length=50)):
    """Cari saham by ticker atau nama perusahaan"""
    q_lower = q.lower()
    
    # Search by ticker
    res_ticker = (supabase.table("stocks")
                  .select("ticker, company_name, sector, overall_score")
                  .ilike("ticker", f"{q_lower}%")
                  .limit(10)
                  .execute())
    
    # Search by company name
    res_company = (supabase.table("stocks")
                   .select("ticker, company_name, sector, overall_score")
                   .ilike("company_name", f"%{q_lower}%")
                   .limit(10)
                   .execute())
    
    # Merge and deduplicate
    seen = {r["ticker"] for r in res_ticker.data}
    combined = res_ticker.data + [r for r in res_company.data if r["ticker"] not in seen]
    return combined[:10]

@router.get("/{ticker}")
async def get_stock(ticker: str, background_tasks: BackgroundTasks):
    """Ambil data lengkap 1 saham termasuk semua metrik & skor"""
    ticker = ticker.upper()
    res = (supabase.table("stocks")
           .select("*")
           .eq("ticker", ticker)
           .execute())

    if not res.data:
        # Data belum ada → fetch dari yfinance di background
        background_tasks.add_task(_fetch_and_save, ticker)
        raise HTTPException(404, f"Data {ticker} belum tersedia, sedang diambil... coba lagi dalam 30 detik")

    return res.data[0]

async def _fetch_and_save(ticker: str):
    """Internal: fetch yfinance lalu simpan ke Supabase"""
    data = fetch_and_calculate(ticker)
    if data:
        supabase.table("stocks").upsert(data, on_conflict="ticker").execute()

@router.post("/{ticker}/refresh")
async def refresh_stock(ticker: str, background_tasks: BackgroundTasks):
    """Force refresh data saham dari yfinance"""
    ticker = ticker.upper()
    background_tasks.add_task(_fetch_and_save, ticker)
    return {"message": f"Refresh {ticker} dimulai, data akan diupdate dalam ~30 detik"}