import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/session';
import { getTemporalData, type TemporalResponse } from '../api/analytics';
import { TemporalAnalytics } from '../components/TemporalAnalytics';
import '../components/Analytics.css';

function StatCard({ label, value }: { label: string; value: string }) {
return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold text-slate-100">{value || '—'}</p>
    </div>
  );
}

export function TemporalPage() {
const { sessionId, dateCols, numericCols } = useSessionStore();

const [dateCol,     setDateCol]     = useState('');
const [metricCol,   setMetricCol]   = useState('');
const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('month');
const [response,    setResponse]    = useState<TemporalResponse | null>(null);
const [loading,     setLoading]     = useState(false);
const [error,       setError]       = useState<string | null>(null);

// Pre-select first available columns on mount
useEffect(() => {
  if (dateCols.length > 0 && !dateCol)   setDateCol(dateCols[0]);
  if (numericCols.length > 0 && !metricCol) setMetricCol(numericCols[0]);
}, [dateCols, numericCols, dateCol, metricCol]);

const fetchData = useCallback(async () => {
  if (!sessionId || !dateCol || !metricCol) return;
  setLoading(true);
  setError(null);
  try {
    const res = await getTemporalData(sessionId, { date_col: dateCol, metric_col: metricCol, granularity });
    setResponse(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar dados temporais';
    setError(msg);
  } finally {
    setLoading(false);
  }
}, [sessionId, dateCol, metricCol, granularity]);

useEffect(() => { 
  fetchData(); 
}, [fetchData]);

const fmtNumber = (n: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n);

return (
  <div className="p-6 space-y-6">
    {/* Header */}
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Temporal Analysis</h1>
      <p className="text-slate-400 text-sm mt-1">Séries temporais e tendências</p>
    </div>

    {/* Controls */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">
          Coluna de Data
        </label>
        <select
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={dateCol}
          onChange={(e) => setDateCol(e.target.value)}
        >
          <option value="">Selecione...</option>
          {dateCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">
          Métrica
        </label>
        <select
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={metricCol}
          onChange={(e) => setMetricCol(e.target.value)}
        >
          <option value="">Selecione...</option>
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>

    {/* Granularity */}
    <div>
      <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">
        Granularidade
      </label>
      <div className="flex rounded-lg overflow-hidden border border-slate-700 w-fit">
        {(['day', 'month', 'year'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGranularity(g)}
            className={`px-6 py-2 text-sm font-medium transition-colors capitalize ${
              granularity === g
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {g === 'day' ? 'Dia' : g === 'month' ? 'Mês' : 'Ano'}
          </button>
        ))}
      </div>
    </div>

    {/* Summary Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Período"        value={response?.summary.time_range ?? ''} />
      <StatCard label="Total Registros" value={response ? String(response.summary.total_records) : ''} />
      <StatCard label="Média / Período" value={response ? fmtNumber(response.summary.avg_per_period) : ''} />
      <StatCard label="Períodos vazios" value={response ? String(response.summary.data_gaps) : ''} />
    </div>

    {/* Chart */}
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4" style={{ minHeight: 420 }}>
      {loading && (
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center h-80">
          <p className="text-red-400 text-sm">⚠ {error}</p>
        </div>
      )}

      {!loading && !error && (!dateCol || !metricCol) && (
        <div className="flex flex-col items-center justify-center h-80 text-slate-500">
          <p className="text-lg">Selecione a coluna de data e a métrica para visualizar</p>
        </div>
      )}

      {!loading && !error && response && response.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700 text-left">
                <th className="pb-2 pr-4">Data</th>
                <th className="pb-2 pr-4 text-right">Valor</th>
                <th className="pb-2 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {response.data.map((row, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 pr-4 text-slate-200">{row.date}</td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-100">{fmtNumber(row.value)}</td>
                  <td className="py-2 text-right font-mono text-green-400">{fmtNumber(row.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && response && response.data.length === 0 && (
        <div className="flex items-center justify-center h-80 text-slate-500">
          <p>Nenhum dado encontrado para o período selecionado</p>
        </div>
      )}

      {/* NF Analytics - if template is NF */}
      {sessionId && (
        <div style={{ marginTop: '32px' }}>
          <TemporalAnalytics sessionId={sessionId} />
        </div>
      )}
    </div>
  </div>
);
}