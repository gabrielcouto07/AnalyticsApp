# Converter Feature — Changes

A new **Converter** tab was added that turns an `.xlsx` upload into:
1. A list of columns with inferred SQL types,
2. SQL statements (per-column `ALTER TABLE … ADD COLUMN`, plus a `CREATE TABLE` and sample `INSERT`s),
3. JavaScript translations of every Excel formula found in the workbook.

---

## Files added

| File | Purpose |
|---|---|
| `backend/services/converter.py` | Core logic: dtype→SQL mapping, SQL generation, Excel-formula→JS translator, openpyxl-based formula extraction. |
| `backend/routers/converter.py` | FastAPI router exposing `POST /api/converter/analyze`. |
| `frontend/src/api/converter.ts` | Typed Axios call + result interfaces. |
| `frontend/src/pages/ConverterPage.tsx` | The page: upload zone, summary strip, columns table, SQL viewer with tabs, formulas table. |

## Files modified

| File | Change |
|---|---|
| `backend/main.py` | Imports and registers the new `converter` router. |
| `frontend/src/pages/index.ts` | Re-exports `ConverterPage`. |
| `frontend/src/components/layout/Sidebar.tsx` | Added `{ id: "converter", icon: "🛠️", label: "Converter" }` to `NAV` (this also extends the `PageId` type). |
| `frontend/src/App.tsx` | Imports `ConverterPage` and adds `converter: <ConverterPage />` to the `PAGES` map. |

---

## API

### `POST /api/converter/analyze`

**Request:** multipart form with a single `file` field (`.xlsx` or `.xls`).

**Response:**
```jsonc
{
  "filename": "sales.xlsx",
  "rows": 1200,
  "column_count": 6,
  "columns": [
    {
      "original": "Order ID",
      "safe": "order_id",          // sanitized SQL identifier
      "sql_type": "INTEGER",
      "pandas_dtype": "int64",
      "sample": "1001",
      "non_null_count": 1200
    }
  ],
  "sql": {
    "table_name": "sales",
    "create_table": "CREATE TABLE sales (...);",
    "alter_columns": [
      { "column": "Order ID", "sql": "ALTER TABLE sales ADD COLUMN order_id INTEGER;" }
    ],
    "inserts": ["INSERT INTO sales (...) VALUES (...);"],
    "rows_inserted": 50,           // capped to keep payload small
    "rows_total": 1200
  },
  "formulas": [
    {
      "sheet": "Sheet1",
      "cell": "D2",
      "column": "Total",
      "excel": "=B2*C2",
      "javascript": "b2*c2",
      "unknown_functions": []      // populated when a function has no template
    }
  ],
  "formula_count": 42
}
```

Errors:
- `400` — non-xlsx upload.
- `422` — file unreadable or malformed.

---

## How it works

### 1. SQL generation (`build_sql`)

For each column the service:
- Sanitizes the header into a safe SQL identifier (`Total (R$)` → `total_r`, lowercase, leading digits prefixed with `_`, non-alphanumerics collapsed to `_`).
- Maps the pandas dtype to a SQL type:

  | pandas | SQL |
  |---|---|
  | `int*` | `INTEGER` |
  | `float*` | `DECIMAL(18, 4)` |
  | `bool` | `BOOLEAN` |
  | `datetime*` | `TIMESTAMP` |
  | other | `TEXT` |

It then emits three things:
- One `CREATE TABLE` with the original column name as a trailing comment per line.
- One `ALTER TABLE … ADD COLUMN` per column (this is the "for each column, a SQL command" requested).
- The first 50 rows as `INSERT INTO …` statements (capped to keep the JSON response small; `rows_total` reports the full count).

### 2. Formula extraction (`extract_formulas`)

Uses `openpyxl.load_workbook(..., data_only=False)` to walk **every sheet** and capture cells whose value is a string starting with `=`. The first row of each sheet is treated as headers so each formula carries the column name it belongs to.

### 3. Formula → JavaScript (`excel_formula_to_js`)

Pipeline applied in this order:

