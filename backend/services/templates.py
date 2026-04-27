"""
Template definitions for different data types.
Includes: NF, Sales, Inventory, Projects, HR, Efetivo, Orcamento
"""

from typing import Dict, List, Any

# ============================================================================
# 1. NF TEMPLATE
# ============================================================================
NF_TEMPLATE = {
    "name": "NF - Notas Fiscais",
    "description": "Entrada de dados de Notas Fiscais para projetos de construção",
    "icon": "📋",
    "color": "blue",
    "key_metrics": [
        {"name": "Total NFs", "field": "count", "description": "Total de notas fiscais processadas", "type": "number"},
        {"name": "Valor Total", "field": "VALOR", "description": "Valor total consolidado", "type": "currency"},
        {"name": "Fornecedores", "field": "FORNECEDOR", "description": "Número de fornecedores únicos", "type": "unique_count"},
        {"name": "Vencimento Médio", "field": "DATA VENCTO", "description": "Dias médios até vencimento", "type": "date_diff"},
    ],
    "required_columns": ["FORNECEDOR", "NF", "VALOR", "DATA VENCTO", "NATUREZA", "BOLETO/DEPÓSITO"],
    "visualizations": [
        {"type": "pie", "title": "Valor por Fornecedor", "field": "FORNECEDOR", "value_field": "VALOR"},
        {"type": "bar", "title": "Distribuição por Natureza", "field": "NATUREZA", "value_field": "count"},
        {"type": "timeline", "title": "Vencimentos por Data", "date_field": "DATA VENCTO", "value_field": "VALOR"},
        {"type": "table", "title": "Top 10 Maiores NFs", "sort_by": "VALOR", "limit": 10},
    ],
    "filters": ["FORNECEDOR", "NATUREZA", "BOLETO/DEPÓSITO", "SITUAÇÃO PLANILHA"],
    "sample_columns": {"FORNECEDOR": "text", "NF": "text", "VALOR": "numeric", "DATA VENCTO": "date", "NATUREZA": "text", "BOLETO/DEPÓSITO": "text"},
}

# ============================================================================
# 2-5. SALES, INVENTORY, PROJECTS, HR TEMPLATES (unchanged)
# ============================================================================
SALES_TEMPLATE = {
    "name": "Vendas", "description": "Dados de vendas com produtos, clientes e receita",
    "icon": "💰", "color": "emerald",
    "key_metrics": [
        {"name": "Receita Total", "field": "amount", "description": "Faturamento total", "type": "currency"},
        {"name": "Número de Vendas", "field": "count", "description": "Quantidade de transações", "type": "number"},
        {"name": "Ticket Médio", "field": "amount", "description": "Valor médio por venda", "type": "average"},
        {"name": "Clientes Únicos", "field": "customer_id", "description": "Clientes que realizaram compra", "type": "unique_count"},
    ],
    "required_columns": ["customer_id", "product_id", "amount", "date", "category"],
    "visualizations": [], "filters": ["category", "date_range", "customer_segment"],
    "sample_columns": {"customer_id": "text", "product_id": "text", "amount": "numeric", "date": "date", "category": "text"},
}
INVENTORY_TEMPLATE = {
    "name": "Inventário", "description": "Controle de estoque, movimentações e produtos",
    "icon": "📦", "color": "orange",
    "key_metrics": [], "required_columns": [], "visualizations": [], "filters": [], "sample_columns": {},
}
PROJECTS_TEMPLATE = {
    "name": "Projetos", "description": "Acompanhamento de projetos, tarefas, progresso e recursos",
    "icon": "🏗️", "color": "purple",
    "key_metrics": [], "required_columns": [], "visualizations": [], "filters": [], "sample_columns": {},
}
HR_TEMPLATE = {
    "name": "Recursos Humanos", "description": "Dados de funcionários, folha de pagamento e benefícios",
    "icon": "👥", "color": "pink",
    "key_metrics": [], "required_columns": [], "visualizations": [], "filters": [], "sample_columns": {},
}

# ============================================================================
# REGISTRY
# ============================================================================
TEMPLATES: Dict[str, Dict[str, Any]] = {
    "nf": NF_TEMPLATE,
    "sales": SALES_TEMPLATE,
    "inventory": INVENTORY_TEMPLATE,
    "projects": PROJECTS_TEMPLATE,
    "hr": HR_TEMPLATE,
}

# Register Efetivo template
try:
    from .efetivo_template import EFETIVO_TEMPLATE
    TEMPLATES["efetivo"] = EFETIVO_TEMPLATE
