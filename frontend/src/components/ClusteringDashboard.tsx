"use client"

import React, { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { API_BASE_URL } from "../api/client"

interface AnalyticsProps {
  sessionId: string
}

interface ClusterRow {
  cluster: string
  size: number
  percentage: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_BASE_URL

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const buttonStyle: React.CSSProperties = {
  background: "#0b4f3a",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontWeight: 600,
  cursor: "pointer",
}

const getAnalysis = (payload: any) => payload?.clustering_analysis ?? payload ?? {}
const getKmeans = (analysis: any) => analysis.kmeans ?? analysis.KMeans ?? analysis
const getPca = (analysis: any) => analysis.pca ?? analysis.PCA ?? null

const normalizeClusters = (kmeans: any): ClusterRow[] => {
  const sizes = kmeans?.cluster_sizes ?? kmeans?.sizes ?? {}
  const total = Number(kmeans?.total_records ?? Object.values(sizes).reduce((sum: number, value: any) => sum + Number(value || 0), 0))
  if (Array.isArray(sizes)) {
    return sizes.map((size, index) => ({
      cluster: `Cluster ${index}`,
      size: Number(size) || 0,
      percentage: total ? Number(((Number(size) / total) * 100).toFixed(1)) : 0,
    }))
  }
  return Object.entries(sizes).map(([cluster, size]) => ({
    cluster: `Cluster ${cluster}`,
    size: Number(size) || 0,
    percentage: total ? Number(((Number(size) / total) * 100).toFixed(1)) : 0,
  }))
}

export const ClusteringDashboard: React.FC<AnalyticsProps> = ({ sessionId }) => {
  const [nClusters, setNClusters] = useState(3)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = async () => {
    setLoading(true)
    setError(null)
    try {
      let response = await fetch(`${API_URL}/api/advanced/${sessionId}/clustering?n_clusters=${nClusters}`)
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/advanced/${sessionId}/clustering`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n_clusters: nClusters }),
        })
      }
      if (!response.ok) throw new Error("clustering")
      setResult(await response.json())
    } catch {
      setError("Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }

  const analysis = useMemo(() => getAnalysis(result), [result])
  const kmeans = useMemo(() => getKmeans(analysis), [analysis])
  const pca = useMemo(() => getPca(analysis), [analysis])
  const clusterRows = useMemo(() => normalizeClusters(kmeans), [kmeans])
  const silhouette = Number(kmeans?.silhouette_score ?? 0)
  const silhouetteColor = silhouette >= 0.5 ? "#16a34a" : silhouette >= 0.3 ? "#ca8a04" : "#ef4444"
  const explained = pca?.explained_variance_ratio ?? pca?.explained_variance ?? []
  const cumulative = pca?.cumulative_variance ?? pca?.cumulative_explained_variance ?? []
  const pcaRows = Array.isArray(explained)
    ? explained.map((value: number, index: number) => ({
      component: `PC${index + 1}`,
      variance: Number((Number(value) * 100).toFixed(1)),
    }))
    : []
  const cumulativePct = cumulative?.length ? Number((Number(cumulative[cumulative.length - 1]) * 100).toFixed(1)) : Number((Number(pca?.total_variance_explained ?? 0) * 100).toFixed(1))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#0f172a" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0b4f3a" }}>Clustering & PCA</h2>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          Descubra grupos de comportamento parecidos entre registros do ERP.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 700, fontSize: 12 }}>
            Clusters
            <input
              type="number"
              min={2}
              max={6}
              value={nClusters}
              onChange={(event) => setNClusters(Math.max(2, Math.min(6, Number(event.target.value) || 3)))}
              style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", width: 110 }}
            />
          </label>
          <button type="button" onClick={execute} disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
            Executar
          </button>
        </div>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Carregando...</p>}
      {error && <p style={{ color: "#ef4444" }}>Erro ao carregar dados.</p>}
      {!loading && !result && <div style={cardStyle}><p style={{ margin: 0, color: "#64748b" }}>Execute o clustering para visualizar agrupamentos</p></div>}

      {result && (
        <>
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800 }}>K-Means</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              <div style={statStyle}><span>Silhouette Score</span><strong>{kmeans?.silhouette_score ?? "-"}</strong></div>
              <div style={statStyle}><span>Inertia</span><strong>{kmeans?.inertia ?? "-"}</strong></div>
              <div style={statStyle}><span>Total Records</span><strong>{kmeans?.total_records ?? "-"}</strong></div>
              <div style={statStyle}>
                <span>Qualidade</span>
                <strong style={{ color: silhouetteColor }}>{silhouette >= 0.5 ? "Boa" : silhouette >= 0.3 ? "Moderada" : "Baixa"}</strong>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Tamanho dos agrupamentos</h3>
            {clusterRows.length === 0 ? (
              <p style={{ color: "#64748b" }}>Nenhum agrupamento encontrado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clusterRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="cluster" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="size" fill="#0b4f3a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Cluster</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Registros</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clusterRows.map((row) => (
                    <tr key={row.cluster}>
                      <td style={tdStyle}>{row.cluster}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.size.toLocaleString("pt-BR")}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.percentage.toLocaleString("pt-BR")}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800 }}>PCA</h3>
            {pcaRows.length === 0 ? (
              <p style={{ margin: 0, color: "#64748b" }}>PCA indisponível para os dados atuais.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pcaRows} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis type="category" dataKey="component" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: "8px" }} />
                    <Bar dataKey="variance" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p style={{ margin: "12px 0 0", color: "#0b4f3a", fontWeight: 800 }}>
                  {cumulativePct}% da variância explicada com {pcaRows.length} componentes
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const statStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  color: "#64748b",
  fontSize: 12,
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#64748b",
  textTransform: "uppercase",
  fontSize: 11,
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
}
