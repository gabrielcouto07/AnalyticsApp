"""
Templates reutilizáveis — Componentes Streamlit para renderização comum.
"""

import pandas as pd
import streamlit as st
from utils import fmt_brl, pct_fmt, fmt_date


def render_header(model, filtered_df) -> None:
    """
    Renderiza header customizado para cada modelo.
    LAYOUT ATUALIZADO — v3.1
    Assinatura e comportamento idênticos. Apenas visual alterado.
    
    Args:
        model: BaseModel instanciado
        filtered_df: DataFrame filtrado com dados
    """
    import datetime
    
    model_name  = getattr(model, 'MODEL_NAME',  'Relatório')
    model_icon  = getattr(model, 'MODEL_ICON',  '📊')
    source_name = getattr(filtered_df, 'attrs', {}).get('filename', '')
    n_linhas    = len(filtered_df)

    # Período — lógica existente mantida intacta
    try:
        date_col = next(
            (c for c in filtered_df.columns if 'date' in c.lower() or 'data' in c.lower()),
            None
        )
        if date_col:
            dmin = filtered_df[date_col].min()
            dmax = filtered_df[date_col].max()
            periodo = f"{dmin.strftime('%d/%m/%Y')} → {dmax.strftime('%d/%m/%Y')}"
        else:
            periodo = "—"
    except Exception:
        periodo = "—"

    st.markdown(f"""
    <div style="
        background: #1a1d27;
        border: 1px solid #2d3144;
        border-radius: 14px;
        padding: 1.4rem 1.8rem;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    ">
        <div style="display:flex; align-items:center; gap:.9rem;">
            <span style="font-size:28px; line-height:1">{model_icon}</span>
            <div>
                <div style="
                    color: #e8eaf0;
                    font-size: 20px;
                    font-weight: 700;
                    letter-spacing: -.02em;
                    line-height: 1.2;
                ">Relatório {model_name}</div>
                <div style="color:#8b90a8; font-size:12px; margin-top:.25rem;">
                    {source_name} &nbsp;·&nbsp;
                    <span style="color:#c8cad4">{n_linhas:,} linhas brutas</span>
                    &nbsp;·&nbsp; Período: {periodo}
                </div>
            </div>
        </div>
        <div style="
            background: #20242f;
            border: 1px solid #2d3144;
            border-radius: 8px;
            padding: .4rem .8rem;
            color: #8b90a8;
            font-size: 11px;
            white-space: nowrap;
        ">
            🕐 {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_kpis(model_kpis: list[tuple]) -> None:
    """
    Renderiza KPI cards genéricos.
    
    Args:
        model_kpis: list[(label, value, color, sub), ...]
                    Ex: [("💼 Vendas", "R$ 100k", "indigo", "10 NFs"), ...]
    """
    cols = st.columns(len(model_kpis))
    for (label, value, color, sub), col in zip(model_kpis, cols):
        with col:
            st.markdown(f"""
            <div class="kpi-card {color}">
              <p class="kpi-title">{label}</p>
              <p class="kpi-value">{value}</p>
              <p class="kpi-sub">{sub}</p>
            </div>
            """, unsafe_allow_html=True)


def render_filters(filtered_df, filter_cols: list[str]) -> dict:
    """
    Renderiza filtros dinâmicos baseados nas colunas.
    
    Args:
        filtered_df: DataFrame com os dados
        filter_cols: lista de colunas para gerar filtros
                     Ex: ["SlpName", "BranchName", "CardName"]
        
    Returns:
        dict {coluna: [valores_selecionados], ...}
    """
    st.markdown('<div class="filter-box">', unsafe_allow_html=True)
    st.markdown("**🔍 Filtros Dinâmicos**")
    
    filters = {}
    
    # Montar colunas para layout (máx 4 por linha)
    n_filters = len([c for c in filter_cols if c in filtered_df.columns])
    cols = st.columns(min(4, n_filters))
    col_idx = 0
    
    for col_name in filter_cols:
        if col_name not in filtered_df.columns:
            continue
        
        with cols[col_idx % 4]:
            opts = sorted([x for x in filtered_df[col_name].dropna().astype(str).unique() if x])
            filters[col_name] = st.multiselect(
                f"🔹 {col_name}",
                opts,
                default=opts if len(opts) <= 10 else opts[:10],
                key=f"filter_{col_name}",
            )
        col_idx += 1
    
    st.markdown("</div>", unsafe_allow_html=True)
    return filters


def render_dataframe_display(df, numeric_cols: list[str] = None, 
                            percent_cols: list[str] = None,
                            max_height: int = 500) -> None:
    """
    Renderiza DataFrame com formatação automática.
    
    Args:
        df: DataFrame a exibir
        numeric_cols: colunas a formatar como R$
        percent_cols: colunas a formatar como %
        max_height: altura máxima em pixels
    """
    if df.empty:
        st.warning("Nenhum dado para exibir")
        return
    
    display_df = df.copy()
    
    if numeric_cols:
        for col in numeric_cols:
            if col in display_df.columns:
                display_df[col] = display_df[col].apply(fmt_brl)
    
    if percent_cols:
        for col in percent_cols:
            if col in display_df.columns:
                display_df[col] = display_df[col].apply(pct_fmt)
    
    st.caption(f"{len(display_df):,} linhas exibidas".replace(",", "."))
    st.dataframe(display_df, use_container_width=True, height=max_height)


def render_search_filter(df: pd.DataFrame, search_key: str = "search_all") -> pd.DataFrame:
    """
    Renderiza barra de busca e filtra DataFrame.
    
    Args:
        df: DataFrame
        search_key: chave de session_state para o campo
        
    Returns:
        DataFrame filtrado
    """
    search_term = st.text_input("🔍 Buscar em todos os campos", key=search_key)
    
    if search_term:
        mask = df.astype(str).apply(
            lambda col: col.str.contains(search_term, case=False, na=False)
        ).any(axis=1)
        return df[mask].copy()
    
    return df
