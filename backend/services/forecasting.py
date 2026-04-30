from __future__ import annotations

from typing import Any, Literal, cast

import numpy as np
import pandas as pd

from .custos_analyzer import canonicalize_consolidado_frame, canonicalize_nfs_frame
from .core.normalizer import strip_accents


ForecastMethod = Literal["linear", "exponential_smoothing", "moving_average"]


def _clean_series(series: pd.Series) -> pd.Series:
    """Normaliza uma série temporal para valores numéricos ordenados."""
    numeric = pd.to_numeric(series.copy(), errors="coerce").dropna()
    if numeric.empty:
        return pd.Series(dtype=float)
    if isinstance(numeric.index, pd.MultiIndex):
        numeric = numeric.reset_index(drop=True)
    return numeric.sort_index()


def _format_label(value: Any) -> str:
    """Formata rótulos de períodos para a API."""
    month_names = {
        1: "Jan",
        2: "Fev",
        3: "Mar",
        4: "Abr",
        5: "Mai",
        6: "Jun",
        7: "Jul",
        8: "Ago",
        9: "Set",
        10: "Out",
        11: "Nov",
        12: "Dez",
    }
    if isinstance(value, pd.Period):
        return f"{month_names.get(value.month, value.month)}/{value.year}"
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.notna(parsed):
        return f"{month_names.get(parsed.month, parsed.month)}/{parsed.year}"
    return str(value)


def _future_labels(index: pd.Index, periods: int) -> list[str]:
    """Gera rótulos futuros a partir do índice histórico."""
    if len(index) == 0:
        return [f"+{offset}" for offset in range(1, periods + 1)]

    if isinstance(index, pd.PeriodIndex):
        return [_format_label(index[-1] + offset) for offset in range(1, periods + 1)]

    datetime_index = pd.to_datetime(index, errors="coerce")
    if pd.notna(datetime_index).any():
        valid_dates = pd.DatetimeIndex(datetime_index[pd.notna(datetime_index)])
        last_date = valid_dates[-1]
        freq = pd.infer_freq(valid_dates) if len(valid_dates) >= 3 else None
        if freq:
            future = pd.date_range(last_date, periods=periods + 1, freq=freq)[1:]
        elif len(valid_dates) >= 2:
            delta = valid_dates[-1] - valid_dates[-2]
            future = pd.DatetimeIndex([last_date + delta * offset for offset in range(1, periods + 1)])
        else:
            future = pd.date_range(last_date + pd.offsets.MonthBegin(1), periods=periods, freq="MS")
        return [_format_label(value) for value in future]

    return [f"+{offset}" for offset in range(1, periods + 1)]


def _trend_from_variation(variation_pct: float) -> str:
    """Classifica tendência pela variação percentual média."""
    if variation_pct > 2:
        return "crescente"
    if variation_pct < -2:
        return "decrescente"
    return "estável"


def _average_variation_pct(values: np.ndarray) -> float:
    """Calcula a variação percentual média por período."""
    if len(values) < 2:
        return 0.0
    variations: list[float] = []
    for previous, current in zip(values[:-1], values[1:]):
        if previous != 0:
            variations.append(((current - previous) / abs(previous)) * 100)
    return float(np.mean(variations)) if variations else 0.0


def _linear_forecast(values: np.ndarray, periods: int, z_value: float) -> tuple[np.ndarray, np.ndarray, np.ndarray, float | None]:
    """Calcula forecast por regressão linear simples."""
    x_values = np.arange(len(values), dtype=float)
    if len(values) < 2:
        forecast = np.repeat(values[-1] if len(values) else 0.0, periods)
        return forecast, forecast, forecast, None

    slope, intercept = np.polyfit(x_values, values, 1)
    fitted = intercept + slope * x_values
    residuals = values - fitted
    residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0
    future_x = np.arange(len(values), len(values) + periods, dtype=float)
    forecast = intercept + slope * future_x
    lower = forecast - z_value * residual_std
    upper = forecast + z_value * residual_std

    ss_res = float(np.sum((values - fitted) ** 2))
    ss_tot = float(np.sum((values - np.mean(values)) ** 2))
    r_squared = 1 - (ss_res / ss_tot) if ss_tot else None
    return forecast, lower, upper, round(float(r_squared), 4) if r_squared is not None else None


