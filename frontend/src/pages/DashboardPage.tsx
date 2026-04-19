import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';
import { TemplateDashboard, NFAnalyticsDashboard, EfetivoDashboard, OrcamentoDashboard } from '../components';
import * as api from '../api/analytics';

interface DataProfile {
  data_profile?: {
    structure?: {
      total_rows: number;
      total_columns: number;
      null_cells_pct: number;
      memory_usage_mb: number;
    };
    columns?: Array<{
      name: string;
      data_type: string;
      null_pct: number;
      unique_pct: number;
    }>;
  };
}

export const DashboardPage: React.FC = () => {
  const sessionId = useSessionStore((state) => state.sessionId);
  const selectedTemplate = useSessionStore((state) => state.selectedTemplate);
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadDashboardData();
    }
  }, [sessionId]);

  const loadDashboardData = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const profileRes = await api.getDataProfile(sessionId);
      setProfile({
        data_profile: profileRes,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // If NF template is selected, show NF Analytics Dashboard
  if (selectedTemplate === 'nf' && sessionId) {
    return <NFAnalyticsDashboard sessionId={sessionId} />;
  }

  // If Efetivo template is selected
  if (selectedTemplate === 'efetivo' && sessionId) {
    return <EfetivoDashboard sessionId={sessionId} />;
  }

  // If Orcamento template is selected
  if (selectedTemplate === 'orcamento' && sessionId) {
    return <OrcamentoDashboard sessionId={sessionId} />;
  }

  // If other template is selected, show template dashboard
  if (selectedTemplate) {
    return <TemplateDashboard templateId={selectedTemplate} />;
  }

  // Generic dashboard
  const stats = profile?.data_profile?.structure;
  const columns = profile?.data_profile?.columns || [];

  const numericCols = columns.filter((c) => c.data_type === 'numeric').length;
  const categoricalCols = columns.filter((c) => c.data_type === 'text').length;
  const dataQuality = stats ? Math.round((1 - stats.null_cells_pct) * 100) : 0;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">📊 Analytics Dashboard</h1>
        <p className="text-gray-400 mt-1">Complete Data Intelligence & Insights</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg p-6 border border-blue-700">
          <p className="text-blue-200 text-sm font-semibold">📊 Total Rows</p>
          <p className="text-3xl font-bold text-white mt-2">{stats?.total_rows?.toLocaleString() || '—'}</p>
          <p className="text-blue-300 text-xs mt-2">Dataset size</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg p-6 border border-purple-700">
          <p className="text-purple-200 text-sm font-semibold">🏛 Columns</p>
          <p className="text-3xl font-bold text-white mt-2">{stats?.total_columns || '—'}</p>
          <p className="text-purple-300 text-xs mt-2">
            {numericCols} numeric, {categoricalCols} categorical
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-lg p-6 border border-emerald-700">
          <p className="text-emerald-200 text-sm font-semibold">✅ Data Quality</p>
          <p className="text-3xl font-bold text-white mt-2">{dataQuality}%</p>
          <p className="text-emerald-300 text-xs mt-2">Complete records</p>
        </div>

        <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-lg p-6 border border-orange-700">
          <p className="text-orange-200 text-sm font-semibold">💾 Memory</p>
          <p className="text-3xl font-bold text-white mt-2">{stats?.memory_usage_mb?.toFixed(1) || '—'} MB</p>
          <p className="text-orange-300 text-xs mt-2">Dataset size in RAM</p>
        </div>
      </div>

      {/* Column Analysis */}
      {columns.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">📋 Column Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.slice(0, 8).map((col) => (
              <div key={col.name} className="bg-slate-700 rounded p-4 border border-slate-600 hover:border-blue-500 transition">
                <p className="font-semibold text-white truncate text-sm">{col.name}</p>
                <p className="text-xs text-gray-400 mt-1">Type: {col.data_type}</p>

                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Completeness</p>
                    <div className="h-2 bg-slate-600 rounded overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${100 - (col.null_pct || 0)}%` }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Uniqueness</p>
                    <div className="h-2 bg-slate-600 rounded overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${col.unique_pct || 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {columns.length > 8 && (
            <p className="text-center text-gray-500 text-sm mt-4">
              Showing 8 of {columns.length} columns. Use the sidebar to explore more.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading dashboard data...</p>
        </div>
      )}
    </div>
  );
};
