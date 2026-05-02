# AGENTS.md — Codex Prompt & Architecture Guide

This file is the **single source of truth** for any AI coding agent (Codex, Copilot, etc.) working on this repository.
Read it fully before making any change.

---

## 1. Project Overview

**AnalyticsApp** is a full-stack data analytics platform for construction project management ("Gestão de Obra").
Users upload spreadsheet files (`.xlsx`, `.csv`, `.json`, `.txt`) and immediately get schema-aware dashboards,
KPI cards, charts, anomaly detection, trend forecasting, segmentation, and clustering — all without any
configuration. The app auto-detects what kind of data was uploaded and shows only the relevant dashboards.

- **Backend**: FastAPI 0.135+ on Python 3.10+, port 8001
- **Frontend**: React 18 + TypeScript + Zustand + Tailwind CSS + Vite, port 3000
- **State**: UUID-based sessions (no auth yet). One active session per browser tab.
- **Data flow**: Upload → parse → detect schema → cache in memory → serve via REST → render in React

---

## 2. Repository Layout

```
AnalyticsApp/
├── backend/
│   ├── main.py                        # FastAPI app, CORS, router registration
│   ├── session.py                     # In-memory session store (UUID → DataFrame)
│   ├── routers/
│   │   ├── upload.py                  # POST /api/upload — entry point for all files
│   │   ├── advanced.py                # GET advanced analytics endpoints
│   │   ├── export.py                  # GET /api/export/{session_id}
│   │   └── templates.py               # Template-specific data endpoints
│   └── services/
│       ├── parser.py                  # Multi-format file reader
│       ├── schema_detector.py         # ← NEW: detects schema type from columns
│       ├── efetivo_template.py        # Efetivo schema definition
│       ├── efetivo_analyzer.py        # Efetivo-specific analysis logic
│       ├── custos_template.py         # Custos/NFs/Orçamento schema definition
│       ├── custos_analyzer.py         # Custos multi-sheet analysis logic
│       ├── orcamento_template.py      # Orçamento budget schema definition
│       └── orcamento_analyzer.py      # Orçamento analysis logic
├── frontend/
│   └── src/
│       ├── store/
│       │   └── sessionStore.ts        # Zustand store — holds sessionId + schemaTypes[]
│       ├── components/
│       │   ├── index.ts               # Barrel export for all dashboard components
│       │   ├── layout/
│       │   │   └── Sidebar.tsx        # Schema-filtered navigation
│       │   ├── EfetivoDashboard.tsx
│       │   ├── CustosDashboard.tsx    # ← NEW: multi-tab Custos view
│       │   ├── OrcamentoDashboard.tsx # ← NEW: Orçamento + NFs + Orçado×Realizado
│       │   ├── AnomaliasDashboard.tsx
│       │   ├── TendenciasDashboard.tsx
│       │   ├── SegmentacaoDashboard.tsx
│       │   └── ClusteringDashboard.tsx
│       └── views/
│           └── DashboardPage.tsx      # Routes activeView → correct dashboard component
├── AGENTS.md                          # ← This file
├── README.md
└── requirements.txt
```

---

## 3. Schema Detection System

### 3.1 How It Works

On every `POST /api/upload`, after parsing the file into a DataFrame (or dict of DataFrames for multi-sheet
Excel), `backend/services/schema_detector.py` must inspect the column names and return a list of detected
schema type strings. These are stored in the session and returned to the frontend in the upload response.

### 3.2 Detection Rules

Implement `detect_schema(sheets: dict[str, pd.DataFrame]) -> list[str]` in `schema_detector.py`:

```python
def detect_schema(sheets: dict[str, pd.DataFrame]) -> list[str]:
    """
    sheets: {sheet_name: DataFrame} — for single-sheet files, key is the filename stem.
    Returns a list of schema type strings, e.g. ["efetivo"], ["custos"], ["efetivo", "custos"].
    """
    detected = []
    all_cols = set()
    for df in sheets.values():
        all_cols.update(c.strip().upper() for c in df.columns if isinstance(c, str))

    # ── EFETIVO ──────────────────────────────────────────────────────────────
    efetivo_signals = {"CARGO/FUNÇÃO", "FORNECEDOR", "FILIAL/OBRA", "PERÍODO"}
    if len(efetivo_signals & all_cols) >= 2:
        detected.append("efetivo")

    # ── CUSTOS (NFs / Consolidado) ────────────────────────────────────────────
    custos_signals = {"NATUREZA", "FORNECEDOR", "NF", "DATA VENCTO", "VALOR"}
    if len(custos_signals & all_cols) >= 3:
        detected.append("custos")

    # ── ORÇAMENTO (budget lines) ──────────────────────────────────────────────
    orcamento_signals = {"CUSTO TOTAL", "CUSTO UNITÁRIO", "QTD", "DESCRIÇÃO", "UNID"}
    if len(orcamento_signals & all_cols) >= 3:
        detected.append("orcamento")

    # ── GENERIC FALLBACK ──────────────────────────────────────────────────────
    if not detected:
        detected.append("generic")

    return detected
```

