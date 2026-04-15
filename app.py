import io
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

warnings.filterwarnings("ignore")

# ════════════════════════════════════════════════════════════════════════════
# INJEÇÃO DE CSS — DEVE SER A PRIMEIRA COISA DO APP
# ════════════════════════════════════════════════════════════════════════════

def _inject_css():
    """Injeta theme.css no início da renderização — antes de qualquer elemento."""
    css_path = Path(__file__).parent / "theme.css"
    if css_path.exists():
        with open(css_path, encoding="utf-8") as f:
            css_content = f.read()
        st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)

_inject_css()

# ════════════════════════════════════════════════════════════════════════════
# IMPORTS: Configuração + UI
# ════════════════════════════════════════════════════════════════════════════

try:
    from config.colors import PALETTE, CHART_COLORS
    from templates.ui import (
        load_theme,
        kpi_card,
        render_kpi_row,
        apply_chart_style,
        render_header,
        render_period_filter,
        render_separator,
        detect_time_granularity,
    )
except ImportError as e:
    st.error(f"❌ Erro ao carregar módulos: {e}\n\nCertifique-se de que config/ e templates/ existem.")
    st.stop()

# ════════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO DA APLICAÇÃO
# ════════════════════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="📊 Analytics Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

load_theme()

# ════════════════════════════════════════════════════════════════════════════
# STATE MANAGEMENT
# ════════════════════════════════════════════════════════════════════════════

if "df_loaded" not in st.session_state:
    st.session_state.df_loaded = None
if "df_filtered" not in st.session_state:
    st.session_state.df_filtered = None
if "selected_columns" not in st.session_state:
    st.session_state.selected_columns = []

# ════════════════════════════════════════════════════════════════════════════
# FUNÇÕES AUXILIARES
# ════════════════════════════════════════════════════════════════════════════

def load_file(uploaded_file) -> pd.DataFrame | None:
    """Carrega arquivo Excel ou CSV."""
    try:
        if uploaded_file.name.endswith('.xlsx') or uploaded_file.name.endswith('.xls'):
            df = pd.read_excel(uploaded_file)
        elif uploaded_file.name.endswith('.csv'):
            df = pd.read_csv(uploaded_file, encoding='utf-8')
        else:
            st.error("❌ Formato não suportado. Use .xlsx, .xls ou .csv")
            return None
        return df
    except Exception as e:
        st.error(f"❌ Erro ao carregar arquivo: {e}")
        return None

