import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './NFAnalytics.css';

interface DataRow {
  [key: string]: any;
}

interface NFDataTableProps {
  sessionId: string;
  filters?: any;
}

export const NFDataTable: React.FC<NFDataTableProps> = ({ sessionId, filters }) => {
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const pageSize = 50;

  useEffect(() => {
    loadData();
  }, [sessionId, filters, page]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `http://localhost:8000/api/templates/nf/data/${sessionId}?limit=${pageSize}&offset=${page * pageSize}`,
        filters || {}
      );

      setData(response.data.rows || []);
      setColumns(response.data.columns || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortBy) return 0;
    
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal || '').toLowerCase();
    const bStr = String(bVal || '').toLowerCase();
    
    return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const totalPages = Math.ceil(total / pageSize);
  const startRow = page * pageSize + 1;
  const endRow = Math.min((page + 1) * pageSize, total);

  if (loading && page === 0) {
    return (
      <div className="data-table-container loading">
        <div className="spinner"></div>
        <p>Carregando dados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-table-container error">
        <p>❌ {error}</p>
        <button onClick={loadData}>Tentar Novamente</button>
      </div>
    );
  }

  return (
    <div className="data-table-container">
      <div className="table-header">
        <h2>📋 Tabela de Dados Completa</h2>
        <p className="record-count">
          Mostrando {startRow} até {endRow} de {total} registros
        </p>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={`sortable ${sortBy === col ? 'sorted ' + sortOrder : ''}`}
                  title={`Clique para ordenar por ${col}`}
                >
                  {col}
                  {sortBy === col && (
                    <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'even' : 'odd'}>
                {columns.map((col) => (
                  <td key={`${idx}-${col}`} className={`cell-${col.toLowerCase()}`}>
                    {formatValue(row[col], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => setPage(0)}
          disabled={page === 0}
          className="page-btn"
        >
          ⬅️ Primeira
        </button>
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="page-btn"
        >
          ◀ Anterior
        </button>

        <div className="page-info">
          Página {page + 1} de {totalPages || 1}
        </div>

        <button
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="page-btn"
        >
          Próxima ▶
        </button>
        <button
          onClick={() => setPage(totalPages - 1)}
          disabled={page >= totalPages - 1}
          className="page-btn"
        >
          Última ⬆️
        </button>

        <select
          value={pageSize}
          onChange={(e) => {
            setLimit(parseInt(e.target.value));
            setPage(0);
          }}
          className="page-size-select"
        >
          <option value="25">25 registros</option>
          <option value="50">50 registros</option>
          <option value="100">100 registros</option>
          <option value="250">250 registros</option>
        </select>
      </div>
    </div>
  );
};

function formatValue(value: any, column: string): string {
  if (value === null || value === undefined) return '-';
  
  if (column.toUpperCase().includes('VALOR') && typeof value === 'number') {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  if (typeof value === 'number' && value > 10000) {
    return value.toLocaleString('pt-BR');
  }
  
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }
  
  return String(value);
}
