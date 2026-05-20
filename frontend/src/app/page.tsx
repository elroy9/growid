"use client";

import { useEffect, useState, useCallback } from "react";
import { getStock, getIHSG, refreshStock, searchStocks, getTrackedTickers, addTrackedTicker, removeTrackedTicker, fetchTickerNow } from "@/lib/api";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ─── Types (unchanged) ────────────────────────────────────────
interface Stock {
  ticker: string;
  company_name: string;
  sector: string;
  overall_score: number;
  price: number;
  last_updated: string;
  profitability_score?: number;
  growth_score?: number;
  financial_strength_score?: number;
  cash_flow_score?: number;
  valuation_score?: number;
  efficiency_score?: number;
  roe?: number;
  roa?: number;
  pe_ratio?: number;
  price_to_book?: number;
  debt_to_equity?: number;
  revenue_growth_yoy?: number;
  market_cap?: number;
}

interface IHSGData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Score helpers ───────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 80) return { badge: "badge badge-green", text: "text-green", bar: "#00D68F" };
  if (score >= 60) return { badge: "badge badge-blue",  text: "text-blue",  bar: "#38BDF8" };
  if (score >= 40) return { badge: "badge badge-gold",  text: "text-gold",  bar: "#FFB84C" };
  return             { badge: "badge badge-red",   text: "text-red",   bar: "#FF5E7A" };
}

function scoreName(score: number) {
  if (score >= 85) return "Kandidat 10x 🚀";
  if (score >= 70) return "Growth Kuat";
  if (score >= 55) return "Stabil";
  if (score >= 40) return "Rata-Rata";
  return "Fundamental Lemah";
}

function fmtCap(value?: number) {
  if (!value || value <= 0) return "—";
  const T = 1_000_000_000_000, B = 1_000_000_000;
  if (value >= T) return `Rp${(value / T).toFixed(1)}T`;
  if (value >= B) return `Rp${(value / B).toFixed(1)}B`;
  return `Rp${value.toLocaleString("id-ID")}`;
}

// ─── Toast component ─────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="animate-toast" style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: "var(--bg3)", border: "1px solid var(--border2)",
      borderRadius: "var(--r-md)", padding: "14px 20px",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text)",
      minWidth: 260, maxWidth: 400,
    }}>
      <span style={{ fontSize: 16 }}>✦</span>
      <span>{message}</span>
      <button onClick={onClose} style={{
        marginLeft: "auto", background: "none", border: "none",
        color: "var(--text3)", cursor: "pointer", fontSize: 16, padding: "0 2px",
      }}>×</button>
    </div>
  );
}

