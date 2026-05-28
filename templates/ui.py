import plotly.graph_objects as go

from config.colors import CHART_COLORS, PALETTE


def apply_chart_style(fig: go.Figure, title: str | None = None) -> go.Figure:
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor=PALETTE["bg"],
        plot_bgcolor=PALETTE["bg"],
        font=dict(color=PALETTE["text"], family="Inter, sans-serif", size=12),
        margin=dict(l=40, r=20, t=40, b=40),
        legend=dict(bgcolor="rgba(0,0,0,0)", borderwidth=0),
        xaxis=dict(gridcolor=PALETTE["border"], linecolor=PALETTE["border"], tickcolor=PALETTE["border"]),
        yaxis=dict(gridcolor=PALETTE["border"], linecolor=PALETTE["border"], tickcolor=PALETTE["border"]),
        hoverlabel=dict(
            bgcolor=PALETTE["surface"],
            font_color=PALETTE["text"],
            bordercolor=PALETTE["border"],
        ),
        colorway=CHART_COLORS,
    )

    if title:
        fig.update_layout(title=dict(text=title, font=dict(size=14, color=PALETTE["text"])))

    return fig