### 3.3 Upload Response Shape

`POST /api/upload` must return:

```json
{
  "session_id": "uuid-string",
  "filename": "original_filename.xlsx",
  "rows": 4351,
  "columns": 14,
  "schema_types": ["efetivo"],
  "detected_sheets": ["Sheet1"],
  "preview": []
}
```

The `schema_types` array is what the frontend uses to filter the Sidebar.

### 3.4 Zustand Store

`sessionStore.ts` must hold:

```ts
interface SessionState {
  sessionId: string | null;
  filename: string | null;
  schemaTypes: string[];          // e.g. ["efetivo"] or ["custos", "orcamento"]
  rows: number;
  columns: number;
  setSession: (data: Partial<SessionState>) => void;
  clearSession: () => void;
}
```

---

## 4. Schema-Aware Sidebar

`Sidebar.tsx` must filter nav items based on `schemaTypes` from the store.
Each nav item has an optional `requires` field — if present, the item is only shown when
at least one of the required schema types is detected. Items with no `requires` always show.

```ts
const NAV_SECTIONS = [
  {
    title: "DASHBOARDS",
    items: [
      { id: "efetivo",   label: "Efetivo",   icon: "👷", requires: ["efetivo"] },
      { id: "custos",    label: "Custos",    icon: "💰", requires: ["custos", "orcamento"] },
      { id: "orcamento", label: "Orçamento", icon: "📋", requires: ["orcamento", "custos"] },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      // No `requires` → always visible once any session is active
      { id: "anomalias",    label: "Detecção de Anomalias",  icon: "🔍" },
      { id: "tendencias",   label: "Tendências & Previsão",  icon: "📈" },
      { id: "segmentacao",  label: "Segmentação",            icon: "🌿" },
      { id: "clustering",   label: "Clustering / PCA",       icon: "🔬" },
    ],
  },
  {
    title: "DADOS",
    items: [
      { id: "profiler",  label: "Data Profiler", icon: "📊" },
      { id: "exportar",  label: "Exportar",      icon: "💾" },
    ],
  },
];
```

**Rule**: hide the entire DASHBOARDS section if `schemaTypes` is empty (no file uploaded yet).
Show a "Faça upload de um arquivo" prompt instead.

**Rule**: if a user navigates to a dashboard whose `requires` is not in `schemaTypes`, show a
designed empty state:
> "Este dashboard requer dados do tipo **[tipo]**. Faça upload de um arquivo com as colunas necessárias."
Never show a blank white screen.

---

## 5. Custos & Orçamento Data Model

### 5.1 Source File Structure

The reference file is a multi-sheet Excel workbook. Sheet names and their roles:

| Sheet name | Role | Header row (0-indexed) |
|---|---|---|
| `PLANILHA ORÇAMENTO - Entrada de` | Budget line items + purchase maps | Row 8 |
| `PLANILHA NFs - Entrada de Dados` | Invoice register (NFs) | Row 7 |
| `PLANILHA ORÇADOxREALIZADO` | Budget vs Actual by month | Row 10 |
| `PLANILHA CONSOLIDADO` | All-invoices consolidated ledger | Row 5 |
| `RESUMO CONSOLIDADOS - CLIENTE` | Client-facing payment summary | Row 9 |
| `CALENDÁRIO` | Calendar helper (ignore in analytics) | — |
| `ENTENDA COMO OPERAR` | Instructions sheet (ignore) | — |

### 5.2 Key Columns per Sheet

#### PLANILHA NFs (Invoices)
- `Nº CONSOLIDADO` — sequential invoice group number
- `COD` — compound key (e.g., "1-3")
- `FORNECEDOR` — supplier name
- `NF` — invoice number
- `MAPA PREÇOS` — purchase map reference
- `NATUREZA` — cost type: one of `Material / Serviço`, `Mão Obra Empr.`, `Mão Obra Tempo`, `Staff`, `Serviços s/ TxAdm`
- `BOLETO/DEPÓSITO` — payment method
- `DATA VENCTO` — due date (datetime)
- `VALOR` — invoice amount (float)
- `SITUAÇÃO PLANILHA` — status flag
- `SALDO PLANILHA` — remaining balance

