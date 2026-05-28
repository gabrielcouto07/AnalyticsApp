"""VendasModel — Vendas"""
import io, re, numpy as np, pandas as pd, plotly.express as px, streamlit as st
from datetime import datetime
from models.base_model import BaseModel

# DEBUG_MODE: tentará importar do app, com fallback para False se circular
DEBUG_MODE = False
try:
    from app import DEBUG_MODE
except (ImportError, RuntimeError):
    DEBUG_MODE = False

def _parse_num(v) -> float:
    if pd.isna(v): return 0.0
    s = str(v).strip()
    if s.lower() in ("nan","none","null","","n/a","-"): return 0.0
    try: return float(s.replace(".", "").replace(",", ".") if "," in s else s)
    except: return 0.0

def _fmt_brl(v: float) -> str:
    try: return f"R$ {abs(v):,.2f}".replace(",","X").replace(".",",").replace("X",".")
    except: return "R$ 0,00"

def _smart_date(val):
    if pd.isna(val): return pd.NaT  
    try: return pd.to_datetime(val)
    except: return pd.NaT

def _get_first_mode(x):
    m = x.mode()
    return m.iloc[0] if len(m) > 0 else ""

# ═══════════════════════════════════════════════════════════════════
# FIX 2: SMART DATE GRANULARITY (Roadmap v3)
# ═══════════════════════════════════════════════════════════════════

def _detectar_granularidade(df: pd.DataFrame, date_col: str = "SaleDate") -> dict:
    """
    Detecta automaticamente a granularidade temporal ideal.
    ≤ 45 dias  → DIÁRIO  (line chart)
    46-120 dias → SEMANAL (bar chart)
    > 120 dias → MENSAL  (bar chart)
    """
    if date_col not in df.columns or df[date_col].isna().all():
        return {
            "tipo": "mensal", "freq": "M", "chart_type": "bar",
            "periodo_str": "Período desconhecido",
            "label_format": "%b/%Y", "dias_total": 0
        }

    d_min = df[date_col].dropna().min()
    d_max = df[date_col].dropna().max()
    dias = (d_max - d_min).days if pd.notnull(d_min) and pd.notnull(d_max) else 0

    if dias <= 45:
        return {
            "tipo": "diário", "freq": "D", "chart_type": "area",
            "periodo_str": f"{dias} dias",
            "label_format": "%d/%m", "dias_total": dias,
        }
    elif dias <= 120:
        return {
            "tipo": "semanal", "freq": "W", "chart_type": "bar",
            "periodo_str": f"{dias//7} semanas",
            "label_format": "%d/%m", "dias_total": dias,
        }
    else:
        return {
            "tipo": "mensal", "freq": "M", "chart_type": "bar",
            "periodo_str": f"{dias//30} meses",
            "label_format": "%b/%Y", "dias_total": dias,
        }


def _badge_granularidade(gran: dict) -> str:
    """Badge HTML colorido com info do período — tema escuro."""
    cores = {
        "diário": "#1e3a1f:#86efac",      # Verde escuro + verde claro
        "semanal": "#1c2640:#7ba7f7",     # Azul escuro + azul claro
        "mensal": "#2d1d3f:#d8b4fe"       # Roxo escuro + roxo claro
    }
    bg, fg = cores.get(gran["tipo"], "#1a1d27:#8b90a8").split(":")
    tipo_label = gran["tipo"].capitalize()  # "Semanal" em vez de "SEMANAL"
    periodo_label = gran["periodo_str"].replace(" semanas", " períodos").replace(" meses", " períodos").replace(" dias", " períodos")
    return (
        f'<span style="background:{bg};border: 1px solid {fg};color:{fg};padding:.3rem .8rem;'
        f'border-radius:20px;font-size:12px;font-weight:600;letter-spacing:.03em">'
        f'📅 Visão {tipo_label} — {periodo_label}</span>'
    )


def _dark_chart(fig, height: int = 380):
    """
    Aplica dark mode em qualquer figura Plotly.
    Chamar após px.bar(), px.line(), px.pie(), px.imshow(), etc.
    NÃO altera dados, colunas ou lógica do gráfico.
    """
    fig.update_layout(
        paper_bgcolor="#1a1d27",
        plot_bgcolor="#1a1d27",
        font=dict(color="#c8cad4", size=12),
        height=height,
        margin=dict(l=16, r=16, t=44, b=16),
        legend=dict(
            bgcolor="#20242f",
            bordercolor="#2d3144",
            borderwidth=1,
            font=dict(size=11)
        ),
        xaxis=dict(
            gridcolor="#2d3144",
            linecolor="#2d3144",
            tickcolor="#2d3144",
            tickfont=dict(color="#8b90a8")
        ),
        yaxis=dict(
            gridcolor="#2d3144",
            linecolor="#2d3144",
            tickfont=dict(color="#8b90a8")
        ),
        hoverlabel=dict(
            bgcolor="#20242f",
            bordercolor="#2d3144",
            font_size=12,
            font_color="#e8eaf0"
        )
    )
    return fig


