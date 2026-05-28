/**
 * Formatadores — normalizam saída de dados para português-BR
 * Utilizados em toda parte do app para apresentação consistente
 */

export const fmt = {
  /**
   * Número padrão com até 2 casas decimais
   * 1234.567 → "1.234,57"
   */
  number: (n: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n),

  /**
   * Notação compacta com 1 casa decimal
   * 1234567 → "1,2M"
   */
  compact: (n: number) =>
    new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n),

  /**
   * Moeda brasileira
   * 1234.56 → "R$ 1.234,56"
   */
  currency: (n: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(n),

  /**
   * Percentual com sinal
   * 12.5 → "+12.5%"
   * -8.3 → "-8.3%"
   */
  percent: (n: number, showSign = true) =>
    `${showSign && n > 0 ? "+" : ""}${n.toFixed(1)}%`,

  /**
   * Data em formato brasileiro
   * "2026-04-15" → "15/04/2026"
   */
  date: (d: string) => new Date(d).toLocaleDateString("pt-BR"),

  /**
   * Data e hora
   * "2026-04-15T14:30:00" → "15/04/2026 14:30"
   */
  datetime: (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),

  /**
   * Duração em formato legível
   * 3661 (segundos) → "1h 1m"
   */
  duration: (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  /**
   * Bytes para legível
   * 1024 → "1 KB"
   * 1048576 → "1 MB"
   */
  bytes: (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  /**
   * Percentual de progresso com cor
   */
  progress: (value: number, max: number) => {
    const percent = Math.round((value / max) * 100);
    return percent;
  },
};

/**
 * Helpers para análise de dados
 */
export const analysis = {
  /**
   * Calcula se um número é "alto" (+), "normal" (~) ou "baixo" (-)
   */
  trend: (current: number, previous: number) => {
    const change = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(change) < 5) return "~";
    return change > 0 ? "+" : "-";
  },

  /**
   * Severity badge color
   */
  severity: (value: number, high: number, low: number) => {
    if (value >= high) return "danger";
    if (value <= low) return "warning";
    return "success";
  },
};
