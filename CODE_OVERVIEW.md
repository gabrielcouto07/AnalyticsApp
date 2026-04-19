# Analytics Dashboard — Code Overview

A walk-through of how this codebase is organized and how each piece fits together.

---

## 1. Big picture

This repo is an **analytics dashboard** that lets a user upload a tabular file (Excel / CSV / TXT / JSON), then explore it through KPIs, charts, quality reports, and exports.

It exists in **two shapes** because it is mid-migration:

| Stack | Entry point | Status |
|---|---|---|
| **Streamlit (legacy v1.5)** | `app.py` | Single-file dashboard, pure Python. Still works standalone. |
| **FastAPI + React (current v2.0)** | `backend/main.py` + `frontend/` | Modular API + SPA. This is where new work goes. |

Both stacks **share** the analytics logic in `config/` and the color palette.

```
┌────────────────┐    HTTP/JSON    ┌──────────────────┐
│  React (Vite)  │ ───────────────▶│ FastAPI (Uvicorn)│
│  localhost:5173│ ◀───────────────│  localhost:8000  │
└────────────────┘                 └──────────────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ pandas DataFrame │
                                   │ (in-memory dict, │
                                   │  keyed by UUID)  │
                                   └──────────────────┘
```

No database — DataFrames live in a plain Python dict keyed by `session_id` (`backend/session.py`). Sessions are lost on restart.

---

## 2. Folder map

```
AnalyticsApp/
├── app.py                  # Legacy Streamlit single-page app
├── theme.css               # Dark theme CSS injected by Streamlit
├── requirements.txt        # Python deps (Streamlit + FastAPI shared)
├── test_data.csv           # Tiny fixture for manual testing
├── test_endpoints.py       # Quick script that hits the FastAPI routes
│
├── .streamlit/             # Streamlit config (theme, upload limits)
│
├── config/                 # SHARED analytics primitives (used by both stacks)
│   ├── colors.py           # PALETTE + CHART_COLORS
│   └── analytics.py        # trends, outliers (IQR/Z), dataset categorization
│
├── templates/              # Streamlit-only UI helpers
│   ├── ui.py               # Header, KPI rows, chart styling
│   └── smart_kpi.py        # "Smart" KPI cards with trend badges
│
├── backend/                # FastAPI service
│   ├── main.py             # App + CORS + router registration
│   ├── session.py          # In-memory {session_id: DataFrame} store
│   ├── routers/            # HTTP endpoints (one file per resource)
│   └── services/           # Business logic (parsing, analytics, export)
│
└── frontend/               # React + TypeScript SPA (Vite)
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── main.tsx        # React entry
        ├── App.tsx         # Layout shell + page router (state-based)
        ├── api/            # Axios client + typed API functions
        ├── store/          # Zustand global session store
        ├── components/     # Reusable UI (charts, cards, layout)
        ├── pages/          # One file per dashboard tab
        └── lib/            # Formatters and theme helpers
```

---

## 3. Backend (`backend/`)

FastAPI app exposing a small REST surface. Every request that needs data passes a `session_id` so the server can look up the matching DataFrame.

### `main.py`
Boots the FastAPI app, configures CORS for the Vite dev ports (`5173`/`5174`/`5175`/`3000`), and mounts the four routers.

### `session.py`
The world's simplest session store: a module-level `dict[str, pd.DataFrame]`. Exposes `create_session`, `get_session`, `delete_session`. **State is lost on process restart** — by design for now.

### `routers/` — HTTP layer
Each file owns one URL prefix. They are thin: validate input, call a service, return JSON.

| File | Prefix | What it does |
|---|---|---|
| `upload.py` | `POST /api/upload` | Accepts a file, parses it, creates a session, returns metadata + 10-row preview. |
| `data.py` | `GET /api/data/{sid}/...` | `kpis`, `stats`, `quality`, `outliers/{column}`. Computes per-column metrics on demand. |
| `charts.py` | `POST/GET /api/charts/{sid}/...` | `temporal` (resampled time series + cumulative), `cross` (group-by + agg), `correlation` (numeric corr matrix). |
| `export.py` | `GET /api/export/{sid}/...` | Streams the DataFrame back as `excel` or `csv`. |

### `services/` — business logic
Imported by routers. No HTTP knowledge here.

| File | Responsibility |
|---|---|
| `parser.py` | `load_dataframe(bytes, filename)` dispatches on extension; `detect_and_parse(df)` auto-coerces object columns to dates or numerics (handles `R$`, `%`, `,` decimals); `get_col_types(df)` buckets columns into `date / numeric / categorical`. |
| `analytics.py` | Re-exports the trend/outlier/categorization functions from `config/analytics.py` so routers don't reach across the project root. |
| `export.py` | `to_excel_bytes(df)` (openpyxl) and `to_csv_string(df)` (UTF-8 BOM). |

---

## 4. Frontend (`frontend/src/`)

React 19 + TypeScript, bundled by Vite. **No router library is used** — `App.tsx` keeps the active page in `useState` and renders one of the components from a `PAGES` map.

### `main.tsx`
React entry. Mounts `<App />` into `#root` inside `<StrictMode>`.

### `App.tsx`
The shell:
- Reads `sessionId` from the Zustand store.
- If no session → renders `<WelcomePage />` (the upload landing page).
- If session exists → renders `<Sidebar />` + `<TopBar />` + the page selected by `useState<PageId>`.

