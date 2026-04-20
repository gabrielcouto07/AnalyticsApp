import React from 'react';

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
}

/**
 * Table Component - Tabelas com Zebra Styling
 * 
 * Design System Rules:
 * - Linhas alternadas (zebra styling)
 * - Sem bordas externas pesadas
 * - Hover effects para interatividade
 * - Padding consistente nas células
 */
export const Table = React.forwardRef<HTMLTableElement, TableProps<any>>(
  ({ data, columns, striped = true, hoverable = true, className = '' }, ref) => {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-700/50">
        <table 
          ref={ref}
          className={`w-full text-sm text-slate-300 ${className}`}
        >
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-700/50">
              {columns.map((col) => (
                <th 
                  key={String(col.key)}
                  className="px-6 py-4 text-left font-semibold text-slate-200 uppercase tracking-wider text-xs"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-500">
                  Sem dados disponíveis
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={idx}
                  className={`
                    border-b border-slate-700/30
                    ${striped && idx % 2 === 1 ? 'bg-slate-800/40' : 'bg-transparent'}
                    ${hoverable ? 'hover:bg-slate-800/60 transition-colors' : ''}
                  `}
                >
                  {columns.map((col) => (
                    <td 
                      key={`${idx}-${String(col.key)}`}
                      className="px-6 py-4 text-slate-300"
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';

export default Table;
