from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, stocks, watchlist, ihsg, tickers
from scraper.scheduler import start_scheduler
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()

app = FastAPI(title="Grow-ID API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
app.include_router(stocks.router,    prefix="/stocks",    tags=["Stocks"])
app.include_router(watchlist.router, prefix="/watchlist", tags=["Watchlist"])
app.include_router(ihsg.router,      prefix="/ihsg",      tags=["IHSG"])
app.include_router(tickers.router,   prefix="/tickers",   tags=["Tickers"])

@app.get("/")
def root():
    return {"app": "Grow-ID", "status": "running", "version": "2.0"}