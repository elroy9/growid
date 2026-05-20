import yfinance as yf
import pandas as pd
import numpy as np
import logging
from datetime import datetime

logger = logging.getLogger("scraper")

# ─── Helper functions ───────────────────────────────────────
def g(df, row, default=0):
    """Ambil 1 nilai dari DataFrame financial, handle error"""
    try: return float(df.loc[row].iloc[0])
    except: return default

def sd(a, b, default=0):
    """Safe divide — return default kalau b = 0"""
    try: return round(a / b, 2) if b and b != 0 else default
    except: return default

def norm(v, lo, hi):
    """Normalisasi nilai ke range 0-1"""
    try: return max(0, min(1, (v - lo) / (hi - lo)))
    except: return 0

def norm_inv(v, lo, hi):
    """Normalisasi terbalik — makin kecil makin bagus (untuk PE, utang, dll)"""
    return 1 - norm(v, lo, hi)

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

# ─── Hitung 6 skor ──────────────────────────────────────────
def calc_scores(m: dict) -> dict:
    prof = (
        norm(m["roe"], 5, 30) * 20 +
        norm(m["roa"], 1, 20) * 15 +
        norm(m["roic"], 5, 25) * 20 +
        norm(m["gross_margin"], 20, 70) * 15 +
        norm(m["operating_margin"], 0, 35) * 15 +
        norm(m["net_profit_margin"], 2, 30) * 15
    )
    grow = (
        norm(m["revenue_growth_yoy"], -5, 30) * 25 +
        norm(m["eps_growth_yoy"], -5, 35) * 25 +
        norm(m["revenue_growth_3y"], 3, 25) * 25 +
        norm(m["eps_growth_3y"], 3, 20) * 25
    )
    fin = (
        norm(m["interest_coverage"], 1, 25) * 25 +
        norm(m["current_ratio"], 0.8, 3.5) * 20 +
        norm(m["quick_ratio"], 0.5, 3) * 20 +
        norm_inv(m["net_debt_ebitda"], -1, 6) * 20 +
        norm(m["cash_ratio"], 0.1, 2) * 15
    )
    cf = (
        norm(m["operating_cf_margin"], 5, 50) * 30 +
        norm(m["free_cf_margin"], -10, 35) * 30 +
        norm(m["cash_conversion_ratio"], 0.5, 2) * 20 +
        norm(m["cf_stability"], 0.5, 10) * 20
    )
    val = (
        norm_inv(m["pe_ratio"] if m["pe_ratio"] > 0 else 999, 5, 60) * 20 +
        norm_inv(m["price_to_book"], 0.5, 8) * 20 +
        norm_inv(m["ev_ebitda"], 3, 30) * 30 +
        norm_inv(m["ev_revenue"], 0.3, 8) * 30
    )
    eff = (
        norm(m["asset_turnover"], 0.05, 2) * 25 +
        norm(m["inventory_turnover"], 2, 20) * 25 +
        norm(m["receivable_turnover"], 3, 25) * 25 +
        norm(m["return_on_capital"], 5, 35) * 25
    )
    return {
        "profitability_score":       round(clamp(prof, 10, 98)),
        "growth_score":              round(clamp(grow, 10, 98)),
        "financial_strength_score":  round(clamp(fin,  15, 98)),
        "cash_flow_score":           round(clamp(cf,   10, 98)),
        "valuation_score":           round(clamp(val,  10, 95)),
        "efficiency_score":          round(clamp(eff,  10, 98)),
    }

