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
    title: "DASHBOARDS",
    items: [
      { id: "efetivo", label: "Efetivo", icon: "📊", requires: ["efetivo"] },
      { id: "custos", label: "Custos", icon: "💰", requires: ["custos"] },
      { id: "orcamento", label: "Orcamento", icon: "📋", requires: ["orcamento"] },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { id: "anomalias", label: "Deteccao de Anomalias", icon: "🔍" },
      { id: "tendencias", label: "Tendencias & Previsao", icon: "📈" },
      { id: "segmentacao", label: "Segmentacao", icon: "🧩" },
      { id: "clustering", label: "Clustering / PCA", icon: "🗂️" },
    ],
  },
  {
    title: "DADOS",
    items: [
      { id: "profiler", label: "Data Profiler", icon: "🔬" },
      { id: "exportar", label: "Exportar", icon: "📤" },
    ],
  },
]

export const VIEW_REQUIREMENTS: Record<string, { requires: string[]; message: string }> = {
  efetivo: {
    requires: ["efetivo"],
    message: "Este dashboard requer dados de Efetivo. Faca upload de um arquivo com colunas como Cargo/Funcao e Fornecedor.",
  },
  custos: {
    requires: ["custos"],
    message: "Este dashboard requer dados de Custos. Faca upload de um arquivo com colunas como Valor e Centro de Custo.",
  },
  orcamento: {
    requires: ["orcamento"],
    message: "Este dashboard requer dados de Orcamento. Faca upload de um arquivo com colunas como Centro de Custo, Orcado e Realizado.",
  },
}

export function getVisibleNavSections(schemaTypes: string[]) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requires || item.requires.some((schema) => schemaTypes.includes(schema))),
  })).filter((section) => section.items.length > 0)
}

export function canAccessView(view: string, schemaTypes: string[]) {
  const requirements = VIEW_REQUIREMENTS[view]
  if (!requirements) return true
  return requirements.requires.some((schema) => schemaTypes.includes(schema))
}

export function getViewRequirement(view: string) {
  return VIEW_REQUIREMENTS[view] ?? null
}

export function getDefaultViewForSchema(schemaTypes: string[]) {
  if (schemaTypes.includes("efetivo")) return "efetivo"
  if (schemaTypes.includes("orcamento")) return "orcamento"
  if (schemaTypes.includes("custos")) return "custos"
  return "profiler"
}
