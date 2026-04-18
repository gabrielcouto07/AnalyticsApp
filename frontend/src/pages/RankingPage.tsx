import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/session';
import { getRankingData, type RankingRow } from '../api/analytics';

const AGG_OPTIONS = [
  { value: 'sum',   label: 'Soma' },
  { value: 'mean',  label: 'Média' },
  { value: 'count', label: 'Contagem' },
  { value: 'max',   label: 'Máximo' },
  { value: 'min',   label: 'Mínimo' },
];

const TOP_N_OPTIONS = [5, 10, 15, 20, 50];

export function RankingPage() {
  const { sessionId, numericCols, categoricalCols } = useSessionStore();

  const [catCol,    setCatCol]    = useState('');
  const [numCol,    setNumCol]    = useState('');
  const [aggFn,     setAggFn]     = useState('sum');
  const [topN,      setTopN]      = useState(10);
  const [direction, setDirection] = useState<'top' | 'bottom'>('top');
  const [rows,      setRows]      = useState<RankingRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (categoricalCols.length > 0 && !catCol) setCatCol(categoricalCols[0]);
    if (numericCols.length > 0 && !numCol)     setNumCol(numericCols[0]);
  }, [categoricalCols, numericCols, catCol, numCol]);

  const fetchData = useCallback(async () => {
    if (!sessionId || !catCol || !numCol) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRankingData(sessionId, {
        cat_col: catCol, num_col: numCol, agg_fn: aggFn, top_n: topN, direction,
      });
      setRows(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (e as Error).message ?? 'Erro ao carregar ranking';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId, catCol, numCol, aggFn, topN, direction]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n);
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Rankings</h1>
        <p className="text-slate-400 text-sm mt-1">Análise de valores por categoria</p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Categoria</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={catCol} onChange={(e) => setCatCol(e.target.value)}
          >
            {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Métrica</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={numCol} onChange={(e) => setNumCol(e.target.value)}
          >
            {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Agregação</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={aggFn} onChange={(e) => setAggFn(e.target.value)}
          >
            {AGG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Top N</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={topN} onChange={(e) => setTopN(Number(e.target.value))}
          >
            {TOP_N_OPTIONS.map((n) => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div>
      </div>

      {/* Top / Bottom Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-700 w-fit">
        {(['top', 'bottom'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              direction === d ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {d === 'top' ? '▲ Top' : '▼ Bottom'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 bg-slate-800 rounded-xl border border-slate-700">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 text-sm">⚠ {error}</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Ranking de {catCol}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-left">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Categoria</th>
                  <th className="pb-2 pr-4 text-right">Valor</th>
                  <th className="pb-2 pr-4 text-right">% do Total</th>
                  <th className="pb-2 text-right">vs. Média</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rank} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 pr-4 text-slate-500 font-mono">{r.rank}</td>
                    <td className="py-2 pr-4 text-slate-200 max-w-xs truncate">{r.category}</td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-100">{fmt(r.value)}</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{r.pct_of_total.toFixed(1)}%</td>
                    <td className={`py-2 text-right font-medium ${r.vs_mean_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmtPct(r.vs_mean_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}