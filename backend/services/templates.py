"""
Template definitions for different data types
Each template includes:
- Key metrics to display
- Visualization suggestions
- Sample data structure
- Recommended analyses
"""

from typing import Dict, List, Any

# ============================================================================
# 1. NF TEMPLATE - Notas Fiscais (Invoices/Purchase Orders)
# ============================================================================
NF_TEMPLATE = {
    "name": "NF - Notas Fiscais",
    "description": "Entrada de dados de Notas Fiscais para projetos de construção",
    "icon": "📋",
    "color": "blue",
    "key_metrics": [
        {
            "name": "Total NFs",
            "field": "count",
            "description": "Total de notas fiscais processadas",
            "type": "number",
        },
        {
            "name": "Valor Total",
            "field": "VALOR",
            "description": "Valor total consolidado",
            "type": "currency",
        },
        {
            "name": "Fornecedores",
            "field": "FORNECEDOR",
            "description": "Número de fornecedores únicos",
            "type": "unique_count",
        },
        {
            "name": "Vencimento Médio",
            "field": "DATA VENCTO",
            "description": "Dias médios até vencimento",
            "type": "date_diff",
        },
    ],
    "required_columns": [
        "FORNECEDOR",
        "NF",
        "VALOR",
        "DATA VENCTO",
        "NATUREZA",
        "BOLETO/DEPÓSITO",
    ],
    "visualizations": [
        {
            "type": "pie",
            "title": "Valor por Fornecedor",
            "field": "FORNECEDOR",
            "value_field": "VALOR",
        },
        {
            "type": "bar",
            "title": "Distribuição por Natureza",
            "field": "NATUREZA",
            "value_field": "count",
        },
        {
            "type": "timeline",
            "title": "Vencimentos por Data",
            "date_field": "DATA VENCTO",
            "value_field": "VALOR",
        },
        {
            "type": "table",
            "title": "Top 10 Maiores NFs",
            "sort_by": "VALOR",
            "limit": 10,
        },
    ],
    "filters": ["FORNECEDOR", "NATUREZA", "BOLETO/DEPÓSITO", "SITUAÇÃO PLANILHA"],
    "sample_columns": {
        "FORNECEDOR": "text",
        "NF": "text",
        "VALOR": "numeric",
        "DATA VENCTO": "date",
        "NATUREZA": "text",
        "BOLETO/DEPÓSITO": "text",
    },
}

# ============================================================================
# 2. SALES TEMPLATE - Vendas
# ============================================================================
SALES_TEMPLATE = {
    "name": "Vendas",
    "description": "Dados de vendas com produtos, clientes e receita",
    "icon": "💰",
    "color": "emerald",
    "key_metrics": [
        {
            "name": "Receita Total",
            "field": "amount",
            "description": "Faturamento total",
            "type": "currency",
        },
        {
            "name": "Número de Vendas",
            "field": "count",
            "description": "Quantidade de transações",
            "type": "number",
        },
        {
            "name": "Ticket Médio",
            "field": "amount",
            "description": "Valor médio por venda",
            "type": "average",
        },
        {
            "name": "Clientes Únicos",
            "field": "customer_id",
            "description": "Clientes que realizaram compra",
            "type": "unique_count",
        },
    ],
    "required_columns": [
        "customer_id",
        "product_id",
        "amount",
        "date",
        "category",
    ],
    "visualizations": [
        {
            "type": "line",
            "title": "Receita por Data",
            "date_field": "date",
            "value_field": "amount",
        },
        {
            "type": "pie",
            "title": "Vendas por Categoria",
            "field": "category",
            "value_field": "amount",
        },
        {
            "type": "bar",
            "title": "Top 10 Produtos",
            "field": "product_id",
            "value_field": "amount",
            "limit": 10,
        },
        {
            "type": "scatter",
            "title": "Quantidade vs Valor",
            "x_field": "quantity",
            "y_field": "amount",
        },
    ],
    "filters": ["category", "date_range", "customer_segment"],
    "sample_columns": {
        "customer_id": "text",
        "product_id": "text",
        "amount": "numeric",
        "date": "date",
        "category": "text",
    },
}

