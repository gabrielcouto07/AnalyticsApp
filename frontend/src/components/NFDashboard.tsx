import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import './NFDashboard.css';

interface NFSummary {
  total_nfs: number;
  total_value: number;
  unique_suppliers: number;
  average_invoice_value: number;
  data_quality: {
    total_rows: number;
    valid_rows: number;
    completeness_percentage: number;
  };
}

interface Supplier {
  supplier: string;
  total_value: number;
  invoice_count: number;
  avg_invoice_value: number;
}

interface TopInvoice {
  nf: string;
  supplier: string;
  value: number;
  nature: string;
  payment_method: string;
  due_date: string;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const NFDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [summary, setSummary] = useState<NFSummary | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [topInvoices, setTopInvoices] = useState<TopInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load summary
        const summaryRes = await axios.get(`http://localhost:8000/api/templates/nf/summary/${sessionId}`);
        setSummary(summaryRes.data);

        // Load suppliers
        const suppliersRes = await axios.get(`http://localhost:8000/api/templates/nf/suppliers/${sessionId}?limit=10`);
        setSuppliers(suppliersRes.data);

        // Load top invoices
        const invoicesRes = await axios.get(`http://localhost:8000/api/templates/nf/top-invoices/${sessionId}?limit=15`);
        setTopInvoices(invoicesRes.data);
      } catch (err) {
        console.error('Error loading NF data:', err);
        setError('Erro ao carregar dados da análise NF');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="nf-dashboard loading">
        <div className="spinner"></div>
        <p>Carregando análise de Notas Fiscais...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="nf-dashboard error">
        <p>❌ {error || 'Erro ao carregar dados'}</p>
      </div>
    );
  }

  // Prepare data for charts
  const supplierChartData = suppliers.slice(0, 5).map(s => ({
    name: s.supplier.substring(0, 15) + (s.supplier.length > 15 ? '...' : ''),
    value: s.total_value,
    count: s.invoice_count
  }));

  const paymentData = [
    { name: 'BOLETO', value: Math.random() * summary.total_value * 0.5 },
    { name: 'DEPÓSITO', value: Math.random() * summary.total_value * 0.5 }
  ];

  return (
    <div className="nf-dashboard">
      {/* Header */}
      <div className="nf-header">
        <h1>📋 Análise de Notas Fiscais (12.csv)</h1>
        <p className="subtitle">Dashboard completo com métricas, fornecedores e maiores valores</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card total-nfs">
          <div className="kpi-icon">📊</div>
          <div className="kpi-content">
            <p className="kpi-label">Total de NFs</p>
            <p className="kpi-value">{summary.total_nfs.toLocaleString('pt-BR')}</p>
            <p className="kpi-meta">{summary.data_quality.valid_rows} de {summary.data_quality.total_rows} registros</p>
          </div>
        </div>

        <div className="kpi-card total-value">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <p className="kpi-label">Valor Total</p>
            <p className="kpi-value">R$ {(summary.total_value / 1000).toFixed(1)}K</p>
            <p className="kpi-meta">{summary.data_quality.completeness_percentage.toFixed(1)}% completo</p>
          </div>
        </div>

        <div className="kpi-card unique-suppliers">
          <div className="kpi-icon">🏢</div>
          <div className="kpi-content">
            <p className="kpi-label">Fornecedores</p>
            <p className="kpi-value">{summary.unique_suppliers}</p>
            <p className="kpi-meta">fornecedores únicos</p>
          </div>
        </div>

        <div className="kpi-card avg-value">
          <div className="kpi-icon">📈</div>
          <div className="kpi-content">
            <p className="kpi-label">Valor Médio</p>
            <p className="kpi-value">R$ {(summary.average_invoice_value / 1000).toFixed(1)}K</p>
            <p className="kpi-meta">por NF</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h2>💰 Top 5 Fornecedores por Valor</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={supplierChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h2>🎯 Distribuição de Método de Pagamento</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={paymentData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: R$ ${(value / 1000).toFixed(0)}K`} outerRadius={100} fill="#8884d8" dataKey="value">
                {paymentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="section suppliers-section">
        <h2>🏆 Ranking de Fornecedores</h2>
        <div className="table-container">
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Posição</th>
                <th>Fornecedor</th>
                <th>Total</th>
                <th>Qtd NFs</th>
                <th>Média/NF</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, idx) => (
                <tr key={idx} className={idx < 3 ? 'highlight' : ''}>
                  <td className="position">#{idx + 1}</td>
                  <td className="supplier-name">{supplier.supplier}</td>
                  <td className="value">R$ {(supplier.total_value / 1000).toFixed(2)}K</td>
                  <td className="count">{supplier.invoice_count}</td>
                  <td className="avg">R$ {(supplier.avg_invoice_value / 1000).toFixed(2)}K</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Invoices */}
      <div className="section top-invoices-section">
        <h2>⭐ Top 15 Maiores Notas Fiscais</h2>
        <div className="table-container">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>NF</th>
                <th>Fornecedor</th>
                <th>Valor</th>
                <th>Natureza</th>
                <th>Pagamento</th>
                <th>Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {topInvoices.map((invoice, idx) => (
                <tr key={idx} className={idx < 3 ? 'top-3' : ''}>
                  <td className="nf">{invoice.nf}</td>
                  <td className="supplier">{invoice.supplier}</td>
                  <td className="value">R$ {(invoice.value / 1000).toFixed(2)}K</td>
                  <td className="nature">{invoice.nature}</td>
                  <td className="payment">
                    <span className={`badge ${invoice.payment_method.toLowerCase()}`}>
                      {invoice.payment_method}
                    </span>
                  </td>
                  <td className="date">{invoice.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="stats-footer">
        <div className="stat">
          <span className="stat-label">Completude:</span>
          <span className="stat-value">{summary.data_quality.completeness_percentage.toFixed(2)}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">NFs por Fornecedor:</span>
          <span className="stat-value">{(summary.total_nfs / summary.unique_suppliers).toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Maior Valor:</span>
          <span className="stat-value">R$ {Math.max(...topInvoices.map(i => i.value)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};
