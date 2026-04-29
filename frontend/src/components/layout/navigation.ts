import { SCHEMA_REQUIRED_COLUMNS } from './schemaRequirements'

export type NavItem = {
  id: string
  label: string
  icon: string
  requires?: string[]
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'DASHBOARDS',
    items: [
      { id: 'efetivo', label: 'Efetivo', icon: '👷', requires: ['efetivo'] },
      { id: 'custos', label: 'Custos', icon: '💰', requires: ['custos', 'orcamento'] },
      { id: 'orcamento', label: 'Orçamento', icon: '📋', requires: ['orcamento', 'custos'] },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { id: 'anomalias', label: 'Detecção de Anomalias', icon: '🔍' },
      { id: 'tendencias', label: 'Tendências & Previsão', icon: '📈' },
      { id: 'segmentacao', label: 'Segmentação', icon: '🌿' },
      { id: 'clustering', label: 'Clustering / PCA', icon: '🔬' },
    ],
  },
  {
    title: 'DADOS',
    items: [
      { id: 'profiler', label: 'Data Profiler', icon: '📊' },
      { id: 'exportar', label: 'Exportar', icon: '💾' },
    ],
  },
]

export const VIEW_REQUIREMENTS: Record<
  string,
  { requires: string[]; requiredLabel: string; columns: string[]; message: string }
> = {
  efetivo: {
    requires: ['efetivo'],
    requiredLabel: 'efetivo',
    columns: SCHEMA_REQUIRED_COLUMNS.efetivo,
    message:
      'Este dashboard requer dados do tipo efetivo. Faça upload de um arquivo com CARGO/FUNÇÃO, FORNECEDOR, FILIAL/OBRA e PERÍODO.',
  },
  custos: {
    requires: ['custos', 'orcamento'],
    requiredLabel: 'custos',
    columns: SCHEMA_REQUIRED_COLUMNS.custos,
    message:
      'Este dashboard requer dados do tipo custos. Faça upload de um arquivo com NATUREZA, FORNECEDOR, NF, DATA VENCTO e VALOR.',
  },
  orcamento: {
    requires: ['orcamento', 'custos'],
    requiredLabel: 'orcamento',
    columns: SCHEMA_REQUIRED_COLUMNS.orcamento,
    message:
      'Este dashboard requer dados do tipo orcamento. Faça upload de um arquivo com CUSTO TOTAL, CUSTO UNITÁRIO, QTD, DESCRIÇÃO e UNID.',
  },
}

export function getVisibleNavSections(schemaTypes: string[]) {
  return NAV_SECTIONS.map((section) => {
    if (section.title === 'DASHBOARDS' && schemaTypes.length === 0) {
      return { ...section, items: [] }
    }

    return {
      ...section,
      items: section.items.filter(
        (item) => !item.requires || item.requires.some((schema) => schemaTypes.includes(schema)),
      ),
    }
  }).filter((section) => section.items.length > 0)
}

export function canAccessView(view: string, schemaTypes: string[]) {
  const requirement = VIEW_REQUIREMENTS[view]
  if (!requirement) return true
  return requirement.requires.some((schema) => schemaTypes.includes(schema))
}

export function getViewRequirement(view: string) {
  return VIEW_REQUIREMENTS[view] ?? null
}

export function getDefaultViewForSchema(schemaTypes: string[]) {
  if (schemaTypes.includes('efetivo')) return 'efetivo'
  if (schemaTypes.includes('custos')) return 'custos'
  if (schemaTypes.includes('orcamento')) return 'orcamento'
  return 'profiler'
}
