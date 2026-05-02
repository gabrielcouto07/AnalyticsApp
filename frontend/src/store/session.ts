import { create } from 'zustand'

import type { DataQualityReport } from '../api/analytics'
import { getDefaultViewForSchema } from '../components/layout/navigation'

interface SessionData {
  sessionId: string
  filename: string
  format: string
  rowCount: number
  colCount: number
  colTypes: Record<string, string>
  activeView: string
  selectedTemplate: string | null
  suggestedTemplates: string[]
  schemaTypes: string[]
  dataQuality: DataQualityReport | null
}

interface SessionState {
  sessions: Record<string, SessionData>
  activeSessionId: string | null
  sessionId: string | null
  filename: string | null
  format: string | null
  rows: number
  columns: number
  rowCount: number
  colCount: number
  colTypes: Record<string, string>
  schemaTypes: string[]
  dataQuality: DataQualityReport | null
  activeView: string
  selectedTemplate: string | null
  suggestedTemplates: string[]
  isUploadOpen: boolean

  setSession: (payload: {
    session_id: string
    filename: string
    rows: number
    columns: number
    col_types?: Record<string, string>
    template?: string | null
    detected_schema?: string[]
    schema_types: string[]
    data_quality?: DataQualityReport | null
    format?: string | null
  }) => void
  switchSession: (sessionId: string) => void
  removeSession: (sessionId: string) => void
  setActiveView: (view: string) => void
  setSelectedTemplate: (templateId: string | null) => void
  setSuggestedTemplates: (templates: string[]) => void
  openUpload: () => void
  closeUpload: () => void
  clearSession: () => void
}

const emptySnapshot = {
  sessionId: null as string | null,
  filename: null as string | null,
  format: null as string | null,
  rows: 0,
  columns: 0,
  rowCount: 0,
  colCount: 0,
  colTypes: {},
  schemaTypes: [] as string[],
  dataQuality: null as DataQualityReport | null,
  activeView: 'efetivo',
  selectedTemplate: null as string | null,
  suggestedTemplates: [] as string[],
}

function resolveSnapshot(session: SessionData | null) {
  if (!session) return emptySnapshot
  return {
    sessionId: session.sessionId,
    filename: session.filename,
    format: session.format,
    rows: session.rowCount,
    columns: session.colCount,
    rowCount: session.rowCount,
    colCount: session.colCount,
    colTypes: session.colTypes,
    schemaTypes: session.schemaTypes,
    dataQuality: session.dataQuality,
    activeView: session.activeView,
    selectedTemplate: session.selectedTemplate,
    suggestedTemplates: session.suggestedTemplates,
  }
}

function resolveSessionView(
  template: string | null | undefined,
  schemaTypes: string[],
  detectedSchema?: string[] | undefined,
) {
  const prioritizedSchemas = (detectedSchema ?? []).filter((value) => value && value !== 'generic')
  if (template && template !== 'generic') return template
  if (prioritizedSchemas.length > 0) {
    return getDefaultViewForSchema(prioritizedSchemas)
  }
  return getDefaultViewForSchema(schemaTypes)
}

function deriveFormat(filename: string) {
  if (!filename.includes('.')) return 'FILE'
  return filename.split('.').pop()?.toUpperCase() ?? 'FILE'
}

function deriveSchemaTypes(
  template: string | null | undefined,
  detectedSchema: string[] | undefined,
  schemaTypes: string[] | undefined,
) {
  const fallbackByTemplate: Record<string, string[]> = {
    efetivo: ['efetivo'],
    medicao: ['medicao'],
    custos: ['custos'],
    orcamento: ['orcamento'],
    generic: ['generic'],
  }

  const derivedTemplateTypes = template ? (fallbackByTemplate[template] ?? ['generic']) : ['generic']
  const raw = [...(schemaTypes ?? []), ...(detectedSchema ?? []), ...derivedTemplateTypes]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)

  if (raw.length === 0) {
    return ['generic']
  }

  if (raw.length > 1 && raw.includes('generic')) {
    return raw.filter((value) => value !== 'generic')
  }

  return raw
}

function removeSessionById(state: SessionState, sessionId: string) {
  const sessions = { ...state.sessions }
  delete sessions[sessionId]

  const nextActiveSessionId =
    state.activeSessionId === sessionId ? Object.keys(sessions)[0] ?? null : state.activeSessionId
  const nextSession = nextActiveSessionId ? sessions[nextActiveSessionId] ?? null : null

  return {
    sessions,
    activeSessionId: nextActiveSessionId,
    ...resolveSnapshot(nextSession),
  }
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: {},
  activeSessionId: null,
  isUploadOpen: false,
  ...emptySnapshot,

  setSession: (payload) =>
    set((state) => {
      const schemaTypes = deriveSchemaTypes(payload.template, payload.detected_schema, payload.schema_types)
      const activeView = resolveSessionView(payload.template, schemaTypes, payload.detected_schema)
      const session: SessionData = {
        sessionId: payload.session_id,
        filename: payload.filename,
        format: payload.format ?? deriveFormat(payload.filename),
        rowCount: payload.rows,
        colCount: payload.columns,
        colTypes: payload.col_types ?? {},
        activeView,
        selectedTemplate: payload.template && payload.template !== 'generic' ? payload.template : null,
        suggestedTemplates: [],
        schemaTypes,
        dataQuality: payload.data_quality ?? null,
      }

      return {
        sessions: {
          ...state.sessions,
          [session.sessionId]: session,
        },
        activeSessionId: session.sessionId,
        isUploadOpen: false,
        ...resolveSnapshot(session),
      }
    }),

  switchSession: (sessionId) =>
    set((state) => {
      const session = state.sessions[sessionId] ?? null
      return {
        activeSessionId: session?.sessionId ?? null,
        ...resolveSnapshot(session),
      }
    }),

  removeSession: (sessionId) =>
    set((state) => removeSessionById(state, sessionId)),

  setActiveView: (view) =>
    set((state) => {
      if (!state.activeSessionId) return { activeView: view }

      const current = state.sessions[state.activeSessionId]
      if (!current) return { activeView: view }

      const updated = {
        ...current,
        activeView: view,
      }

      return {
        sessions: {
          ...state.sessions,
          [current.sessionId]: updated,
        },
        ...resolveSnapshot(updated),
      }
    }),

  setSelectedTemplate: (templateId) =>
    set((state) => {
      if (!state.activeSessionId) return { selectedTemplate: templateId }

      const current = state.sessions[state.activeSessionId]
      if (!current) return { selectedTemplate: templateId }

      const updated = {
        ...current,
        selectedTemplate: templateId,
      }

      return {
        sessions: {
          ...state.sessions,
          [current.sessionId]: updated,
        },
        ...resolveSnapshot(updated),
      }
    }),

  setSuggestedTemplates: (templates) =>
    set((state) => {
      if (!state.activeSessionId) return { suggestedTemplates: templates }

      const current = state.sessions[state.activeSessionId]
      if (!current) return { suggestedTemplates: templates }

      const updated = {
        ...current,
        suggestedTemplates: templates,
      }

      return {
        sessions: {
          ...state.sessions,
          [current.sessionId]: updated,
        },
        ...resolveSnapshot(updated),
      }
    }),

  openUpload: () => set({ isUploadOpen: true }),

  closeUpload: () => set({ isUploadOpen: false }),

  clearSession: () =>
    set((state) => {
      if (!state.activeSessionId) {
        return {
          sessions: {},
          activeSessionId: null,
          ...emptySnapshot,
        }
      }

      return removeSessionById(state, state.activeSessionId)
    }),
}))