def _chart_evolucao_smart(df: pd.DataFrame, gran: dict, date_col: str = "SaleDate", 
                          value_col: str = "LineTotal", color_col: str = "SlpName") -> object:
    """
    Gráfico adaptativo por granularidade temporal.
    - Diário (≤45d):  Area chart com max/min línea
    - Semanal (46-120d): Bar chart por semana (top 5 vendors)
    - Mensal (>120d):  Bar chart por mês (top 5 vendors)
    """
    import plotly.graph_objects as go
    
    if date_col not in df.columns or value_col not in df.columns:
        return None
    
    tipo = gran.get("tipo", "mensal")
    freq = gran.get("freq", "M")
    
    df_chart = df[[date_col, value_col, color_col]].copy()
    df_chart[date_col] = pd.to_datetime(df_chart[date_col])
    df_chart[value_col] = pd.to_numeric(df_chart[value_col], errors="coerce")
    df_chart = df_chart.dropna()
    
    if tipo == "diário":
        # Area chart por dia (todos os vendedores)
        daily = df_chart.groupby(date_col)[value_col].sum().reset_index()
        daily["Date"] = daily[date_col].dt.strftime("%d/%m")
        
        fig = px.area(
            daily, x=date_col, y=value_col,
            title=f"📅 Evolução Diária: {gran['periodo_str']}",
            labels={value_col: "R$", date_col: "Data"},
            color_discrete_sequence=["#0EA5E9"]
        )
        fig.update_traces(fill="tozeroy", line=dict(width=2))
        
        # Anotações para max/min
        max_val = daily[value_col].max()
        min_val = daily[value_col].min()
        max_date = daily[daily[value_col]==max_val][date_col].iloc[0]
        min_date = daily[daily[value_col]==min_val][date_col].iloc[0]
        
        fig.add_annotation(x=max_date, y=max_val, text="↑ Máx", showarrow=True, 
                          arrowhead=2, arrowsize=1, arrowwidth=2, arrowcolor="green")
        fig.add_annotation(x=min_date, y=min_val, text="↓ Mín", showarrow=True,
                          arrowhead=2, arrowsize=1, arrowwidth=2, arrowcolor="red")
        
    elif tipo == "semanal":
        # Bar chart por semana (top 5 vendedores)
        weekly = df_chart.copy()
        weekly["Semana"] = weekly[date_col].dt.isocalendar().week
        weekly["Ano"] = weekly[date_col].dt.year
        weekly = weekly.groupby(["Ano", "Semana", color_col])[value_col].sum().reset_index()
        weekly["Semana"] = "S" + weekly["Semana"].astype(str)
        
        top5 = df_chart.groupby(color_col)[value_col].sum().nlargest(5).index
        weekly = weekly[weekly[color_col].isin(top5)]
        
        fig = px.bar(
            weekly, x="Semana", y=value_col, color=color_col,
            barmode="stack",
            title=f"📊 Evolução Semanal: {gran['periodo_str']} — Top 5 {color_col}",
            labels={value_col: "R$"},
            color_discrete_sequence=px.colors.qualitative.Pastel1
        )
        
    else:  # mensal
        # Bar chart por mês (top 5 vendedores)
        monthly = df_chart.copy()
        monthly["Mes"] = monthly[date_col].dt.strftime("%b/%Y")
        monthly = monthly.groupby(["Mes", color_col])[value_col].sum().reset_index()
        
        top5 = df_chart.groupby(color_col)[value_col].sum().nlargest(5).index
        monthly = monthly[monthly[color_col].isin(top5)]
        
        fig = px.bar(
            monthly, x="Mes", y=value_col, color=color_col,
            barmode="stack",
            title=f"📅 Evolução Mensal: {gran['periodo_str']} — Top 5 {color_col}",
            labels={value_col: "R$"},
            color_discrete_sequence=px.colors.qualitative.Pastel1
        )
    
    fig.update_layout(
        height=400,
        hovermode="x unified"
    )
    fig = _dark_chart(fig, height=400)
    return fig