def _exponential_smoothing_forecast(values: np.ndarray, periods: int, z_value: float, alpha: float = 0.3) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Calcula forecast por suavização exponencial simples."""
    if len(values) == 0:
        forecast = np.zeros(periods)
        return forecast, forecast, forecast

    smoothed = np.zeros(len(values), dtype=float)
    smoothed[0] = values[0]
    for index in range(1, len(values)):
        smoothed[index] = alpha * values[index] + (1 - alpha) * smoothed[index - 1]

    residuals = values - smoothed
    residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0
    forecast = np.repeat(smoothed[-1], periods)
    lower = forecast - z_value * residual_std
    upper = forecast + z_value * residual_std
    return forecast, lower, upper


def _moving_average_forecast(values: np.ndarray, periods: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Calcula forecast por média móvel dos últimos períodos."""
    if len(values) == 0:
        forecast = np.zeros(periods)
        return forecast, forecast, forecast
    window = max(1, min(3, len(values) // 2 or 1))
    value = float(np.mean(values[-window:]))
    forecast = np.repeat(value, periods)
    return forecast, forecast, forecast


def forecast_series(
    series: pd.Series,
    periods: int,
    method: ForecastMethod = "exponential_smoothing",
    confidence: float = 0.95,
) -> dict[str, Any]:
    """
    Recebe uma pd.Series ordenada e retorna histórico, previsão, tendência e qualidade do ajuste.
    """
    cleaned = _clean_series(series)
    safe_periods = max(1, int(periods))
    values = cleaned.to_numpy(dtype=float)
    z_value = 1.96 if confidence >= 0.95 else 1.64
    selected_method = method if method in {"linear", "exponential_smoothing", "moving_average"} else "exponential_smoothing"

    if selected_method == "linear":
        forecast_values, lower_values, upper_values, r_squared = _linear_forecast(values, safe_periods, z_value)
    elif selected_method == "moving_average":
        forecast_values, lower_values, upper_values = _moving_average_forecast(values, safe_periods)
        r_squared = None
    else:
        forecast_values, lower_values, upper_values = _exponential_smoothing_forecast(values, safe_periods, z_value)
        r_squared = None

    variation_pct = _average_variation_pct(values)
    labels = _future_labels(cleaned.index, safe_periods)
    return {
        "historical": [
            {"label": _format_label(index), "value": round(float(value), 2)}
            for index, value in zip(cleaned.index, values)
        ],
        "forecast": [
            {
                "label": labels[index],
                "value": round(float(forecast_values[index]), 2),
                "lower_bound": round(float(lower_values[index]), 2),
                "upper_bound": round(float(upper_values[index]), 2),
            }
            for index in range(safe_periods)
        ],
        "trend": _trend_from_variation(variation_pct),
        "variacao_pct_periodo": round(float(variation_pct), 2),
        "r_squared": r_squared,
    }


def _normalize_text(value: Any) -> str:
    """Normaliza texto para comparação tolerante a acentos."""
    text = strip_accents(str(value or "")).upper().strip()
    return " ".join(text.split())


def _resolve_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Resolve uma coluna usando aliases normalizados."""
    normalized = {_normalize_text(column): str(column) for column in df.columns}
    for candidate in candidates:
        key = _normalize_text(candidate)
        if key in normalized:
            return normalized[key]
    return None


def _headcount_by_period(df: pd.DataFrame, period_col: str, value_col: str, group_cols: list[str]) -> pd.Series:
    """Calcula headcount único por período."""
    working = df.copy()
    working[value_col] = pd.to_numeric(working[value_col], errors="coerce").fillna(0)
    working = working[working[value_col] > 0].copy()
    if working.empty:
        return pd.Series(dtype=float)
    if "period_date" not in working.columns:
        working["period_date"] = pd.to_datetime(working[period_col].astype(str), errors="coerce")
        if working["period_date"].isna().all():
            working["period_date"] = working[period_col].astype(str)
    unique_cols = [column for column in group_cols if column in working.columns]
    if unique_cols:
        grouped = working.drop_duplicates(subset=["period_date", *unique_cols]).groupby("period_date").size()
    else:
        grouped = working.groupby("period_date")[value_col].sum()
    return grouped.sort_index().astype(float)


def _trend_alerts(dimension: str, result: dict[str, Any], series: pd.Series) -> list[str]:
    """Gera alertas de qualidade para uma dimensão prevista."""
    if len(series.dropna()) < 3:
        return []

    alerts: list[str] = []
    variation = float(result.get("variacao_pct_periodo") or 0)
    if variation > 15:
        alerts.append(f"{dimension} crescendo {variation:.1f}% — monitorar")
    elif variation < -15:
        alerts.append(f"{dimension} caindo {abs(variation):.1f}% — monitorar")

    values = pd.to_numeric(series, errors="coerce").dropna().to_numpy(dtype=float)
    if len(values) >= 3:
        x_values = np.arange(len(values), dtype=float)
        slope, intercept = np.polyfit(x_values, values, 1)
        fitted = intercept + slope * x_values
        recent_actual = values[-2:]
        recent_fitted = fitted[-2:]
        divergences = [
            abs((actual - expected) / expected) if expected else 0.0
            for actual, expected in zip(recent_actual, recent_fitted)
        ]
        if divergences and all(value > 0.30 for value in divergences):
            alerts.append(f"Quebra de tendência detectada em {dimension}")
    return alerts


def forecast_efetivo(
    df: pd.DataFrame,
    periods: int = 3,
    method: str = "exponential_smoothing",
) -> dict[str, Any]:
    """
    Retorna previsão de headcount geral e por cargo para dados de Efetivo.
    """
    if df.empty:
        return {"headcount_geral": forecast_series(pd.Series(dtype=float), periods), "por_cargo": {}, "alertas": []}

    period_col = _resolve_column(df, ["PERÍODO", "PERIODO", "Periodo"])
    value_col = _resolve_column(df, ["Qtd", "Quantidade"])
    cargo_col = _resolve_column(df, ["CARGO/FUNÇÃO", "Cargo/Função", "Funcao", "Função"])
    fornecedor_col = _resolve_column(df, ["Fornecedor"])
    obra_col = _resolve_column(df, ["Filial/Obra", "Obra"])

    if period_col is None or value_col is None:
        return {"headcount_geral": forecast_series(pd.Series(dtype=float), periods), "por_cargo": {}, "alertas": []}

    group_cols = [column for column in [obra_col, fornecedor_col, cargo_col, period_col] if column is not None]
    geral_series = _headcount_by_period(df, period_col, value_col, group_cols)
    selected_method = cast(ForecastMethod, method if method in {"linear", "exponential_smoothing", "moving_average"} else "exponential_smoothing")
    geral = forecast_series(geral_series, periods, selected_method)

    por_cargo: dict[str, Any] = {}
    alertas = _trend_alerts("Headcount", geral, geral_series)
    if cargo_col is not None:
        working = df.copy()
        working[value_col] = pd.to_numeric(working[value_col], errors="coerce").fillna(0)
        top_cargos = (
            working[working[value_col] > 0]
            .groupby(cargo_col)[value_col]
            .sum()
            .sort_values(ascending=False)
            .head(5)
            .index
            .tolist()
        )
        for cargo in top_cargos:
            cargo_frame = working[working[cargo_col] == cargo].copy()
            cargo_series = _headcount_by_period(cargo_frame, period_col, value_col, group_cols)
            if len(cargo_series) == 0:
                continue
            result = forecast_series(cargo_series, periods, selected_method)
            por_cargo[str(cargo)] = result
            alertas.extend(_trend_alerts(str(cargo), result, cargo_series))

    return {"headcount_geral": geral, "por_cargo": por_cargo, "alertas": alertas}


def forecast_custos(
    df_nfs: pd.DataFrame,
    df_consolidado: pd.DataFrame | None,
    periods: int = 3,
    method: str = "exponential_smoothing",
) -> dict[str, Any]:
    """
    Retorna previsão mensal de custos totais e por natureza.
    """
    nfs = canonicalize_nfs_frame(df_nfs)
    consolidado = canonicalize_consolidado_frame(df_consolidado)
    source = consolidado if not consolidado.empty else nfs
    if source.empty or "data_vencimento" not in source.columns or "valor" not in source.columns:
        empty = forecast_series(pd.Series(dtype=float), periods)
        return {"previsao_total": empty, "previsao_por_natureza": {}, "alertas": []}

    working = source.copy()
    working["data_vencimento"] = pd.to_datetime(working["data_vencimento"], errors="coerce", dayfirst=True)
    working["valor"] = pd.to_numeric(working["valor"], errors="coerce")
    working = working[working["data_vencimento"].notna() & working["valor"].notna() & (working["valor"] != 0)].copy()
    if working.empty:
        empty = forecast_series(pd.Series(dtype=float), periods)
        return {"previsao_total": empty, "previsao_por_natureza": {}, "alertas": []}

    working["periodo"] = working["data_vencimento"].dt.to_period("M").dt.to_timestamp()
    total_series = working.groupby("periodo")["valor"].sum().sort_index()
    selected_method = cast(ForecastMethod, method if method in {"linear", "exponential_smoothing", "moving_average"} else "exponential_smoothing")
    previsao_total = forecast_series(total_series, periods, selected_method)
    alertas = _trend_alerts("Custos totais", previsao_total, total_series)

    previsao_por_natureza: dict[str, Any] = {}
    if "natureza" in working.columns:
        for natureza, group in working.groupby("natureza", dropna=False):
            natureza_series = group.groupby("periodo")["valor"].sum().sort_index()
            if len(natureza_series) < 3:
                continue
            label = str(natureza or "Nao informado")
            result = forecast_series(natureza_series, periods, selected_method)
            previsao_por_natureza[label] = result
            alertas.extend(_trend_alerts(label, result, natureza_series))

    return {
        "previsao_total": previsao_total,
        "previsao_por_natureza": previsao_por_natureza,
        "alertas": alertas,
    }
