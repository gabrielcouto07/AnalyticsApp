import React from 'react';
import { useSessionStore } from '../store/session';
import { EfetivoDashboard, OrcamentoDashboard, CustosDashboard } from '../components';

export const DashboardPage: React.FC = () => {
  const sessionId = useSessionStore((state) => state.sessionId);
  const selectedTemplate = useSessionStore((state) => state.selectedTemplate);

  if (!sessionId) return null;

  if (!selectedTemplate) {
    return (
      <div className="p-8 text-center text-gray-300">
        <p className="text-2xl font-semibold mb-2">
          Template nao identificado automaticamente.
        </p>
        <p className="text-sm text-gray-400">
          Faca upload de um arquivo de Custos, Efetivo ou Orcamento para continuar.
        </p>
      </div>
    );
  }

  if (selectedTemplate === 'efetivo') return <EfetivoDashboard sessionId={sessionId} />;
  if (selectedTemplate === 'orcamento') return <OrcamentoDashboard sessionId={sessionId} />;
  if (selectedTemplate === 'custos') return <CustosDashboard sessionId={sessionId} />;

  return (
    <div className="p-8 text-center text-gray-300">
      <p className="text-2xl font-semibold mb-2">
        Template <span>&quot;{selectedTemplate}&quot;</span> não suportado.
      </p>
      <p className="text-sm text-gray-400">
        Apenas Custos, Efetivo e Orçamento estão disponíveis.
      </p>
    </div>
  );
};
