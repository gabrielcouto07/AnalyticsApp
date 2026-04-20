# 📚 TemporalPage.tsx - Reference Implementation

This file serves as the **golden reference** for all future page redesigns. Use this as your template.

## Before & After

### ❌ BEFORE (Old Way - 600+ lines)
```typescript
// Raw JSX with inline styling
// Manual div containers
// Repeated className patterns
// No component reuse
// Hard to maintain
// Inconsistent spacing
```

### ✅ AFTER (New Way - 280 lines)
```typescript
// Clean component-based structure
// Reusable premium components
// Consistent design system
// Easy to maintain
// Professional styling
// Semantic spacing
```

## Full Implementation Example

Here's the actual structure used in the redesigned TemporalPage:

```tsx
import { useContext, useState, useCallback, useEffect } from 'react';
import { DataContext } from '@/context/DataContext';
import {
  PageLayout,
  Section,
  FilterCard,
  SelectField,
  ActionButton,
  ChartCard,
  ChartGrid,
  InfoGrid,
  EmptyState,
  LoadingState,
  Badge
} from '@/components';
import { getTemporalData } from '@/services/api';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';

export default function TemporalPage() {
  const { sessionId, dateCols, numericCols } = useContext(DataContext);
  
  // State management
  const [dateCol, setDateCol] = useState('');
  const [metricCol, setMetricCol] = useState('');
  const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('month');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Effects
  useEffect(() => {
    if (dateCols.length > 0 && !dateCol) setDateCol(dateCols[0]);
    if (numericCols.length > 0 && !metricCol) setMetricCol(numericCols[0]);
  }, [dateCols, numericCols, dateCol, metricCol]);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!sessionId || !dateCol || !metricCol) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await getTemporalData(sessionId, {
        date_col: dateCol,
        metric_col: metricCol,
        granularity
      });
      setResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [sessionId, dateCol, metricCol, granularity]);

  // Render
  return (
    <PageLayout
      icon="📈"
      title="Série Temporal"
      subtitle="Acompanhe a evolução temporal dos seus dados ao longo do tempo"
    >
      {/* ===== FILTER SECTION ===== */}
      <FilterCard title="Configuração" accentColor="blue">
        <SelectField
          label="Data"
          value={dateCol}
          onChange={setDateCol}
          options={dateCols.map(col => ({ value: col, label: col }))}
        />
        <SelectField
          label="Métrica"
          value={metricCol}
          onChange={setMetricCol}
          options={numericCols.map(col => ({ value: col, label: col }))}
        />
        <ActionButton
          label="Atualizar"
          onClick={fetchData}
          loading={loading}
          variant="primary"
        />
      </FilterCard>

      {/* ===== CONTENT (Only shown when loaded successfully) ===== */}
      {!loading && !error && response && (
        <>
          {/* KPI Metrics */}
          <InfoGrid
            items={[
              {
                icon: '📅',
                label: 'Período',
                value: `${response.stats.period_start} a ${response.stats.period_end}`,
                accentColor: 'blue'
              },
              {
                icon: '💰',
                label: 'Total',
                value: `R$ ${response.stats.total.toLocaleString()}`,
                accentColor: 'emerald'
              },
              {
                icon: '📈',
                label: 'Média',
                value: `R$ ${response.stats.average.toLocaleString()}`,
                accentColor: 'amber'
              },
              {
                icon: '⚡',
                label: 'Máximo',
                value: `R$ ${response.stats.max.toLocaleString()}`,
                accentColor: 'cyan'
              },
              {
                icon: '📊',
                label: 'Dados',
                value: `${response.data.length} registros`,
                accentColor: 'purple'
              }
            ]}
          />

          {/* Charts Section */}
          <ChartGrid cols={2}>
            <ChartCard
              title="Evolução Temporal"
              accentColor="blue"
              size="large"
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={response.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Acumulado"
              accentColor="emerald"
              size="large"
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={response.cumulative}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </ChartGrid>

          {/* Data Table */}
          <ChartCard
            title="Detalhes da Série"
            accentColor="indigo"
            size="large"
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400">Acumulado</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {response.data.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-sm text-slate-300">{row.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 text-right">R$ {row.value.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 text-right">R$ {row.cumulative.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        label={row.status}
                        variant={row.status === 'Acima' ? 'success' : 'warning'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        </>
      )}

      {/* ===== LOADING STATE ===== */}
      {loading && <LoadingState />}

      {/* ===== ERROR STATE ===== */}
      {error && (
        <Badge
          label={`❌ Erro: ${error}`}
          variant="error"
        />
      )}

      {/* ===== EMPTY STATE ===== */}
      {!loading && !error && (!response || response.data.length === 0) && (
        <EmptyState
          icon="📈"
          title="Nenhum dado para exibir"
          description="Configure os parâmetros e clique em 'Atualizar' para começar a análise"
        />
      )}
    </PageLayout>
  );
}
```