#### PLANILHA ORÇAMENTO (Budget)
**Columns B–J (first 9 content columns)** are the budget structure:
- `ITEM` — top-level budget item code
- `SUBITEM` — sub-item code
- `DESCRIÇÃO` — description
- `UNID` — unit of measure
- `QTD` — quantity
- `CUSTO UNITÁRIO` — unit cost
- `CUSTO TOTAL` — total budget (QTD × CUSTO UNITÁRIO)

**Columns K onward (~500 columns)** are individual purchase maps (Mapas de Compra).
Each mapa column header is the mapa number. Values are the amounts allocated per budget line.

**Parsing rule for ORÇAMENTO**: read rows starting at row 8 (0-indexed) as header.
Treat the first 9 content columns as the budget structure DataFrame.
Pivot the remaining columns wide→long to create a `mapas` DataFrame:

```python
def parse_orcamento_sheet(df_raw: pd.DataFrame) -> dict:
    # df_raw already has header at row 8
    budget_cols = df_raw.columns[:9].tolist()
    mapa_cols   = df_raw.columns[9:].tolist()

    budget_df = df_raw[budget_cols].dropna(subset=["DESCRIÇÃO"])

    mapas_df = (
        df_raw[budget_cols[:3] + mapa_cols]
        .melt(id_vars=budget_cols[:3], var_name="mapa_num", value_name="valor_alocado")
        .dropna(subset=["valor_alocado"])
        .query("valor_alocado != 0")
    )
    return {"budget": budget_df, "mapas": mapas_df}
```

#### PLANILHA ORÇADOxREALIZADO (Budget vs Actual)
- `ITEM/SUBITEM` — budget line reference
- `DESCRIÇÃO` — description
- `VERBA TOTAL CUSTO DIRETO` — total approved budget (sem taxa de adm)
- Columns named with month numbers (1, 2, 3 … 20+) — actual desembolso per month

**Parsing rule**: after reading header at row 10, identify month columns as those whose name
can be cast to int. Melt them to a `mes` + `realizado` long format for charting.

#### PLANILHA CONSOLIDADO (Ledger)
Same column structure as NFs but deduplicated and enriched with `ITEM` and `VALOR` appropriation.
Use as the source of truth for cash-flow and payment-status views.

#### RESUMO CONSOLIDADOS - CLIENTE (Client Summary)
- `Nº CONSOLIDADO` — invoice group
- `MATERIAL/SERVIÇO` — amount by cost type
- `MÃO OBRA EMPREITADA`
- `MÃO OBRA TEMPO`
- `STAFF`
- `SERVIÇO sem TAXA ADM`
- `TOTAL` — subtotal before admin fee
- `TAXA ADMINISTRAÇÃO` — admin fee amount
- `%` — admin fee rate (typically 13%)
- `NF ADMINISTRAÇÃO` — admin invoice number
- `DATA VENCTO` / `DATA RECBTO` — due / received dates
- `TOTAL GERAL` — final total including admin fee

### 5.3 NATUREZA Taxonomy

This is the cost-type taxonomy used across all Custos sheets:

| Value | Meaning |
|---|---|
| `Material / Serviço` | Materials and contracted services (incur admin fee) |
| `Mão Obra Empr.` | Outsourced labor — empreitada (incur admin fee) |
| `Mão Obra Tempo` | Temporary labor (incur admin fee) |
| `Staff` | Internal staff (incur admin fee) |
| `Serviços s/ TxAdm` | Services exempt from admin fee |

Always use this taxonomy for grouping, filtering, and color-coding in charts.

---

## 6. Dashboard Components

### 6.1 EfetivoDashboard

**File**: `frontend/src/components/EfetivoDashboard.tsx`
**Schema required**: `efetivo`

Tabs:
1. **Visão Geral** — KPI cards (Total Funcionários, Filiais Ativas, Cargos Distintos, % Dados Completos), bar chart headcount by filial, secondary KPIs (Total Diárias, Dias Ativos, Média Diária, Fornecedores, Funções), period bar chart
2. **Por Filial** — filter by Filial/Obra and Cargo/Função, bar chart + detail table with headcount and % of total
3. **Evolução** — line chart of headcount evolution by month
4. **Detalhamento** — paginated raw records table (Filial/Obra, Fornecedor, Cargo/Função, Período, Dia, Qtd)

