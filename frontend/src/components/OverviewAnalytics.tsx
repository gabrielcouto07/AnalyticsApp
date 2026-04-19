import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface TimelineData {
  period: string;
  total_value: number;
  invoice_count: number;
  avg_value: number;
}

interface NatureData {
  nature: string;
  total_value: number;
  count: number;
}

interface PaymentData {
  method: string;
  value: number;
  percentage: string;
}

export const OverviewAnalytics: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [nature, setNature] = useState<NatureData[]>([]);
  const [payment, setPayment] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `http://localhost:8000/api/templates/nf/analysis/${sessionId}`
        );

        if (res.data) {
          // Processar timeline
          if (res.data.timeline_analysis) {
            const timelineData = Object.entries(res.data.timeline_analysis).map(([period, data]: any) => ({
              period,
              total_value: data.total_value || 0,
              invoice_count: data.invoice_count || 0,
              avg_value: data.avg_invoice_value || 0,
            }));
            setTimeline(timelineData);
          }

          // Processar natureza
          if (res.data.nature_analysis) {
            const natureData = Object.entries(res.data.nature_analysis).map(([nature, data]: any) => ({
              nature: nature || 'Não classificado',
              total_value: data.total_value || 0,
              count: data.invoice_count || 0,
            }));
            setNature(natureData);
          }

          // Processar pagamento
          if (res.data.payment_analysis) {
            const paymentData = Object.entries(res.data.payment_analysis).map(([method, data]: any) => ({
              method,
              value: data.total_value || 0,
              percentage: ((data.total_value / (res.data.summary?.total_value || 1)) * 100).toFixed(1),
            }));
            setPayment(paymentData);
          }
        }
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError('Erro ao carregar análises');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <p>📊 Carregando análises...</p>
      </div>
    );
  }

  if (error) {
    return <div className="analytics-error">❌ {error}</div>;
  }

  return (
    <div className="overview-analytics">
      {/* Timeline Chart */}
      {timeline.length > 0 && (
        <div className="analytics-section">
          <h3>📈 Evolução Temporal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
              <Area type="monotone" dataKey="total_value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Nature Distribution */}
      {nature.length > 0 && (
        <div className="analytics-section">
          <h3>🎯 Distribuição por Natureza</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={nature} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nature" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
              <Legend />
              <Bar dataKey="total_value" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payment Methods Table */}
      {payment.length > 0 && (
        <div className="analytics-section">
          <h3>💳 Análise de Pagamentos</h3>
          <div className="payment-grid">
            {payment.map((p, idx) => (
              <div key={idx} className="payment-card">
                <p className="method">{p.method}</p>
                <p className="value">R$ {(p.value / 1000).toFixed(2)}K</p>
                <p className="percentage">{p.percentage}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
