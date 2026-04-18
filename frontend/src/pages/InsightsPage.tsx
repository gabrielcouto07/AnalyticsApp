import { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';
import { getInsights, type InsightData } from '../api/analytics';

const SEVERITY_CONFIG = {
critical: { bg: 'bg-red-500/10',    border: 'border-red-500/40',    icon: '🔴', label: 'Crítico',  text: 'text-red-400'    },
warning:  { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', icon: '🟡', label: 'Atenção',  text: 'text-yellow-400' },
info:     { bg: 'bg-blue-500/10',   border: 'border-blue-500/40',   icon: '🔵', label: 'Info',     text: 'text-blue-400'   },
};

const TYPE_ICON: Record<string, string> = {
missing_data: '📭',
outlier:      '📊',
correlation:  '🔗',
pattern:      '🔍',
trend:        '📈',
anomaly:      '⚡',
};

function InsightCard({ insight }: { insight: InsightData }) {
const cfg = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.info;
return (
  <div className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 space-y-2`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{TYPE_ICON[insight.type] ?? '💡'}</span>
        <h3 className="text-sm font-semibold text-slate-100">{insight.title}</h3>
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text} whitespace-nowrap`}>
        {cfg.icon} {cfg.label}
      </span>
    </div>
    <p className="text-sm text-slate-300 leading-relaxed">{insight.description}</p>
    {insight.affected_columns.length > 0 && (
      <div className="flex flex-wrap gap-1 pt-1">
        {insight.affected_columns.map((c) => (
          <span key={c} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
            {c}
          </span>
        ))}
      </div>
    )}
  </div>
);
}

export function InsightsPage() {
const { sessionId } = useSessionStore();
const [insights, setInsights] = useState<InsightData[]>([]);
const [loading,  setLoading]  = useState(false);
const [error,    setError]    = useState<string | null>(null);

useEffect(() => {
  if (!sessionId) return;
  let mounted = true;
  
  const fetchData = async () => {
    try {
      const res = await getInsights(sessionId);
      if (mounted) setInsights(res.insights);
    } catch (e) {
      if (mounted) setError(
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          ?? (e as Error).message
          ?? 'Erro ao carregar insights'
      );
    } finally {
      if (mounted) setLoading(false);
    }
  };
  
  setLoading(true);
  setError(null);
  fetchData();
  
  return () => { mounted = false; };
}, [sessionId]);

const critical = insights.filter((i) => i.severity === 'critical');
const warnings = insights.filter((i) => i.severity === 'warning');
const infos    = insights.filter((i) => i.severity === 'info');

return (
  <div className="p-6 space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Insights Automáticos</h1>
      <p className="text-slate-400 text-sm mt-1">
        Observações geradas automaticamente sobre os seus dados
      </p>
    </div>

    {/* Summary Badges */}
    {!loading && insights.length > 0 && (
      <div className="flex gap-3 flex-wrap">
        {critical.length > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-sm text-red-400 font-medium">
            🔴 {critical.length} crítico{critical.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-sm text-yellow-400 font-medium">
            🟡 {warnings.length} atenção
          </span>
        )}
        {infos.length > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-sm text-blue-400 font-medium">
            🔵 {infos.length} informativo{infos.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    )}

    {/* Loading */}
    {loading && (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        <p className="text-slate-400 text-sm">Analisando seus dados...</p>
      </div>
    )}

    {/* Error */}
    {error && !loading && (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 text-sm">
        ⚠ {error}
      </div>
    )}

    {/* Empty */}
    {!loading && !error && insights.length === 0 && (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
        <span className="text-4xl">✅</span>
        <p className="text-lg font-medium text-slate-300">Nenhum problema encontrado</p>
        <p className="text-sm">Seus dados parecem estar em bom estado!</p>
      </div>
    )}

    {/* Insights List */}
    {!loading && !error && insights.length > 0 && (
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>
    )}
  </div>
);
}