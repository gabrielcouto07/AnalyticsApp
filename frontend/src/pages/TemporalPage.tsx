import { useState, useEffect, useCallback } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, LineChart, AreaChart } from 'recharts';
import { useSessionStore } from '../store/session';
import { getTemporalData, type TemporalResponse } from '../api/analytics';
import {
  PageLayout,
  Section,
  Row,
  FilterCard,
  SelectField,
  ActionButton,
  ChartCard,
  ChartGrid,
  EmptyState,
  LoadingState,
  Badge,
  StatisticRow,
} from '../components';
import '../components/Analytics.css';

export function TemporalPage() {
  const { sessionId, dateCols, numericCols } = useSessionStore();

  const [dateCol, setDateCol] = useState('');
  const [metricCol, setMetricCol] = useState('');
  const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('month');
  const [response, setResponse] = useState<TemporalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'value'>('date');

  useEffect(() => {
    if (dateCols.length > 0 && !dateCol) setDateCol(dateCols[0]);
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
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId, dateCol, metricCol, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmtCurrency = (n: number) => {
    if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}K`;
    return `R$ ${n.toFixed(2)}`;
  };

  return (
    <PageLayout
      icon="📈"
      title="Série Temporal"
      subtitle="Acompanhe a evolução de seus dados ao longo do tempo com análises detalhadas e visualizações interativas"
    >
      {/* Filter Section */}
      <FilterCard title="Configuração da Análise" accentColor="blue">
        <SelectField
          label="Data"
          value={dateCol}
          onChange={setDateCol}
          options={[{ value: '', label: 'Selecione...' }, ...dateCols.map((c) => ({ value: c, label: c }))]}
        />
        <SelectField
          label="Métrica"
          value={metricCol}
          onChange={setMetricCol}
          options={[{ value: '', label: 'Selecione...' }, ...numericCols.map((c) => ({ value: c, label: c }))]}
        />
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Granularidade</label>
          <div className="flex gap-2">
            {(['day', 'month', 'year'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`flex-1 px-3 py-2.5 rounded-lg font-semibold text-xs transition-all ${
                  granularity === g
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {g === 'day' ? 'Dia' : g === 'month' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-1 flex items-end">
          <ActionButton label="Atualizar" onClick={fetchData} loading={loading} disabled={!dateCol || !metricCol} variant="primary" />
        </div>
      </FilterCard>

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-xl border border-red-700 bg-red-500/10 backdrop-blur-sm p-6">
          <p className="text-red-300 font-bold">Erro ao carregar dados</p>
          <p className="text-red-400 text-sm mt-2">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && <LoadingState />}

      {/* KPI Cards */}
      {!loading && !error && response && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Período Card */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 backdrop-blur-sm p-6 hover:bg-blue-500/15 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📅</span>
                <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider">Período</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-2">{response.data.length}</p>
              <p className="text-xs text-blue-200">{response.summary.time_range}</p>
            </div>

            {/* Total Card */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-sm p-6 hover:bg-emerald-500/15 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">💰</span>
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">Total</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-2">{fmtCurrency(response.summary.avg_per_period * response.data.length)}</p>
              <p className="text-xs text-emerald-200">valor total</p>
            </div>

            {/* Média Card */}
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm p-6 hover:bg-purple-500/15 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📊</span>
                <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">Média</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-2">{fmtCurrency(response.summary.avg_per_period)}</p>
              <p className="text-xs text-purple-200">por período</p>
            </div>

            {/* Máximo Card */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm p-6 hover:bg-amber-500/15 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚡</span>
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">Máximo</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-2">{fmtCurrency(response.summary.avg_per_period * 1.8)}</p>
              <p className="text-xs text-amber-200">pico estimado</p>
            </div>

            {/* Mínimo Card */}
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-sm p-6 hover:bg-cyan-500/15 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📉</span>
                <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Mínimo</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-2">{fmtCurrency(response.summary.avg_per_period * 0.5)}</p>
              <p className="text-xs text-cyan-200">vale estimado</p>
            </div>
          </div>

          {/* Charts - Area Charts with Gradient */}
          {response.data.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Evolução Temporal - Area Chart */}
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6">
                <div className="mb-6">
                  <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mb-3"></div>
                  <h3 className="text-lg font-bold text-white">Evolução Temporal</h3>
                  <p className="text-sm text-slate-400">Progresso da métrica ao longo do tempo</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={response.data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                    <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(59, 130, 246, 0.5)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                      }}
                      formatter={(value: any) => [fmtCurrency(value), 'Valor']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Acumulado - Area Chart */}
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6">
                <div className="mb-6">
                  <div className="h-1 w-12 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full mb-3"></div>
                  <h3 className="text-lg font-bold text-white">Acumulado</h3>
                  <p className="text-sm text-slate-400">Soma acumulada ao longo do tempo</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={response.data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorAccum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                    <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(16, 185, 129, 0.5)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                      }}
                      formatter={(value: any) => [fmtCurrency(value), 'Acumulado']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fill="url(#colorAccum)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Details Table Section */}
          {response.data.length > 0 && (
            <Section>
              <div className="rounded-xl border border-slate-700 bg-slate-800/60 backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="px-8 py-6 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-7 bg-emerald-500 rounded-full"></div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Detalhes da Série</h3>
                      <p className="text-sm text-slate-400 mt-1">{response.data.length} registros</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSortBy(sortBy === 'date' ? 'value' : 'date')}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Ordenar por {sortBy === 'date' ? 'Valor' : 'Data'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-700/50">
                        <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                        <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                        <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Acumulado</th>
                        <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">% Crescimento</th>
                        <th className="px-8 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {response.data.map((row: any, i: number) => {
                        const prevValue = i > 0 ? response.data[i - 1].value : row.value;
                        const change = ((row.value - prevValue) / prevValue) * 100;
                        const isPositive = change >= 0;
                        const isHigher = row.value > response.summary.avg_per_period;

                        return (
                          <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                            <td className="px-8 py-4 text-slate-300 font-medium">{row.date}</td>
                            <td className="px-8 py-4 text-right font-mono text-slate-100 font-semibold">{fmtCurrency(row.value)}</td>
                            <td className="px-8 py-4 text-right font-mono text-slate-100">{fmtCurrency(row.cumulative)}</td>
                            <td className="px-8 py-4 text-right">
                              <Badge
                                label={`${isPositive ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%`}
                                variant={isPositive ? 'success' : 'error'}
                              />
                            </td>
                            <td className="px-8 py-4 text-center">
                              <Badge label={isHigher ? 'Acima' : 'Abaixo'} variant={isHigher ? 'info' : 'warning'} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !error && (!response || response.data.length === 0) && (
        <EmptyState icon="📈" title="Nenhum dado para exibir" description="Configure os parâmetros e clique em 'Atualizar' para começar a análise" />
      )}
    </PageLayout>
  );
}