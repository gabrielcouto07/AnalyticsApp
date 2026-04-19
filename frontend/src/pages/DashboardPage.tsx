import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';
import { TemplateDashboard, NFDashboard, EfetivoDashboard, OrcamentoDashboard } from '../components';
import * as api from '../api/analytics';

interface DataProfile {
  data_profile?: {
    structure?: {
      total_rows: number;
      total_columns: number;
      null_cells_pct: number;
      memory_usage_mb: number;
      column_types: Record<string, number>;
    };
    columns?: Array<{
      name: string;
      data_type: string;
      null_pct: number;
      unique_pct: number;
    }>;
  };
  recommendations?: any;
}

export const DashboardPage: React.FC = () => {
  const sessionId = useSessionStore((state) => state.sessionId);
  const selectedTemplate = useSessionStore((state) => state.selectedTemplate);
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId) loadProfile();
  }, [sessionId]);

  const loadProfile = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [profileRes, recommendRes] = await Promise.all([
        api.getDataProfile(sessionId),
        api.getRecommendations(sessionId),
      ]);
      setProfile({ data_profile: profileRes, recommendations: recommendRes });
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Template-specific dashboards ──────────────────────────────────
  if (selectedTemplate === 'nf' && sessionId)
    return <NFDashboard sessionId={sessionId} />;

  if (selectedTemplate === 'efetivo' && sessionId)
    return <EfetivoDashboard sessionId={sessionId} />;

  if (selectedTemplate === 'orcamento' && sessionId)
    return <OrcamentoDashboard sessionId={sessionId} />;

  if (selectedTemplate)
    return <TemplateDashboard templateId={selectedTemplate} />;

  // ── Generic dashboard ─────────────────────────────────────────────
  const stats = profile?.data_profile?.structure;
  const columns = profile?.data_profile?.columns || [];
  const numericCols = columns.filter((c) => c.data_type === 'numeric').length;
  const categoricalCols = columns.filter((c) => c.data_type === 'text').length;
  const dataQuality = stats ? Math.round((1 - stats.null_cells_pct) * 100) : 0;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">📊 Analytics Dashboard</h1>
          <p className="text-gray-400 mt-1">Project Status & Data Intelligence</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg p-6 border border-blue-700">
          <p className="text-blue-200 text-sm font-semibold">Total Rows</p>
          <p className="text-3xl font-bold text-white mt-2">{stats?.total_rows?.toLocaleString() || '—'}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg p-6 border border-purple-700">
          <p className="text-purple-200 text-sm font-semibold">Columns</p>
          <p className="text-3xl font-bold text-white mt-2">{stats?.total_columns || '—'}</p>
          <p className="text-purple-300 text-xs mt-2">{numericCols} numeric, {categoricalCols} categorical</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-lg p-6 border border-emerald-700">
          <p className="text-emerald-200 text-sm font-semibold">Data Quality</p>
          <p className="text-3xl font-bold text-white mt-2">{dataQuality}%</p>
        </div>
        <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-lg p-6 border border-orange-700">
          <p className="text-orange-200 text-sm font-semibold">Memory</p>
          <p className="text-3xl font-bold text-white mt-2">{stats?.memory_usage_mb?.toFixed(1) || '—'} MB</p>
        </div>
      </div>

      {columns.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">📋 Column Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.slice(0, 8).map((col) => (
              <div key={col.name} className="bg-slate-700 rounded p-4 border border-slate-600">
                <p className="font-semibold text-white truncate">{col.name}</p>
                <p className="text-xs text-gray-300 mt-1">Type: {col.data_type}</p>
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
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading profile data...</p>
        </div>
      )}
    </div>
  );
};
