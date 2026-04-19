import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DistributionData {
  name: string;
  value: number;
  percentage: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const DistributionAnalytics: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [natureData, setNatureData] = useState<DistributionData[]>([]);
  const [paymentData, setPaymentData] = useState<DistributionData[]>([]);
  const [supplierData, setSupplierData] = useState<DistributionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await axios.get(
          `http://localhost:8000/api/templates/nf/analysis/${sessionId}`
        );

        // Nature distribution
        if (res.data.nature_analysis) {
          const total = Object.values(res.data.nature_analysis).reduce((sum: number, d: any) => sum + (d.total_value || 0), 0);
          const nature = Object.entries(res.data.nature_analysis).map(([name, data]: any) => ({
            name: name || 'Não classificado',
            value: data.total_value || 0,
            percentage: ((data.total_value / total) * 100).toFixed(1),
          }));
          setNatureData(nature);
        }

        // Payment distribution
        if (res.data.payment_analysis) {
          const total = Object.values(res.data.payment_analysis).reduce((sum: number, d: any) => sum + (d.total_value || 0), 0);
          const payment = Object.entries(res.data.payment_analysis).map(([name, data]: any) => ({
            name,
            value: data.total_value || 0,
            percentage: ((data.total_value / total) * 100).toFixed(1),
          }));
          setPaymentData(payment);
        }

        // Supplier distribution (top 10)
        if (res.data.supplier_analysis) {
          const total = res.data.summary?.total_value || 0;
          const suppliers = res.data.supplier_analysis.slice(0, 10).map((s: any) => ({
            name: s.supplier.substring(0, 20) + (s.supplier.length > 20 ? '...' : ''),
            value: s.total_value,
            percentage: ((s.total_value / total) * 100).toFixed(1),
          }));
          setSupplierData(suppliers);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  if (loading) return <div className="analytics-loading">📊 Carregando distribuições...</div>;

  return (
    <div className="distribution-analytics">
      {/* Nature Distribution - Pie Chart */}
      <div className="distribution-section">
        <h3>🎯 Distribuição por Natureza</h3>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={natureData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {natureData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="legend-grid">
          {natureData.map((item, idx) => (
            <div key={idx} className="legend-item">
              <span className="color-box" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
              <span className="label">{item.name}</span>
              <span className="percentage">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Distribution - Bar Chart */}
      <div className="distribution-section">
        <h3>💳 Distribuição de Pagamento</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={paymentData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
            <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Supplier Distribution - Top 10 */}
      <div className="distribution-section">
        <h3>🏢 Top 10 Fornecedores</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={supplierData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={190} />
            <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}K`} />
            <Bar dataKey="value" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="distribution-section">
        <h3>📊 Resumo de Distribuição</h3>
        <div className="summary-grid">
          <div className="summary-card">
            <p className="title">Naturezas</p>
            <p className="count">{natureData.length}</p>
            <p className="desc">tipos diferentes</p>
          </div>
          <div className="summary-card">
            <p className="title">Formas de Pagamento</p>
            <p className="count">{paymentData.length}</p>
            <p className="desc">métodos encontrados</p>
          </div>
          <div className="summary-card">
            <p className="title">Top Fornecedores</p>
            <p className="count">{supplierData.length}</p>
            <p className="desc">maiores valores</p>
          </div>
        </div>
      </div>
    </div>
  );
};
