"""
Componentes inteligentes de KPI com trends, indicadores visuais e interatividade.
Fase 1.5 - Frontend Evolution
"""

import streamlit as st
import plotly.graph_objects as go
from config.colors import PALETTE
from config.analytics import calculate_trend
import pandas as pd


def smart_kpi_card(
    title: str,
    value: str,
    trend_pct: float = 0,
    trend_direction: str = "→",
    subtitle: str = "",
    icon: str = "📊",
    color: str = "primary",
) -> str:
    """
    Card KPI inteligente com indicador de tendência visual.
    - Seta ↑↓ com cor (verde/vermelho)
    - Badge com % de mudança
    - Fundo com gradiente sutil
    """
    
    # Define cores baseadas na tendência
    if trend_pct > 5:
        trend_badge = f"<span class='kpi-trend-up'>↑ +{trend_pct:.1f}%</span>"
    elif trend_pct < -5:
        trend_badge = f"<span class='kpi-trend-down'>↓ {trend_pct:.1f}%</span>"
    else:
        trend_badge = f"<span class='kpi-trend-neutral'>→ {trend_pct:+.1f}%</span>"
    
    # Mapeia cor primária
    palette_color = PALETTE.get(color, PALETTE["primary"])
    
    html = f"""<div class="smart-kpi-card" style="border-left: 5px solid {palette_color};">
        <div class="smart-kpi-header">
            <span class="smart-kpi-icon">{icon}</span>
            <span class="smart-kpi-title">{title}</span>
            {trend_badge}
        </div>
        <div class="smart-kpi-value">{value}</div>
        {'<div class="smart-kpi-subtitle">' + subtitle + '</div>' if subtitle else ''}
    </div>"""
    
    return html


def render_smart_kpi_row(kpis: list[dict]):
    """
    Renderiza linha de smart KPI cards com trends.
    Cada KPI deve ter: title, value, trend_pct, subtitle, icon (opcional)
    """
    cards_html = "".join([
        smart_kpi_card(
            title=k.get("title", ""),
            value=k.get("value", ""),
            trend_pct=k.get("trend_pct", 0),
            subtitle=k.get("subtitle", ""),
            icon=k.get("icon", "📊"),
            color=k.get("color", "primary"),
        )
        for k in kpis
    ])
    
    st.markdown(f'<div class="smart-kpi-row">{cards_html}</div>', unsafe_allow_html=True)


def mini_metric_chart(
    df: pd.DataFrame,
    value_col: str,
    date_col: str = None,
    title: str = "",
    fill_color: str = "#4f8ef7",
) -> go.Figure:
    """
    Cria um mini gráfico sparkline-style para o topo do dashboard.
    Usado em cards de overview com série temporal comprimida.
    """
    try:
        if date_col and date_col in df.columns:
            df_sorted = df.sort_values(date_col)
            y_values = df_sorted[value_col].values
            x_values = range(len(y_values))
        else:
            y_values = df[value_col].tail(30).values
            x_values = range(len(y_values))
        
        fig = go.Figure(
            data=[
                go.Scatter(
                    x=x_values,
                    y=y_values,
                    fill="tozeroy",
                    fillcolor=f"rgba({int(fill_color[1:3], 16)}, {int(fill_color[3:5], 16)}, {int(fill_color[5:7], 16)}, 0.3)",
                    line=dict(color=fill_color, width=2),
                    mode="lines",
                    name=value_col,
                )
            ]
        )
        
        fig.update_layout(
            title=title,
            showlegend=False,
            height=150,
            margin=dict(l=0, r=0, t=20, b=0),
            paper_bgcolor=PALETTE["surface"],
            plot_bgcolor=PALETTE["surface"],
            font=dict(size=9, color=PALETTE["text_muted"]),
            hovermode="x unified",
        )
        
        fig.update_xaxes(showgrid=False, showticklabels=False)
        fig.update_yaxes(showgrid=False, showticklabels=False)
        
        return fig
    except Exception as e:
        print(f"Erro ao criar mini gráfico: {e}")
        return None


