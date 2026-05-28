import io
import warnings
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

warnings.filterwarnings("ignore")

# OBRIGATÓRIO: set_page_config DEVE ser a primeira chamada antes de qualquer st.xxx
st.set_page_config(
    page_title="Analytics Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Injeta CSS antes de qualquer elemento Streamlit renderizar
def _inject_css():
    css_path = Path(__file__).parent / "theme.css"
    if css_path.exists():
        with open(css_path, encoding="utf-8") as f:
            css_content = f.read()
            st.markdown(f"""
            <style>
            {css_content}
            </style>
            """, unsafe_allow_html=True)

_inject_css()


try:
    from config.colors import PALETTE, CHART_COLORS
    from config.analytics import (
        calculate_trend,
        detect_outliers_iqr,
        categorize_dataset,
        identify_anomalies,
    )
    from templates.ui import (
        load_theme,
        kpi_card,
        render_kpi_row,
        apply_chart_style,
        render_header,
        render_separator,
        detect_time_granularity,
    )
    from templates.smart_kpi import (
        smart_kpi_card,
        render_smart_kpi_row,
        mini_metric_chart,
        metric_comparison_badge,
        insight_card,
        render_insights_section,
        gauge_chart,
    )
except ImportError as e:
    st.error(f"❌ Erro ao carregar módulos: {e}")
    st.stop()


load_theme()


# Inicializa session state
for _key in ["df_loaded", "df_filtered"]:
    if _key not in st.session_state:
        st.session_state[_key] = None
if "selected_columns" not in st.session_state:
    st.session_state.selected_columns = []


# --- CARREGAMENTO E DETECÇÃO DE TIPOS ---

@st.cache_data(show_spinner="🔍 Detectando tipos de colunas...")
def detect_and_parse(df: pd.DataFrame) -> pd.DataFrame:
    """
    Tenta converter colunas object para datetime ou numérico automaticamente.
    Limpa caracteres monetários (R$, %, ,) antes de tentar numérico.
    """
    df = df.copy()
    for col in df.columns:
        if df[col].dtype != object:
            continue

        # Tenta datetime primeiro
        try:
            parsed = pd.to_datetime(df[col], infer_datetime_format=True, errors="coerce")
            if parsed.notna().sum() / len(df) > 0.7:
                df[col] = parsed
                continue
        except Exception:
            pass

        # Tenta numérico após limpar símbolos comuns
        cleaned = (
            df[col].astype(str)
            .str.replace(r"[R$%\s]", "", regex=True)
            .str.replace(".", "", regex=False)
            .str.replace(",", ".", regex=False)
        )
        numeric = pd.to_numeric(cleaned, errors="coerce")
        if numeric.notna().sum() / len(df) > 0.7:
            df[col] = numeric

    return df


@st.cache_data(show_spinner="📂 Carregando arquivo...")
def load_file(file_bytes: bytes, filename: str) -> pd.DataFrame | None:
    """
    Carrega Excel (.xlsx/.xls), CSV, TXT delimitado ou JSON.
    Detecta separador e encoding automaticamente em CSV/TXT.
    Normaliza JSON aninhado com json_normalize.
    """
    import io, json

    name = filename.lower()
    buf = io.BytesIO(file_bytes)

    def detect_encoding(file_bytes: bytes) -> str:
        """Detecta encoding do arquivo tentando múltiplas opções"""
        encodings = ["utf-8", "latin-1", "iso-8859-1", "cp1252", "utf-16"]
        for enc in encodings:
            try:
                file_bytes.decode(enc)
                return enc
            except (UnicodeDecodeError, AttributeError):
                continue
        return "utf-8"  # Fallback

    try:
        if name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(buf)

        elif name.endswith(".csv"):
            encoding = detect_encoding(file_bytes)
            sample = buf.read(2048).decode(encoding, errors="ignore")
            buf.seek(0)
            sep = ";" if sample.count(";") > sample.count(",") else ","
            df = pd.read_csv(buf, sep=sep, encoding=encoding, on_bad_lines="skip")

        elif name.endswith(".txt"):
            encoding = detect_encoding(file_bytes)
            sample = buf.read(2048).decode(encoding, errors="ignore")
            buf.seek(0)
            sep = "\t" if "\t" in sample else ("|" if "|" in sample else ",")
            df = pd.read_csv(buf, sep=sep, encoding=encoding, on_bad_lines="skip")

        elif name.endswith(".json"):
            raw = json.load(buf)
            # Suporte a lista de objetos, dict com lista, ou DataFrame direto
            if isinstance(raw, list):
                df = pd.json_normalize(raw)
            elif isinstance(raw, dict):
                # Tenta encontrar a primeira chave que seja lista
                for v in raw.values():
                    if isinstance(v, list):
                        df = pd.json_normalize(v)
                        break
                else:
                    df = pd.DataFrame([raw])
            else:
                st.error("❌ Estrutura JSON não reconhecida.")
                return None

        else:
            st.error("❌ Formato não suportado. Use .xlsx, .xls, .csv, .txt ou .json")
            return None

        return detect_and_parse(df)

    except Exception as e:
        st.error(f"❌ Erro ao carregar arquivo: {e}")
        return None


def get_col_types(df: pd.DataFrame) -> dict:
    """Retorna dicionário com listas de colunas por tipo detectado."""
    return {
        "date": df.select_dtypes(include=["datetime64"]).columns.tolist(),
        "numeric": df.select_dtypes(include=[np.number]).columns.tolist(),
        "categorical": df.select_dtypes(include=["object", "category"]).columns.tolist(),
    }


# --- EXPORTAÇÃO ---

def to_excel(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Dados")
    return buf.getvalue()


def to_csv(df: pd.DataFrame) -> str:
    return df.to_csv(index=False, encoding="utf-8-sig")


# --- SIDEBAR ---

st.sidebar.markdown("### 📁 Carregar Dados")

uploaded = st.sidebar.file_uploader(
    "Escolha um arquivo",
    type=["xlsx", "xls", "csv", "txt", "json"],
    help="Suporta Excel, CSV, TXT delimitado e JSON",
)

if uploaded:
    df_raw = load_file(uploaded.read(), uploaded.name)

    if df_raw is not None:
        st.session_state.df_loaded = df_raw
        col_types_raw = get_col_types(df_raw)

        st.sidebar.success(f"✅ {uploaded.name}")
        st.sidebar.caption(f"{len(df_raw):,} linhas · {len(df_raw.columns)} colunas")

        # Resumo dos tipos detectados na sidebar
        with st.sidebar.expander("🔍 Tipos detectados", expanded=False):
            for label, icon, key in [("Datas", "📅", "date"), ("Numéricas", "🔢", "numeric"), ("Categóricas", "🏷️", "categorical")]:
                if col_types_raw[key]:
                    st.caption(f"{icon} {label}: {', '.join(col_types_raw[key])}")

        # Seleção de colunas
        st.sidebar.markdown("---")
        st.sidebar.markdown("### 🗂️ Colunas para análise")
        select_all = st.sidebar.checkbox("Todas as colunas", value=True)

        if select_all:
            selected = df_raw.columns.tolist()
        else:
            selected = st.sidebar.multiselect(
                "Selecione colunas",
                df_raw.columns.tolist(),
                default=df_raw.columns[:6].tolist(),
            )

        df_view = df_raw[selected].copy() if selected else df_raw.copy()
        col_types = get_col_types(df_view)

        # Filtros dinâmicos — data
        if col_types["date"] or col_types["categorical"] or col_types["numeric"]:
            st.sidebar.markdown("---")
            st.sidebar.markdown("### 🎛️ Filtros")

        if col_types["date"]:
            date_col = st.sidebar.selectbox("Coluna de data", col_types["date"], key="sb_date")
            min_d = df_view[date_col].min().date()
            max_d = df_view[date_col].max().date()
            date_range = st.sidebar.date_input("Intervalo de datas", [min_d, max_d], min_value=min_d, max_value=max_d)
            if len(date_range) == 2:
                df_view = df_view[
                    (df_view[date_col].dt.date >= date_range[0]) &
                    (df_view[date_col].dt.date <= date_range[1])
                ]
        else:
            date_col = None

        # Filtros numéricos por range (até 2 colunas)
        for num_col in col_types["numeric"][:2]:
            _min = float(df_view[num_col].min())
            _max = float(df_view[num_col].max())
            if _min < _max:
                rng = st.sidebar.slider(
                    f"Range: {num_col}",
                    min_value=_min, max_value=_max,
                    value=(_min, _max),
                    key=f"rng_{num_col}",
                )
                df_view = df_view[df_view[num_col].between(*rng)]

        # Filtros categóricos (até 3 colunas com ≤ 30 valores únicos)
        for cat_col in col_types["categorical"][:3]:
            uniq = df_view[cat_col].dropna().unique().tolist()
            if 1 < len(uniq) <= 30:
                chosen = st.sidebar.multiselect(f"{cat_col}", uniq, default=uniq, key=f"cat_{cat_col}")
                if chosen:
                    df_view = df_view[df_view[cat_col].isin(chosen)]

        st.session_state.df_filtered = df_view
        col_types = get_col_types(df_view)  # recalcula após filtros

        # --- HEADER ---
        render_header(
            "📊 Analytics Dashboard",
            f"{uploaded.name} · {len(df_view):,} registros · {len(df_view.columns)} colunas",
        )
        
        # Detecção de schema do dataset
        dataset_info = categorize_dataset(df_raw)
        st.info(f"ℹ️ Dataset identificado: {dataset_info['description']}", icon="🔍")

        # KPIs automáticos com base nas colunas numéricas (SMART v1.5)
        if col_types["numeric"]:
            with st.spinner("🔍 Analisando trends e anomalias..."):
                kpis = []
                insights = []
                
                for idx, col in enumerate(col_types["numeric"][:4]):
                    total = df_view[col].sum()
                    media = df_view[col].mean()
                    
                    # Calcula trend entre início e fim do período
                    trend_info = calculate_trend(df_view[col].reset_index(drop=True), periods=max(2, len(df_view) // 4))
                    
                    # Ícones alternados por tipo de métrica
                    icons = ["💰", "📊", "🎯", "⚡"]
                    colors = ["primary", "secondary", "accent", "success"]
                    
                    kpis.append({
                        "title": col,
                        "value": f"{total:,.2f}" if total < 1_000_000 else f"{total/1_000_000:.1f}M",
                        "trend_pct": trend_info.get("change_pct", 0),
                        "subtitle": f"Média: {media:,.0f}",
                        "icon": icons[idx % len(icons)],
                        "color": colors[idx % len(colors)],
                    })
                    
                    # Detecta outliers
                    outlier_indices, outlier_pct = detect_outliers_iqr(df_view[col])
                    if outlier_pct > 2:
                        insights.append({
                            "title": f"⚠️ Anomalias em {col}",
                            "description": f"{len(outlier_indices)} outliers ({outlier_pct:.1f}%) detectados",
                            "icon": "🔔",
                            "color": "warning",
                        })
                
                render_smart_kpi_row(kpis)
                
                # Mostra insights se houver
                if insights:
                    render_insights_section(insights)

        render_separator()

        # --- ABAS ---
        tab_overview, tab_temporal, tab_explore, tab_stats, tab_export = st.tabs([
            "📋 Visão Geral", "📅 Temporal", "🔎 Explorador", "📈 Estatísticas", "💾 Exportar",
        ])

        # TAB 1 — visão geral: primeiras linhas + qualidade dos dados
        with tab_overview:
            st.markdown("### Primeiras linhas")
            st.dataframe(df_view.head(15), use_container_width=True)

            render_separator()
            st.markdown("### Qualidade dos dados")
            quality = pd.DataFrame({
                "Coluna": df_view.columns,
                "Tipo": df_view.dtypes.astype(str).values,
                "Nulos": df_view.isnull().sum().values,
                "% Nulos": (df_view.isnull().mean() * 100).round(1).values,
                "Únicos": df_view.nunique().values,
                "Exemplo": [str(df_view[c].dropna().iloc[0]) if df_view[c].dropna().shape[0] > 0 else "—" for c in df_view.columns],
            })
            st.dataframe(quality, use_container_width=True, hide_index=True)
            
            # Análise de anomalias
            if col_types["numeric"]:
                render_separator()
                st.markdown("### 🔍 Verificação de Anomalias")
                anomalies = identify_anomalies(df_view, col_types["numeric"], threshold_z=2.5)
                
                anomaly_summary = []
                for col, indices in anomalies.items():
                    if indices:
                        anomaly_summary.append(f"• **{col}**: {len(indices)} valores anômalos ({len(indices)/len(df_view)*100:.1f}%)")
                
                if anomaly_summary:
                    st.warning("⚠️ Anomalias detectadas:\n" + "\n".join(anomaly_summary))
                else:
                    st.success("✅ Nenhuma anomalia detectada")

        # TAB 2 — série temporal quando há coluna de data
        with tab_temporal:
            if not col_types["date"]:
                st.info("ℹ️ Nenhuma coluna de data detectada. Verifique a seleção de colunas.")
            elif not col_types["numeric"]:
                st.info("ℹ️ Nenhuma coluna numérica detectada para plotar.")
            else:
                t_date = st.selectbox("Coluna de data", col_types["date"], key="t_date")
                t_num = st.selectbox("Métrica", col_types["numeric"], key="t_num")

                gran_sugerida = detect_time_granularity(df_view, t_date)
                agg_map = {"Dia": "D", "Semana": "W", "Mês": "ME", "Trimestre": "QE", "Ano": "YE"}
                gran = st.radio("Granularidade", list(agg_map.keys()),
                                index=list(agg_map.keys()).index(gran_sugerida) if gran_sugerida in agg_map else 2,
                                horizontal=True)

                ts = (
                    df_view.set_index(t_date)[t_num]
                    .resample(agg_map[gran])
                    .sum()
                    .reset_index()
                )
                
                # Mini cards com estatísticas por período
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("Total", f"{ts[t_num].sum():,.0f}", 
                              delta=f"{(ts[t_num].iloc[-1] - ts[t_num].iloc[-2]):.0f}" if len(ts) > 1 else None)
                with col2:
                    st.metric("Média", f"{ts[t_num].mean():,.0f}")
                with col3:
                    st.metric("Máximo", f"{ts[t_num].max():,.0f}")
                with col4:
                    st.metric("Mínimo", f"{ts[t_num].min():,.0f}")

                c1, c2 = st.columns(2)
                with c1:
                    fig = px.line(ts, x=t_date, y=t_num, markers=True,
                                  title=f"{t_num} — Linha ({gran})",
                                  color_discrete_sequence=[PALETTE["primary"]])
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)
                with c2:
                    fig = px.bar(ts, x=t_date, y=t_num,
                                 title=f"{t_num} — Barras ({gran})",
                                 color_discrete_sequence=[PALETTE["secondary"]])
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)

                # Linha de tendência acumulada
                ts["acumulado"] = ts[t_num].cumsum()
                fig = px.area(ts, x=t_date, y="acumulado",
                              title=f"{t_num} — Acumulado ({gran})",
                              color_discrete_sequence=[PALETTE["accent"]])
                st.plotly_chart(apply_chart_style(fig), use_container_width=True)

        # TAB 3 — explorador interativo de variáveis
        with tab_explore:
            if col_types["numeric"]:
                st.markdown("### Distribuição numérica")
                col_n = st.selectbox("Coluna", col_types["numeric"], key="exp_num")
                
                # Mini stats
                col_a, col_b, col_c, col_d = st.columns(4)
                with col_a:
                    st.metric("Q1", f"{df_view[col_n].quantile(0.25):,.0f}")
                with col_b:
                    st.metric("Mediana", f"{df_view[col_n].median():,.0f}")
                with col_c:
                    st.metric("Q3", f"{df_view[col_n].quantile(0.75):,.0f}")
                with col_d:
                    st.metric("Desvio Padrão", f"{df_view[col_n].std():,.0f}")
                
                c1, c2 = st.columns(2)
                with c1:
                    fig = px.histogram(df_view, x=col_n, nbins=40, title=f"Histograma: {col_n}",
                                       color_discrete_sequence=[PALETTE["primary"]])
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)
                with c2:
                    fig = px.box(df_view, y=col_n, title=f"Box Plot: {col_n}",
                                 color_discrete_sequence=[PALETTE["secondary"]])
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)

            if col_types["categorical"]:
                render_separator()
                st.markdown("### Distribuição categórica")
                col_c = st.selectbox("Coluna", col_types["categorical"], key="exp_cat")
                top_n = st.slider("Top N", 5, 30, 10)
                vc = df_view[col_c].value_counts().head(top_n).reset_index()
                vc.columns = [col_c, "contagem"]

                c1, c2 = st.columns(2)
                with c1:
                    fig = px.bar(vc, x="contagem", y=col_c, orientation="h",
                                 title=f"Top {top_n}: {col_c}",
                                 color="contagem",
                                 color_continuous_scale="Viridis")
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)
                with c2:
                    fig = px.pie(vc, names=col_c, values="contagem",
                                 title=f"Participação: {col_c}",
                                 color_discrete_sequence=CHART_COLORS)
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)

            if col_types["numeric"] and col_types["categorical"]:
                render_separator()
                st.markdown("### Análise cruzada")
                c1, c2, c3 = st.columns(3)
                with c1:
                    cross_cat = st.selectbox("Categórica", col_types["categorical"], key="xcat")
                with c2:
                    cross_num = st.selectbox("Numérica", col_types["numeric"], key="xnum")
                with c3:
                    agg_fn = st.selectbox("Agregação", ["Soma", "Média", "Contagem", "Máximo", "Mínimo"])

                fn_map = {"Soma": "sum", "Média": "mean", "Contagem": "count", "Máximo": "max", "Mínimo": "min"}
                grp = (
                    df_view.groupby(cross_cat)[cross_num]
                    .agg(fn_map[agg_fn])
                    .reset_index()
                    .rename(columns={cross_num: agg_fn})
                    .sort_values(agg_fn, ascending=False)
                    .head(20)
                )

                fig = px.bar(grp, x=cross_cat, y=agg_fn,
                             title=f"{agg_fn} de {cross_num} por {cross_cat}",
                             color=agg_fn, color_continuous_scale="Purples")
                st.plotly_chart(apply_chart_style(fig), use_container_width=True)

        # TAB 4 — estatísticas descritivas e correlações
        with tab_stats:
            if not col_types["numeric"]:
                st.info("ℹ️ Nenhuma coluna numérica encontrada.")
            else:
                st.markdown("### Estatísticas descritivas")
                stats_df = df_view[col_types["numeric"]].describe().T.round(4)
                st.dataframe(stats_df, use_container_width=True)
                
                # Resumo visual das distribuições
                st.markdown("### Distribuição das colunas numéricas")
                for col in col_types["numeric"][:3]:  # Primeiras 3
                    fig = px.histogram(df_view, x=col, nbins=30,
                                      title=f"Distribuição: {col}",
                                      color_discrete_sequence=[PALETTE["primary"]])
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True, height=250)

                if len(col_types["numeric"]) >= 2:
                    render_separator()
                    st.markdown("### Matriz de correlação")
                    corr = df_view[col_types["numeric"]].corr()
                    fig = px.imshow(corr, color_continuous_scale="RdBu_r",
                                    zmin=-1, zmax=1, text_auto=".2f",
                                    title="Correlação entre variáveis numéricas")
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)

                    render_separator()
                    st.markdown("### Dispersão entre variáveis")
                    c1, c2 = st.columns(2)
                    with c1:
                        sc_x = st.selectbox("Eixo X", col_types["numeric"], key="sc_x")
                    with c2:
                        sc_y = st.selectbox("Eixo Y", col_types["numeric"],
                                            index=min(1, len(col_types["numeric"]) - 1), key="sc_y")

                    color_by = None
                    if col_types["categorical"]:
                        color_opt = st.selectbox("Cor por (opcional)", ["—"] + col_types["categorical"])
                        color_by = None if color_opt == "—" else color_opt

                    try:
                        fig = px.scatter(df_view, x=sc_x, y=sc_y, color=color_by,
                                         trendline="ols", opacity=0.7,
                                         title=f"Dispersão: {sc_x} vs {sc_y}",
                                         color_discrete_sequence=CHART_COLORS)
                    except Exception:
                        # Fallback sem trendline se statsmodels não estiver disponível
                        fig = px.scatter(df_view, x=sc_x, y=sc_y, color=color_by,
                                         opacity=0.7,
                                         title=f"Dispersão: {sc_x} vs {sc_y}",
                                         color_discrete_sequence=CHART_COLORS)
                    
                    st.plotly_chart(apply_chart_style(fig), use_container_width=True)

        # TAB 5 — exportação dos dados filtrados
        with tab_export:
            st.markdown("### Exportar dados filtrados")
            st.caption(f"{len(df_view):,} linhas · {len(df_view.columns)} colunas")

            ts_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            c1, c2 = st.columns(2)
            with c1:
                st.download_button("📥 Excel (.xlsx)", data=to_excel(df_view),
                                   file_name=f"analytics_{ts_str}.xlsx",
                                   mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                   use_container_width=True)
            with c2:
                st.download_button("📥 CSV", data=to_csv(df_view),
                                   file_name=f"analytics_{ts_str}.csv",
                                   mime="text/csv",
                                   use_container_width=True)

else:
    from templates.ui import render_welcome
    render_welcome()