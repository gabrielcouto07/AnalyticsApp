/**
 * Design System — Tokens centralizados
 * Fonte única de verdade para cores, tipografia e tema Plotly
 */

export const tokens = {
  colors: {
    primary: "#4f8ef7",
    secondary: "#a78bfa",
    accent: "#06b6d4",
    success: "#34c97e",
    warning: "#f59e0b",
    danger: "#f87171",
    surface: "#0f172a", // fundo da página
    card: "#1e293b", // fundo dos cards
    border: "#334155",
    text: "#f1f5f9",
    muted: "#94a3b8",
    faint: "#475569",
  },

  /**
   * Layout base para todos os gráficos Plotly
   * Aplicado globalmente para garantir consistência visual
   */
  plotly: {
    layout: {
      paper_bgcolor: "#1e293b",
      plot_bgcolor: "#1e293b",
      font: { family: "Inter, sans-serif", color: "#f1f5f9", size: 12 },
      xaxis: {
        gridcolor: "#334155",
        linecolor: "#334155",
        tickfont: { color: "#94a3b8" },
      },
      yaxis: {
        gridcolor: "#334155",
        linecolor: "#334155",
        tickfont: { color: "#94a3b8" },
      },
      legend: {
        bgcolor: "rgba(0,0,0,0)",
        font: { color: "#94a3b8" },
      },
      hoverlabel: {
        bgcolor: "#0f172a",
        font: { color: "#f1f5f9" },
        bordercolor: "#334155",
      },
      margin: { l: 50, r: 20, t: 45, b: 45 },
    },
    config: {
      responsive: true,
      displayModeBar: false,
    },
    colors: [
      "#4f8ef7",
      "#a78bfa",
      "#34c97e",
      "#f59e0b",
      "#06b6d4",
      "#f87171",
      "#ec4899",
      "#8b5cf6",
    ],
  },

  /**
   * Spacing scale (Tailwind compat)
   */
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "2.5rem",
    "3xl": "3rem",
  },

  /**
   * Border radius
   */
  radius: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.5rem",
    full: "9999px",
  },

  /**
   * Typography
   */
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
};

export type Theme = typeof tokens;