def metric_comparison_badge(current: float, previous: float, decimals: int = 1) -> str:
    """
    Retorna badge HTML com comparação de valores.
    Example: "R$ 1.2M ↑ 15.3%"
    """
    try:
        if previous == 0:
            pct_change = 0
        else:
            pct_change = ((current - previous) / abs(previous)) * 100
        
        if abs(pct_change) < 0.5:
            arrow = "→"
            color = "#94a3b8"
        elif pct_change > 0:
            arrow = "↑"
            color = "#34c97e"
        else:
            arrow = "↓"
            color = "#f87171"
        
        return f'<span style="color: {color};">{arrow} {pct_change:+.{decimals}f}%</span>'
    except Exception:
        return ""


def insight_card(title: str, description: str, icon: str = "💡", color: str = "accent") -> str:
    """
    Card com insight/recomendação extraída dos dados.
    Exemplo: "⚠️ 12 outliers detectados em 'N_Valor'"
    """
    palette_color = PALETTE.get(color, PALETTE["accent"])
    
    html = f"""<div class="insight-card" style="border-left: 4px solid {palette_color};">
        <div class="insight-icon">{icon}</div>
        <div class="insight-content">
            <div class="insight-title">{title}</div>
            <div class="insight-desc">{description}</div>
        </div>
    </div>"""
    return html


def render_insights_section(insights: list[dict]):
    """
    Renderiza seção de insights automáticos.
    Cada insight deve ter: title, description, icon (opcional)
    """
    if not insights:
        return
    
    html = '<div class="insights-container">'
    for idx, insight in enumerate(insights):
        html += insight_card(
            title=insight.get("title", ""),
            description=insight.get("description", ""),
            icon=insight.get("icon", "💡"),
            color=insight.get("color", "accent"),
        )
    html += "</div>"
    
    st.markdown(html, unsafe_allow_html=True)


def gauge_chart(value: float, max_value: float = 100, title: str = "", color: str = "#4f8ef7") -> go.Figure:
    """
    Cria gráfico de gauge (velocímetro) para mostrar progresso/performance.
    """
    fig = go.Figure(
        data=[
            go.Gauge(
                domain={"x": [0, 1], "y": [0, 1]},
                value=value,
                maximum=max_value,
                title={"text": title},
                delta={"reference": max_value * 0.8},
                gauge={
                    "axis": {"range": [None, max_value]},
                    "bar": {"color": color},
                    "steps": [
                        {"range": [0, max_value * 0.5], "color": "rgba(79, 142, 247, 0.2)"},
                        {"range": [max_value * 0.5, max_value], "color": "rgba(79, 142, 247, 0.1)"},
                    ],
                    "threshold": {
                        "line": {"color": "red", "width": 2},
                        "thickness": 0.75,
                        "value": max_value * 0.9,
                    },
                },
            )
        ]
    )
    
    fig.update_layout(
        height=300,
        paper_bgcolor=PALETTE["surface"],
        font=dict(color=PALETTE["text"], size=11),
        margin=dict(l=20, r=20, t=50, b=20),
    )
    
    return fig


def heatmap_trend(df: pd.DataFrame, date_col: str, numeric_col: str, freq: str = "D") -> go.Figure:
    """
    Cria heatmap de tendência temporal para um período (dia da semana/hora do dia).
    Útil para padrões de comportamento.
    """
    try:
        df_copy = df.copy()
        df_copy[date_col] = pd.to_datetime(df_copy[date_col])
        df_copy["value_bin"] = pd.cut(df_copy[numeric_col], bins=10)
        df_copy["date"] = df_copy[date_col].dt.date
        df_copy["hour"] = df_copy[date_col].dt.hour if freq == "H" else df_copy[date_col].dt.isocalendar().week
        
        pivot = df_copy.groupby(["date", "hour"])[numeric_col].sum().unstack(fill_value=0)
        
        fig = go.Figure(
            data=go.Heatmap(
                z=pivot.values,
                x=pivot.columns,
                y=[str(d) for d in pivot.index],
                colorscale="Blues",
                colorbar=dict(title=numeric_col),
            )
        )
        
        fig.update_layout(
            title="Padrão Temporal de Valores",
            xaxis_title="Período",
            yaxis_title="Data",
            height=300,
            paper_bgcolor=PALETTE["surface"],
            font=dict(color=PALETTE["text"]),
        )
        
        return fig
    except Exception as e:
        print(f"Erro ao criar heatmap: {e}")
        return None
