import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';
import { TemplateDashboard, NFAnalyticsDashboard, EfetivoDashboard, OrcamentoDashboard } from '../components';
import { MateriaisDashboard } from '../components/MateriaisDashboard';
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

  // If Materiais template is selected
  if (selectedTemplate === 'materiais' && sessionId) {
    return <MateriaisDashboard sessionId={sessionId} />;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl">📊</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">Analytics Dashboard</h1>
          </div>
          <p className="text-sm sm:text-base text-slate-400">Complete Data Intelligence & Insights</p>
        </div>

        {/* ─── Quick Stats Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Rows Card */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 backdrop-blur-sm p-5 sm:p-6 hover:bg-blue-500/15 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📊</span>
              <h3 className="text-xs sm:text-sm font-bold text-blue-300 uppercase tracking-wider">Total Rows</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-2">{stats?.total_rows?.toLocaleString() || '—'}</p>
            <p className="text-xs text-blue-200">Dataset size</p>
          </div>

          {/* Columns Card */}
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm p-5 sm:p-6 hover:bg-purple-500/15 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🏛️</span>
              <h3 className="text-xs sm:text-sm font-bold text-purple-300 uppercase tracking-wider">Columns</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-2">{stats?.total_columns || '—'}</p>
            <p className="text-xs text-purple-200">{numericCols} numeric, {categoricalCols} text</p>
          </div>

          {/* Data Quality Card */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-sm p-5 sm:p-6 hover:bg-emerald-500/15 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">✅</span>
              <h3 className="text-xs sm:text-sm font-bold text-emerald-300 uppercase tracking-wider">Quality</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-2">{dataQuality}%</p>
            <p className="text-xs text-emerald-200">Complete records</p>
          </div>

          {/* Memory Card */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm p-5 sm:p-6 hover:bg-amber-500/15 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💾</span>
              <h3 className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider">Memory</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-2">{stats?.memory_usage_mb?.toFixed(1) || '—'} MB</p>
            <p className="text-xs text-amber-200">RAM usage</p>
          </div>
        </div>

        {/* ─── Column Analysis ─────────────────────────────────────────────── */}
        {columns.length > 0 && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5 sm:mb-6">
              <div className="h-1 w-12 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full"></div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Column Analysis</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {columns.slice(0, 8).map((col) => (
                <div 
                  key={col.name} 
                  className="rounded-lg border border-slate-600/50 bg-slate-700/40 hover:bg-slate-700/60 p-4 transition-all group"
                >
                  <p className="font-semibold text-white truncate text-sm mb-1 group-hover:text-cyan-300 transition">{col.name}</p>
                  <p className="text-xs text-slate-400">Type: <span className="text-slate-300 font-medium">{col.data_type}</span></p>

                  <div className="mt-3 space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs text-slate-400">Completeness</p>
                        <p className="text-xs font-semibold text-emerald-300">{Math.round(100 - (col.null_pct || 0))}%</p>
                      </div>
                      <div className="h-1.5 bg-slate-600/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" 
                          style={{ width: `${100 - (col.null_pct || 0)}%` }} 
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs text-slate-400">Uniqueness</p>
                        <p className="text-xs font-semibold text-cyan-300">{Math.round(col.unique_pct || 0)}%</p>
                      </div>
                      <div className="h-1.5 bg-slate-600/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full" 
                          style={{ width: `${col.unique_pct || 0}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {columns.length > 8 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-400">
                  Showing <span className="text-slate-300 font-semibold">8 of {columns.length}</span> columns
                </p>
                <p className="text-xs text-slate-500 mt-1">Use the sidebar to explore all columns</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Loading State ─────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-3 border-slate-600 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 text-sm">Loading dashboard data...</p>
          </div>
        )}

        {/* ─── Empty State ────────────────────────────────────────────────── */}
        {!loading && !profile && (
          <div className="rounded-lg border border-slate-600/50 bg-slate-700/30 p-8 sm:p-12 text-center">
            <p className="text-slate-400 text-sm sm:text-base">No data available. Upload a file to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
