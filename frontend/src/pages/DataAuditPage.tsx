import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useSessionStore } from '../store/session';

interface AuditStep {
  step_id: number;
  category: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  timestamp: string;
  severity: string;
}

interface QualityMetric {
  column: string;
  dtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  sample?: string;
}

interface DataSummary {
  rows: number;
  columns: number;
  null_pct: number;
  memory_mb: number;
}

const CATEGORY_CONFIG: Record<string, { icon: string }> = {
  parsing: { icon: '📂' },
  cleaning: { icon: '🧹' },
  typing: { icon: '🔍' },
  kpi: { icon: '📊' },
  semantic: { icon: '🏷' },
};

const SEVERITY_DOT: Record<string, string> = {
  success: 'bg-green-400',
  warning: 'bg-yellow-400',
  info: 'bg-blue-400',
};

export function DataAuditPage() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const [steps, setSteps] = useState<AuditStep[]>([]);
  const [quality, setQuality] = useState<QualityMetric[]>([]);
  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'audit' | 'quality' | 'analysis'>('audit');

  useEffect(() => {
    if (!sessionId) {
      setSteps([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get(`/api/data/${sessionId}/audit`).catch(() => ({ data: { steps: [] } })),
      api.get(`/api/data/${sessionId}/quality`).catch(() => ({ data: { quality: [] } })),
      api.get(`/api/data/${sessionId}/profile/complete`).catch(() => ({ data: { profile: {} } })),
    ])
      .then(([auditRes, qualityRes, profileRes]) => {
        if (cancelled) return;
        setSteps(auditRes.data.steps || []);
        setQuality(qualityRes.data.quality || []);
        
        const profile = profileRes.data?.profile;
        if (profile) {
          setSummary({
            rows: profile.row_count || 0,
            columns: profile.column_count || 0,
            null_pct: profile.null_percentage || 0,
            memory_mb: 0
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Audit load failed:', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const categories = ['all', 'parsing', 'cleaning', 'typing', 'kpi', 'semantic'];
  const visibleSteps = filter === 'all' ? steps : steps.filter((step) => step.category === filter);
  
  // Quality insights
  const emptyColumns = quality.filter(q => q.null_pct > 50).length;
  const problematicColumns = quality.filter(q => q.null_pct > 20 && q.null_pct <= 50).length;
  const totalNulls = quality.reduce((sum, q) => sum + (q.null_count || 0), 0);
  const unusedColumnsCount = quality.filter(q => q.null_pct === 100).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
          <p style={{ color: '#6b7280' }}>Analyzing your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: '#f1f5f9', padding: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#f1f5f9' }}>
          📊 Data Audit Report
        </h1>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#cbd5e1' }}>
          Complete analysis of what you're seeing, what's being used, and what might need attention
        </p>
      </div>

      {/* Quick Stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Total Rows</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>
              {summary.rows.toLocaleString()}
            </p>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Columns</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
              {summary.columns}
            </p>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Null Fields</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
              {totalNulls.toLocaleString()}
            </p>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Avg Null %</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
              {summary.null_pct.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Data Quality Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ 
          backgroundColor: unusedColumnsCount > 0 ? '#7f1d1d' : '#0f4c23',
          border: `1px solid ${unusedColumnsCount > 0 ? '#dc2626' : '#10b981'}`,
          borderRadius: '8px',
          padding: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{unusedColumnsCount > 0 ? '⚠️' : '✅'}</span>
            <div>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#f1f5f9' }}>Unused Columns</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#f1f5f9' }}>
                {unusedColumnsCount}
              </p>
            </div>
          </div>
        </div>
        <div style={{ 
          backgroundColor: emptyColumns > 0 ? '#7f1d1d' : '#0f4c23',
          border: `1px solid ${emptyColumns > 0 ? '#dc2626' : '#10b981'}`,
          borderRadius: '8px',
          padding: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{emptyColumns > 0 ? '⚠️' : '✅'}</span>
            <div>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#f1f5f9' }}>Mostly Empty</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#f1f5f9' }}>
                {emptyColumns}
              </p>
            </div>
          </div>
        </div>
        <div style={{ 
          backgroundColor: problematicColumns > 0 ? '#713f12' : '#0f4c23',
          border: `1px solid ${problematicColumns > 0 ? '#f59e0b' : '#10b981'}`,
          borderRadius: '8px',
          padding: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{problematicColumns > 0 ? '⚠️' : '✅'}</span>
            <div>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#f1f5f9' }}>Sparse Data</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#f1f5f9' }}>
                {problematicColumns}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #334155' }}>
        {[
          { id: 'audit', label: '📋 Processing Log' },
          { id: 'quality', label: '🔍 Column Analysis' },
          { id: 'analysis', label: '📊 Data Issues' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 'bold' : '500',
              color: activeTab === tab.id ? '#3b82f6' : '#94a3b8',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content: Audit Log */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: filter === category ? 'bold' : '500',
                  color: filter === category ? '#ffffff' : '#cbd5e1',
                  backgroundColor: filter === category ? '#3b82f6' : '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {category === 'all'
                  ? `All (${steps.length})`
                  : `${CATEGORY_CONFIG[category]?.icon || '•'} ${category.charAt(0).toUpperCase() + category.slice(1)} (${steps.filter((step) => step.category === category).length})`}
              </button>
            ))}
          </div>

          {visibleSteps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
              <p style={{ fontSize: '32px', margin: 0 }}>📭</p>
              <p style={{ margin: '12px 0 0 0' }}>No audit steps found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visibleSteps.map((step) => {
                const config = CATEGORY_CONFIG[step.category];
                return (
                  <div 
                    key={step.step_id} 
                    style={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      gap: '12px'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{config?.icon || '•'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>#{step.step_id}</span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>{step.category}</span>
                      </div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#f1f5f9' }}>
                        {step.title}
                      </h4>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {step.description}
                      </p>
                      {Object.keys(step.details || {}).length > 0 && (
                        <details style={{ cursor: 'pointer' }}>
                          <summary style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '500' }}>
                            Show details
                          </summary>
                          <pre style={{
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#0f172a',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#cbd5e1',
                            overflow: 'auto'
                          }}>
                            {JSON.stringify(step.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Quality Analysis */}
      {activeTab === 'quality' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155' }}>
                {['Column', 'Type', 'Nulls', 'Empty %', 'Unique', 'Status'].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#94a3b8',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quality.map((item, idx) => (
                <tr
                  key={item.column}
                  style={{
                    borderBottom: '1px solid #334155',
                    backgroundColor: idx % 2 === 0 ? '#0f172a' : '#1e293b'
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: '500', color: '#f1f5f9', maxWidth: '180px' }}>
                    {item.column}
                  </td>
                  <td style={{ padding: '12px', color: '#cbd5e1' }}>
                    <span style={{ fontSize: '11px', backgroundColor: '#334155', color: '#cbd5e1', padding: '2px 8px', borderRadius: '4px' }}>
                      {item.dtype}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: item.null_count > 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                    {item.null_count || 0}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ height: '4px', width: '50px', backgroundColor: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          height: '4px',
                          backgroundColor: item.null_pct >= 100 ? '#ef4444' : item.null_pct > 50 ? '#f97316' : item.null_pct > 20 ? '#f59e0b' : '#10b981',
                          width: `${Math.min(item.null_pct, 100)}%`
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9', minWidth: '40px' }}>
                        {item.null_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: '#cbd5e1' }}>
                    {item.unique_count || '—'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: item.null_pct === 100 ? '#7f1d1d' : item.null_pct > 50 ? '#713f12' : '#0f4c23',
                      color: item.null_pct === 100 ? '#fca5a5' : item.null_pct > 50 ? '#fdba74' : '#86efac'
                    }}>
                      {item.null_pct === 100 ? 'UNUSED' : item.null_pct > 50 ? 'SPARSE' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: Data Issues Analysis */}
      {activeTab === 'analysis' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#fca5a5' }}>
              ⚠️ Empty Columns ({unusedColumnsCount})
            </h3>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#fecaca', lineHeight: '1.5' }}>
              These columns are 100% empty and are being completely ignored by all analysis:
            </p>
            {unusedColumnsCount === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#fecaca' }}>None - Good data quality!</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                {quality.filter(q => q.null_pct === 100).map(col => (
                  <span key={col.column} style={{
                    backgroundColor: '#dc2626',
                    color: '#fca5a5',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {col.column}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#713f12', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#fdba74' }}>
              ⚠️ Mostly Empty ({emptyColumns})
            </h3>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#fcd34d', lineHeight: '1.5' }}>
              These columns are more than 50% empty. You might be losing time analyzing incomplete data:
            </p>
            {emptyColumns === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#fcd34d' }}>None - All columns have good completeness!</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {quality.filter(q => q.null_pct > 50 && q.null_pct < 100).map(col => (
                  <div key={col.column} style={{
                    backgroundColor: '#f59e0b',
                    color: '#713f12',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{col.column}</span>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>{col.null_pct.toFixed(0)}% empty</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#0f4c23', border: '1px solid #10b981', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#86efac' }}>
              ✅ Usable Columns ({quality.filter(q => q.null_pct <= 20).length})
            </h3>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6ee7b7', lineHeight: '1.5' }}>
              These columns have good data quality (20% or less empty) and are actively being used in analysis:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {quality.filter(q => q.null_pct <= 20).map(col => (
                <div key={col.column} style={{
                  backgroundColor: '#10b981',
                  color: '#ecfdf5',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{col.column}</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{(100 - col.null_pct).toFixed(0)}% complete</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
