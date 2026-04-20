import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/session';
import { getRankingData, type RankingRow } from '../api/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  PageLayout,
  FilterCard,
  InfoGrid,
  ChartCard,
  ChartGrid,
  EmptyState,
  SelectField,
  ActionButton,
  Badge,
  LoadingState,
  StatisticRow,
} from '../components';

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

  const chartData = rows.slice(0, Math.min(10, rows.length)).map(r => ({
    name: r.category.substring(0, 15) + (r.category.length > 15 ? '...' : ''),
    value: r.value,
  }));

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#06b6d4'];
  
  const topValue = rows.length > 0 ? rows[0].value : 0;
  const bottomValue = rows.length > 0 ? rows[rows.length - 1].value : 0;
  const avgValue = rows.length > 0 ? rows.reduce((sum, r) => sum + r.value, 0) / rows.length : 0;

  const statsItems = [
    { label: '📂 Categoria', value: catCol || '—', sublabel: 'agrupamento' },
    { label: '📊 Métrica', value: numCol || '—', sublabel: 'valor analisado' },
    { label: '⚙️ Agregação', value: AGG_OPTIONS.find(o => o.value === aggFn)?.label || 'Soma', sublabel: 'função aplicada' },
    { label: '🔝 Top N', value: topN.toString(), sublabel: 'registros' },
    { label: '📈 Direção', value: direction === 'top' ? '↑ Maiores' : '↓ Menores', sublabel: 'direção' },
  ];

  return (
    <PageLayout icon="🏅" title="Rankings" subtitle="Analise e compare os melhores e piores valores por categoria com visualizações profissionais">
      {!loading && !error && (
        <>
          <FilterCard title="Configuração" accentColor="amber">
            <SelectField
              label="Categoria"
              value={catCol}
              onChange={(e) => setCatCol(e.target.value)}
              options={categoricalCols.map(c => ({ value: c, label: c }))}
            />
            <SelectField
              label="Métrica"
              value={numCol}
              onChange={(e) => setNumCol(e.target.value)}
              options={numericCols.map(c => ({ value: c, label: c }))}
            />
            <SelectField
              label="Agregação"
              value={aggFn}
              onChange={(e) => setAggFn(e.target.value)}
              options={AGG_OPTIONS}
            />
            <SelectField
              label="Top N"
              value={topN.toString()}
              onChange={(e) => setTopN(Number(e.target.value))}
              options={TOP_N_OPTIONS.map(n => ({ value: n.toString(), label: n.toString() }))}
            />
            <div className="flex gap-3 items-end">
              <button
                onClick={() => setDirection('top')}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                  direction === 'top'
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ↑ Maiores
              </button>
              <button
                onClick={() => setDirection('bottom')}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                  direction === 'bottom'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ↓ Menores
              </button>
            </div>
            <ActionButton
              label="Carregar"
              onClick={fetchData}
              disabled={loading || !catCol || !numCol}
              variant="amber"
            />
          </FilterCard>

          <InfoGrid items={statsItems} columns={5} />
        </>
      )}

      {loading && <LoadingState message="Carregando ranking..." />}

      {error && !loading && (
        <Badge variant="error" title="Erro ao carregar ranking" message={error} />
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon="📊"
          title="Nenhum ranking carregado"
          description="Configure os parâmetros e clique em 'Carregar' para visualizar o ranking"
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Top 3 Podium */}
          {rows.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {rows.slice(0, 3).map((r, idx) => (
                <ChartCard
                  key={r.rank}
                  title={idx === 0 ? '🥇 Ouro' : idx === 1 ? '🥈 Prata' : '🥉 Bronze'}
                  subtitle={`#${r.rank} - ${r.category}`}
                  size="small"
                >
                  <div className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold text-white mb-2">{fmt(r.value)}</p>
                      <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            idx === 0 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                            idx === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                            'bg-gradient-to-r from-orange-500 to-orange-600'
                          }`}
                          style={{ width: `${(r.value / topValue) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{((r.value / topValue) * 100).toFixed(0)}% do topo</p>
                    </div>
                  </div>
                </ChartCard>
              ))}
            </div>
          )}

          {/* Charts & Stats Row */}
          <ChartGrid cols={2}>
            {/* Bar Chart */}
            {chartData.length > 0 && (
              <ChartCard
                title="Top Rankings"
                subtitle={`Top ${Math.min(10, rows.length)} categor${rows.length > 1 ? 'ias' : 'ia'}`}
                size="medium"
              >
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        style={{ fontSize: 11 }}
                      />
                      <YAxis stroke="#94a3b8" style={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(71, 85, 105, 0.5)',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any) => [fmt(value), 'Valor']}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            )}

            {/* Statistics */}
            <ChartCard
              title="Estatísticas"
              subtitle="Resumo dos valores"
              size="medium"
            >
              <div className="space-y-3">
                <StatisticRow icon="🔝" label="Máximo" value={fmt(topValue)} color="amber" />
                <StatisticRow icon="📊" label="Média" value={fmt(avgValue)} color="blue" />
                <StatisticRow icon="📉" label="Mínimo" value={fmt(bottomValue)} color="red" />
                <StatisticRow icon="📈" label="Diferença" value={fmt(topValue - bottomValue)} color="emerald" />
                <StatisticRow icon="⚡" label="Proporção" value={`${(topValue / bottomValue).toFixed(1)}x`} color="purple" />
              </div>
            </ChartCard>
          </ChartGrid>

          {/* Ranking Table */}
          <ChartCard
            title="Ranking Completo"
            subtitle={`${rows.length} registros no total`}
            size="large"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50 border-b border-slate-700/50">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">% do Total</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">vs. Média</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {rows.map((r) => {
                    const isTopPerfomer = r.rank <= 3;
                    const isAboveAvg = r.value > avgValue;

                    return (
                      <tr key={r.rank} className={`hover:bg-slate-700/20 transition-colors ${
                        isTopPerfomer ? 'bg-slate-700/10' : ''
                      }`}>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-mono font-bold ${
                            r.rank === 1 ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' :
                            r.rank === 2 ? 'bg-gray-400/20 border border-gray-400/40 text-gray-300' :
                            r.rank === 3 ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300' :
                            'bg-slate-700/20 border border-slate-600/40 text-slate-300'
                          }`}>
                            {r.rank}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-200 max-w-xs truncate font-medium">{r.category}</td>
                        <td className="px-6 py-4 text-right font-mono text-slate-100 font-semibold">{fmt(r.value)}</td>
                        <td className="px-6 py-4 text-right text-slate-300">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                                style={{ width: `${Math.min(r.pct_of_total, 100)}%` }}
                              ></div>
                            </div>
                            <span className="font-medium text-xs w-12 text-right">{r.pct_of_total.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${r.vs_mean_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className="inline-block">{fmtPct(r.vs_mean_pct)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            isAboveAvg ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600/20 text-slate-300'
                          }`}>
                            {isAboveAvg ? '↑ Acima' : '↓ Abaixo'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </PageLayout>
  );
}