# ============================================================================
# 3. INVENTORY TEMPLATE - Inventário
# ============================================================================
INVENTORY_TEMPLATE = {
    "name": "Inventário",
    "description": "Controle de estoque, movimentações e produtos",
    "icon": "📦",
    "color": "orange",
    "key_metrics": [
        {
            "name": "Itens em Estoque",
            "field": "quantity",
            "description": "Total de unidades disponíveis",
            "type": "sum",
        },
        {
            "name": "Valor do Estoque",
            "field": "unit_price",
            "description": "Valor total em reais",
            "type": "sum_with_field",
        },
        {
            "name": "SKUs Críticos",
            "field": "quantity",
            "description": "Produtos com baixo estoque",
            "type": "count_where",
            "condition": "quantity < 10",
        },
        {
            "name": "Rotatividade",
            "field": "last_movement",
            "description": "Dias desde última movimentação",
            "type": "date_diff",
        },
    ],
    "required_columns": [
        "sku",
        "product_name",
        "quantity",
        "unit_price",
        "warehouse",
        "last_movement",
    ],
    "visualizations": [
        {
            "type": "bar",
            "title": "Estoque por Depósito",
            "field": "warehouse",
            "value_field": "quantity",
        },
        {
            "type": "scatter",
            "title": "SKUs Críticos",
            "x_field": "sku",
            "y_field": "quantity",
        },
        {
            "type": "timeline",
            "title": "Movimentações",
            "date_field": "last_movement",
            "value_field": "quantity",
        },
        {
            "type": "table",
            "title": "Produtos com Baixo Estoque",
            "sort_by": "quantity",
            "limit": 20,
        },
    ],
    "filters": ["warehouse", "sku", "product_name", "quantity_range"],
    "sample_columns": {
        "sku": "text",
        "product_name": "text",
        "quantity": "numeric",
        "unit_price": "numeric",
        "warehouse": "text",
        "last_movement": "date",
    },
}

# ============================================================================
# 4. PROJECTS TEMPLATE - Projetos
# ============================================================================
PROJECTS_TEMPLATE = {
    "name": "Projetos",
    "description": "Acompanhamento de projetos, tarefas, progresso e recursos",
    "icon": "🏗️",
    "color": "purple",
    "key_metrics": [
        {
            "name": "Projetos Ativos",
            "field": "status",
            "description": "Projetos em andamento",
            "type": "count_where",
            "condition": "status = 'Active'",
        },
        {
            "name": "Taxa Conclusão",
            "field": "progress",
            "description": "Média de progresso geral",
            "type": "average",
        },
        {
            "name": "Tarefas Pendentes",
            "field": "task_status",
            "description": "Tarefas não completadas",
            "type": "count_where",
            "condition": "task_status != 'Done'",
        },
        {
            "name": "Orçamento Gasto",
            "field": "spent",
            "description": "Percentual do orçamento utilizado",
            "type": "percentage",
            "numerator_field": "spent",
            "denominator_field": "budget",
        },
    ],
    "required_columns": [
        "project_id",
        "project_name",
        "status",
        "progress",
        "budget",
        "spent",
        "start_date",
        "end_date",
    ],
    "visualizations": [
        {
            "type": "bar",
            "title": "Progresso por Projeto",
            "field": "project_name",
            "value_field": "progress",
        },
        {
            "type": "pie",
            "title": "Distribuição por Status",
            "field": "status",
            "value_field": "count",
        },
        {
            "type": "timeline",
            "title": "Cronograma",
            "start_date_field": "start_date",
            "end_date_field": "end_date",
            "title_field": "project_name",
        },
        {
            "type": "table",
            "title": "Detalhes dos Projetos",
            "sort_by": "progress",
            "columns": ["project_name", "status", "progress", "spent", "budget"],
        },
    ],
    "filters": ["status", "project_manager", "date_range", "budget_range"],
    "sample_columns": {
        "project_id": "text",
        "project_name": "text",
        "status": "text",
        "progress": "numeric",
        "budget": "numeric",
        "spent": "numeric",
        "start_date": "date",
        "end_date": "date",
    },
}

# ============================================================================
# 5. HR TEMPLATE - Recursos Humanos
# ============================================================================
HR_TEMPLATE = {
    "name": "Recursos Humanos",
    "description": "Dados de funcionários, folha de pagamento e benefícios",
    "icon": "👥",
    "color": "pink",
    "key_metrics": [
        {
            "name": "Total de Colaboradores",
            "field": "employee_id",
            "description": "Número de funcionários ativos",
            "type": "unique_count",
        },
        {
            "name": "Folha de Pagamento",
            "field": "salary",
            "description": "Total mensal de salários",
            "type": "sum",
        },
        {
            "name": "Taxa Rotatividade",
            "field": "exit_date",
            "description": "Percentual de desligamentos",
            "type": "percentage",
        },
        {
            "name": "Salário Médio",
            "field": "salary",
            "description": "Salário médio por colaborador",
            "type": "average",
        },
    ],
    "required_columns": [
        "employee_id",
        "name",
        "department",
        "salary",
        "hire_date",
        "position",
    ],
    "visualizations": [
        {
            "type": "pie",
            "title": "Colaboradores por Departamento",
            "field": "department",
            "value_field": "count",
        },
        {
            "type": "bar",
            "title": "Salários por Departamento",
            "field": "department",
            "value_field": "salary",
        },
        {
            "type": "timeline",
            "title": "Admissões ao Longo do Tempo",
            "date_field": "hire_date",
            "value_field": "count",
        },
        {
            "type": "table",
            "title": "Equipe",
            "columns": ["name", "department", "position", "salary", "hire_date"],
        },
    ],
    "filters": ["department", "position", "salary_range", "hire_date_range"],
    "sample_columns": {
        "employee_id": "text",
        "name": "text",
        "department": "text",
        "salary": "numeric",
        "hire_date": "date",
        "position": "text",
    },
}