def _calcular_top_growth(df: pd.DataFrame, date_col: str = "SaleDate", 
                         group_col: str = "SlpName", value_col: str = "LineTotal",
                         top_n: int = 5) -> pd.DataFrame:
    """
    Calcula Top Growth: compara período atual vs período anterior.
    Retorna DataFrame com: Vendedor, Período Anterior, Período Atual, Crescimento %.
    """
    if date_col not in df.columns:
        return pd.DataFrame()
    
    df_sort = df.sort_values(date_col)
    d_min = df_sort[date_col].min()
    d_max = df_sort[date_col].max()
    dias_total = (d_max - d_min).days
    
    if dias_total < 10:
        return pd.DataFrame()  # Período muito curto
    
    # Dividir em 2 períodos
    mid_date = d_min + pd.Timedelta(days=dias_total // 2)
    
    df_before = df[df[date_col] < mid_date]
    df_after = df[df[date_col] >= mid_date]
    
    # Agregações por período
    before = df_before.groupby(group_col)[value_col].sum().reset_index()
    before.columns = [group_col, "Período_Anterior"]
    
    after = df_after.groupby(group_col)[value_col].sum().reset_index()
    after.columns = [group_col, "Período_Atual"]
    
    # Merge
    merged = before.merge(after, on=group_col, how="outer").fillna(0)
    merged["Crescimento%"] = (
        (merged["Período_Atual"] - merged["Período_Anterior"]) / 
        (merged["Período_Anterior"] + 1)  # +1 para evitar divisão por zero
    ) * 100
    
    # Top N por crescimento
    top_growth = merged.nlargest(top_n, "Crescimento%")
    return top_growth

class VendasModel(BaseModel):
    MODEL_NAME    = "VENDAS"
    MODEL_ICON    = "📈"
    DEDUP_ENABLED = False
    
    COL_MAP = {
        "SaleDate": ["Data do Faturamento", "Data Faturamento", "SaleDate", "Data Emissão", "Data Emissao"],
        "SlpName": ["Vendedor", "SlpName", "Nome do Vendedor"],
        "LineTotal": ["Valor dos Itens", "LineTotal", "Valor Linha"],
        "Quantity": ["Quantidade", "Quantity"],
        "CardName": ["Nome do cliente", "CardName", "Cliente", "Nome do PN"],
        "CardCode": ["Código cliente", "CardCode"],
        "State": ["UF", "Estado", "State", "Em-Estoque"],
        "ItemCode": ["Código do Item", "ItemCode", "Número do Item"],
        "ItemDescription": ["Descrição do Item", "ItemDescription", "Descrição"],
        "ItemGroup": ["Grupo de Itens", "ItemGroup", "Grupo Itens", "Categoria"],
        "UsageType": ["Utilização", "Utilizacao", "Uso", "UsageType"],
        "InvDocNum": ["Nº NF", "Numero NF", "Número NF", "InvDocNum"],
        "DocType": ["Tipo Doc", "DocType"],
        "BranchName": ["Filial", "BranchName"],
        "InvoiceTotal": ["Total Nota", "Total NF", "InvoiceTotal"],
        "AmountReceivable": ["A Receber", "AmountReceivable"],
        "UnitPrice": ["Preço Unitário", "UnitPrice"],
    }
    
    REQUIRED_COLS = ["SaleDate", "SlpName", "LineTotal"]
    NUMERIC_COLS = ["Quantity", "UnitPrice", "LineTotal", "InvoiceTotal", "AmountReceivable"]
    TEXT_COLS = ["CardName", "CardCode", "SlpName", "State", "ItemCode", "ItemDescription", "ItemGroup", "UsageType", "DocType", "BranchName", "InvDocNum"]
    DATE_COLS = ["SaleDate"]
    TABS = ["📊 Dashboard", "👤 Vendedores", "📦 Itens", "🏥 Clientes", "📋 Detalhe"]
    FILTER_COLS = ["SlpName", "State"]

    def __init__(self, df_raw: pd.DataFrame):
        super().__init__(df_raw)
        self.top_n = 10

    def load(self) -> "VendasModel":
        try:
            rev = {alias.upper().strip(): canon for canon, aliases in self.COL_MAP.items() for alias in aliases}
            df = self.df_raw.rename(columns={col: rev[col.upper().strip()] for col in self.df_raw.columns if col.upper().strip() in rev}).copy()
            for c in self.NUMERIC_COLS:
                if c in df.columns: df[c] = df[c].apply(_parse_num)
            for c in self.TEXT_COLS:
                if c in df.columns: df[c] = df[c].astype(str).str.strip()
            if "SaleDate" in df.columns:
                df["SaleDate"] = df["SaleDate"].apply(_smart_date)
                df = df[df["SaleDate"].notna()].copy()
            self.df = df
        except Exception as e:
            st.error(f"Erro: {str(e)}")
            self.df = None
        return self

    def validate(self) -> tuple:
        return (self.df is not None, [] if self.df is not None else ["Erro"])

    def get_kpis(self, df: pd.DataFrame = None) -> list:
        """Calcula KPIs do modelo."""
        if df is None: df = self.df
        if df is None or df.empty: return []
        
        total = df["LineTotal"].sum() if "LineTotal" in df.columns else 0
        n_vendedores = df["SlpName"].nunique() if "SlpName" in df.columns else 0
        n_clientes = df["CardName"].nunique() if "CardName" in df.columns else 0
        
        return [
            ("📦 Faturamento", _fmt_brl(total), "emerald", "Valor total"),
            ("👤 Vendedores", str(n_vendedores), "blue", "Ativos"),
            ("🏥 Clientes", str(n_clientes), "teal", "Únicos"),
        ]

    def get_aggregations(self, df: pd.DataFrame = None) -> dict:
        """Gera agregações por perspectiva."""
        if df is None: df = self.df
        if df is None or df.empty: return {}
        
        aggs = {}
        try:
            if "SlpName" in df.columns:
                aggs["por_vendedor"] = df.groupby("SlpName").agg(
                    Faturamento=("LineTotal", "sum"),
                    Quantidade=("Quantity", "sum") if "Quantity" in df.columns else ("LineTotal", "count"),
                    Clientes=("CardName", "nunique") if "CardName" in df.columns else ("SlpName", "count"),
                ).reset_index().sort_values("Faturamento", ascending=False)
            
            if "State" in df.columns:
                aggs["por_estado"] = df.groupby("State").agg(
                    Faturamento=("LineTotal", "sum"),
                    Clientes=("CardName", "nunique") if "CardName" in df.columns else ("State", "count"),
                ).reset_index().sort_values("Faturamento", ascending=False)
        except Exception as e:
            st.warning(f"Erro ao calcular agregações: {str(e)}")
        
        return aggs

    def get_charts_config(self) -> list:
        """Retorna configuração dos gráficos."""
        return [
            {
                "name": "Faturamento por Vendedor",
                "type": "bar",
                "key": "por_vendedor",
            },
            {
                "name": "Faturamento por Estado",
                "type": "pie",
                "key": "por_estado",
            },
        ]

    def render_tabs(self, aggs: dict = None, filters: dict = None) -> None:
        """Renderiza as tabs do modelo — NOVA UI/UX Power BI Completa."""
        if aggs is None: aggs = {}
        if filters is None: filters = {}
        
        df = self.df if self.df is not None else pd.DataFrame()
        if df.empty:
            st.warning("❌ Sem dados para exibir")
            return
        
        # ═══════════════════════════════════════════════════════════════════
        # 🔧 FASE 0: DEBUG BLOCK (remover depois de validar)
        # ═══════════════════════════════════════════════════════════════════
        
        if DEBUG_MODE:
            with st.expander("🔧 Debug: Colunas & Agregações", expanded=False):
                col_d1, col_d2 = st.columns(2)
                with col_d1:
                    st.write("**Colunas no df:**")
                    st.code(", ".join(df.columns.tolist()))
                    st.write(f"**Total de linhas:** {len(df):,}".replace(",","."))
                with col_d2:
                    st.write("**Chaves em aggs:**")
                    st.code(", ".join(aggs.keys()) if aggs else "vazio")
                    for k, v in aggs.items():
                        st.write(f"  {k}: {len(v)} linhas, cols: {list(v.columns)}")
            
            st.markdown("---")
        
        # ═══════════════════════════════════════════════════════════════════
        # 📊 FASE 1 + 2: DASHBOARD COMPLETO
        # ═══════════════════════════════════════════════════════════════════
        
        # ROW 1: 6 KPIs com valores e tendências
        self._render_kpi_row(df)
        
        # ✨ BADGE: Granularidade temporal detectada automaticamente
        if "SaleDate" in df.columns:
            gran = _detectar_granularidade(df, "SaleDate")
            st.markdown(_badge_granularidade(gran), unsafe_allow_html=True)
        
        st.markdown("---")
        
        # ROW 2: Top Vendedores (barra) + Grupos de Item (donut)
        col1, col2 = st.columns(2, gap="large")
        
        with col1:
            if "por_vendedor" in aggs and not aggs["por_vendedor"].empty:
                fig_vend = self._chart_top_vendedores(aggs["por_vendedor"])
                st.plotly_chart(fig_vend, use_container_width=True)
        
        with col2:
            if "ItemGroup" in df.columns:
                grupos = df.groupby("ItemGroup")["LineTotal"].sum().reset_index()
                grupos = grupos[grupos["ItemGroup"].notna() & (grupos["ItemGroup"] != "")]
                if not grupos.empty:
                    fig_grupo = px.pie(
                        grupos.nlargest(8, "LineTotal"),
                        values="LineTotal", names="ItemGroup",
                        title="🥧 Faturamento por Grupo Item",
                        color_discrete_sequence=px.colors.qualitative.Set2
                    )
                    fig_grupo.update_layout(height=450)
                    fig_grupo.update_traces(
                        textfont_color="#e8eaf0",
                        marker=dict(line=dict(color="#1a1d27", width=2))
                    )
                    fig_grupo = _dark_chart(fig_grupo, height=450)
                    st.plotly_chart(fig_grupo, use_container_width=True)
                else:
                    st.info("Sem dados de Grupo Item")
            else:
                st.info("ItemGroup não encontrado")
        
        # ROW 3: Evolução Mensal (barra empilhada - Top 5 vendedores)
        if "SaleDate" in df.columns:
            df_temp = df.copy()
            df_temp["SaleMonth"] = df_temp["SaleDate"].dt.to_period("M").astype(str)
            
            top5_vend = df_temp.groupby("SlpName")["LineTotal"].sum().nlargest(5).index
            df_trend = df_temp[df_temp["SlpName"].isin(top5_vend)].copy()
            df_trend = df_trend.groupby(["SaleMonth", "SlpName"])["LineTotal"].sum().reset_index()
            
            if not df_trend.empty:
                fig_trend = px.bar(
                    df_trend, x="SaleMonth", y="LineTotal", color="SlpName",
                    barmode="stack",
                    title="📅 Evolução Mensal — Top 5 Vendedores",
                    labels={"SaleMonth": "Mês", "LineTotal": "R$", "SlpName": "Vendedor"},
                    color_discrete_sequence=px.colors.qualitative.Pastel1
                )
                fig_trend.update_layout(height=400, hovermode="x unified")
                fig_trend = _dark_chart(fig_trend, height=400)
                st.plotly_chart(fig_trend, use_container_width=True)
        
        st.markdown("---")
        
        # ROW 3B: HEATMAP de Vendas por Dia da Semana
        if "SaleDate" in df.columns:
            df_heat = df.copy()
            df_heat["DayOfWeek"] = df_heat["SaleDate"].dt.day_name()
            df_heat["Week"] = df_heat["SaleDate"].dt.isocalendar().week
            
            dias_ordem = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            df_heat["DayOfWeek"] = pd.Categorical(df_heat["DayOfWeek"], categories=dias_ordem, ordered=True)
            
            heatmap_data = df_heat.groupby(["Week", "DayOfWeek"])["LineTotal"].sum().reset_index()
            heatmap_pivot = heatmap_data.pivot(index="DayOfWeek", columns="Week", values="LineTotal").fillna(0)
            
            if not heatmap_pivot.empty:
                # Traduzir dias
                dia_map = {
                    "Monday": "Seg", "Tuesday": "Ter", "Wednesday": "Qua", "Thursday": "Qui",
                    "Friday": "Sex", "Saturday": "Sab", "Sunday": "Dom"
                }
                heatmap_pivot.index = [dia_map.get(d, d) for d in heatmap_pivot.index]
                
                fig_heat = px.imshow(
                    heatmap_pivot,
                    color_continuous_scale="Viridis",
                    title="🔥 Heatmap: Vendas por Dia da Semana",
                    labels={"x": "Semana", "y": "Dia", "color": "R$"},
                    aspect="auto"
                )
                fig_heat.update_layout(height=300)
                fig_heat = _dark_chart(fig_heat, height=300)
                st.plotly_chart(fig_heat, use_container_width=True)
        
        st.markdown("---")
        
        # ROW 4: Estados (barra) + Tipo de Venda (rosca)
        col3, col4 = st.columns(2, gap="large")
        
        with col3:
            if "State" in df.columns:
                estados = df.groupby("State")["LineTotal"].sum().reset_index()
                estados = estados[estados["State"].notna() & (estados["State"] != "")].nlargest(15, "LineTotal")
                if not estados.empty:
                    fig_uf = px.bar(
                        estados.sort_values("LineTotal"),
                        x="LineTotal", y="State", orientation="h",
                        title="🗺️ Top 15 Estados por Faturamento",
                        text="LineTotal",
                        color="LineTotal",
                        color_continuous_scale="Blues_r"
                    )
                    fig_uf.update_traces(texttemplate="R$ %{text:.0f}", textposition="outside")
                    fig_uf.update_layout(height=450, showlegend=False)
                    st.plotly_chart(fig_uf, use_container_width=True)
        
        with col4:
            if "UsageType" in df.columns:
                tipos = df.groupby("UsageType")["LineTotal"].sum().reset_index()
                tipos = tipos[tipos["UsageType"].notna() & (tipos["UsageType"] != "")]
                if not tipos.empty:
                    fig_uso = px.pie(
                        tipos,
                        values="LineTotal", names="UsageType",
                        title="🏷️ Tipo de Venda",
                        hole=0.4,
                        color_discrete_sequence=px.colors.qualitative.Pastel
                    )
                    fig_uso.update_layout(height=450)
                    st.plotly_chart(fig_uso, use_container_width=True)
                else:
                    st.info("Sem dados de Tipo de Venda")
            else:
                st.info("UsageType não encontrado")
        
        st.markdown("---")
        
        # ROW 4B: TOP GROWTH DETECTION
        st.subheader("🚀 Crescimento: Comparação de Períodos")
        top_growth = _calcular_top_growth(df, "SaleDate", "SlpName", "LineTotal", top_n=5)
        
        if not top_growth.empty:
            col_growth_1, col_growth_2 = st.columns([1.2, 1], gap="large")
            
            with col_growth_1:
                # Gráfico de barras com crescimento
                fig_growth = px.bar(
                    top_growth.sort_values("Crescimento%"),
                    x="Crescimento%", y="SlpName", orientation="h",
                    title="Top 5 Vendedores por Crescimento %",
                    text="Crescimento%",
                    color="Crescimento%",
                    color_continuous_scale="RdYlGn"
                )
                fig_growth.update_traces(
                    texttemplate="%{x:.0f}%",
                    textposition="outside"
                )
                fig_growth.update_layout(showlegend=False, height=350)
                fig_growth = _dark_chart(fig_growth, height=350)
                st.plotly_chart(fig_growth, use_container_width=True)
            
            with col_growth_2:
                # Tabela detalhada
                st.write("**Detalhes de Crescimento:**")
                df_growth_display = top_growth.copy()
                df_growth_display["Período_Anterior"] = df_growth_display["Período_Anterior"].apply(_fmt_brl)
                df_growth_display["Período_Atual"] = df_growth_display["Período_Atual"].apply(_fmt_brl)
                df_growth_display["Crescimento%"] = df_growth_display["Crescimento%"].apply(lambda x: f"{x:+.0f}%")
                df_growth_display = df_growth_display.rename(columns={"SlpName": "Vendedor"})
                st.dataframe(
                    df_growth_display,
                    use_container_width=True,
                    height=350
                )
        else:
            st.info("📊 Período muito curto para análise de crescimento")
        
        st.markdown("---")
        
        # ROW 5: Top 10 Clientes (gráfico + tabela) — FIX #4
        st.subheader("🏥 Top 10 Clientes")
        if "CardName" in df.columns:
            top10_cli = df[df["CardName"].notna() & (df["CardName"] != "")].copy()
            
            # Contar NFs e Itens por cliente
            top10_cli = top10_cli.groupby("CardName").agg({
                "LineTotal": "sum",
                "InvDocNum": lambda x: x.dropna().nunique(),
                "ItemCode": "count"
            }).reset_index()
            
            top10_cli = top10_cli.nlargest(10, "LineTotal")
            top10_cli.columns = ["Cliente", "Faturamento", "NFs", "Itens"]
            
            if not top10_cli.empty:
                col_chart, col_table = st.columns([1.2, 1], gap="large")
                
                with col_chart:
                    # Gráfico de barras horizontal
                    df_chart = top10_cli.sort_values("Faturamento")
                    fig_cli = px.bar(
                        df_chart, x="Faturamento", y="Cliente", orientation="h",
                        title="Top 10 Clientes por Faturamento",
                        text="Faturamento",
                        color="Faturamento",
                        color_continuous_scale="Viridis_r"
                    )
                    fig_cli.update_traces(
                        texttemplate="R$ %{x:,.0f}",
                        textposition="outside"
                    )
                    fig_cli.update_layout(showlegend=False, height=400)
                    fig_cli = _dark_chart(fig_cli, height=400)
                    st.plotly_chart(fig_cli, use_container_width=True)
                
                with col_table:
                    # Tabela com formatação
                    df_display = top10_cli.copy()
                    df_display["Faturamento"] = df_display["Faturamento"].apply(_fmt_brl)
                    df_display.index = range(1, len(df_display) + 1)
                    st.dataframe(df_display, use_container_width=True, height=400)
        
        st.markdown("---")
        
        # ═══════════════════════════════════════════════════════════════════
        # 📋 TABS ADICIONAIS
        # ═══════════════════════════════════════════════════════════════════
        tabs = st.tabs(self.TABS)
        
        with tabs[1]:  # Vendedores
            st.subheader("👤 Análise Detalhada por Vendedor")
            
            if "por_vendedor" in aggs and not aggs["por_vendedor"].empty:
                vend_table = aggs["por_vendedor"].copy()
                vend_table["Faturamento"] = vend_table["Faturamento"].apply(_fmt_brl)
                
                col_vend_tab, col_vend_trend = st.columns([1, 1.2], gap="large")
                
                with col_vend_tab:
                    st.write("**Ranking de Vendedores:**")
                    st.dataframe(vend_table, use_container_width=True, height=400)
                
                with col_vend_trend:
                    # Gráfico de tendência para Top 5 vendedores
                    st.write("**Tendência: Top 5 Vendedores**")
                    if "SaleDate" in df.columns:
                        top5_vend_names = df.groupby("SlpName")["LineTotal"].sum().nlargest(5).index
                        df_top5 = df[df["SlpName"].isin(top5_vend_names)].copy()
                        df_top5 = df_top5.groupby([pd.Grouper(key="SaleDate", freq="W"), "SlpName"])["LineTotal"].sum().reset_index()
                        
                        fig_trend_vend = px.line(
                            df_top5, x="SaleDate", y="LineTotal", color="SlpName",
                            title="Evolução Semanal",
                            markers=True,
                            color_discrete_sequence=px.colors.qualitative.Set1
                        )
                        fig_trend_vend.update_layout(height=400, hovermode="x unified")
                        fig_trend_vend = _dark_chart(fig_trend_vend, height=400)
                        st.plotly_chart(fig_trend_vend, use_container_width=True)
                    else:
                        st.info("Sem SaleDate para análise de tendência")
            else:
                st.info("Sem dados de vendedores")
        
        with tabs[2]:  # Itens
            st.subheader("📦 Análise Detalhada de Itens")
            if "ItemCode" in df.columns or "ItemDescription" in df.columns:
                item_col = "ItemDescription" if "ItemDescription" in df.columns else "ItemCode"
                if item_col in df.columns:
                    itens = df[df[item_col].notna() & (df[item_col] != "")].groupby(item_col)[
                        "LineTotal"
                    ].sum().reset_index().nlargest(20, "LineTotal")
                    itens.columns = [item_col, "Faturamento"]
                    itens["Faturamento"] = itens["Faturamento"].apply(_fmt_brl)
                    st.dataframe(itens, use_container_width=True, height=450)
            else:
                st.info("Sem dados de Itens")
        
        with tabs[3]:  # Clientes — FIX #5
            st.subheader("🏥 Análise Completa de Clientes com Curva ABC")
            
            if "CardName" in df.columns:
                # ─────────────────────────────────────────────────────────
                # Métricas do topo
                # ─────────────────────────────────────────────────────────
                cli_total = df[df["CardName"].notna() & (df["CardName"] != "")]["CardName"].nunique()
                cli_fat_total = df["LineTotal"].sum()
                cli_fat_media = cli_fat_total / cli_total if cli_total > 0 else 0
                
                top_cli = df[df["CardName"].notna() & (df["CardName"] != "")].groupby("CardName")[
                    "LineTotal"
                ].sum().nlargest(1)
                top_cli_name = top_cli.index[0] if len(top_cli) > 0 else "N/A"
                
                m1, m2, m3, m4 = st.columns(4)
                with m1:
                    st.metric("👥 Total Clientes", f"{cli_total:,}".replace(",", "."))
                with m2:
                    st.metric("💰 Faturamento Total", _fmt_brl(cli_fat_total))
                with m3:
                    st.metric("📊 Ticket Médio", _fmt_brl(cli_fat_media))
                with m4:
                    st.metric("⭐ Top Cliente", top_cli_name[:20])
                
                st.markdown("---")
                
                # ─────────────────────────────────────────────────────────
                # Curva ABC com visualização
                # ─────────────────────────────────────────────────────────
                df_abc = self._calcular_curva_abc(df, "CardName", "LineTotal")
                
                # Tabela ABC
                st.write("### 📈 Curva ABC")
                col_abc_tab, col_abc_chart = st.columns([1, 1], gap="large")
                
                with col_abc_tab:
                    st.write("**Clientes por Classe:**")
                    
                    df_display_abc = df_abc.copy()
                    
                    # Auto-highlight: Adicionar emoji e style por classe
                    def highlight_classe(classe):
                        mapa = {"A": "🟢 A", "B": "🟡 B", "C": "🔴 C"}
                        return mapa.get(classe, classe)
                    
                    df_display_abc["Classe ABC"] = df_display_abc["Classe ABC"].apply(highlight_classe)
                    df_display_abc["Faturamento"] = df_display_abc["Faturamento"].apply(_fmt_brl)
                    df_display_abc["% Acumulado"] = (df_display_abc["% Acumulado"] 
                                                     .apply(lambda x: f"{x:.1f}%"))
                    
                    # Reorder columns para melhor visualização
                    df_display_abc = df_display_abc[["Classe ABC", "Item", "Faturamento", "% Acumulado"]]
                    
                    st.dataframe(
                        df_display_abc.head(50),
                        use_container_width=True,
                        height=400
                    )
                
                with col_abc_chart:
                    st.write("**Distribuição Pareto:**")
                    
                    # Gráfico Pareto (linha acumulada)
                    fig_abc = px.bar(
                        df_abc.head(30),
                        x="Item", y="Faturamento",
                        color="Classe ABC",
                        color_discrete_map={"A": "#10b981", "B": "#f59e0b", "C": "#ef4444"},
                        title="Curva ABC (Top 30 Clientes)"
                    )
                    
                    # Adicionar linha de % acumulado
                    fig_abc.add_scatter(
                        x=df_abc.head(30)["Item"],
                        y=df_abc.head(30)["% Acumulado"],
                        name="% Acumulado",
                        yaxis="y2",
                        line=dict(color="blue", width=2),
                        mode="lines+markers"
                    )
                    
                    fig_abc.update_layout(
                        yaxis2=dict(
                            title="% Acumulado",
                            overlaying="y",
                            side="right"
                        ),
                        height=400,
                        hovermode="x unified"
                    )
                    st.plotly_chart(fig_abc, use_container_width=True)
                
                st.markdown("---")
                
                # ─────────────────────────────────────────────────────────
                # Métricas por Classe ABC
                # ─────────────────────────────────────────────────────────
                st.write("### 📊 Resumo Pareto")
                
                for classe in ["A", "B", "C"]:
                    df_classe = df_abc[df_abc["Classe ABC"] == classe]
                    if not df_classe.empty:
                        n_cli = len(df_classe)
                        fat_classe = df_classe["Faturamento"].sum()
                        pct_fat = (fat_classe / df_abc["Faturamento"].sum()) * 100
                        
                        emoji = {"A": "🟢", "B": "🟡", "C": "🔴"}[classe]
                        st.info(
                            f"{emoji} **Classe {classe}**: {n_cli} clientes ({n_cli/cli_total*100:.0f}%) · "
                            f"R$ {fat_classe:,.0f} ({pct_fat:.0f}%)"
                        )
            else:
                st.warning("Sem dados de CardName para análise de clientes")

        
        with tabs[4]:  # Detalhe
            st.subheader("📋 Dados Detalhados")
            ts = datetime.now().strftime("%Y%m%d_%H%M")
            
            c1, c2 = st.columns(2)
            with c1:
                st.download_button(
                    "📊 Baixar CSV",
                    data=df.to_csv(index=False, sep=";").encode("utf-8-sig"),
                    file_name=f"vendas_{ts}.csv",
                    mime="text/csv",
                    use_container_width=True
                )
            with c2:
                try:
                    from utils.file_loader import to_excel
                    excel_bytes = to_excel({"Vendas": df})
                    st.download_button(
                        "📈 Baixar Excel",
                        data=excel_bytes,
                        file_name=f"vendas_{ts}.xlsx",
                        mime="application/vnd.ms-excel",
                        use_container_width=True
                    )
                except:
                    pass
            
            st.dataframe(df, use_container_width=True, height=500)
    
    # ═══════════════════════════════════════════════════════════════════
    # FUNÇÕES AUXILIARES PARA DASHBOARD
    # ═══════════════════════════════════════════════════════════════════
    
    def _render_kpi_row(self, df: pd.DataFrame) -> None:
        """
        Renderiza 3 KPIs principais em 1 linha limpa.
        Focado nos indicadores que realmente importam:
        • Faturamento (métrica financeira)
        • Vendedores (força de venda)
        • NFs (volume de transações)
        """
        # Faturamento
        total_fat = df["LineTotal"].sum() if "LineTotal" in df.columns else 0
        
        # NFs com tratamento robusto
        n_nfs = 0
        if "InvDocNum" in df.columns:
            n_nfs = (
                df["InvDocNum"]
                .dropna()
                .astype(str)
                .str.strip()
                .replace("nan", np.nan)
                .replace("", np.nan)
                .dropna()
                .nunique()
            )
        
        # Vendedores
        n_vend = df["SlpName"].dropna().nunique() if "SlpName" in df.columns else 0
        
        # UMA LINHA: 3 KPIs principais
        c1, c2, c3 = st.columns(3)
        with c1:
            st.metric("💰 Faturamento", _fmt_brl(total_fat), "no período")
        with c2:
            st.metric("👤 Vendedores", str(n_vend), "ativos")
        with c3:
            st.metric("📄 NFs", str(n_nfs), "emitidas")
    
    def _chart_top_vendedores(self, df_vend: pd.DataFrame, n: int = 10):
        """Gráfico de ranking Top N vendedores com destaque."""
        df_top = df_vend.head(n).sort_values("Faturamento")
        
        colors = ["#059669" if i == len(df_top)-1 else "#6ee7b7" for i in range(len(df_top))]
        
        fig = px.bar(
            df_top, x="Faturamento", y="SlpName", orientation="h",
            title=f"📊 Top {n} Vendedores",
            text="Faturamento",
            color_discrete_sequence=[colors[0]]*len(df_top)
        )
        
        fig.update_traces(
            marker=dict(color=colors),
            texttemplate="R$ %{x:,.0f}",
            textposition="outside"
        )
        fig.update_layout(showlegend=False, height=400)
        fig = _dark_chart(fig, height=400)
        return fig

    def _calcular_curva_abc(self, df: pd.DataFrame, group_col: str = "CardName", 
                           value_col: str = "LineTotal") -> pd.DataFrame:
        """
        Calcula Curva ABC (regra 80/20).
        A: Top 20% de items = ~80% do valor
        B: Próximos 30% = ~15% do valor
        C: Últimos 50% = ~5% do valor
        """
        df_abc = df[df[group_col].notna() & (df[group_col] != "")].copy()
        df_abc = df_abc.groupby(group_col)[value_col].sum().reset_index()
        df_abc = df_abc.sort_values(value_col, ascending=False)
        
        total = df_abc[value_col].sum()
        df_abc["% Acumulado"] = df_abc[value_col].cumsum() / total * 100
        
        # Classificação ABC
        def classify_abc(pct):
            if pct <= 80:
                return "A"
            elif pct <= 95:
                return "B"
            else:
                return "C"
        
        df_abc["Classe ABC"] = df_abc["% Acumulado"].apply(classify_abc)
        df_abc = df_abc.rename(columns={group_col: "Item", value_col: "Faturamento"})
        return df_abc

    def get_export_sheets(self, df: pd.DataFrame) -> dict:
        """Retorna sheets para exportação."""
        return {"Vendas": df}
