import { create } from 'zustand';
import type { KpiData, QualityData, InsightData } from '../api/analytics';

interface ActiveFilters {
date_range: { col: string; start: string; end: string } | null;
categorical: { col: string; values: string[] }[];
numeric_range: { col: string; min: number; max: number }[];
}

interface SemanticColumnProfile {
name: string;
dtype: string;
semantic_type: string;
confidence: number;
null_count: number;
null_pct: number;
unique_count: number;
sample_values: string[];
scores?: Record<string, number>;
}

interface SemanticData {
columns: SemanticColumnProfile[];
column_groups: Record<string, string[]>;
primary_temporal_col?: string;
primary_category_cols?: string[];
primary_numeric_cols?: string[];
}

interface SessionState {
// Session
sessionId: string | null;
filename: string | null;
rowCount: number;
colCount: number;

// Column classification (derived from colTypes on upload)
colTypes: Record<string, string>;
numericCols: string[];
dateCols: string[];
categoricalCols: string[];

// Semantic classification
semanticData: SemanticData | null;

// Data
kpis: KpiData[];
quality: QualityData[];
stats: Record<string, unknown>;
insights: InsightData[];

// Filters
activeFilters: ActiveFilters;
filteredRowCount: number | null;

// Template
selectedTemplate: string | null;
suggestedTemplates: string[];

// Actions
setSession: (payload: {
  session_id: string;
  filename: string;
  rows: number;
  columns: number;
  col_types: Record<string, string>;
}) => void;
setSemanticData: (semanticData: SemanticData | null) => void;
setKpis: (kpis: KpiData[]) => void;
setQuality: (quality: QualityData[]) => void;
setStats: (stats: Record<string, unknown>) => void;
setInsights: (insights: InsightData[]) => void;
setActiveFilters: (filters: Partial<ActiveFilters>) => void;
setFilteredRowCount: (n: number | null) => void;
setSelectedTemplate: (templateId: string | null) => void;
setSuggestedTemplates: (templates: string[]) => void;
clearSession: () => void;
}

const initialFilters: ActiveFilters = {
date_range: null,
categorical: [],
numeric_range: [],
};

function classifyCols(colTypes: Record<string, string>) {
const numeric: string[] = [];
const date: string[] = [];
const categorical: string[] = [];

for (const [col, type] of Object.entries(colTypes)) {
  const t = type.toLowerCase();
  if (t.includes('date') || t.includes('time')) {
    date.push(col);
  } else if (
    t.includes('int') ||
    t.includes('float') ||
    t.includes('numeric') ||
    t === 'number'
  ) {
    numeric.push(col);
  } else {
    categorical.push(col);
  }
}

return { numeric, date, categorical };
}

export const useSessionStore = create<SessionState>((set) => ({
sessionId:          null,
filename:           null,
rowCount:           0,
colCount:           0,
colTypes:           {},
numericCols:        [],
dateCols:           [],
categoricalCols:    [],
semanticData:       null,
kpis:               [],
quality:            [],
stats:              {},
insights:           [],
activeFilters:      initialFilters,
filteredRowCount:   null,
selectedTemplate:   null,
suggestedTemplates: [],

setSession: (payload) => {
  const { numeric, date, categorical } = classifyCols(payload.col_types);
  set({
    sessionId:       payload.session_id,
    filename:        payload.filename,
    rowCount:        payload.rows,
    colCount:        payload.columns,
    colTypes:        payload.col_types,
    numericCols:     numeric,
    dateCols:        date,
    categoricalCols: categorical,
    // Reset dependent state
    kpis:            [],
    quality:         [],
    stats:           {},
    insights:        [],
    activeFilters:   initialFilters,
    filteredRowCount: null,
  });
},

setSemanticData:      (semanticData) => set({ semanticData }),
setKpis:              (kpis) => set({ kpis }),
setQuality:           (quality) => set({ quality }),
setStats:             (stats) => set({ stats }),
setInsights:          (insights) => set({ insights }),
setFilteredRowCount:  (n) => set({ filteredRowCount: n }),
setSelectedTemplate:  (templateId) => set({ selectedTemplate: templateId }),
setSuggestedTemplates: (templates) => set({ suggestedTemplates: templates }),

setActiveFilters: (filters) =>
  set((state) => ({
    activeFilters: { ...state.activeFilters, ...filters },
  })),

clearSession: () =>
  set({
    sessionId:          null,
    filename:           null,
    rowCount:           0,
    colCount:           0,
    colTypes:           {},
    numericCols:        [],
    dateCols:           [],
    categoricalCols:    [],
    semanticData:       null,
    kpis:               [],
    quality:            [],
    stats:              {},
    insights:           [],
    activeFilters:      initialFilters,
    filteredRowCount:   null,
    selectedTemplate:   null,
    suggestedTemplates: [],
  }),
}));

export const useSession = useSessionStore;