Split each tab into its own sub-component: `EfetivoVisaoGeral`, `EfetivoFilial`, `EfetivoEvolucao`, `EfetivoDetalhamento`.

### 6.2 CustosDashboard

**File**: `frontend/src/components/CustosDashboard.tsx`
**Schema required**: `custos` OR `orcamento`

Tabs:
1. **Resumo** — KPI cards from RESUMO sheet (Total NFs, Total Valor, Valor com Taxa Adm, Taxa Adm %, NFs em Aberto), donut chart by NATUREZA
2. **NFs** — invoice list with columns: Nº CONSOLIDADO, FORNECEDOR, NF, NATUREZA, VALOR, DATA VENCTO, BOLETO/DEPÓSITO, SITUAÇÃO. Filters: NATUREZA, FORNECEDOR, date range. Color-code NATUREZA chips using the taxonomy above.
3. **Consolidado** — grouped ledger view by FORNECEDOR, sortable. Shows TOTAL paid per supplier.
4. **Fluxo de Caixa** — bar chart of VALOR by month (DATA VENCTO), stacked by NATUREZA

### 6.3 OrcamentoDashboard

**File**: `frontend/src/components/OrcamentoDashboard.tsx`
**Schema required**: `orcamento` OR `custos`

Tabs:
1. **Orçamento** — budget tree table: ITEM → SUBITEM → DESCRIÇÃO, with QTD, CUSTO UNITÁRIO, CUSTO TOTAL columns. Show total budget KPI card at top.
2. **Mapas de Compra** — table of the pivoted mapas: ITEM, SUBITEM, DESCRIÇÃO, mapa_num, valor_alocado. Filter by mapa number.
3. **Orçado × Realizado** — side-by-side bar chart per ITEM: VERBA TOTAL (blue) vs sum of monthly actuals (green). Show variance % column. Use data from PLANILHA ORÇADOxREALIZADO.
4. **Evolução Mensal** — line chart of cumulative realizado by month across all items.

### 6.4 Analytics Dashboards (generic — no schema required)

These work on any uploaded data. They already exist in the codebase.
Do NOT break their existing fetch/chart flow when making other changes.

- `AnomaliasDashboard.tsx` — calls `GET /api/{session_id}/anomalies`
- `TendenciasDashboard.tsx` — calls `GET /api/{session_id}/trends`
- `SegmentacaoDashboard.tsx` — calls `GET /api/{session_id}/segmentation`
- `ClusteringDashboard.tsx` — calls `GET /api/{session_id}/clustering`

---

## 7. Backend Endpoints to Implement

### 7.1 Custos Endpoints

```
GET /api/custos/{session_id}/resumo
  → { total_nfs, total_valor, valor_com_taxa, taxa_adm_pct, nfs_em_aberto, by_natureza: [{natureza, valor}] }

GET /api/custos/{session_id}/nfs
  → { items: [{ consolidado, fornecedor, nf, natureza, valor, data_vencto, pagamento, situacao }], total }

GET /api/custos/{session_id}/consolidado
  → { items: [{ fornecedor, total_valor, count_nfs, naturezas: string[] }] }

GET /api/custos/{session_id}/fluxo
  → { months: [{ mes, valor_total, by_natureza: [{natureza, valor}] }] }
```

### 7.2 Orçamento Endpoints

```
GET /api/orcamento/{session_id}/budget
  → { items: [{ item, subitem, descricao, unid, qtd, custo_unitario, custo_total }], total_orcado }

GET /api/orcamento/{session_id}/mapas
  → { items: [{ item, subitem, descricao, mapa_num, valor_alocado }] }

GET /api/orcamento/{session_id}/variancia
  → { items: [{ item, descricao, verba_total, realizado, variancia, variancia_pct }] }

GET /api/orcamento/{session_id}/evolucao_mensal
  → { months: [{ mes, realizado_acumulado }] }
```

### 7.3 Parser Service

Implement `backend/services/custos_analyzer.py` with a `parse_custos_workbook(path: str) -> dict` function
that reads the multi-sheet Excel and returns structured DataFrames. It must:

1. Detect which sheets are present by name (partial match is fine — sheet names may be truncated)
2. Read each sheet with the correct `header` row offset (see Section 5.1)
3. Apply the Orçamento wide→long pivot from Section 5.2
4. Return `{ "nfs": df, "orcamento": {"budget": df, "mapas": df}, "orcado_realizado": df, "consolidado": df, "resumo": df }`
5. Be tolerant of missing sheets — return `None` for any sheet not found