# ============================================================================
# REGISTRY - All templates
# ============================================================================
TEMPLATES: Dict[str, Dict[str, Any]] = {
    "nf": NF_TEMPLATE,
    "sales": SALES_TEMPLATE,
    "inventory": INVENTORY_TEMPLATE,
    "projects": PROJECTS_TEMPLATE,
    "hr": HR_TEMPLATE,
}


def get_all_templates() -> Dict[str, Dict[str, Any]]:
    """Return all available templates"""
    return TEMPLATES


def get_template(template_id: str) -> Dict[str, Any] | None:
    """Get a specific template by ID"""
    return TEMPLATES.get(template_id)


def get_template_suggestions(columns: List[str]) -> List[str]:
    """
    Suggest templates based on column names using ML-like scoring
    Analyzes keyword matches and calculates confidence scores
    Returns list of template IDs sorted by relevance (highest first)
    """
    column_lower = [c.lower().strip() for c in columns]
    
    # Define template-specific keyword patterns with weights
    templates_keywords = {
        "nf": {
            "strong": ["fornecedor", "nf", "boleto", "depósito", "vencto"],  # weight: 2.0
            "medium": ["nota", "fiscal", "vencimento", "natureza"],  # weight: 1.5
            "weak": ["data", "valor"],  # weight: 1.0
        },
        "sales": {
            "strong": ["cliente", "produto", "categoria", "receita"],
            "medium": ["venda", "vendedor", "amount", "qty", "quantity"],
            "weak": ["data", "valor", "amount"],
        },
        "inventory": {
            "strong": ["sku", "estoque", "warehouse", "depósito"],
            "medium": ["quantidade", "produto", "locação", "movimentação"],
            "weak": ["data", "valor", "price"],
        },
        "projects": {
            "strong": ["projeto", "tarefa", "status", "progresso"],
            "medium": ["deadline", "responsável", "orçamento"],
            "weak": ["data", "valor"],
        },
        "hr": {
            "strong": ["funcionário", "departamento", "salário", "employee"],
            "medium": ["cargo", "posição", "admissão", "contrato"],
            "weak": ["data", "valor"],
        },
    }
    
    # Calculate scores for each template
    scores = {}
    for template_id, keywords in templates_keywords.items():
        score = 0.0
        
        for col in column_lower:
            # Check strong keywords (weight 2.0)
            for keyword in keywords["strong"]:
                if keyword in col or col in keyword:
                    score += 2.0
            
            # Check medium keywords (weight 1.5)
            for keyword in keywords["medium"]:
                if keyword in col or col in keyword:
                    score += 1.5
            
            # Check weak keywords (weight 1.0)
            for keyword in keywords["weak"]:
                if keyword in col or col in keyword:
                    score += 1.0
        
        if score > 0:
            scores[template_id] = score
    
    # Sort templates by score (highest first)
    if scores:
        sorted_templates = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [template_id for template_id, score in sorted_templates]
    
    # Default fallback: return sales template
    return ["sales"]


def get_essential_columns(template_id: str, df_columns: List[str]) -> List[str]:
    """
    Get essential columns for a template based on required_columns definition.
    Matches column names flexibly (case-insensitive, whitespace-tolerant).
    
    Returns list of columns that exist in the dataframe and are essential for the template.
    """
    template = get_template(template_id)
    if not template or "required_columns" not in template:
        return df_columns  # Return all if template doesn't define required columns
    
    required = template["required_columns"]
    df_cols_lower = {col.lower().strip(): col for col in df_columns}
    required_lower = [r.lower().strip() for r in required]
    
    # Find matching columns (case-insensitive)
    essential_cols = []
    for req_col_lower in required_lower:
        if req_col_lower in df_cols_lower:
            essential_cols.append(df_cols_lower[req_col_lower])
    
    return essential_cols


def filter_dataframe_for_template(df, template_id: str):
    """
    Filter dataframe to show only essential columns for a template.
    Removes empty columns, internal IDs, and unnecessary auxiliary columns.
    
    Returns cleaned dataframe with only relevant columns.
    """
    import pandas as pd
    
    # Get essential columns for this template
    essential_cols = get_essential_columns(template_id, list(df.columns))
    
    if not essential_cols:
        # If no essential columns found, filter manually
        # Remove columns that are likely auxiliary (contain patterns like +, _, etc.)
        excluded_patterns = [
            "cons", "seq", "fornec+nf", "nf repetidas", "consolidado",
            "empr", "temp", "codigo", "id", "internal", "aux", "auxiliar",
        ]
        
        df_filtered = df.copy()
        for col in df.columns:
            col_lower = col.lower()
            # Remove if column matches excluded patterns
            if any(pattern in col_lower for pattern in excluded_patterns):
                df_filtered = df_filtered.drop(columns=[col], errors='ignore')
            # Remove if column is completely empty
            elif df_filtered[col].isna().sum() == len(df_filtered):
                df_filtered = df_filtered.drop(columns=[col], errors='ignore')
        
        return df_filtered
    
    # Filter to essential columns only
    df_filtered = df[essential_cols].copy()
    
    # Remove rows where all essential values are null
    df_filtered = df_filtered.dropna(how='all')
    
    return df_filtered