// ─── Score bar row ────────────────────────────────────────────
function ScoreBar({ label, score }: { label: string; score?: number }) {
  const sc = score ?? 0;
  const col = scoreColor(sc);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-body)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500 }} className={col.text}>{sc.toFixed(0)}</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${sc}%`, background: col.bar }} />
      </div>
    </div>
  );
}

// ─── Metric value cell ────────────────────────────────────────
function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card" style={{ textAlign: "center" }}>
      <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, fontFamily: "var(--font-body)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 20, fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--text)" }}>{value}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════
export default function Home() {
  // ─── State (all logic unchanged) ─────────────────────────
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [ihsgData, setIhsGData] = useState<IHSGData[]>([]);
  const [loading, setLoading] = useState(true);
  const [ihsgLoading, setIhsGLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [trackedTickers, setTrackedTickers] = useState<any[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [tickerMessage, setTickerMessage] = useState<string | null>(null);
  const [managingTickers, setManagingTickers] = useState(false);
  const [showTickerManager, setShowTickerManager] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchAllStocks();
    fetchIHSGData();
    loadTrackedTickers();
  }, []);

  // ─── All handlers (logic UNCHANGED) ──────────────────────
  const loadTrackedTickers = async () => {
    try {
      const data = await getTrackedTickers();
      setTrackedTickers(data);
    } catch (err) {
      console.error("Error loading tracked tickers:", err);
    }
  };

  const handleAddTicker = async () => {
    if (!newTicker.trim()) { setTickerMessage("Masukkan ticker terlebih dahulu"); return; }
    setManagingTickers(true);
    setTickerMessage(null);
    try {
      await addTrackedTicker(newTicker.toUpperCase());
      setTickerMessage(`Ticker ${newTicker.toUpperCase()} berhasil ditambahkan!`);
      setToast(`✦ ${newTicker.toUpperCase()} ditambahkan ke watchlist`);
      setNewTicker("");
      await loadTrackedTickers();
    } catch (err) {
      setTickerMessage(`Gagal: ${(err as Error).message}`);
    } finally {
      setManagingTickers(false);
    }
  };

  const handleRemoveTicker = async (ticker: string) => {
    setManagingTickers(true);
    try {
      await removeTrackedTicker(ticker);
      setTickerMessage(`Ticker ${ticker} dihapus`);
      setToast(`${ticker} dihapus dari watchlist`);
      await loadTrackedTickers();
    } catch (err) {
      setTickerMessage(`Gagal menghapus: ${(err as Error).message}`);
    } finally {
      setManagingTickers(false);
    }
  };

  const handleFetchTickerNow = async (ticker: string) => {
    setManagingTickers(true);
    try {
      await fetchTickerNow(ticker);
      setTickerMessage(`Ticker ${ticker} sedang di-fetch, cek lagi dalam 10 detik`);
      setToast(`Fetching ${ticker}... cek lagi dalam 10 detik`);
      setTimeout(() => loadTrackedTickers(), 3000);
    } catch (err) {
      setTickerMessage(`Gagal fetch: ${(err as Error).message}`);
    } finally {
      setManagingTickers(false);
    }
  };

  const fetchAllStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("http://localhost:8000/stocks/");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const sampleResponse = await fetch("/sample_stocks.json");
      const sampleData: Stock[] = await sampleResponse.json();
      const mergedData: Stock[] = sampleData.map((stock: Stock) => ({ ...stock }));
      data.forEach((apiStock: Stock) => {
        const existingIndex = mergedData.findIndex(stock => stock.ticker === apiStock.ticker);
        if (existingIndex >= 0) mergedData[existingIndex] = { ...mergedData[existingIndex], ...apiStock };
        else mergedData.push(apiStock);
      });
      setStocks(mergedData);
      setFilteredStocks(mergedData);
    } catch (err) {
      console.error("Error fetching stocks:", err);
      setError("Gagal mengambil data saham. Menampilkan data sample...");
      try {
        const sampleResponse = await fetch("/sample_stocks.json");
        const sampleData = await sampleResponse.json();
        setStocks(sampleData);
        setFilteredStocks(sampleData);
      } catch {
        setStocks([]);
        setFilteredStocks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchIHSGData = async () => {
    try {
      setIhsGLoading(true);
      const data = await getIHSG(30);
      setIhsGData(data);
    } catch (err) {
      console.error("Error fetching IHSG:", err);
    } finally {
      setIhsGLoading(false);
    }
  };

  const handleSearch = useCallback(async (term: string) => {
    setSearchTerm(term);
    setSearchMessage(null);
    if (term.trim() === "") { setFilteredStocks(stocks); setSearchLoading(false); return; }
    setSearchLoading(true);
    try {
      const results = await searchStocks(term.trim());
      if (results.length > 0) {
        setFilteredStocks(results);
      } else {
        const local = stocks.filter(s =>
          s.ticker.toLowerCase().includes(term.toLowerCase()) ||
          s.company_name.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredStocks(local);
        if (local.length === 0) {
          const tickerCandidate = term.trim().toUpperCase();
          if (/^[A-Z]{2,5}$/.test(tickerCandidate)) {
            setSearchMessage(`Ticker ${tickerCandidate} belum ada di cache. Data sedang dimuat, silakan coba lagi dalam 30 detik.`);
            try { await getStock(tickerCandidate); } catch {}
          } else {
            setSearchMessage("Tidak ada hasil untuk query ini.");
          }
        }
      }
    } catch {
      const filtered = stocks.filter(s =>
        s.ticker.toLowerCase().includes(term.toLowerCase()) ||
        s.company_name.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredStocks(filtered);
      setSearchMessage("Pencarian offline. Server tidak merespons, tampilkan data lokal.");
    } finally {
      setSearchLoading(false);
    }
  }, [stocks]);

  const handleSelectStock = async (ticker: string) => {
    setDetailLoading(true);
    setRefreshMessage(null);
    try {
      const stockDetail = await getStock(ticker);
      setSelectedStock(stockDetail);
    } catch {
      const fallback = stocks.find(s => s.ticker === ticker) || null;
      setSelectedStock(fallback);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelectedStock = async (ticker: string) => {
    setDetailLoading(true);
    setRefreshMessage("Memperbarui data terbaru, mohon tunggu...");
    try {
      await refreshStock(ticker);
      setRefreshMessage("Refresh dimulai. Silakan buka kembali detail setelah sekitar 30 detik.");
      setToast(`Refresh ${ticker} dimulai...`);
    } catch {
      setRefreshMessage("Gagal memperbarui data. Coba lagi nanti.");
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Chart config ─────────────────────────────────────────
  const ihsgLast  = ihsgData[ihsgData.length - 1];
  const ihsgPrev  = ihsgData[ihsgData.length - 2];
  const ihsgDelta = ihsgLast && ihsgPrev
    ? ((ihsgLast.close - ihsgPrev.close) / ihsgPrev.close * 100)
    : null;
  const ihsgUp = ihsgDelta !== null && ihsgDelta >= 0;

  const chartData = {
    labels: ihsgData.map(d => new Date(d.date).toLocaleDateString("id-ID", { month: "short", day: "numeric" })),
    datasets: [{
      label: "IHSG",
      data: ihsgData.map(d => d.close),
      borderColor: "#00D68F",
      backgroundColor: "rgba(0,214,143,0.06)",
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointBackgroundColor: "#00D68F",
      pointBorderColor: "#0B0F14",
      pointBorderWidth: 2,
      borderWidth: 2,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#161D28",
        titleColor: "#9BA8BF",
        bodyColor: "#E8EAF0",
        borderColor: "#243349",
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx: any) => `  IHSG: ${ctx.parsed.y.toLocaleString("id-ID")}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.03)" },
        ticks: { color: "#5A6680", font: { size: 11 }, maxTicksLimit: 7 },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: {
          color: "#5A6680",
          font: { family: "var(--font-dm-mono)", size: 11 },
          callback: (v: any) => (v / 1000).toFixed(1) + "K",
        },
      },
    },
    interaction: { intersect: false, mode: "index" as const },
  };

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)" }}>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* ── Topbar ── */}
      <header className="topbar">
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "linear-gradient(135deg, #00D68F, #38BDF8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 15, color: "#000",
            }}>G</div>
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 20, letterSpacing: "-0.3px" }}>
              Grow<span style={{ color: "var(--green)" }}>-ID</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge badge-green" style={{ fontSize: 11 }}>● Live</span>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>IDX</span>
          </div>
        </div>
      </header>

      {/* ── Page body ── */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px 80px" }}>

        {/* ── Hero Greeting ── */}
        <div className="animate-slide-up" style={{ marginBottom: 40 }}>
          <p className="section-label" style={{ marginBottom: 8 }}>Dashboard · Analisis Saham Indonesia</p>
          <h1 style={{ fontFamily: "var(--font-head)", fontSize: 36, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: 10 }}>
            Indonesian Stock<br />
            <span style={{ color: "var(--green)" }}>Analyst</span>
          </h1>
          <p style={{ color: "var(--text2)", fontSize: 15, maxWidth: 560, lineHeight: 1.7 }}>
            Analisis fundamental saham IHSG yang presisi — skor komprehensif berbasis{" "}
            <span style={{ color: "var(--text)" }}>6 dimensi</span> dengan data real-time.
          </p>
        </div>

        {/* ── IHSG Chart ── */}
        <div className="chart-container animate-slide-up" style={{ marginBottom: 28, animationDelay: "0.05s" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <p className="section-label" style={{ marginBottom: 4 }}>Indeks Harga Saham Gabungan</p>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 18, fontWeight: 700 }}>IHSG Daily</h2>
            </div>
            {ihsgLast && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 500, color: "var(--text)" }}>
                  {ihsgLast.close.toLocaleString("id-ID")}
                </div>
                {ihsgDelta !== null && (
                  <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: ihsgUp ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                    {ihsgUp ? "▲" : "▼"} {Math.abs(ihsgDelta).toFixed(2)}%
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>30 hari terakhir</div>
              </div>
            )}
          </div>
          <div style={{ height: 240 }}>
            {ihsgLoading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="spinner" />
              </div>
            ) : (
              <Line data={chartData} options={chartOptions} />
            )}
          </div>
        </div>

        {/* ── Ticker Manager ── */}
        <div className="animate-slide-up" style={{ marginBottom: 24, animationDelay: "0.1s" }}>
          <button className="panel-toggle" onClick={() => setShowTickerManager(!showTickerManager)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14 }}>⚙</span>
              <span>Kelola Ticker</span>
              <span className="badge badge-muted" style={{ fontSize: 11 }}>{trackedTickers.length}</span>
            </div>
            <span style={{ color: "var(--text3)", fontSize: 12, fontFamily: "var(--font-mono)", transition: "transform 0.2s", display: "inline-block", transform: showTickerManager ? "rotate(90deg)" : "none" }}>▶</span>
          </button>

          {showTickerManager && (
            <div className="panel-body">
              {/* Add ticker row */}
              <div style={{ marginBottom: 24 }}>
                <p className="section-label" style={{ marginBottom: 10 }}>Tambah Ticker Baru</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    className="input-ticker"
                    placeholder="Misal: ASII, INDF, BBRI"
                    value={newTicker}
                    onChange={e => setNewTicker(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && handleAddTicker()}
                    disabled={managingTickers}
                  />
                  <button className="btn-primary" onClick={handleAddTicker} disabled={managingTickers}
                    style={{ whiteSpace: "nowrap", padding: "12px 24px" }}>
                    {managingTickers ? <span className="spinner-sm" /> : "Tambah +"}
                  </button>
                </div>
                {tickerMessage && (
                  <p style={{ marginTop: 8, fontSize: 12, color: "var(--text3)" }}>{tickerMessage}</p>
                )}
              </div>

              {/* Tracked list */}
              <div>
                <p className="section-label" style={{ marginBottom: 12 }}>
                  Sedang Di-track — <span style={{ color: "var(--text2)" }}>{trackedTickers.length} ticker</span>
                </p>
                {trackedTickers.length === 0 ? (
                  <p style={{ color: "var(--text3)", fontSize: 13 }}>Belum ada ticker terdaftar.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, maxHeight: 280, overflowY: "auto" }}>
                    {trackedTickers.map((item: any) => (
                      <div key={item.ticker} className="ticker-pill">
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: "var(--blue)", textAlign: "center" }}>
                          {item.ticker}
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-fetch" style={{ flex: 1 }} onClick={() => handleFetchTickerNow(item.ticker)} disabled={managingTickers}>
                            Fetch
                          </button>
                          <button className="btn-danger" style={{ flex: 1 }} onClick={() => handleRemoveTicker(item.ticker)} disabled={managingTickers}>
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Search Bar ── */}
        <div className="animate-slide-up" style={{ marginBottom: 28, position: "relative", animationDelay: "0.12s" }}>
          <p className="section-label" style={{ marginBottom: 10 }}>Cari & Analisis Saham</p>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", width: 18, height: 18, flexShrink: 0 }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="input-search"
              placeholder="Cari ticker atau nama perusahaan..."
              value={searchTerm}
              onChange={e => handleSearch(e.target.value)}
            />
            {searchLoading && (
              <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}>
                <span className="spinner-sm" />
              </span>
            )}
          </div>
          {searchLoading && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--text3)" }}>
              Mencari di server...
            </p>
          )}
          {searchMessage && (
            <div className="alert-info" style={{ marginTop: 10 }}>
              {searchMessage}
            </div>
          )}
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="alert-error" style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
            <div>
              <p style={{ fontWeight: 600, color: "var(--red)", fontSize: 13, marginBottom: 2 }}>Koneksi Gagal</p>
              <p style={{ fontSize: 12, color: "var(--text2)" }}>{error}</p>
            </div>
          </div>
        )}

        {/* ── Stocks Grid ── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 280 }}>
            <div style={{ textAlign: "center" }}>
              <div className="spinner" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "var(--text3)", fontSize: 13 }}>Memuat data saham...</p>
            </div>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
            <p style={{ color: "var(--text2)", fontSize: 16, marginBottom: 6 }}>
              {searchTerm ? "Tidak ada saham yang cocok" : "Tidak ada data saham"}
            </p>
            <p style={{ color: "var(--text3)", fontSize: 13 }}>Coba kata kunci yang berbeda</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p className="section-label">
                {searchTerm ? `${filteredStocks.length} hasil` : `${filteredStocks.length} saham`}
              </p>
              <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                Sorted by score ↓
              </p>
            </div>
            <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {filteredStocks.map(stock => {
                const col = scoreColor(stock.overall_score);
                return (
                  <div key={stock.ticker} className="stock-card" onClick={() => handleSelectStock(stock.ticker)}>
                    {/* Top accent line based on score */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: col.bar, opacity: 0.5, borderRadius: "var(--r-lg) var(--r-lg) 0 0" }} />

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 500, color: "var(--text)", marginBottom: 3 }}>
                          {stock.ticker}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text3)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {stock.company_name}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: col.bar }}>
                          {stock.overall_score.toFixed(0)}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>/100</div>
                      </div>
                    </div>

                    {/* Sector badge */}
                    <div style={{ marginBottom: 16 }}>
                      <span className="badge badge-muted" style={{ fontSize: 11 }}>{stock.sector}</span>
                    </div>

                    {/* Mini score bar */}
                    <div className="score-bar-track" style={{ marginBottom: 16 }}>
                      <div className="score-bar-fill" style={{ width: `${stock.overall_score}%`, background: col.bar }} />
                    </div>

                    {/* Price row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>Harga</p>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 500 }}>
                          Rp{stock.price?.toLocaleString("id-ID") || "—"}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className={col.badge} style={{ fontSize: 11 }}>
                          {scoreName(stock.overall_score)}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 11, color: "var(--text3)" }}>
                        {stock.last_updated
                          ? new Date(stock.last_updated).toLocaleDateString("id-ID")
                          : "—"}
                      </p>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>Lihat detail →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Footer count ── */}
        {!loading && filteredStocks.length > 0 && (
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
              {searchTerm
                ? `${filteredStocks.length} / ${stocks.length} saham`
                : `${stocks.length} saham tersedia`}
            </p>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════
          STOCK DETAIL MODAL
      ══════════════════════════════════════════ */}
      {selectedStock && (
        <div
          className="modal-overlay"
          style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 500 }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedStock(null); }}
        >
          <div className="modal-panel" style={{ width: "100%", maxWidth: 860, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: 32 }}>

              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 36, fontWeight: 500, letterSpacing: "0.02em", lineHeight: 1, marginBottom: 6 }}>
                    {selectedStock.ticker}
                  </div>
                  <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 8 }}>{selectedStock.company_name}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge badge-muted" style={{ fontSize: 11 }}>{selectedStock.sector}</span>
                    <span className={scoreColor(selectedStock.overall_score).badge} style={{ fontSize: 11 }}>
                      {scoreName(selectedStock.overall_score)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStock(null)}
                  style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text2)", fontSize: 18, transition: "color 0.2s, border-color 0.2s" }}
                >×</button>
              </div>

              {/* Overall Score + Price */}
              <div className="score-ring-card" style={{ marginBottom: 24 }}>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 500, lineHeight: 1, color: scoreColor(selectedStock.overall_score).bar }}>
                    {selectedStock.overall_score.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>/100</div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Overall Score</p>
                  <p style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 700, color: scoreColor(selectedStock.overall_score).bar, marginBottom: 10 }}>
                    {scoreName(selectedStock.overall_score)}
                  </p>
                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>Harga</p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 500 }}>
                        Rp{selectedStock.price?.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>Market Cap</p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 500 }}>
                        {fmtCap(selectedStock.market_cap)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Refresh row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
                <button className="btn-secondary" onClick={() => refreshSelectedStock(selectedStock.ticker)} disabled={detailLoading}>
                  {detailLoading ? <><span className="spinner-sm" /> Memperbarui...</> : "↻ Refresh Data"}
                </button>
                {refreshMessage && (
                  <p style={{ fontSize: 12, color: "var(--text3)" }}>{refreshMessage}</p>
                )}
              </div>

              {/* Score breakdown bars */}
              <div style={{ marginBottom: 28 }}>
                <p className="section-label" style={{ marginBottom: 16 }}>Score Breakdown — 6 Dimensi</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
                  <ScoreBar label="Profitability (20%)" score={selectedStock.profitability_score} />
                  <ScoreBar label="Growth (20%)"        score={selectedStock.growth_score} />
                  <ScoreBar label="Financial Strength (15%)" score={selectedStock.financial_strength_score} />
                  <ScoreBar label="Cash Flow (15%)"     score={selectedStock.cash_flow_score} />
                  <ScoreBar label="Valuation (15%)"     score={selectedStock.valuation_score} />
                  <ScoreBar label="Efficiency (15%)"    score={selectedStock.efficiency_score} />
                </div>
              </div>

              {/* Score cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }} className="stagger">
                {[
                  { label: "Profitability", score: selectedStock.profitability_score, detail: `ROE ${selectedStock.roe?.toFixed(1) ?? "—"}%  ·  ROA ${selectedStock.roa?.toFixed(1) ?? "—"}%` },
                  { label: "Growth",        score: selectedStock.growth_score,        detail: `Rev Growth ${selectedStock.revenue_growth_yoy?.toFixed(1) ?? "—"}%` },
                  { label: "Fin. Strength", score: selectedStock.financial_strength_score, detail: `D/E ${selectedStock.debt_to_equity?.toFixed(2) ?? "—"}x` },
                  { label: "Cash Flow",     score: selectedStock.cash_flow_score,     detail: "Operating Cash Flow" },
                  { label: "Valuation",     score: selectedStock.valuation_score,     detail: `P/E ${selectedStock.pe_ratio?.toFixed(1) ?? "—"}  ·  P/B ${selectedStock.price_to_book?.toFixed(1) ?? "—"}` },
                  { label: "Efficiency",    score: selectedStock.efficiency_score,    detail: "Asset Turnover" },
                ].map(({ label, score, detail }) => {
                  const sc = score ?? 0;
                  const col = scoreColor(sc);
                  return (
                    <div key={label} className="score-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <p style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>{label}</p>
                        <span className={col.badge} style={{ fontSize: 11 }}>{sc.toFixed(0)}</span>
                      </div>
                      <div className="score-bar-track" style={{ marginBottom: 8 }}>
                        <div className="score-bar-fill" style={{ width: `${sc}%`, background: col.bar }} />
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text3)" }}>{detail}</p>
                    </div>
                  );
                })}
              </div>

              {/* Key metrics */}
              <div style={{ marginBottom: 24 }}>
                <p className="section-label" style={{ marginBottom: 12 }}>Key Metrics</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  <MetricCell label="ROE"     value={`${selectedStock.roe?.toFixed(1) ?? "—"}%`} />
                  <MetricCell label="ROA"     value={`${selectedStock.roa?.toFixed(1) ?? "—"}%`} />
                  <MetricCell label="P/E"     value={selectedStock.pe_ratio?.toFixed(1) ?? "—"} />
                  <MetricCell label="P/B"     value={selectedStock.price_to_book?.toFixed(1) ?? "—"} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: "center", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                  Data diperbarui:{" "}
                  {selectedStock.last_updated
                    ? new Date(selectedStock.last_updated).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}