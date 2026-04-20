/**
 * EXEMPLO: Como usar o novo Design System
 * 
 * Este arquivo mostra como integrar os componentes Card, KPI, StatusBadge, Table
 * nas suas páginas de forma consistente
 */

import { useState } from 'react';
import { Card, KPI, StatusBadge, Table } from '../components/DesignSystem';
import { BarChart3, TrendingUp, Zap, TrendingDown } from 'lucide-react';

export function DesignSystemExample() {
  // Dados exemplo
  const kpiData = [
    { icon: BarChart3, label: 'Total', value: 'R$ 2.5M', color: 'blue' as const },
    { icon: TrendingUp, label: 'Média', value: 'R$ 125K', color: 'purple' as const },
    { icon: Zap, label: 'Máximo', value: 'R$ 450K', color: 'amber' as const },
    { icon: TrendingDown, label: 'Mínimo', value: 'R$ 45K', color: 'cyan' as const },
  ];

  const tableData = [
    { id: 1, date: '2026-04-20', value: 125000, status: 'above', change: '+12%' },
    { id: 2, date: '2026-04-19', value: 98500, status: 'below', change: '-8%' },
    { id: 3, date: '2026-04-18', value: 152300, status: 'above', change: '+18%' },
    { id: 4, date: '2026-04-17', value: 65400, status: 'below', change: '-15%' },
  ];

  const columns = [
    { key: 'date', header: 'Data', width: '15%' },
    { key: 'value', header: 'Valor', width: '20%', render: (v: number) => `R$ ${v.toLocaleString('pt-BR')}` },
    { key: 'change', header: 'Variação', width: '15%' },
    { 
      key: 'status', 
      header: 'Status', 
      width: '15%',
      render: (status: string) => <StatusBadge status={status as any} />
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 p-8">
      {/* ================================ */}
      {/* FASE 1: CONTAINERS (CARDS)     */}
      {/* ================================ */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white mb-6">Fase 1: Containers (Cards)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="default">
            <h3 className="text-lg font-bold text-white mb-2">Card Default</h3>
            <p className="text-slate-400">Uso geral - Seções comuns</p>
          </Card>

          <Card variant="elevated">
            <h3 className="text-lg font-bold text-white mb-2">Card Elevated</h3>
            <p className="text-slate-400">Seções importantes - Maior destaque</p>
          </Card>

          <Card variant="bordered">
            <h3 className="text-lg font-bold text-white mb-2">Card Bordered</h3>
            <p className="text-slate-400">Alternativa estilizada</p>
          </Card>
        </div>
      </div>

      {/* ================================ */}
      {/* FASE 2: KPI (MÉTRICAS)        */}
      {/* ================================ */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white mb-6">Fase 2: KPI (Hierarquia de Dados)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {kpiData.map((kpi, idx) => (
            <KPI
              key={idx}
              icon={kpi.icon}
              label={kpi.label}
              value={kpi.value}
              color={kpi.color}
              subtext="Por período"
              trend={{ value: Math.random() * 20, isPositive: Math.random() > 0.5 }}
            />
          ))}
        </div>
      </div>

      {/* ================================ */}
      {/* FASE 3: TABELA COM ZEBRA      */}
      {/* ================================ */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white mb-6">Fase 3: Tabelas com Zebra Styling</h2>
        
        <Card variant="elevated">
          <h3 className="text-lg font-bold text-white mb-4">Dados com Status</h3>
          <Table data={tableData} columns={columns} />
        </Card>
      </div>

      {/* ================================ */}
      {/* STATUS BADGES SHOWCASE         */}
      {/* ================================ */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white mb-6">Status Badges Showcase</h2>
        
        <Card variant="default">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-slate-400 w-24">Acima:</span>
              <StatusBadge status="above" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 w-24">Abaixo:</span>
              <StatusBadge status="below" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 w-24">Aviso:</span>
              <StatusBadge status="warning" label="Requer Atenção" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 w-24">Sucesso:</span>
              <StatusBadge status="success" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 w-24">Neutro:</span>
              <StatusBadge status="neutral" />
            </div>
          </div>
        </Card>
      </div>

      {/* ================================ */}
      {/* LAYOUT COMPLETO EXEMPLO        */}
      {/* ================================ */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Exemplo de Layout Completo</h2>
        
        {/* Seção de Título */}
        <div className="mb-8">
          <h3 className="text-5xl font-bold text-white mb-2">Exemplo Dashboard</h3>
          <p className="text-slate-400">Utilize este layout como referência para suas páginas</p>
        </div>

        {/* Seção de KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <KPI icon={BarChart3} label="Total" value="R$ 2.5M" color="blue" subtext="valor total" />
          <KPI icon={TrendingUp} label="Média" value="R$ 125K" color="purple" subtext="por período" />
          <KPI icon={Zap} label="Máximo" value="R$ 450K" color="amber" subtext="pico" />
          <KPI icon={TrendingDown} label="Mínimo" value="R$ 45K" color="cyan" subtext="vale" />
        </div>

        {/* Seção de Conteúdo Múltiplo */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico */}
          <Card variant="elevated" className="lg:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4">Série Temporal</h3>
            <div className="h-64 bg-slate-700/30 rounded-lg flex items-center justify-center">
              <p className="text-slate-500">Seu gráfico aqui (Recharts)</p>
            </div>
          </Card>

          {/* Estatísticas Laterais */}
          <Card variant="default">
            <h3 className="text-lg font-bold text-white mb-4">Estatísticas</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Desvio Padrão</p>
                <p className="text-2xl font-bold text-emerald-400">R$ 45.2K</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Amplitude</p>
                <p className="text-2xl font-bold text-blue-400">R$ 405K</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Seção de Tabela */}
        <Card variant="elevated" className="mt-8">
          <h3 className="text-lg font-bold text-white mb-4">Detalhes da Série</h3>
          <Table data={tableData} columns={columns} />
        </Card>
      </div>
    </div>
  );
}

export default DesignSystemExample;
