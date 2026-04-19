import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';
import { TemplateDashboard, NFDashboard, NFAnalyticsDashboard, EfetivoDashboard, OrcamentoDashboard } from '../components';
import * as api from '../api/analytics';

interface View {
  id: string;
  label: string;
  icon: string;
  description: string;
  requires: Record<string, boolean>;
}

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
  const [availableViews, setAvailableViews] = useState<Record<string, View>>({});
  const [filterOptions, setFilterOptions] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showViews, setShowViews] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadDashboardData();
    }
  }, [sessionId]);

  const loadDashboardData = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [profileRes, viewsRes, filtersRes] = await Promise.all([
        api.getDataProfile(sessionId),
        api.getAvailableViews(sessionId),
        api.getFilterOptions(sessionId),
      ]);

      setProfile({
        data_profile: profileRes,
        recommendations: viewsRes?.recommendations,
      });
      
      if (viewsRes?.views) {
        setAvailableViews(viewsRes.views);
      }
      
      if (filtersRes) {
        setFilterOptions(filtersRes);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Template-specific dashboards
  if (selectedTemplate === 'nf' && sessionId) {
    return <NFAnalyticsDashboard sessionId={sessionId} />;
  }

  if (selectedTemplate === 'efetivo' && sessionId) {
    return <EfetivoDashboard sessionId={sessionId} />;
  }

  if (selectedTemplate === 'orcamento' && sessionId) {
    return <OrcamentoDashboard sessionId={sessionId} />;
  }
        </div>
        <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-lg p-6 border border-orange-700">
          <p className="text-orange-200 text-sm font-semibold">💾 Memory</p>
          <p className="text-3xl font-bold text-white mt-2">{stats?.memory_usage_mb?.toFixed(1) || '—'} MB</p>
        </div>
      </div>

<<<<<<< HEAD
      {/* Available Analytics Views */}
      {showViews && Object.keys(availableViews).length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">📈 Available Analytics Views</h2>
          <p className="text-gray-400 mb-4">Select any view below to explore detailed analytics for different aspects of your data:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(availableViews).map((view) => (
              <div
                key={view.id}
                className="bg-slate-700 rounded-lg p-5 border border-slate-600 hover:border-blue-500 transition cursor-pointer hover:shadow-lg hover:shadow-blue-500/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{view.icon}</span>
                  <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">Available</span>
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{view.label}</h3>
                <p className="text-sm text-gray-400 mb-4">{view.description}</p>
                <p className="text-xs text-gray-500">Click the sidebar to navigate to this view →</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Options Summary */}
      {filterOptions && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">🔍 Filter Options</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filterOptions.numeric_columns && filterOptions.numeric_columns.length > 0 && (
              <div className="bg-slate-700 rounded p-4 border border-slate-600">
                <h3 className="font-semibold text-blue-400 mb-3">📊 Numeric Filters</h3>
                <div className="space-y-2">
                  {filterOptions.numeric_columns.slice(0, 5).map((col: any) => (
                    <div key={col.column} className="text-sm">
                      <p className="text-white font-medium">{col.column}</p>
                      <p className="text-gray-400 text-xs">
                        {col.min.toFixed(2)} to {col.max.toFixed(2)}
                      </p>
                    </div>
                  ))}
                  {filterOptions.numeric_columns.length > 5 && (
                    <p className="text-xs text-gray-500 italic">
                      +{filterOptions.numeric_columns.length - 5} more columns
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {filterOptions.categorical_columns && Object.keys(filterOptions.categorical_columns).length > 0 && (
              <div className="bg-slate-700 rounded p-4 border border-slate-600">
                <h3 className="font-semibold text-purple-400 mb-3">🏷️ Categorical Filters</h3>
                <div className="space-y-2">
                  {Object.entries(filterOptions.categorical_columns).slice(0, 5).map(([col, values]: any) => (
                    <div key={col} className="text-sm">
                      <p className="text-white font-medium">{col}</p>
                      <p className="text-gray-400 text-xs">
                        {values.length} unique values
                      </p>
                    </div>
                  ))}
                  {Object.keys(filterOptions.categorical_columns).length > 5 && (
                    <p className="text-xs text-gray-500 italic">
                      +{Object.keys(filterOptions.categorical_columns).length - 5} more columns
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {filterOptions.date_columns && filterOptions.date_columns.length > 0 && (
              <div className="bg-slate-700 rounded p-4 border border-slate-600">
                <h3 className="font-semibold text-emerald-400 mb-3">📅 Date Filters</h3>
                <div className="space-y-2">
                  {filterOptions.date_columns.map((col: any) => (
                    <div key={col.column} className="text-sm">
                      <p className="text-white font-medium">{col.column}</p>
                      <p className="text-gray-400 text-xs">
                        {new Date(col.min).toLocaleDateString()} to {new Date(col.max).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Column Analysis */}
=======
>>>>>>> origin/main
      {columns.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">📋 Column Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.slice(0, 8).map((col) => (
<<<<<<< HEAD
              <div key={col.name} className="bg-slate-700 rounded p-4 border border-slate-600 hover:border-blue-500 transition">
                <p className="font-semibold text-white truncate text-sm">{col.name}</p>
                <p className="text-xs text-gray-400 mt-1">Type: {col.data_type}</p>

=======
              <div key={col.name} className="bg-slate-700 rounded p-4 border border-slate-600">
                <p className="font-semibold text-white truncate">{col.name}</p>
                <p className="text-xs text-gray-300 mt-1">Type: {col.data_type}</p>
>>>>>>> origin/main
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
