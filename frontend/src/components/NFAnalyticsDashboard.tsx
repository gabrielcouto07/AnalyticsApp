import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { api } from '../api/client';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ScatterChart, Scatter, AreaChart, Area, ComposedChart
} from 'recharts';
import './NFAnalytics.css';

interface Summary {
  total_nfs: number;
  total_value: number;
  unique_suppliers: number;
  average_invoice_value: number;
}

interface Supplier {
  supplier: string;
  total_value: number;
  invoice_count: number;
  avg_invoice_value: number;
  min_value: number;
  max_value: number;
}

interface Nature {
  nature: string;
  total_value: number;
  invoice_count: number;
  avg_value: number;
}

interface PaymentMethod {
  method: string;
  total_value: number;
  invoice_count: number;
  avg_value: number;
}

interface Timeline {
  period: string;
  total_value: number;
  invoice_count: number;
  avg_value: number;
}

interface TopInvoice {
  nf: string;
  supplier: string;
  value: number;
  nature: string;
  payment_method: string;
  due_date: string;
}

interface TrendMetric {
  label: string;
  current: number;
  previous?: number;
  trend?: 'up' | 'down' | 'stable';
  percentChange?: number;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

// Helper function to calculate trend
const calculateTrend = (current: number, previous?: number) => {
  if (!previous || previous === 0) return { trend: 'stable', percentChange: 0 };
  const change = ((current - previous) / previous) * 100;
  return {
    trend: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
    percentChange: Math.abs(change)
  };
};

export const NFAnalyticsDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [nature, setNature] = useState<Nature[]>([]);
  const [payment, setPayment] = useState<PaymentMethod[]>([]);
  const [timeline, setTimeline] = useState<Timeline[]>([]);
  const [topInvoices, setTopInvoices] = useState<TopInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Calculate derived metrics and trends
  const metrics = useMemo(() => {
    if (!timeline || timeline.length === 0) return null;
    
    const current = timeline[timeline.length - 1];
    const previous = timeline.length > 1 ? timeline[timeline.length - 2] : undefined;
    
    return {
      valueTrend: calculateTrend(current?.total_value || 0, previous?.total_value),
      countTrend: calculateTrend(current?.invoice_count || 0, previous?.invoice_count),
      avgTrend: calculateTrend(current?.avg_value || 0, previous?.avg_value)
    };
  }, [timeline]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!summary || !suppliers || !nature || suppliers.length === 0) return null;
    
    const topSupplier = suppliers[0];
    const concentration = topSupplier?.total_value && summary?.total_value 
      ? (topSupplier.total_value / summary.total_value) * 100 
      : 0;
    const avgInvoiceSize = summary?.average_invoice_value || 0;
    const largeInvoices = topInvoices.filter(inv => inv.value > avgInvoiceSize * 1.5).length;
    