## Key Patterns

### 1. **Imports**
```typescript
// Premium components
import { PageLayout, FilterCard, ChartCard, InfoGrid, ... } from '@/components';

// External libraries
import { ResponsiveContainer, LineChart, ... } from 'recharts';
```

### 2. **State Management**
```typescript
const [dateCol, setDateCol] = useState('');
const [response, setResponse] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
```

### 3. **PageLayout Wrapper**
```typescript
<PageLayout
  icon="📈"
  title="Page Title"
  subtitle="Optional subtitle for context"
>
  {/* All content goes here */}
</PageLayout>
```

### 4. **FilterCard Pattern**
```typescript
<FilterCard title="Configuration" accentColor="blue">
  <SelectField label="..." value={...} onChange={...} options={...} />
  <ActionButton label="Update" onClick={...} loading={...} />
</FilterCard>
```

### 5. **InfoGrid (5 Metrics)**
```typescript
<InfoGrid
  items={[
    { icon: '📅', label: 'Label', value: 'Value', accentColor: 'blue' },
    // ... 4 more items
  ]}
/>
```

### 6. **ChartGrid + ChartCard**
```typescript
<ChartGrid cols={2}>
  <ChartCard title="Chart 1" accentColor="blue" size="large">
    {/* Recharts component here */}
  </ChartCard>
  <ChartCard title="Chart 2" accentColor="emerald" size="large">
    {/* Another Recharts component */}
  </ChartCard>
</ChartGrid>
```

### 7. **Conditional States**
```typescript
{loading && <LoadingState />}
{error && <Badge label={error} variant="error" />}
{!data && <EmptyState icon="..." title="..." description="..." />}
```

## Design Principles

1. **Component Hierarchy**
   - PageLayout (top level wrapper)
   - Section/Row (content grouping)
   - FilterCard (configuration)
   - InfoGrid (metrics)
   - ChartGrid (layout for charts)
   - ChartCard (individual visualizations)

2. **Color System**
   - Blue: Primary actions and data
   - Emerald: Success and totals
   - Amber: Warnings and averages
   - Cyan: Info and additional metrics
   - Purple: Complementary data

3. **Responsive Design**
   - Mobile: 1 column
   - Tablet: 2 columns (md breakpoint)
   - Desktop: 3 columns (lg breakpoint)

4. **Spacing**
   - Card padding: 24px-32px
   - Grid gaps: 16px-24px
   - Section spacing: 24px (space-y-6)

5. **Effects**
   - Hover: translateY(-2px) + shadow
   - Transitions: 0.3s ease
   - Backdrop: blur(8px)
   - Borders: 1px solid rgba(71, 85, 105, 0.5)

## What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Lines of Code | ~600 | ~280 |
| Component Reuse | ❌ None | ✅ 100% |
| Code Duplication | ❌ High | ✅ None |
| Visual Consistency | ❌ Manual | ✅ Automatic |
| Maintainability | ❌ Hard | ✅ Easy |
| Scalability | ❌ Difficult | ✅ Simple |

## Use This As Template

Copy this structure for:
- DistributionPage
- RankingPage
- Dashboard
- Overview
- All other pages

Just replace:
- Page title and subtitle
- Filter fields and options
- Metrics and their values
- Chart components and data
- Table structure if different

The overall structure stays exactly the same!

---

**This is your reference implementation. Study it, use it as a template, and apply the same pattern to all other pages.**