except ImportError:
    pass

# Register Orcamento template
try:
    from .orcamento_template import ORCAMENTO_TEMPLATE
    TEMPLATES["orcamento"] = ORCAMENTO_TEMPLATE
except ImportError:
    pass

# Register Materiais template
try:
    from .materiais_template import MATERIAIS_TEMPLATE
    TEMPLATES["materiais"] = MATERIAIS_TEMPLATE
except ImportError:
    pass

# Register Custos template
try:
    from .custos_template import CUSTOS_TEMPLATE
    TEMPLATES["custos"] = CUSTOS_TEMPLATE
except ImportError:
    pass


def get_all_templates() -> Dict[str, Dict[str, Any]]:
    return TEMPLATES

def get_template(template_id: str) -> Dict[str, Any] | None:
    return TEMPLATES.get(template_id)

def get_template_suggestions(columns: List[str]) -> List[str]:
    column_lower = [c.lower().strip() for c in columns]
    templates_keywords = {
        "nf": {"strong": ["fornecedor", "nf", "boleto", "depósito", "vencto"], "medium": ["nota", "fiscal", "vencimento", "natureza"], "weak": ["data", "valor"]},
        "sales": {"strong": ["cliente", "produto", "categoria", "receita"], "medium": ["venda", "vendedor", "amount", "qty", "quantity"], "weak": ["data", "valor", "amount"]},
        "inventory": {"strong": ["sku", "estoque", "warehouse", "depósito"], "medium": ["quantidade", "produto", "locação", "movimentação"], "weak": ["data", "valor", "price"]},
        "projects": {"strong": ["projeto", "tarefa", "status", "progresso"], "medium": ["deadline", "responsável", "orçamento"], "weak": ["data", "valor"]},
        "hr": {"strong": ["funcionário", "departamento", "salário", "employee"], "medium": ["cargo", "posição", "admissão", "contrato"], "weak": ["data", "valor"]},
        "efetivo": {"strong": ["fornecedor", "funcao", "quantidade", "diarias"], "medium": ["obra", "mesnome", "dia"], "weak": ["periodo", "trabalhou"]},
        "orcamento": {"strong": ["fornecedornome", "descricao", "preco", "valora", "valorb"], "medium": ["assunto", "quant", "unid", "tipo"], "weak": ["obra", "numero"]},
        "materiais": {"strong": ["fornecedor", "mapa", "item", "descricao", "quant", "preço", "negociado"], "medium": ["obra", "assunto", "unid", "contato", "telefone"], "weak": ["valor", "data"]},
        "custos": {"strong": ["numconsolidado", "fornecedor", "mapaprecos", "datavencto", "condpagto"], "medium": ["valor", "natureza", "nf", "consolidado"], "weak": ["obra", "data"]},
    }
    scores = {}
    for template_id, keywords in templates_keywords.items():
        score = 0.0
        for col in column_lower:
            for keyword in keywords["strong"]:
                if keyword in col or col in keyword: score += 2.0
            for keyword in keywords["medium"]:
                if keyword in col or col in keyword: score += 1.5
            for keyword in keywords["weak"]:
                if keyword in col or col in keyword: score += 1.0
        if score > 0: scores[template_id] = score
    if scores:
        return [t for t, _ in sorted(scores.items(), key=lambda x: x[1], reverse=True)]
    return ["sales"]

def get_essential_columns(template_id: str, df_columns: List[str]) -> List[str]:
    template = get_template(template_id)
    if not template or "required_columns" not in template: return df_columns
    required = template["required_columns"]
    df_cols_lower = {col.lower().strip(): col for col in df_columns}
    return [df_cols_lower[r.lower().strip()] for r in required if r.lower().strip() in df_cols_lower]

def filter_dataframe_for_template(df, template_id: str):
    import pandas as pd
    essential_cols = get_essential_columns(template_id, list(df.columns))
    if not essential_cols:
        excluded_patterns = ["cons", "seq", "fornec+nf", "nf repetidas", "consolidado", "empr", "temp", "codigo", "id", "internal", "aux", "auxiliar"]
        df_filtered = df.copy()
        for col in df.columns:
            col_lower = col.lower()
            if any(p in col_lower for p in excluded_patterns): df_filtered = df_filtered.drop(columns=[col], errors='ignore')
            elif df_filtered[col].isna().sum() == len(df_filtered): df_filtered = df_filtered.drop(columns=[col], errors='ignore')
        return df_filtered
    df_filtered = df[essential_cols].copy()
    df_filtered = df_filtered.dropna(how='all')
    return df_filtered