---

## 8. Multi-Format File Support

The upload endpoint must handle all of these:

| Extension | Reader | Notes |
|---|---|---|
| `.xlsx`, `.xls` | `pd.read_excel(path, sheet_name=None)` | Returns dict of sheets |
| `.csv` | `pd.read_csv(path, sep=None, engine="python")` | Auto-detect separator |
| `.json` | `pd.read_json(path)` or `pd.DataFrame(json.load(f))` | Handle both array and object root |
| `.txt` | `pd.read_csv(path, sep=None, engine="python")` | Same as CSV |

Implement `detect_format(filename: str, content: bytes) -> str` in `parser.py` that returns the
format string based on extension and, as fallback, magic bytes.

For multi-sheet Excel files, the session must store ALL sheets as a dict:
`session["sheets"] = { sheet_name: df }`. The primary DataFrame (`session["df"]`) should be the
first content sheet (skip CALENDÁRIO, ENTENDA COMO OPERAR, and any all-NaN sheets).

---

## 9. Empty States

Every dashboard that requires a specific schema must render a designed empty state when:
- No file is uploaded (show upload prompt)
- File is uploaded but schema does not match (show mismatch message with required column list)
- Data is loading (show skeleton cards, not a spinner)

```tsx
// Empty state component pattern
<div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
  <span className="text-4xl mb-4">📂</span>
  <h3 className="text-lg font-semibold text-gray-200 mb-2">
    Dados não compatíveis
  </h3>
  <p className="text-sm max-w-xs">
    Este dashboard requer um arquivo com as colunas:{" "}
    <code className="text-green-400">NATUREZA, FORNECEDOR, VALOR</code>.
    Faça upload do arquivo correto.
  </p>
</div>
```

---

## 10. What NOT to Break

1. **The existing Efetivo upload and chart flow** — do not remove `POST /api/upload` behavior
2. **The advanced analytics endpoints** in `advanced.py` — do not rename or remove them
3. **The export endpoint** in `export.py` — keep `/api/export/{session_id}` working
4. **`npm run build` must pass** with zero TypeScript errors
5. **`npm run lint` must pass** (one pre-existing warning in UploadZone.tsx is acceptable)
6. **Python syntax/import checks must pass** for all backend files

---

## 11. Testing

- Do NOT make HTTP calls at module-level or at pytest collection time
- All test files must live under `tests/` folder
- Use `fastapi.testclient.TestClient` for endpoint tests — no live server required
- Use `pytest.mark.parametrize` for schema detection tests covering all known column combinations
- The pre-existing root-level test files (`test_analytics.py`, `test_insights.py`, etc.) are legacy —
  do not delete them but do not run them in CI. New tests go in `tests/` only.

---

## 12. Coding Conventions

- **Python**: type hints on all function signatures; `snake_case`; max 120 chars per line
- **TypeScript**: strict mode; no `any`; `camelCase` for variables, `PascalCase` for components
- **React**: functional components only; custom hooks for data fetching; no class components
- **State**: Zustand only — no Redux, no Context API for global state
- **Styling**: Tailwind utility classes only — no inline styles except for dynamic values
- **API errors**: always return `{ "detail": "human-readable message" }` with appropriate HTTP status
- **DataFrames**: never mutate in place in service functions — always return new DataFrames
- **NaN safety**: wrap all `pd.isna()` calls with `isinstance(val, (int, float))` guard before calling

## ERP Integration Path

When this app is embedded into or connected to the ERP system, the following
architectural constraints must be respected:

### Session Layer
- Sessions today are keyed by file upload (UUID). In the ERP, sessions will
  be keyed by (obra_id, periodo). The session_id format must remain opaque
  strings — no code should assume UUID format.
- The parsed DataFrame cache (cache.py → _parsed_cache) will need to be
  replaced with a Redis or Memcached layer when running multi-worker.

### Parser Layer
- All parsers in backend/services/ read from bytes (BytesIO). This is
  intentional — they are agnostic to the source. In the ERP, the bytes
  will come from the database BLOB column instead of file upload.
  No parser should accept a file path — always bytes + filename string.

### Authentication
- The /api/upload endpoint and all session-scoped routes need Bearer token
  authentication before ERP integration. Add auth middleware stub but do
  not implement until ERP SSO is defined.

### Performance Targets
- Upload + parse: < 3 seconds for files up to 5MB (current Efetivo: ~2MB ✓)
- Any aggregation endpoint: < 500ms with warm cache
- Detail/list endpoints with pagination: < 200ms per page
