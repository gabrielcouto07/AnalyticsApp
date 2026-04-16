import { useCallback, useState } from "react"
import { analyzeXlsx, type ConverterResult } from "../api/converter"

type SqlTab = "alter" | "create" | "insert"

export function ConverterPage() {
  const [data, setData]       = useState<ConverterResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<SqlTab>("alter")
  const [dragging, setDragging] = useState(false)

  const onFile = useCallback(async (file: File) => {
    setLoading(true); setError(null); setData(null)
    try {
      const result = await analyzeXlsx(file)
      setData(result)
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Erro ao processar arquivo")
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>
          XLSX → SQL & JavaScript Converter
        </h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>
          Upload an .xlsx file. Each column becomes an <code>ALTER TABLE … ADD COLUMN</code> statement,
          and every Excel formula is translated to a JavaScript expression.
        </p>
      </div>

      {/* Upload zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false)
          const f = e.dataTransfer.files[0]; if (f) onFile(f)
        }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "160px", padding: "24px",
          borderRadius: "12px",
          border: `2px dashed ${dragging ? "#4f8ef7" : "#334155"}`,
          backgroundColor: dragging ? "rgba(79,142,247,0.08)" : "rgba(30,41,59,0.5)",
          cursor: "pointer",
          opacity: loading ? 0.6 : 1,
          pointerEvents: loading ? "none" : "auto",
        }}
      >
        <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
          onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div style={{ fontSize: "40px", marginBottom: "10px" }}>{loading ? "⚙️" : "📥"}</div>
        <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#f1f5f9" }}>
          {loading ? "Analyzing..." : "Drop an .xlsx here or click to choose"}
        </p>
        <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
          Only Excel files are supported on this page
        </p>
      </label>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "10px",
          backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
          color: "#fca5a5", fontSize: "13px" }}>
          ⚠️ {error}
        </div>
      )}

      {data && (
        <>
          <SummaryStrip data={data} />
          <ColumnsCard data={data} />
          <SqlCard data={data} tab={tab} setTab={setTab} />
          <FormulasCard data={data} />
        </>
      )}
    </div>
  )
}

// ---------- Sub-components ----------

function SummaryStrip({ data }: { data: ConverterResult }) {
  const items: [string, string | number][] = [
    ["File", data.filename],
    ["Rows", data.rows.toLocaleString()],
    ["Columns", data.column_count],
    ["Formulas", data.formula_count],
    ["Table", data.sql.table_name],
  ]
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
      {items.map(([label, value]) => (
        <div key={label} style={cardStyle}>
          <p style={labelStyle}>{label}</p>
          <p style={{ margin: "6px 0 0 0", fontSize: "16px", fontWeight: 700, color: "#f1f5f9",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={String(value)}>
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}

function ColumnsCard({ data }: { data: ConverterResult }) {
  return (
    <section style={cardStyle}>
      <SectionHeader title="Columns" subtitle="Detected columns and inferred SQL types" />
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Original", "SQL identifier", "SQL type", "pandas dtype", "Sample"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.columns.map(c => (
              <tr key={c.safe}>
                <td style={tdStyle}>{c.original}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", color: "#4f8ef7" }}>{c.safe}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", color: "#a78bfa" }}>{c.sql_type}</td>
                <td style={{ ...tdStyle, color: "#94a3b8" }}>{c.pandas_dtype}</td>
                <td style={{ ...tdStyle, color: "#cbd5e1", maxWidth: "260px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.sample}>
                  {c.sample || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SqlCard({ data, tab, setTab }: { data: ConverterResult; tab: SqlTab; setTab: (t: SqlTab) => void }) {
  const tabs: { id: SqlTab; label: string; count?: number }[] = [
    { id: "alter",  label: "ALTER per column", count: data.sql.alter_columns.length },
    { id: "create", label: "CREATE TABLE" },
    { id: "insert", label: "Sample INSERTs", count: data.sql.rows_inserted },
  ]

  let body = ""
  if (tab === "alter")  body = data.sql.alter_columns.map(a => `-- ${a.column}\n${a.sql}`).join("\n\n")
  if (tab === "create") body = data.sql.create_table
  if (tab === "insert") body = data.sql.inserts.join("\n")

  return (
    <section style={cardStyle}>
      <SectionHeader
        title="SQL output"
        subtitle={`Showing ${data.sql.rows_inserted} of ${data.sql.rows_total} rows for INSERTs`}
        right={<CopyButton text={body} />}
      />
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              border: "1px solid", cursor: "pointer", transition: "all 0.15s ease",
              backgroundColor: tab === t.id ? "rgba(79,142,247,0.15)" : "transparent",
              borderColor:    tab === t.id ? "#4f8ef7" : "#334155",
              color:          tab === t.id ? "#4f8ef7" : "#cbd5e1",
            }}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>
      <pre style={codeBlockStyle}>{body || "—"}</pre>
    </section>
  )
}

function FormulasCard({ data }: { data: ConverterResult }) {
  if (data.formula_count === 0) {
    return (
      <section style={cardStyle}>
        <SectionHeader title="Excel formulas → JavaScript" subtitle="None found in this workbook" />
      </section>
    )
  }
  return (
    <section style={cardStyle}>
      <SectionHeader title="Excel formulas → JavaScript"
        subtitle={`${data.formula_count} formula${data.formula_count === 1 ? "" : "s"} translated`} />
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>{["Sheet", "Cell", "Column", "Excel", "JavaScript", "Notes", ""].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {data.formulas.map((f, i) => (
              <tr key={`${f.sheet}-${f.cell}-${i}`}>
                <td style={tdStyle}>{f.sheet}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", color: "#4f8ef7" }}>{f.cell}</td>
                <td style={tdStyle}>{f.column || "—"}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", color: "#cbd5e1",
                    maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={f.excel}>{f.excel}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", color: "#34c97e",
                    maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={f.javascript}>{f.javascript}</td>
                <td style={{ ...tdStyle, color: f.unknown_functions.length ? "#f5a623" : "#64748b", fontSize: "11px" }}>
                  {f.unknown_functions.length
                    ? `unknown: ${f.unknown_functions.join(", ")}`
                    : "ok"}
                </td>
                <td style={tdStyle}><CopyButton text={f.javascript} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------- Tiny shared bits ----------

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f1f5f9" }}>{title}</h3>
        {subtitle && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

function CopyButton({ text, compact }: { text: string; compact?: boolean }) {
  const [done, setDone] = useState(false)
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true); setTimeout(() => setDone(false), 1500)
    } catch { /* no-op */ }
  }
  return (
    <button onClick={onClick} style={{
      padding: compact ? "4px 8px" : "6px 12px",
      fontSize: compact ? "11px" : "12px", fontWeight: 600,
      borderRadius: "8px", border: "1px solid #334155",
      backgroundColor: done ? "rgba(52,201,126,0.15)" : "rgba(79,142,247,0.1)",
      color: done ? "#34c97e" : "#4f8ef7",
      cursor: "pointer", transition: "all 0.15s ease",
    }}>
      {done ? "✓ Copied" : "Copy"}
    </button>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "rgba(30, 41, 59, 0.6)",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "20px",
}

const labelStyle: React.CSSProperties = {
  margin: 0, fontSize: "11px", fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: "0.5px",
}

const tableStyle: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", fontSize: "12px",
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px",
  borderBottom: "1px solid #334155",
  fontSize: "11px", fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: "0.5px",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(51,65,85,0.5)",
  color: "#f1f5f9",
}

const codeBlockStyle: React.CSSProperties = {
  margin: 0, padding: "16px",
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "10px",
  color: "#e2e8f0",
  fontFamily: "Menlo, Consolas, monospace",
  fontSize: "12px",
  lineHeight: 1.6,
  overflow: "auto",
  maxHeight: "420px",
  whiteSpace: "pre",
}
