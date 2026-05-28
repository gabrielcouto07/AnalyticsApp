import streamlit as st
import plotly.graph_objects as go
from config.colors import PALETTE


def load_theme():
    """Aplica configurações globais de tema via st.markdown."""
    st.markdown("""
        <style>
        /* Remove padding padrão do topo */
        .block-container { padding-top: 1rem; }
        /* Métricas sem borda inferior nativa */
        [data-testid="metric-container"] { border: none; }
        </style>
    """, unsafe_allow_html=True)


def render_header(title: str, subtitle: str = ""):
    """Renderiza o cabeçalho principal da página."""
    st.markdown(f"""
        <div class="dash-header">
            <h1 class="dash-title">{title}</h1>
            {'<p class="dash-subtitle">' + subtitle + '</p>' if subtitle else ''}
        </div>
    """, unsafe_allow_html=True)


def render_separator():
    """Separador visual leve entre seções."""
    st.markdown('<hr class="dash-separator"/>', unsafe_allow_html=True)


def kpi_card(title: str, value: str, subtitle: str = "", icon: str = "📊") -> str:
    """Retorna HTML de um card KPI individual."""
    return f"""
    <div class="kpi-card">
        <div class="kpi-icon">{icon}</div>
        <div class="kpi-content">
            <div class="kpi-title">{title}</div>
            <div class="kpi-value">{value}</div>
            <div class="kpi-subtitle">{subtitle}</div>
        </div>
    </div>
    """


def render_kpi_row(kpis: list[dict]):
    """
    Renderiza uma linha de KPI cards.
    Cada item da lista deve ter: title, value e opcionalmente subtitle e icon.
    """
    cards_html = "".join([
        kpi_card(
            k.get("title", ""),
            k.get("value", ""),
            k.get("subtitle", ""),
            k.get("icon", "📊"),
        )
        for k in kpis
    ])
    st.markdown(f'<div class="kpi-row">{cards_html}</div>', unsafe_allow_html=True)


def apply_chart_style(fig: go.Figure, title: str = None) -> go.Figure:
    """
    Aplica tema escuro padronizado a qualquer figura Plotly.
    Todos os gráficos do app passam por aqui para consistência visual.
    """
    updates = dict(
        paper_bgcolor=PALETTE["surface"],
        plot_bgcolor=PALETTE["surface"],
        font=dict(family="Inter, sans-serif", color=PALETTE["text"], size=12),
        title=dict(font=dict(size=15, color=PALETTE["text"]), x=0.01),
        margin=dict(l=20, r=20, t=45, b=20),
        xaxis=dict(
            gridcolor=PALETTE["border"],
            linecolor=PALETTE["border"],
            tickcolor=PALETTE["border"],
            tickfont=dict(color=PALETTE["text_muted"]),
        ),
        yaxis=dict(
            gridcolor=PALETTE["border"],
            linecolor=PALETTE["border"],
            tickcolor=PALETTE["border"],
            tickfont=dict(color=PALETTE["text_muted"]),
        ),
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            font=dict(color=PALETTE["text_muted"]),
        ),
        hoverlabel=dict(
            bgcolor=PALETTE["bg"],
            font_color=PALETTE["text"],
            bordercolor=PALETTE["border"],
        ),
    )
    if title:
        updates["title"]["text"] = title

    fig.update_layout(**updates)
    return fig


def detect_time_granularity(df, date_col: str) -> str:
    """
    Sugere a granularidade temporal mais adequada baseada no range de datas.
    Retorna string compatível com as opções do radio do app.
    """
    try:
        delta = df[date_col].max() - df[date_col].min()
        days = delta.days
        if days <= 30:
            return "Dia"
        elif days <= 120:
            return "Semana"
        elif days <= 730:
            return "Mês"
        elif days <= 1460:
            return "Trimestre"
        else:
            return "Ano"
    except Exception:
        return "Mês"

def render_welcome():
    """
    Tela de boas vindas exibida de começo, antes de qualquer açao do usuario.
    """
    st.markdown("""
    <style>
    .welcome-container {
        text-align: center;
        padding: 4rem 2rem;
    }
    .welcome-title {
        font-size: 2.5em;
        margin-bottom: 0.5em;
        color: #f1f5f9;
    }
    .welcome-subtitle {
        font-size: 1.2em;
        color: #94a3b8;
        margin-bottom: 2em;
    }
    .welcome-icon {
        font-size: 4em;
        margin-bottom: 1em;
    }
    </style>
    <div class="welcome-container">
        <div class="welcome-icon">📊</div>
        <h1 class="welcome-title">Analytics Dashboard</h1>
        <p class="welcome-subtitle">Carregue seus dados para começar a explorar insights incríveis</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.info("👈 Use a **sidebar** para carregar seu arquivo (Excel, CSV, TXT, JSON)", icon="ℹ️")