# ─── Main: fetch semua data 1 saham ─────────────────────────
def fetch_and_calculate(ticker: str) -> dict | None:
    """Fetch data fundamental dari yfinance lalu hitung 6 skor"""
    try:
        stock  = yf.Ticker(f"{ticker}.JK")
        info   = stock.info
        fin    = stock.financials
        bal    = stock.balance_sheet
        cf     = stock.cashflow

        # Raw financial values
        revenue      = g(fin, "Total Revenue")
        gross_prof   = g(fin, "Gross Profit")
        op_income    = g(fin, "Operating Income")
        net_income   = g(fin, "Net Income")
        ebitda       = info.get("ebitda") or 0
        total_assets = g(bal, "Total Assets")
        equity       = g(bal, "Stockholders Equity")
        total_debt   = info.get("totalDebt") or 0
        cash         = g(bal, "Cash And Cash Equivalents")
        curr_liab    = g(bal, "Current Liabilities")
        inventory    = g(bal, "Inventory")
        receivable   = g(bal, "Accounts Receivable")
        ocf          = g(cf,  "Operating Cash Flow")
        capex        = g(cf,  "Capital Expenditure")
        interest     = g(fin, "Interest Expense")

        fcf      = ocf - abs(capex)
        net_debt = total_debt - cash

        # Revenue CAGR 3 tahun: (Rev_now / Rev_3y)^(1/3) - 1
        try:
            rev_3y    = float(fin.loc["Total Revenue"].iloc[3])
            rev_cagr3 = round((revenue / rev_3y) ** (1/3) - 1, 4) * 100 if rev_3y > 0 else 0
        except:
            rev_cagr3 = 0

        # EPS CAGR 3 tahun
        try:
            eps_now   = info.get("trailingEps") or 0
            ni_3y     = float(fin.loc["Net Income"].iloc[3])
            ni_now    = net_income
            shares    = info.get("sharesOutstanding") or 1
            eps_3y_v  = ni_3y / shares
            eps_cagr3 = round((eps_now / eps_3y_v) ** (1/3) - 1, 4) * 100 if eps_3y_v > 0 else 0
        except:
            eps_cagr3 = 0

        # CF Stability: Mean OCF / Std Dev OCF (5 tahun)
        try:
            ocf_hist     = [float(x) for x in cf.loc["Operating Cash Flow"] if x]
            cf_stability = round(np.mean(ocf_hist) / np.std(ocf_hist), 2) if np.std(ocf_hist) > 0 else 3
        except:
            cf_stability = 3

        # Kalkulasi semua metrik
        metrics = {
            "ticker":        ticker,
            "company_name":  info.get("longName") or info.get("shortName") or ticker,
            "sector":        info.get("sector") or "Unknown",
            "price":         info.get("currentPrice") or info.get("regularMarketPrice") or 0,
            "market_cap":    info.get("marketCap") or 0,
            # Profitability
            "roe":                round((info.get("returnOnEquity") or 0) * 100, 2),
            "roa":                round((info.get("returnOnAssets") or 0) * 100, 2),
            "roic":               sd(net_income, equity + total_debt) * 100,
            "gross_margin":       sd(gross_prof, revenue) * 100,
            "operating_margin":   sd(op_income, revenue) * 100,
            "net_profit_margin":  round((info.get("profitMargins") or 0) * 100, 2),
            "ebitda_margin":      sd(ebitda, revenue) * 100,
            # Growth
            "revenue_growth_yoy": round((info.get("revenueGrowth") or 0) * 100, 2),
            "eps_growth_yoy":     round((info.get("earningsGrowth") or 0) * 100, 2),
            "net_income_growth":  0,
            "revenue_growth_3y":  rev_cagr3,
            "eps_growth_3y":      eps_cagr3,
            "fcf":                round(fcf / 1e9, 2),  # dalam Miliar IDR
            # Financial Strength
            "debt_to_equity":     round((info.get("debtToEquity") or 0) / 100, 2),
            "debt_to_assets":     sd(total_debt, total_assets),
            "interest_coverage":  sd(op_income, abs(interest)) if interest < 0 else 10,
            "current_ratio":      round(info.get("currentRatio") or 1.5, 2),
            "quick_ratio":        round(info.get("quickRatio") or 1.0, 2),
            "cash_ratio":         sd(cash, curr_liab),
            "net_debt_ebitda":    sd(net_debt, ebitda),
            # Cash Flow Quality
            "operating_cf_margin":    sd(ocf, revenue) * 100,
            "free_cf_margin":         sd(fcf, revenue) * 100,
            "cash_conversion_ratio":  sd(ocf, net_income),
            "cf_stability":           cf_stability,
            # Valuation
            "pe_ratio":      round(info.get("trailingPE") or 0, 2),
            "forward_pe":    round(info.get("forwardPE") or 0, 2),
            "peg_ratio":     round(info.get("pegRatio") or 0, 2),
            "price_to_book": round(info.get("priceToBook") or 0, 2),
            "price_to_sales":round(info.get("priceToSalesTrailing12Months") or 0, 2),
            "ev_ebitda":     round(info.get("enterpriseToEbitda") or 0, 2),
            "ev_revenue":    round(info.get("enterpriseToRevenue") or 0, 2),
            "p_fcf":         round((info.get("marketCap") or 0) / fcf, 2) if fcf > 0 else 0,
            # Efficiency
            "asset_turnover":      sd(revenue, total_assets),
            "inventory_turnover":  sd(revenue, inventory) if inventory > 0 else 10,
            "receivable_turnover": sd(revenue, receivable) if receivable > 0 else 10,
            "return_on_capital":   sd(net_income, total_assets - curr_liab) * 100,
            "last_updated":        datetime.utcnow().isoformat(),
        }

        # Hitung 6 skor + overall
        scores = calc_scores(metrics)
        scores["overall_score"] = round(
            scores["profitability_score"]      * 0.20 +
            scores["growth_score"]             * 0.20 +
            scores["financial_strength_score"]  * 0.15 +
            scores["cash_flow_score"]           * 0.15 +
            scores["valuation_score"]           * 0.15 +
            scores["efficiency_score"]          * 0.15
        )
        metrics.update(scores)

        logger.info(f"{ticker} OK — Overall score: {scores['overall_score']}")
        return metrics

    except Exception as e:
        logger.error(f"Gagal fetch {ticker}: {e}")
        return None


# ─── IHSG Daily via ^JKSE ───────────────────────────────────
def fetch_ihsg_daily(period: str = "3mo") -> list:
    """Ambil data IHSG harian dari Yahoo Finance ticker ^JKSE"""
    try:
        df = yf.download("^JKSE", period=period, interval="1d", progress=False)
        # Flatten MultiIndex columns (yfinance versi baru)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        rows = []
        for date, row in df.iterrows():
            rows.append({
                "date":   date.strftime("%Y-%m-%d"),
                "open":   round(float(row["Open"]), 2),
                "high":   round(float(row["High"]), 2),
                "low":    round(float(row["Low"]), 2),
                "close":  round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        logger.info(f"IHSG OK — {len(rows)} hari")
        return rows
    except Exception as e:
        logger.error(f"Gagal fetch IHSG: {e}")
        return []