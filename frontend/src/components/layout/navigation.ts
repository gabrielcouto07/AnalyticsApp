import { SCHEMA_REQUIRED_COLUMNS } from "./schemaRequirements"

export type NavItem = {
  id: string
  label: string
  icon: string
  color?: string
  description?: string
  requires?: string[]
  requiresMultiple?: boolean
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "DASHBOARDS",
    items: [
      {
        id: "efetivo",
        label: "Efetivo de Obra",
        icon: "👷",
        color: "#3B82F6",
        requires: ["efetivo"],
        description: "Presenca diaria, fornecedores e funcoes",
      },
      {
        id: "medicao",
        label: "Medicoes / MP",
        icon: "📐",
        color: "#A855F7",
        requires: ["medicao"],
        description: "Propostas, medicoes e boletins por fornecedor",
      },
      {
        id: "custos",
        label: "Custos / NFs",
        icon: "💰",
        color: "#F97316",
        requires: ["custos", "orcamento"],
        description: "Notas fiscais, consolidado e fluxo de caixa",
      },
      {
        id: "orcamento",
        label: "Orcamento",
        icon: "📋",
        color: "#22C55E",
        requires: ["orcamento", "custos"],
        description: "Itens orcados, mapas e orcado x realizado",
      },
      {
        id: "cross",
        label: "Analise Cruzada",
        icon: "🔗",
        color: "#64748B",
        requires: ["efetivo", "medicao"],
        requiresMultiple: true,
        description: "Compara automaticamente efetivo com medicoes do mesmo projeto",
      },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { id: "anomalias", label: "Anomalias", icon: "🔍" },
      { id: "tendencias", label: "Tendencias", icon: "📈" },
      { id: "segmentacao", label: "Segmentacao", icon: "🌿" },
      { id: "clustering", label: "Clustering / PCA", icon: "🔬" },
    ],
  },
  {
    title: "DADOS",
    items: [
      { id: "profiler", label: "Data Profiler", icon: "📊" },
      { id: "exportar", label: "Exportar", icon: "💾" },
    ],
  },
]

export const VIEW_REQUIREMENTS: Record<
  string,
  { requires: string[]; requiredLabel: string; columns: string[]; message: string }
> = {
  efetivo: {
    requires: ["efetivo"],
    requiredLabel: "efetivo",
    columns: SCHEMA_REQUIRED_COLUMNS.efetivo,
    message:
      "Este dashboard requer dados de efetivo. Faca upload de um arquivo com CARGO/FUNCAO, FORNECEDOR, FILIAL/OBRA e PERIODO.",
  },
  medicao: {
    requires: ["medicao"],
    requiredLabel: "medicao",
    columns: ["ITEM", "DESCRICAO", "QUANTIDADE", "UNIDADE", "VALOR"],
    message:
      "Este dashboard requer dados de medicao. Faca upload de um arquivo com ITEM, DESCRICAO, QUANTIDADE, UNIDADE e VALOR.",
  },
  custos: {
    requires: ["custos", "orcamento"],
    requiredLabel: "custos",
    columns: SCHEMA_REQUIRED_COLUMNS.custos,
    message:
      "Este dashboard requer dados de custos. Faca upload de um arquivo com NATUREZA, FORNECEDOR, NF, DATA VENCTO e VALOR.",
  },
  orcamento: {
    requires: ["orcamento", "custos"],
    requiredLabel: "orcamento",
    columns: SCHEMA_REQUIRED_COLUMNS.orcamento,
    message:
      "Este dashboard requer dados de orcamento. Faca upload de um arquivo com CUSTO TOTAL, CUSTO UNITARIO, QTD, DESCRICAO e UNID.",
  },
  cross: {
    requires: ["efetivo", "medicao"],
    requiredLabel: "analise cruzada",
    columns: ["EFETIVO", "MEDICAO / MP"],
    message:
      "A analise cruzada aparece quando a sessao possui pelo menos dois schemas ativos e inclui efetivo com medicao.",
  },
}

export function getVisibleNavSections(schemaTypes: string[]) {
  return NAV_SECTIONS.map((section) => {
    if (section.title === "DASHBOARDS" && schemaTypes.length === 0) {
      return { ...section, items: [] }
    }

    return {
      ...section,
      items: section.items.filter((item) => {
        if (item.requiresMultiple) {
          return schemaTypes.length >= 2 && (item.requires ?? []).every((schema) => schemaTypes.includes(schema))
        }
        return !item.requires || item.requires.some((schema) => schemaTypes.includes(schema))
      }),
    }
  }).filter((section) => section.items.length > 0)
}

export function canAccessView(view: string, schemaTypes: string[]) {
  const requirement = VIEW_REQUIREMENTS[view]
  if (!requirement) return true
  if (view === "cross") {
    return schemaTypes.length >= 2 && requirement.requires.every((schema) => schemaTypes.includes(schema))
  }
  return requirement.requires.some((schema) => schemaTypes.includes(schema))
}

export function getViewRequirement(view: string) {
  return VIEW_REQUIREMENTS[view] ?? null
}

export function getDefaultViewForSchema(schemaTypes: string[]) {
  const priority = ["efetivo", "medicao", "custos", "orcamento", "generic"]
  return priority.find((schema) => schemaTypes.includes(schema)) ?? "profiler"
}
