from apscheduler.schedulers.background import BackgroundScheduler
from scraper.tv_scraper import fetch_and_calculate, fetch_ihsg_daily
from database import supabase
import logging

logger = logging.getLogger("scheduler")

def get_tracked_tickers():
    """Baca daftar ticker dari database tabel tracked_tickers"""
    try:
        res = supabase.table("tracked_tickers").select("ticker").execute()
        return [row["ticker"] for row in res.data]
    except Exception as e:
        logger.error(f"Error baca tracked_tickers: {e}")
        # Fallback ke list default jika table tidak ada
        return [
            "ACES", "ACST", "ADES", "ADHI", "ADMG", "AGAR", "AGII", "AGRO", "AGRS", "AHAP", "AIMS", "AISA", "AKKU", "AKPI", 
            "AKSI", "ALDO", "ALKA", "ALMI", "AMAG", "AMFG", "AMIN", "AMOR", "ANDI", "ANJT", "ANTM", "APEX", "ARCI", "ARGO", 
            "ARII", "ARMY", "ARNA", "ARTI", "ASBI", "ASDM", "ASGR", "ASJT", "ASMI", "ASRI", "ASRM", "ASUR", "ATIC", "AUTO", 
            "BABP", "BACA", "BALI", "BAPA", "BATA", "BAYU", "BBCA", "BBNI", "BBRI", "BBRM", "BBSS", "BBTN", "BBYB", "BCAP", 
            "BCIC", "BDMN", "BEKS", "BEST", "BFIN", "BGTG", "BIMA", "BINA", "BIPI", "BJBR", "BJTM", "BKDP", "BKSL", "BLTA", 
            "BMAS", "BMRI", "BMTR", "BNBA", "BNGA", "BNII", "BNLI", "BOLT", "BOSS", "BRAM", "BRIS", "BRMS", "BRNA", "BRPT", 
            "BSDE", "BSWD", "BTEL", "BTEK", "BTPS", "BUDI", "BUKA", "BULL", "BUMI", "BVIC", "BWPT", "BYAN", "CARS", "CASA", 
            "CBMF", "CCAP", "CEKA", "CENT", "CFIN", "CITA", "CITY", "CLEO", "CLPI", "CMNP", "CMPP", "CNKO", "CNMA", "CPIN", 
            "CPRO", "CSAP", "CTRA", "CTTH", "DART", "DAYA", "DEAL", "DEFI", "DEPO", "DGIK", "DGNS", "DILD", "DKFT", "DLTA", 
            "DMAS", "DMND", "DOID", "DPNS", "DSFI", "DSNG", "DUTI", "DVLA", "DWGL", "DYAN"
        ]

def run_daily_scrape():
    logger.info("=== Scraping harian dimulai ===")
    # 1. Update IHSG
    rows = fetch_ihsg_daily()
    if rows:
        supabase.table("ihsg_daily").upsert(rows, on_conflict="date").execute()
    # 2. Update semua saham
    tickers = get_tracked_tickers()
    ok, fail = 0, []
    for ticker in tickers:
        data = fetch_and_calculate(ticker)
        if data:
            supabase.table("stocks").upsert(data, on_conflict="ticker").execute()
            ok += 1
        else:
            fail.append(ticker)
    logger.info(f"Selesai: {ok} OK, {len(fail)} gagal: {fail}")

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Setiap hari kerja jam 18:30 WIB (11:30 UTC)
    scheduler.add_job(run_daily_scrape, "cron",
                      day_of_week="mon-fri", hour=11, minute=30)
    scheduler.start()
    logger.info("Scheduler aktif — update tiap hari kerja 18:30 WIB")
    return scheduler