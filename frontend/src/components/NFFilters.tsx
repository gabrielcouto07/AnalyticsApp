import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './NFAnalytics.css';

interface FilterOptions {
  suppliers: string[];
  categories: string[];
  paymentMethods: string[];
}

interface NFFiltersProps {
  sessionId: string;
  onFiltersChange: (filters: any) => void;
}

export const NFFilters: React.FC<NFFiltersProps> = ({ sessionId, onFiltersChange }) => {
  const [options, setOptions] = useState<FilterOptions>({
    suppliers: [],
    categories: [],
    paymentMethods: []
  });
  const [filters, setFilters] = useState({
    supplier: '',
    category: '',
    paymentMethod: '',
    minValue: 0,
    maxValue: Infinity
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFilterOptions();
  }, [sessionId]);

  const loadFilterOptions = async () => {
    try {
      setLoading(true);
      const [suppliersRes, categoryRes, paymentRes] = await Promise.all([
        axios.get(`http://localhost:8000/api/templates/nf/suppliers/${sessionId}?limit=100`),
        axios.get(`http://localhost:8000/api/templates/nf/nature/${sessionId}`),
        axios.get(`http://localhost:8000/api/templates/nf/payment/${sessionId}`)
      ]);

      setOptions({
        suppliers: suppliersRes.data.map((s: any) => s.supplier),
        categories: categoryRes.data.map((c: any) => c.nature),
        paymentMethods: paymentRes.data.map((p: any) => p.method)
      });
    } catch (err) {
      console.error('Error loading filter options:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters = {
      supplier: '',
      category: '',
      paymentMethod: '',
      minValue: 0,
      maxValue: Infinity
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  if (loading) {
    return <div className="filters-container loading">Carregando filtros...</div>;
  }

  return (
    <div className="filters-container">
      <div className="filters-header">
        <h3>🔍 Filtros Avançados</h3>
        <button className="reset-btn" onClick={resetFilters}>Limpar Filtros</button>
      </div>

      <div className="filters-grid">
        <div className="filter-group">
          <label>Fornecedor</label>
          <select
            value={filters.supplier}
            onChange={(e) => handleFilterChange('supplier', e.target.value)}
            className="filter-select"
          >
            <option value="">Todos os Fornecedores</option>
            {options.suppliers.map((supplier) => (
              <option key={supplier} value={supplier}>{supplier}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Categoria</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="filter-select"
          >
            <option value="">Todas as Categorias</option>
            {options.categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Método de Pagamento</label>
          <select
            value={filters.paymentMethod}
            onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
            className="filter-select"
          >
            <option value="">Todos os Métodos</option>
            {options.paymentMethods.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Valor Mínimo</label>
          <input
            type="number"
            value={filters.minValue}
            onChange={(e) => handleFilterChange('minValue', parseFloat(e.target.value))}
            className="filter-input"
            placeholder="0"
          />
        </div>

        <div className="filter-group">
          <label>Valor Máximo</label>
          <input
            type="number"
            value={filters.maxValue === Infinity ? '' : filters.maxValue}
            onChange={(e) => handleFilterChange('maxValue', e.target.value ? parseFloat(e.target.value) : Infinity)}
            className="filter-input"
            placeholder="Ilimitado"
          />
        </div>
      </div>

      <div className="filter-summary">
        <p>Filtros aplicados: {
          [filters.supplier && `Fornecedor: ${filters.supplier}`,
           filters.category && `Categoria: ${filters.category}`,
           filters.paymentMethod && `Pagamento: ${filters.paymentMethod}`]
            .filter(Boolean)
            .join(' | ') || 'Nenhum'
        }</p>
      </div>
    </div>
  );
};