1. **Mask string literals** so cell-ref / operator regexes don't touch their contents.
2. **Expand ranges** — `A1:A3` → `[a1, a2, a3]`.
3. **Convert functions** (innermost first), using a template table:

   | Excel | JavaScript |
   |---|---|
   | `SUM(x)` | `(x).reduce((a,b)=>a+(+b\|\|0),0)` |
   | `AVERAGE(x)` / `AVG(x)` | `((x).reduce(...)/(x).length)` |
   | `MIN/MAX(x)` | `Math.min/max(...[].concat(x))` |
   | `ABS / SQRT / ROUND / FLOOR / CEILING / POWER` | `Math.*` equivalents |
   | `IF(c, a, b)` | `((c) ? (a) : (b))` |
   | `IFERROR(a, b)` | IIFE with try/catch |
   | `CONCAT / CONCATENATE(x)` | `[x].join('')` |
   | `LEN / UPPER / LOWER / TRIM` | `String(x).length / .toUpperCase() / …` |
   | `AND / OR / NOT` | `[x].every(Boolean) / .some(Boolean) / !(x)` |
   | `COUNT(x)` | filters non-empty values then `.length` |
   | `MOD(a, b)` | `(a % b)` |

   Unknown functions become `funcname(args)` and their original name is reported in `unknown_functions` so the UI can flag them.

4. **Lowercase remaining cell references** — `A1`, `$B$2` → `a1`, `b2`.
5. **Operators** — `<>`→`!==`, `^`→`**`, `=`→`===` (the regex skips `==` and `=>` so the JS we just generated is preserved), `&`→`+`.
6. **Restore strings.**

### Sample conversions

| Excel | JavaScript |
|---|---|
| `=A1+B1` | `a1+b1` |
| `=SUM(A1:A5)` | `([a1, a2, a3, a4, a5]).reduce((a,b)=>a+(+b\|\|0),0)` |
| `=IF(A1>10, "big", "small")` | `((a1>10) ? ("big") : ("small"))` |
| `=A1&" "&B1` | `a1 + " " + b1` |
| `=IF(A1<>B1, ROUND(C1, 2), 0)` | `((a1!==b1) ? (Math.round(c1, 2)) : (0))` |
| `=A1^2 + SQRT(B1)` | `a1**2 + Math.sqrt(b1)` |
| `=AND(A1>0, B1<100)` | `[a1>0, b1<100].every(Boolean)` |
| `=VLOOKUP(...)` | `vlookup(...)` + `unknown_functions: ["VLOOKUP"]` |

---

## UI

The page renders four sections after a successful upload:

1. **Summary strip** — file name, row/column counts, formula count, derived table name.
2. **Columns table** — original name, sanitized SQL identifier, SQL type, pandas dtype, first non-null sample.
3. **SQL output** — three tabs (`ALTER per column` / `CREATE TABLE` / `Sample INSERTs`) with a copy-to-clipboard button on the active panel.
4. **Formulas table** — sheet, cell, column, original Excel, translated JavaScript, an `ok` / `unknown: …` notes column, and a per-row copy button.

The Converter has its **own** upload (independent of the main analytics session) because formulas need the raw `.xlsx` bytes — pandas only ever sees calculated values, so reading the file a second time with openpyxl is required.

---

## Limitations

- Only `.xlsx` / `.xls` (no `.csv` / `.json` — those have no formulas).
- Sheet-qualified references like `Sheet2!A1` aren't rewritten; the `Sheet2!` prefix is left in place.
- Array formulas, named ranges, and structured table references aren't expanded.
- The `INSERT` output is capped at 50 rows to keep the JSON payload reasonable; `rows_total` reports the real count.
- Unknown functions are passed through lowercased — they parse as JS but won't run unless you provide implementations.

---

## How to use

1. Backend: `python -m uvicorn backend.main:app --reload --port 8000`
2. Frontend: `cd frontend && npm run dev`
3. Open the app, upload any file on the Welcome screen to enter the dashboard.
4. Click **🛠️ Converter** in the sidebar.
5. Drop an `.xlsx`. Results render below; use the copy buttons to grab SQL or JS snippets.
