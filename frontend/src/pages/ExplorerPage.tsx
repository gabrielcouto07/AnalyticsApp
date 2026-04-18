import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/session';
import { getScatterData, type ScatterResponse } from '../api/analytics';

function CorrCard({ label, value, desc }: { label: string; value: number; desc: string }) {
const abs = Math.abs(value);
const color = abs >= 0.7 ? 'text-green-400' : abs >= 0.3 ? 'text-yellow-400' : 'text-slate-400';
return (
  <div className="bg-slate-900 rounded-lg p-3 text-center">
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`text-xl font-bold font-mono ${color}`}>{value.toFixed(3)}</p>
    <p className="text-xs text-slate-500 mt-1">{desc}</p>
  </div>
);
}

export function ExplorerPage() {
const { sessionId, numericCols, categoricalCols } = useSessionStore();

const [xCol,       setXCol]       = useState('');
const [yCol,       setYCol]       = useState('');
const [colorCol,   setColorCol]   = useState('');
const [showReg,    setShowReg]     = useState(true);
const [result,     setResult]     = useState<ScatterResponse | null>(null);
const [loading,    setLoading]    = useState(false);
const [error,      setError]      = useState<string | null>(null);

useEffect(() => {
  if (numericCols.length >= 2) {
    if (!xCol) setXCol(numericCols[0]);
    if (!yCol) setYCol(numericCols[1]);
  }
}, [numericCols, xCol, yCol]);

const fetchData = useCallback(async () => {
  if (!sessionId || !xCol || !yCol || xCol === yCol) return;
  setLoading(true);
  setError(null);
  try {
    const res = await getScatterData(sessionId, {
      x_col: xCol,
      y_col: yCol,
      color_col: colorCol || undefined,
      sample_n: 5000,
    });
    setResult(res);
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { detail?: string } }; message?: string })
      ?.response?.data?.detail ?? (e as Error).message ?? 'Erro ao carregar scatter';
    setError(msg);
  } finally {
    setLoading(false);
  }
}, [sessionId, xCol, yCol, colorCol]);

useEffect(() => { fetchData(); }, [fetchData]);

// Build summary stats instead of Plotly traces
const summary = result ? {
  total_points: result.data.length,
  x_min: Math.min(...result.data.map(p => p.x)),
  x_max: Math.max(...result.data.map(p => p.x)),
  y_min: Math.min(...result.data.map(p => p.y)),
  y_max: Math.max(...result.data.map(p => p.y)),
} : null;

const corrDesc = (r: number) => {
  const a = Math.abs(r);
  if (a >= 0.9) return 'Muito forte';
  if (a >= 0.7) return 'Forte';
  if (a >= 0.5) return 'Moderada';
  if (a >= 0.3) return 'Fraca';
  return 'Muito fraca';
};

return (
  <div className="p-6 space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Data Explorer</h1>
      <p className="text-slate-400 text-sm mt-1">Análise bivariada e scatter plots</p>
    </div>

    {/* Controls */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Eixo X</label>
        <select
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={xCol} onChange={(e) => setXCol(e.target.value)}
        >
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Eixo Y</label>
        <select
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={yCol} onChange={(e) => setYCol(e.target.value)}
        >
          {numericCols.filter((c) => c !== xCol).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">
          Cor (opcional)
        </label>
        <select
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={colorCol} onChange={(e) => setColorCol(e.target.value)}
        >
          <option value="">Nenhum</option>
          {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showReg}
            onChange={(e) => setShowReg(e.target.checked)}
            className="w-4 h-4 rounded accent-blue-500"
          />
          <span className="text-sm text-slate-300">Linha de regressão</span>
        </label>
      </div>
    </div>

    {loading && (
      <div className="flex items-center justify-center h-64 bg-slate-800 rounded-xl border border-slate-700">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )}
    {error && !loading && (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 text-sm">⚠ {error}</div>
    )}

    {!loading && !error && result && (
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Resumo dos Dados
          </h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Total de Pontos</p>
              <p className="text-lg font-bold text-slate-100">{summary?.total_points}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{xCol} (Min-Max)</p>
              <p className="text-lg font-bold text-slate-100 font-mono">{summary?.x_min.toFixed(2)} - {summary?.x_max.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{yCol} (Min-Max)</p>
              <p className="text-lg font-bold text-slate-100 font-mono">{summary?.y_min.toFixed(2)} - {summary?.y_max.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Equação</p>
              <p className="text-sm font-mono text-slate-300">y = {result.regression.slope.toFixed(4)}x + {result.regression.intercept.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Sample Data Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Amostra dos Dados (primeiros 20)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left pb-2 pr-4">{xCol}</th>
                <th className="text-left pb-2 pr-4">{yCol}</th>
                {colorCol && <th className="text-left pb-2 pr-4">{colorCol}</th>}
              </tr>
            </thead>
            <tbody>
              {result.data.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 pr-4 font-mono text-slate-200">{row.x.toFixed(4)}</td>
                  <td className="py-2 pr-4 font-mono text-slate-200">{row.y.toFixed(4)}</td>
                  {colorCol && <td className="py-2 pr-4 text-slate-300">{row.color ?? 'N/A'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Correlation Panel */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Coeficientes de Correlação
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <CorrCard
              label="Pearson"
              value={result.correlation.pearson}
              desc={corrDesc(result.correlation.pearson)}
            />
            <CorrCard
              label="Spearman"
              value={result.correlation.spearman}
              desc={corrDesc(result.correlation.spearman)}
            />
            <CorrCard
              label="Kendall"
              value={result.correlation.kendall}
              desc={corrDesc(result.correlation.kendall)}
            />
          </div>
          {result.regression.p_value < 0.05 ? (
            <p className="text-xs text-green-400 mt-3">
              ✓ Regressão estatisticamente significativa (p = {result.regression.p_value.toFixed(4)})
            </p>
          ) : (
            <p className="text-xs text-yellow-400 mt-3">
              ⚠ Relação não significativa (p = {result.regression.p_value.toFixed(4)})
            </p>
          )}
        </div>
      </div>
    )}
  </div>
);
}