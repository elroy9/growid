import yfinance as yf
import json
from datetime import datetime

def fetch_basic_stock(ticker):
    """Fetch basic stock data without complex calculations"""
    try:
        stock = yf.Ticker(f"{ticker}.JK")
        info = stock.info

        return {
            "ticker": ticker,
            "company_name": info.get("longName") or info.get("shortName") or ticker,
            "sector": info.get("sector") or "Unknown",
            "price": info.get("currentPrice") or info.get("regularMarketPrice") or 0,
            "overall_score": 50,  # Default score
            "last_updated": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None

# Fetch some stocks
tickers = ['BBRI', 'BMRI', 'TLKM', 'ASII', 'GOTO', 'UNVR']
stocks_data = []

for ticker in tickers:
    print(f"Fetching {ticker}...")
    data = fetch_basic_stock(ticker)
    if data:
        stocks_data.append(data)
        print(f"✅ {ticker} done")
    else:
        print(f"❌ {ticker} failed")

# Save to JSON
with open('stocks_sample.json', 'w') as f:
    json.dump(stocks_data, f, indent=2)

print(f"Saved {len(stocks_data)} stocks to stocks_sample.json")