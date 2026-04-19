import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';
import { DistributionAnalytics } from '../components/DistributionAnalytics';

export function DistributionPage() {
  const { sessionId, numericCols } = useSessionStore();
  const [col, setCol] = useState('');

  useEffect(() => {
    if (numericCols.length > 0 && !col) setCol(numericCols[0]);
  }, [numericCols, col]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Distribution Analysis</h1>
        <p className="text-slate-400 text-sm mt-1">Histogramas, boxplots e sumário estatístico</p>
      </div>

      <div className="max-w-xs">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">
          Selecionar Coluna
        </label>
        <select
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={col}
          onChange={(e) => setCol(e.target.value)}
        >
          <option value="">Selecione...</option>
          {numericCols.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {numericCols.map((c) => (
          <button
            key={c}
            onClick={() => setCol(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              c === col
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <p className="text-slate-300 text-center">
          {col ? `Análise de distribuição: ${col}` : 'Selecione uma coluna para análise'}
        </p>
      </div>

      {sessionId && (
        <div style={{ marginTop: '32px' }}>
          <DistributionAnalytics sessionId={sessionId} />
        </div>
      )}
    </div>
  );
}