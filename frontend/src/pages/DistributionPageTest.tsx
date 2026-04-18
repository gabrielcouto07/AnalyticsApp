import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';

export function DistributionPageTest() {
  const { numericCols } = useSessionStore();
  const [col, setCol] = useState('');

  useEffect(() => {
    if (numericCols.length > 0 && !col) setCol(numericCols[0]);
  }, [numericCols, col]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Distribution Analysis</h1>
        <p className="text-slate-400 text-sm mt-1">Teste básico sem gráficos</p>
      </div>

      <div className="max-w-xs">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">
          Selecionar Coluna
        </label>
        <select
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
          value={col}
          onChange={(e) => setCol(e.target.value)}
        >
          <option value="">Selecione...</option>
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-slate-300">
          {col ? `Coluna selecionada: ${col}` : 'Nenhuma coluna selecionada'}
        </p>
      </div>
    </div>
  );
}
