const API_BASE = "https://financialmodelingprep.com/api/v3";
const API_KEY = "demo";

const TOP_100_US_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "BRK-B", "LLY", "AVGO",
  "TSLA", "JPM", "V", "WMT", "XOM", "UNH", "MA", "JNJ", "PG", "ORCL",
  "HD", "COST", "BAC", "ABBV", "KO", "NFLX", "CRM", "MRK", "CVX", "AMD",
  "ADBE", "PEP", "TMO", "CSCO", "MCD", "LIN", "ABT", "WFC", "DIS", "ACN",
  "DHR", "TXN", "INTU", "VZ", "AMAT", "QCOM", "CMCSA", "PFE", "PM", "CAT",
  "IBM", "RTX", "SPGI", "GE", "GS", "NOW", "UBER", "ISRG", "BKNG", "BLK",
  "LOW", "HON", "UNP", "MS", "AXP", "DE", "SYK", "NEE", "AMGN", "TJX",
  "SCHW", "T", "ADP", "MDT", "C", "VRTX", "ELV", "GILD", "LRCX", "MU",
  "SBUX", "PGR", "MMC", "COP", "MO", "CB", "NKE", "SO", "REGN", "MDLZ",
  "ADI", "PLD", "BMY", "UPS", "PANW", "INTC", "CI", "BA", "KKR", "EQIX"
];

const elements = {
  search: document.getElementById("search"),
  sector: document.getElementById("sector"),
  minMarketCap: document.getElementById("minMarketCap"),
  minPrice: document.getElementById("minPrice"),
  changeDirection: document.getElementById("changeDirection"),
  refreshBtn: document.getElementById("refreshBtn"),
  resetBtn: document.getElementById("resetBtn"),
  period: document.getElementById("period"),
  resultCount: document.getElementById("resultCount"),
  summary: document.getElementById("summary"),
  tableBody: document.getElementById("tableBody"),
  statusLine: document.getElementById("statusLine"),
  chartTitle: document.getElementById("chartTitle"),
  chartCanvas: document.getElementById("chartCanvas"),
};

const state = {
  rows: [],
  filteredRows: [],
  sort: { key: "marketCap", direction: "desc" },
  selectedSymbol: null,
  chart: [],
};

const formatter = {
  compact: new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }),
  price: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  percent: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function loadScreenerData() {
  elements.statusLine.textContent = "Loading live quote and profile data…";

  const symbols = TOP_100_US_SYMBOLS.join(",");
  const quotesUrl = `${API_BASE}/quote/${encodeURIComponent(symbols)}?apikey=${API_KEY}`;
  const profileUrl = `${API_BASE}/profile/${encodeURIComponent(symbols)}?apikey=${API_KEY}`;

  const [quotes, profiles] = await Promise.all([fetchJson(quotesUrl), fetchJson(profileUrl)]);
  const profileMap = new Map(profiles.map((item) => [item.symbol, item]));

  state.rows = quotes
    .filter((quote) => quote.symbol)
    .map((quote) => {
      const profile = profileMap.get(quote.symbol) || {};
      return {
        symbol: quote.symbol,
        name: quote.name || profile.companyName || "—",
        sector: profile.sector || "Unknown",
        price: quote.price || 0,
        changePercent: quote.changesPercentage || 0,
        marketCap: quote.marketCap || profile.mktCap || 0,
        volume: quote.volume || 0,
      };
    });

  updateSectorFilter();
  applyFiltersAndRender();

  elements.statusLine.textContent = `Live connection established with Financial Modeling Prep. Loaded ${state.rows.length} symbols.`;

  if (!state.selectedSymbol && state.filteredRows.length) {
    selectSymbol(state.filteredRows[0].symbol);
  }
}

function updateSectorFilter() {
  const sectors = [...new Set(state.rows.map((row) => row.sector).filter(Boolean))].sort();
  const currentValue = elements.sector.value;

  elements.sector.innerHTML = '<option value="all">All sectors</option>';
  sectors.forEach((sector) => {
    const option = document.createElement("option");
    option.value = sector;
    option.textContent = sector;
    elements.sector.appendChild(option);
  });

  if (sectors.includes(currentValue)) {
    elements.sector.value = currentValue;
  }
}

function applyFiltersAndRender() {
  const term = elements.search.value.trim().toLowerCase();
  const sector = elements.sector.value;
  const minMarketCap = Number(elements.minMarketCap.value || 0) * 1_000_000_000;
  const minPrice = Number(elements.minPrice.value || 0);
  const direction = elements.changeDirection.value;

  state.filteredRows = state.rows.filter((row) => {
    const textPass = !term || row.symbol.toLowerCase().includes(term) || row.name.toLowerCase().includes(term);
    const sectorPass = sector === "all" || row.sector === sector;
    const capPass = row.marketCap >= minMarketCap;
    const pricePass = row.price >= minPrice;
    const directionPass =
      direction === "all" ||
      (direction === "gainers" && row.changePercent > 0) ||
      (direction === "losers" && row.changePercent < 0);

    return textPass && sectorPass && capPass && pricePass && directionPass;
  });

  const { key, direction: sortDirection } = state.sort;
  state.filteredRows.sort((a, b) => {
    const left = a[key];
    const right = b[key];

    if (typeof left === "string") {
      return sortDirection === "asc" ? left.localeCompare(right) : right.localeCompare(left);
    }
    return sortDirection === "asc" ? left - right : right - left;
  });

  renderSummary();
  renderTable();
}

