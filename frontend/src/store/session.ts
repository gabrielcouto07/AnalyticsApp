import { create } from 'zustand';

interface SessionState {
  sessionId: string | null;
  filename: string | null;
  rowCount: number;
  colCount: number;
  colTypes: Record<string, string>;

  selectedTemplate: string | null;
  suggestedTemplates: string[];

  setSession: (payload: {
    session_id: string;
    filename: string;
    rows: number;
    columns: number;
    col_types: Record<string, string>;
    template?: string | null;
  }) => void;
  setSelectedTemplate: (templateId: string | null) => void;
  setSuggestedTemplates: (templates: string[]) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  filename: null,
  rowCount: 0,
  colCount: 0,
  colTypes: {},
  selectedTemplate: null,
  suggestedTemplates: [],

  setSession: (payload) =>
    set({
      sessionId: payload.session_id,
      filename: payload.filename,
      rowCount: payload.rows,
      colCount: payload.columns,
      colTypes: payload.col_types,
      selectedTemplate: payload.template ?? null,
    }),

  setSelectedTemplate: (templateId) => set({ selectedTemplate: templateId }),
  setSuggestedTemplates: (templates) => set({ suggestedTemplates: templates }),

  clearSession: () =>
    set({
      sessionId: null,
      filename: null,
      rowCount: 0,
      colCount: 0,
      colTypes: {},
      selectedTemplate: null,
      suggestedTemplates: [],
    }),
}));

export const useSession = useSessionStore;