### `api/`
| File | Purpose |
|---|---|
| `client.ts` | Single `axios` instance pointed at `http://localhost:8000` with a 30s timeout. |
| `analytics.ts` | Typed wrappers for every backend endpoint (`uploadFile`, `getKpis`, `getQuality`, `getStats`, `getTemporalChart`, `getCrossChart`, `getCorrelation`). |

### `store/session.ts`
Zustand store holding everything page components need: `sessionId`, `filename`, `rows`, `columns`, `colTypes`, plus cached `kpis`, `quality`, `stats`, `datasetType`. `setSession(partial)` merges, `clear()` resets — used by the "New Upload" button.

### `components/`
Presentational pieces.

- **Top-level chart/card components** — `KpiCard`, `TemporalChart`, `CrossChart`, `CorrelationChart`, `ScatterChart`, `QualityTable`, `ExportButton`, `FilterSidebar`, `UploadZone`, `WelcomePage` helpers.
- **`common/`** — generic building blocks: `ChartCard` (wrapper with title/border), `KpiCard` (duplicate of the top-level one — flagged for cleanup in `ARQUITETURA.md`), `LoadingSkeleton`.
- **`layout/`** — `Sidebar` (the eight nav buttons + current-file footer + "New Upload") and `TopBar` (header with status indicator).

### `pages/`
One file per tab in the sidebar. Each page reads from the Zustand store, fetches its own extra data via the `api/` helpers, and composes components.

| Page | Tab | What it shows |
|---|---|---|
| `WelcomePage.tsx` | (pre-session) | Hero + drag-drop upload. |
| `OverviewPage.tsx` | Overview | KPI grid, data-health score, summary, null-by-column, column-type lists. |
| `TemporalPage.tsx` | Temporal | Resampled time series. |
| `DistributionPage.tsx` | Distribution | Histograms per numeric column. |
| `RankingPage.tsx` | Ranking | Top-N bar chart from a categorical × numeric pair. |
| `ExplorerPage.tsx` | Explorer | Free-form cross-tab analysis. |
| `CorrelationPage.tsx` | Correlation | Heatmap of numeric correlations. |
| `QualityPage.tsx` | Quality | Per-column null %, unique count, sample value. |
| `ExportPage.tsx` | Export | Download buttons for Excel / CSV. |

### `lib/`
- `format.ts` — `fmt.number / currency / percent / date` helpers (`Intl.NumberFormat`).
- `theme.ts` — colors and chart-theming constants used by the React side.

---

## 5. Shared config (`config/`)

Used by **both** the Streamlit app and the FastAPI services.

- **`colors.py`** — `PALETTE` dict (primary, secondary, success, warning, danger, accent, plus surface/text/border tokens) and `CHART_COLORS` sequence for multi-series Plotly graphs.
- **`analytics.py`** — pure functions:
  - `calculate_trend(series)` — % change between the last two periods, returns direction + arrow emoji.
  - `detect_outliers_iqr(series, multiplier=1.5)` — returns indices of outliers and their share.
  - `identify_anomalies(df, cols, threshold_z=2.5)` — Z-score based.
  - `categorize_dataset(df)` — heuristic match on column names → `sales / financial / ops / hr / generic`.
  - `get_kpi_suggestions(type)` — recommended KPI labels per dataset type.
  - `calculate_percentile_rank(value, series)` — where a value sits in the distribution.

---

## 6. Streamlit legacy (`app.py` + `templates/`)

`app.py` is a self-contained dashboard (~25 KB) that imports from `config/` and `templates/` and renders 5 tabs (Overview, Temporal, Explorer, Stats, Export). It injects `theme.css` for the dark look.

`templates/`:
- `ui.py` — `load_theme`, `render_header`, `kpi_card`, `render_kpi_row`, `apply_chart_style`.
- `smart_kpi.py` — KPI cards with trend badges (the v1.5 "smart" upgrade).

`.streamlit/config.toml` sets the upload size limit and base theme.

---

## 7. End-to-end flow (FastAPI + React)

1. **Upload** — User drops a file in `WelcomePage` → `UploadZone` calls `uploadFile()` → `POST /api/upload` → backend parses, stores DataFrame, returns `session_id` + `col_types` + `preview`.
2. **Hydrate store** — Frontend calls `setSession(...)` so every page sees the new metadata. `App.tsx` flips from welcome to dashboard layout because `sessionId` is now truthy.
3. **Dashboard** — `OverviewPage` calls `getKpis`, `getQuality`, `getStats` in parallel, caches results in the store.
4. **Navigate** — Clicking a sidebar item updates `useState<PageId>` in `App.tsx`. The new page mounts and fetches whatever extra endpoint it needs (`charts/temporal`, `charts/correlation`, …).
5. **Export** — `ExportPage` triggers `GET /api/export/{sid}/excel|csv`, FastAPI streams the file back.
6. **Reset** — Sidebar "New Upload" calls `clear()`, `sessionId` becomes `null`, `App.tsx` rerenders the welcome screen.

---

## 8. Running it

```bash
# Backend
python -m uvicorn backend.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev          # Vite serves on http://localhost:5173
```

Legacy Streamlit version:

```bash
streamlit run app.py
```

API docs are auto-generated at `http://localhost:8000/docs`.
