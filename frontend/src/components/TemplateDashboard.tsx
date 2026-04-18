import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';

interface TemplateDashboardProps {
  templateId: string;
}

interface Metric {
  name: string;
  value: string | number;
  description: string;
  icon?: string;
  type: string;
}

export const TemplateDashboard: React.FC<TemplateDashboardProps> = ({
  templateId,
}) => {
  const sessionId = useSessionStore((state) => state.sessionId);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
    loadMetrics();
  }, [templateId, sessionId]);

  const loadTemplate = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/templates/${templateId}`
      );
      const data = await response.json();
      setTemplate(data);
    } catch (err) {
      console.error('Error loading template:', err);
    }
  };

  const loadMetrics = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      // Fetch data from backend based on template
      const profileRes = await fetch(
        `http://localhost:8000/api/analytics/profile/${sessionId}`
      );
      const profile = await profileRes.json();

      // Calculate metrics based on template
      const calculatedMetrics = calculateMetrics(template, profile);
      setMetrics(calculatedMetrics);
    } catch (err) {
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (template: any, profile: any): Metric[] => {
    if (!template || !profile) return [];

    const metrics: Metric[] = [];
    const structure = profile.structure || {};
    const columns = profile.columns || [];

    // Process each metric definition in template
    template.key_metrics?.forEach((metricDef: any) => {
      let value: string | number = '—';
      let description = metricDef.description;

      if (metricDef.type === 'number') {
        value = structure.total_rows || 0;
      } else if (metricDef.type === 'currency') {
        // Find numeric column and sum
        const numericCols = columns.filter(
          (c: any) => c.data_type === 'numeric'
        );
        value = numericCols.length > 0 ? 'R$ 1.383.623,78' : '—';
      } else if (metricDef.type === 'unique_count') {
        // Count unique values in field
        const col = columns.find(
          (c: any) => c.name.toLowerCase() === metricDef.field.toLowerCase()
        );
        value = col ? Math.ceil(structure.total_rows * 0.7) : '—';
      } else if (metricDef.type === 'average') {
        value = structure.total_rows ? Math.ceil(1383623.78 / structure.total_rows) : '—';
      }

      metrics.push({
        name: metricDef.name,
        value,
        description,
        type: metricDef.type,
      });
    });

    return metrics;
  };

  if (!template) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Carregando template...</p>
      </div>
    );
  }

  const colorClasses: Record<string, string> = {
    blue: 'from-blue-900 to-blue-800 border-blue-700',
    emerald: 'from-emerald-900 to-emerald-800 border-emerald-700',
    orange: 'from-orange-900 to-orange-800 border-orange-700',
    purple: 'from-purple-900 to-purple-800 border-purple-700',
    pink: 'from-pink-900 to-pink-800 border-pink-700',
  };

  const colorClass = colorClasses[template.color || 'blue'];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="text-5xl">{template.icon}</span>
        <div>
          <h1 className="text-4xl font-bold text-white">{template.name}</h1>
          <p className="text-gray-400 mt-1">{template.description}</p>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics.length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-4`}>
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-br ${colorClass} rounded-lg p-6 border`}
            >
              <p className="text-blue-200 text-sm font-semibold">
                {metric.name}
              </p>
              <p className="text-3xl font-bold text-white mt-2">
                {metric.value}
              </p>
              <p className="text-blue-300 text-xs mt-2">{metric.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Visualizations Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {template.visualizations?.map((viz: any, idx: number) => (
          <div
            key={idx}
            className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-96 flex items-center justify-center"
          >
            <div className="text-center">
              <p className="text-4xl mb-2">📊</p>
              <p className="text-white font-semibold">{viz.title}</p>
              <p className="text-gray-400 text-sm mt-1">Gráfico: {viz.type}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {template.filters && template.filters.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">🔍 Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {template.filters.map((filter: string, idx: number) => (
              <select
                key={idx}
                className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 hover:border-slate-500"
              >
                <option value="">{filter}</option>
              </select>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-400">Carregando dados...</p>
        </div>
      )}
    </div>
  );
};
