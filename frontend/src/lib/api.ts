const BASE = "http://localhost:8000";

export async function register(name: string, email: string, password: string) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error("Email atau password salah");
  return res.json(); // { access_token, user: { id, email, name } }
}

export async function searchStocks(query: string) {
  const res = await fetch(`${BASE}/stocks/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Gagal mencari saham");
  return res.json();
}

export async function getStock(ticker: string) {
  const res = await fetch(`${BASE}/stocks/${ticker}`);
  if (!res.ok) throw new Error("Saham tidak ditemukan");
  return res.json(); // semua metrik + 6 skor + overall_score
}

export async function refreshStock(ticker: string) {
  const res = await fetch(`${BASE}/stocks/${ticker}/refresh`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Gagal memperbarui saham");
  return res.json();
}

export async function getIHSG(days = 30) {
  const res = await fetch(`${BASE}/ihsg/daily?days=${days}`);
  return res.json(); // array: [{date, open, high, low, close, volume}]
}

export async function getWatchlist(token: string) {
  const res = await fetch(`${BASE}/watchlist`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function addWatchlist(ticker: string, token: string) {
  await fetch(`${BASE}/watchlist/${ticker}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }
  });
}

export async function removeWatchlist(ticker: string, token: string) {
  await fetch(`${BASE}/watchlist/${ticker}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getTrackedTickers() {
  const res = await fetch(`${BASE}/tickers`);
  if (!res.ok) throw new Error("Gagal mengambil daftar ticker");
  return res.json();
}

export async function addTrackedTicker(ticker: string) {
  const res = await fetch(`${BASE}/tickers/${ticker}`, {
    method: "POST",
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Gagal menambah ticker: ${message}`);
  }
  return res.json();
}

export async function removeTrackedTicker(ticker: string) {
  const res = await fetch(`${BASE}/tickers/${ticker}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Gagal menghapus ticker: ${message}`);
  }
  return res.json();
}

export async function fetchTickerNow(ticker: string) {
  const res = await fetch(`${BASE}/tickers/${ticker}/fetch-now`, {
    method: "POST",
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Gagal fetch ticker: ${message}`);
  }
  return res.json();
}