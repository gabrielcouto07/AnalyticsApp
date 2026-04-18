import { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';
import { getCorrelationData, type CorrelationResponse } from '../api/analytics';

function StatCard({ label, value, color = 'text-slate-100' }: {
label: string; value: string | number; color?: string;
}) {
return (
  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);
}

export function CorrelationPage() {
const { sessionId } = useSessionStore();
const [data,    setData]    = useState<CorrelationResponse | null>(null);
const [loading, setLoading] = useState(false);
const [error,   setError]   = useState<string | null>(null);

useEffect(() => {
  if (!sessionId) return;
  let mounted = true;
  
  const fetchData = async () => {
    try {
      const res = await getCorrelationData(sessionId);
      if (mounted) setData(res);
    } catch (e) {
      if (mounted) {
        const msg = (e instanceof Error) ? e.message : 'Erro ao carregar correlação'; // type: ignore
        setError(msg);
      }
    } finally {
      if (mounted) setLoading(false);
    }
  };
  
  setLoading(true);
  setError(null);
  fetchData();
  
  return () => { mounted = false; };
}, [sessionId]);

return (
  <div className="p-6 space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Correlation Analysis</h1>
      <p className="text-slate-400 text-sm mt-1">Matriz de correlação entre variáveis numéricas</p>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Tamanho da Matriz"  value={data ? `${data.columns.length}×${data.columns.length}` : '—'} />
      <StatCard label="Correlações Fortes" value={data?.strong_count ?? '—'} color="text-green-400" />
      <StatCard label="Correlações Fracas" value={data?.weak_count   ?? '—'} color="text-yellow-400" />
      <StatCard label="Sem Correlação"     value={data?.no_corr_count ?? '—'} color="text-slate-400" />
    </div>

    {/* Heatmap Table */}
    {!loading && !error && data && data.columns.length > 0 && (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Matriz de Correlação
        </h3>
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="bg-slate-700/50 p-2 text-left text-slate-400 border border-slate-700">Var</th>
              {data.columns.slice(0, 8).map((col) => (
                <th key={col} className="bg-slate-700/50 p-2 text-center text-slate-400 border border-slate-700 w-12 truncate" title={col}>
                  {col.substring(0, 6)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.columns.slice(0, 8).map((row_col, row_idx) => (
              <tr key={row_col}>
                <td className="bg-slate-700/30 p-2 text-left text-slate-300 border border-slate-700 font-mono text-xs truncate max-w-xs" title={row_col}>
                  {row_col.substring(0, 12)}
                </td>
                {data.data[row_idx].slice(0, 8).map((val, col_idx) => {
                  const abs = Math.abs(val);
                  let bgColor = 'bg-slate-700/20';
                  if (abs >= 0.7) bgColor = val > 0 ? 'bg-blue-600/60' : 'bg-red-600/60';
                  else if (abs >= 0.3) bgColor = val > 0 ? 'bg-blue-500/40' : 'bg-red-500/40';
                  return (
                    <td key={col_idx} className={`p-2 text-center border border-slate-700 font-mono text-xs ${bgColor} text-slate-100`} title={val.toFixed(3)}>
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* Top Correlations Table */}
    {data && data.top_correlations.length > 0 && (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Top Correlações
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left pb-2 pr-4">Coluna A</th>
                <th className="text-left pb-2 pr-4">Coluna B</th>
                <th className="text-right pb-2">Correlação (r)</th>
                <th className="text-right pb-2 pl-4">Força</th>
              </tr>
            </thead>
            <tbody>
              {data.top_correlations.map((p, i) => {
                const abs = Math.abs(p.value);
                const color = abs >= 0.7 ? 'text-green-400' : abs >= 0.3 ? 'text-yellow-400' : 'text-slate-400';
                const label = abs >= 0.7 ? 'Forte' : abs >= 0.3 ? 'Moderada' : 'Fraca';
                return (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 pr-4 text-slate-200">{p.col_a}</td>
                    <td className="py-2 pr-4 text-slate-200">{p.col_b}</td>
                    <td className={`py-2 text-right font-mono font-bold ${p.value >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      {p.value.toFixed(3)}
                    </td>
                    <td className={`py-2 pl-4 text-right ${color}`}>{label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);
}