    return {
      concentration,
      topSupplierShare: topSupplier,
      largeInvoiceCount: largeInvoices,
      avgSize: avgInvoiceSize,
      categoryCount: nature.length,
      paymentMethodCount: payment.length
    };
  }, [summary, suppliers, nature, topInvoices, payment]);

  useEffect(() => {
    loadAllData();
  }, [sessionId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all analytics in parallel
      const baseURL = api.defaults.baseURL;
      const [statsRes, suppliersRes, natureRes, paymentRes, timelineRes, invoicesRes] = await Promise.all([
        axios.get(`${baseURL}/api/templates/nf/stats/${sessionId}`),
        axios.get(`${baseURL}/api/templates/nf/suppliers/${sessionId}?limit=20`),
        axios.get(`${baseURL}/api/templates/nf/nature/${sessionId}`),
        axios.get(`${baseURL}/api/templates/nf/payment/${sessionId}`),
        axios.get(`${baseURL}/api/templates/nf/timeline/${sessionId}`),
        axios.get(`${baseURL}/api/templates/nf/top-invoices/${sessionId}?limit=20`)
      ]);

      setSummary(statsRes.data.summary);
      setSuppliers(suppliersRes.data);
      setNature(natureRes.data);
      setPayment(paymentRes.data);
      setTimeline(timelineRes.data);
      setTopInvoices(invoicesRes.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Erro ao carregar análises. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-container loading">
        <div className="spinner"></div>
        <p>Carregando análises completas...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="analytics-container error">
        <p>❌ {error || 'Erro ao carregar dados'}</p>
        <button onClick={loadAllData} className="retry-button">Tentar Novamente</button>
      </div>
    );
  }

  return (
    <div className="nf-analytics-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>📊 Análise Completa de Notas Fiscais</h1>
        <p className="subtitle">Dashboard com todas as dimensões de análise</p>
      </div>

      {/* Enhanced KPI Cards with Trend Indicators */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">📋</div>
          <div className="kpi-content">
            <p className="kpi-label">Total de NFs</p>
            <p className="kpi-value">{summary?.total_nfs.toLocaleString('pt-BR') || '—'}</p>
            {metrics?.countTrend && (
              <div className={`kpi-trend trend-${metrics.countTrend.trend}`}>
                <span>{metrics.countTrend.trend === 'up' ? '📈' : metrics.countTrend.trend === 'down' ? '📉' : '➡️'}</span>
                <span>{metrics.countTrend.percentChange.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">💵</div>
          <div className="kpi-content">
            <p className="kpi-label">Valor Total</p>
            <p className="kpi-value">R$ {summary ? (summary.total_value / 1000000).toFixed(2) : '—'}M</p>
            {metrics?.valueTrend && (
              <div className={`kpi-trend trend-${metrics.valueTrend.trend}`}>
                <span>{metrics.valueTrend.trend === 'up' ? '📈' : metrics.valueTrend.trend === 'down' ? '📉' : '➡️'}</span>
                <span>{metrics.valueTrend.percentChange.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">🏢</div>
          <div className="kpi-content">
            <p className="kpi-label">Fornecedores</p>
            <p className="kpi-value">{summary?.unique_suppliers || '—'}</p>
            <div className="kpi-subtitle">Únicos ativos</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">📈</div>
          <div className="kpi-content">
            <p className="kpi-label">Média/NF</p>
            <p className="kpi-value">R$ {summary ? (summary.average_invoice_value / 1000).toFixed(1) : '—'}K</p>
            {metrics?.avgTrend && (
              <div className={`kpi-trend trend-${metrics.avgTrend.trend}`}>
                <span>{metrics.avgTrend.trend === 'up' ? '📈' : metrics.avgTrend.trend === 'down' ? '📉' : '➡️'}</span>
                <span>{metrics.avgTrend.percentChange.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {['overview', 'evolution', 'suppliers', 'category', 'payment', 'timeline', 'insights', 'invoices'].map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && '📊 Visão Geral'}
              {tab === 'evolution' && '🔄 Evolução'}
              {tab === 'suppliers' && '🏢 Fornecedores'}
              {tab === 'category' && '🏷️ Categorias'}
              {tab === 'payment' && '💳 Pagamento'}
              {tab === 'timeline' && '📅 Cronologia'}
              {tab === 'insights' && '💡 Insights'}
              {tab === 'invoices' && '📄 Maiores Valores'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <div className="charts-row">
              <div className="chart-box">
                <h3>Top 10 Fornecedores por Valor</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={suppliers.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="supplier" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(0)}K`} />
                    <Bar dataKey="total_value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-box">
                <h3>Distribuição por Categoria</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={nature}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ nature }) => nature}
                      outerRadius={80}
                      dataKey="total_value"
                    >
                      {nature.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(0)}K`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <div className="tab-pane">
            <div className="table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fornecedor</th>
                    <th>Valor Total</th>
                    <th>Qtd NFs</th>
                    <th>Média/NF</th>
                    <th>Mínimo</th>
                    <th>Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier, idx) => (
                    <tr key={idx}>
                      <td className="rank">{idx + 1}</td>
                      <td className="name">{supplier.supplier}</td>
                      <td className="value">R$ {(supplier.total_value / 1000).toFixed(1)}K</td>
                      <td className="count">{supplier.invoice_count}</td>
                      <td className="avg">R$ {(supplier.avg_invoice_value / 1000).toFixed(1)}K</td>
                      <td className="min">R$ {(supplier.min_value / 1000).toFixed(1)}K</td>
                      <td className="max">R$ {(supplier.max_value / 1000).toFixed(1)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category Tab */}
        {activeTab === 'category' && (
          <div className="tab-pane">
            <div className="charts-row">
              <div className="chart-box full-width">
                <h3>Valor por Categoria</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={nature}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nature" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(0)}K`} />
                    <Bar dataKey="total_value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Valor Total</th>
                    <th>Qtd NFs</th>
                    <th>Média</th>
                    <th>% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {nature.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.nature}</td>
                      <td>R$ {(item.total_value / 1000).toFixed(1)}K</td>
                      <td>{item.invoice_count}</td>
                      <td>R$ {(item.avg_value / 1000).toFixed(1)}K</td>
                      <td>{((item.total_value / summary.total_value) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <div className="tab-pane">
            <div className="charts-row">
              <div className="chart-box">
                <h3>Distribuição de Pagamento</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={payment}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ method }) => method}
                      outerRadius={80}
                      dataKey="total_value"
                    >
                      {payment.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(0)}K`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Método</th>
                    <th>Valor Total</th>
                    <th>Qtd NFs</th>
                    <th>Média</th>
                    <th>% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payment.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.method}</td>
                      <td>R$ {(item.total_value / 1000).toFixed(1)}K</td>
                      <td>{item.invoice_count}</td>
                      <td>R$ {(item.avg_value / 1000).toFixed(1)}K</td>
                      <td>{((item.total_value / summary.total_value) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="tab-pane">
            <div className="charts-row full-width">
              <div className="chart-box full-width">
                <h3>Evolução Temporal</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(0)}K`} />
                    <Legend />
                    <Line type="monotone" dataKey="total_value" stroke="#8b5cf6" name="Valor Total" />
                    <Line type="monotone" dataKey="avg_value" stroke="#f59e0b" name="Média" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Valor Total</th>
                    <th>Qtd NFs</th>
                    <th>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.period}</td>
                      <td>R$ {(item.total_value / 1000).toFixed(1)}K</td>
                      <td>{item.invoice_count}</td>
                      <td>R$ {(item.avg_value / 1000).toFixed(1)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="tab-pane">
            <div className="table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>NF</th>
                    <th>Fornecedor</th>
                    <th>Valor</th>
                    <th>Categoria</th>
                    <th>Pagamento</th>
                    <th>Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {topInvoices.map((invoice, idx) => (
                    <tr key={idx}>
                      <td className="rank">{idx + 1}</td>
                      <td className="nf">{invoice.nf}</td>
                      <td className="supplier">{invoice.supplier}</td>
                      <td className="value">R$ {(invoice.value / 1000).toFixed(1)}K</td>
                      <td className="nature">{invoice.nature}</td>
                      <td className="method">{invoice.payment_method}</td>
                      <td className="date">{invoice.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