function renderSummary() {
  const rows = state.filteredRows;
  const gainers = rows.filter((row) => row.changePercent > 0).length;
  const losers = rows.filter((row) => row.changePercent < 0).length;
  const avgMove = rows.length ? rows.reduce((sum, row) => sum + row.changePercent, 0) / rows.length : 0;
  const totalCap = rows.reduce((sum, row) => sum + row.marketCap, 0);

  elements.summary.innerHTML = `
    <article>
      <p>Results</p>
      <h3>${rows.length}</h3>
    </article>
    <article>
      <p>Gainers / Losers</p>
      <h3>${gainers} / ${losers}</h3>
    </article>
    <article>
      <p>Average Day Move</p>
      <h3 class="${avgMove >= 0 ? "up" : "down"}">${formatter.percent.format(avgMove)}%</h3>
    </article>
    <article>
      <p>Total Market Cap</p>
      <h3>${formatter.compact.format(totalCap)}</h3>
    </article>
  `;

  elements.resultCount.textContent = `${rows.length} rows`;
}

function renderTable() {
  elements.tableBody.innerHTML = "";

  if (!state.filteredRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="7" class="empty">No companies match the selected filters.</td>';
    elements.tableBody.appendChild(tr);
    return;
  }

  state.filteredRows.forEach((row) => {
    const tr = document.createElement("tr");
    if (row.symbol === state.selectedSymbol) {
      tr.classList.add("selected");
    }

    tr.innerHTML = `
      <td><button class="linkish" data-symbol="${row.symbol}">${row.symbol}</button></td>
      <td>${row.name}</td>
      <td>${row.sector}</td>
      <td>${formatter.price.format(row.price)}</td>
      <td class="${row.changePercent >= 0 ? "up" : "down"}">${formatter.percent.format(row.changePercent)}%</td>
      <td>${formatter.compact.format(row.marketCap)}</td>
      <td>${formatter.compact.format(row.volume)}</td>
    `;

    elements.tableBody.appendChild(tr);
  });
}

async function loadChartData(symbol, days) {
  const url = `${API_BASE}/historical-price-full/${encodeURIComponent(symbol)}?timeseries=${days}&apikey=${API_KEY}`;
  const data = await fetchJson(url);
  return (data.historical || []).map((item) => ({ date: item.date, close: item.close })).reverse();
}

function drawChart(series) {
  const canvas = elements.chartCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0d1223";
  ctx.fillRect(0, 0, width, height);

  if (!series.length) {
    ctx.fillStyle = "#a6b3d6";
    ctx.font = "16px Inter, sans-serif";
    ctx.fillText("No chart data available.", 24, height / 2);
    return;
  }

  const closes = series.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const pad = 36;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const spread = max - min || 1;

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  [0, 0.5, 1].forEach((tick) => {
    const y = pad + innerH * tick;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  });

  ctx.strokeStyle = "#56f6a9";
  ctx.lineWidth = 2;
  ctx.beginPath();

  series.forEach((point, index) => {
    const x = pad + (index / (series.length - 1 || 1)) * innerW;
    const y = pad + ((max - point.close) / spread) * innerH;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  ctx.fillStyle = "#c7d2f0";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(`High ${formatter.price.format(max)}`, pad, 18);
  ctx.fillText(`Low ${formatter.price.format(min)}`, width - 130, 18);
}

async function selectSymbol(symbol) {
  state.selectedSymbol = symbol;
  renderTable();

  const days = Number(elements.period.value);
  elements.chartTitle.textContent = `Loading ${symbol} chart…`;

  try {
    state.chart = await loadChartData(symbol, days);
    drawChart(state.chart);

    const latest = state.chart[state.chart.length - 1];
    elements.chartTitle.textContent = latest
      ? `${symbol} · ${formatter.price.format(latest.close)} · ${days} day history`
      : `${symbol} · no chart data`;
  } catch (error) {
    elements.chartTitle.textContent = `${symbol} · failed to load chart`;
    drawChart([]);
    elements.statusLine.textContent = `Chart request failed: ${error.message}`;
  }
}

function resetFilters() {
  elements.search.value = "";
  elements.sector.value = "all";
  elements.minMarketCap.value = "";
  elements.minPrice.value = "";
  elements.changeDirection.value = "all";
  applyFiltersAndRender();
}

function wireEvents() {
  [
    elements.search,
    elements.sector,
    elements.minMarketCap,
    elements.minPrice,
    elements.changeDirection,
  ].forEach((input) => input.addEventListener("input", applyFiltersAndRender));

  elements.refreshBtn.addEventListener("click", async () => {
    try {
      await loadScreenerData();
    } catch (error) {
      elements.statusLine.textContent = `Quote request failed: ${error.message}`;
    }
  });

  elements.resetBtn.addEventListener("click", resetFilters);

  elements.period.addEventListener("change", () => {
    if (state.selectedSymbol) {
      selectSymbol(state.selectedSymbol);
    }
  });

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) {
        state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
      } else {
        state.sort.key = key;
        state.sort.direction = key === "name" || key === "symbol" || key === "sector" ? "asc" : "desc";
      }
      applyFiltersAndRender();
    });
  });

  elements.tableBody.addEventListener("click", (event) => {
    const symbol = event.target.dataset.symbol;
    if (symbol) {
      selectSymbol(symbol);
    }
  });
}

async function init() {
  wireEvents();
  drawChart([]);

  try {
    await loadScreenerData();
  } catch (error) {
    elements.statusLine.textContent = `Connection failed. ${error.message}. If demo key is throttled, replace API_KEY with your own free key.`;
  }
}

init();
