import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TemporalMetrics {
  period: string;
  total_nfs: number;
  total_value: number;
  avg_value: number;
  max_value: number;
  min_value: number;
}

export const TemporalAnalytics: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [data, setData] = useState<TemporalMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await axios.get(
          `http://localhost:8000/api/templates/nf/analysis/${sessionId}`
        );

        if (res.data.timeline_analysis) {
          const timelineData = Object.entries(res.data.timeline_analysis).map(([period, data]: any) => ({
            period,
            total_nfs: data.invoice_count || 0,
            total_value: data.total_value || 0,
            avg_value: data.avg_invoice_value || 0,
            max_value: data.max_value || 0,
            min_value: data.min_value || 0,
          }));
          setData(timelineData);

          // Calcular estatísticas
          const totalValue = timelineData.reduce((sum, d) => sum + d.total_value, 0);
          const totalNFs = timelineData.reduce((sum, d) => sum + d.total_nfs, 0);
          const avgNFsPerPeriod = (totalNFs / timelineData.length).toFixed(2);
          
          setStats({
            periods: timelineData.length,
            totalValue,
            totalNFs,
            avgNFsPerPeriod,
            maxValue: Math.max(...timelineData.map(d => d.max_value)),
            minValue: Math.min(...timelineData.map(d => d.min_value)),
          });
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  if (loading) return <div className="analytics-loading">📊 Carregando dados temporais...</div>;

  return (
    <div className="temporal-analytics">
      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <p className="label">Períodos</p>
            <p className="value">{stats.periods}</p>
          </div>
          <div className="stat-card">
            <p className="label">Total de NFs</p>
            <p className="value">{stats.totalNFs}</p>
          </div>
          <div className="stat-card">
            <p className="label">NFs/Período</p>
            <p className="value">{stats.avgNFsPerPeriod}</p>
          </div>
          <div className="stat-card">
            <p className="label">Valor Total</p>
            <p className="value">R$ {(stats.totalValue / 1000).toFixed(0)}K</p>
          </div>
        </div>
      )}

      {/* Timeline Chart - Total Value */}
      <div className="chart-container">
        <h3>📈 Evolução de Valores por Período</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="total_value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            <Line yAxisId="right" type="monotone" dataKey="total_nfs" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Timeline Chart - Average Value */}
      <div className="chart-container">
        <h3>💰 Valor Médio por Período</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(2)}K`} />
            <Line type="monotone" dataKey="avg_value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="table-container">
        <h3>📋 Detalhes por Período</h3>
        <table className="temporal-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>NFs</th>
              <th>Valor Total</th>
              <th>Valor Médio</th>
              <th>Máximo</th>
              <th>Mínimo</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td><strong>{row.period}</strong></td>
                <td>{row.total_nfs}</td>
                <td>R$ {(row.total_value / 1000).toFixed(2)}K</td>
                <td>R$ {(row.avg_value / 1000).toFixed(2)}K</td>
                <td>R$ {(row.max_value / 1000).toFixed(2)}K</td>
                <td>R$ {(row.min_value / 1000).toFixed(2)}K</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