def export_to_excel(df: pd.DataFrame, filename: str = "export.xlsx"):
    """Retorna arquivo Excel em memory."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="Dados")
    return output.getvalue()

def export_to_csv(df: pd.DataFrame) -> str:
    """Retorna CSV em string."""
    return df.to_csv(index=False, encoding='utf-8-sig')

# ════════════════════════════════════════════════════════════════════════════
# LAYOUT PRINCIPAL
# ════════════════════════════════════════════════════════════════════════════

st.title("📊 Analytics Dashboard — Análise Genérica")
st.markdown("**Sistema generalista para análise e visualização de qualquer base de dados**")

# ── SIDEBAR: UPLOAD E FILTROS ──────────────────────────────────────────────
st.sidebar.markdown("### 📁 Carregar Dados")

uploaded_file = st.sidebar.file_uploader(
    "Escolha um arquivo",
    type=["xlsx", "xls", "csv"],
    key="file_upload",
    help="Suporta Excel (.xlsx, .xls) e CSV"
)

if uploaded_file:
    df = load_file(uploaded_file)
    
    if df is not None:
        st.session_state.df_loaded = df
        
        st.sidebar.success(f"✅ Arquivo carregado: {uploaded_file.name}")
        st.sidebar.caption(f"Linhas: {len(df)} | Colunas: {len(df.columns)}")
        
        # ── SELEÇÃO DE COLUNAS ─────────────────────────────────────────
        st.sidebar.markdown("---")
        st.sidebar.markdown("### 🔍 Seleção de Colunas")
        
        all_columns = df.columns.tolist()
        
        # Opção "Selecionar Todos"
        select_all = st.sidebar.checkbox("Selecionar todas as colunas", value=True)
        
        if select_all:
            st.session_state.selected_columns = all_columns
        else:
            st.session_state.selected_columns = st.sidebar.multiselect(
                "Escolha colunas para análise",
                all_columns,
                default=all_columns[:5] if len(all_columns) > 5 else all_columns
            )
        
        # Aplicar seleção
        if st.session_state.selected_columns:
            st.session_state.df_filtered = df[st.session_state.selected_columns].copy()
        
        # ── ABAS PRINCIPAIS ────────────────────────────────────────────
        tab_overview, tab_explore, tab_stats, tab_export = st.tabs(
            ["📊 Visão Geral", "🔎 Explorador", "📈 Estatísticas", "💾 Exportar"]
        )
        
        # ── TAB 1: VISÃO GERAL ────────────────────────────────────────
        with tab_overview:
            st.markdown("### 📊 Primeiras Linhas dos Dados")
            st.dataframe(
                st.session_state.df_filtered.head(10),
                use_container_width=True
            )
            
            st.markdown("---")
            st.markdown("### 📋 Informações do DataFrame")
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("📊 Total de Linhas", len(st.session_state.df_filtered))
            with col2:
                st.metric("🏷️ Total de Colunas", len(st.session_state.df_filtered.columns))
            with col3:
                st.metric("💾 Tamanho (MB)", round(st.session_state.df_filtered.memory_usage().sum() / 1024**2, 2))
        
        # ── TAB 2: EXPLORADOR (Gráficos) ───────────────────────────────
        with tab_explore:
            st.markdown("### 🔎 Explorador de Dados")
            
            # Detectar tipos de colunas
            numeric_cols = st.session_state.df_filtered.select_dtypes(include=[np.number]).columns.tolist()
            text_cols = st.session_state.df_filtered.select_dtypes(include=['object']).columns.tolist()
            date_cols = st.session_state.df_filtered.select_dtypes(include=['datetime64']).columns.tolist()
            
            if numeric_cols:
                st.markdown("**📊 Distribuição de Variáveis Numéricas**")
                col_numeric = st.selectbox("Escolha coluna numérica", numeric_cols, key="numeric_col")
                
                fig = px.histogram(
                    st.session_state.df_filtered,
                    x=col_numeric,
                    nbins=50,
                    title=f"Distribuição: {col_numeric}",
                    color_discrete_sequence=[PALETTE.get("primary", "#4f8ef7")]
                )
                fig = apply_chart_style(fig, title=f"Distribuição: {col_numeric}")
                st.plotly_chart(fig, use_container_width=True)
            
            if text_cols:
                st.markdown("---")
                st.markdown("**📢 Contagem de Valores Categóricos**")
                col_text = st.selectbox("Escolha coluna categórica", text_cols, key="text_col")
                
                top_n = st.slider("Top N categorias", 5, 50, 10, key="top_n")
                
                value_counts = st.session_state.df_filtered[col_text].value_counts().head(top_n)
                fig = px.bar(
                    x=value_counts.values,
                    y=value_counts.index,
                    orientation='h',
                    title=f"Top {top_n} valores: {col_text}",
                    color_discrete_sequence=[PALETTE.get("success", "#34c97e")]
                )
                fig = apply_chart_style(fig)
                st.plotly_chart(fig, use_container_width=True)
            
            if numeric_cols and text_cols:
                st.markdown("---")
                st.markdown("**📊 Análise Cruzada**")
                col1, col2 = st.columns(2)
                
                with col1:
                    col_cat = st.selectbox("Coluna categórica", text_cols, key="cross_cat")
                with col2:
                    col_num = st.selectbox("Coluna numérica", numeric_cols, key="cross_num")
                
                fig = px.box(
                    st.session_state.df_filtered,
                    x=col_cat,
                    y=col_num,
                    title=f"{col_num} por {col_cat}",
                    color_discrete_sequence=[PALETTE.get("warning", "#f5a623")]
                )
                fig = apply_chart_style(fig)
                st.plotly_chart(fig, use_container_width=True)
        
        # ── TAB 3: ESTATÍSTICAS ────────────────────────────────────────
        with tab_stats:
            st.markdown("### 📈 Estatísticas Descritivas")
            
            numeric_cols = st.session_state.df_filtered.select_dtypes(include=[np.number]).columns.tolist()
            
            if numeric_cols:
                stats_df = st.session_state.df_filtered[numeric_cols].describe().T
                st.dataframe(stats_df, use_container_width=True)
                
                st.markdown("---")
                st.markdown("### 🔗 Correlação Entre Variáveis")
                
                corr_matrix = st.session_state.df_filtered[numeric_cols].corr()
                fig = px.imshow(
                    corr_matrix,
                    color_continuous_scale="RdBu",
                    zmin=-1, zmax=1,
                    title="Matriz de Correlação"
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("ℹ️ Nenhuma coluna numérica encontrada para análise estatística.")
        
        # ── TAB 4: EXPORTAR ────────────────────────────────────────────
        with tab_export:
            st.markdown("### 💾 Exportar Dados")
            
            col1, col2 = st.columns(2)
            
            with col1:
                excel_data = export_to_excel(st.session_state.df_filtered, "analytics_export.xlsx")
                st.download_button(
                    label="📥 Baixar como Excel (.xlsx)",
                    data=excel_data,
                    file_name=f"analytics_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            
            with col2:
                csv_data = export_to_csv(st.session_state.df_filtered)
                st.download_button(
                    label="📥 Baixar como CSV",
                    data=csv_data,
                    file_name=f"analytics_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv"
                )

else:
    st.info("👈 Carregue um arquivo na barra lateral para começar.")
