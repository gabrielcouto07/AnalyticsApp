from __future__ import annotations

import math
from datetime import date
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from scipy.stats import linregress, norm

from ..services.custos_analyzer import (
    canonicalize_budget_frame,
    canonicalize_consolidado_frame,
    canonicalize_nfs_frame,
)
from ..services.session_merger import merge_sessions
from ..session import get_session
from ..utils.json_utils import _json_safe


router = APIRouter(tags=["analytics"])


MONTH_LABELS = {
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


def _risk_level(value: float, medium_threshold: float, high_threshold: float) -> str:
    if value > high_threshold:
        return "alto"
    if value > medium_threshold:
        return "médio"
    return "baixo"


def _get_session_or_404(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _get_structured(session_id: str) -> dict[str, Any]:
    session = _get_session_or_404(session_id)
    structured = session.extras.get("structured_data")
    return structured if isinstance(structured, dict) else {}


def _get_nfs_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    structured = _get_structured(session_id)
    for frame in (structured.get("nfs"), session.extras.get("nfs"), session.df):
        normalized = canonicalize_nfs_frame(frame)
        if not normalized.empty:
            normalized["data_vencimento"] = pd.to_datetime(
                normalized.get("data_vencimento"),
                errors="coerce",
                dayfirst=True,
            )
            return normalized
    return pd.DataFrame()


def _get_consolidado_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    structured = _get_structured(session_id)
    for frame in (structured.get("consolidado"), session.extras.get("consolidado")):
        normalized = canonicalize_consolidado_frame(frame)
        if not normalized.empty:
            normalized["data_vencimento"] = pd.to_datetime(
                normalized.get("data_vencimento"),
                errors="coerce",
                dayfirst=True,
            )
            return normalized
    return pd.DataFrame()


def _get_budget_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    structured = _get_structured(session_id)
    candidates = [
        structured.get("orcamento", {}).get("budget") if isinstance(structured.get("orcamento"), dict) else None,
        session.extras.get("orcamento_budget"),
        session.extras.get("flat"),
    ]
    for frame in candidates:
        normalized = canonicalize_budget_frame(frame)
        if not normalized.empty:
            return normalized
    return pd.DataFrame()


def _get_resumo_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    structured = _get_structured(session_id)
    for frame in (structured.get("resumo"), session.extras.get("resumo")):
        if isinstance(frame, pd.DataFrame) and not frame.empty:
            return frame.copy()
    return pd.DataFrame()


def _get_efetivo_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    if "Quantidade" in session.df.columns:
        frame = session.df.copy()
        frame["Data"] = pd.to_datetime(frame.get("Data"), errors="coerce")
        frame["Quantidade"] = pd.to_numeric(frame.get("Quantidade"), errors="coerce").fillna(0)
        frame["Mes"] = pd.to_numeric(frame.get("Mes"), errors="coerce").fillna(0).astype(int)
        return frame
    return pd.DataFrame()


def _quality_reports_for_session(session_id: str) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []
    for frame in (
        _get_nfs_frame(session_id),
        _get_consolidado_frame(session_id),
        _get_budget_frame(session_id),
        _get_resumo_frame(session_id),
        _get_efetivo_frame(session_id),
    ):
        if isinstance(frame, pd.DataFrame):
            report = frame.attrs.get("quality_report")
            if isinstance(report, dict):
                reports.append(report)
    return reports


def _budget_total(session_id: str) -> float:
    budget = _get_budget_frame(session_id)
    if budget.empty or "custo_total" not in budget.columns:
        return 0.0
    return float(pd.to_numeric(budget["custo_total"], errors="coerce").fillna(0).sum())


def _monthly_nfs(session_id: str) -> pd.DataFrame:
    nfs = _get_nfs_frame(session_id)
    if nfs.empty or "data_vencimento" not in nfs.columns:
        return pd.DataFrame()
    working = nfs[nfs["data_vencimento"].notna()].copy()
    if working.empty:
        return pd.DataFrame()
    working["mes_ref"] = working["data_vencimento"].dt.to_period("M").dt.to_timestamp()
    grouped = (
        working.groupby("mes_ref", dropna=False)
        .agg(valor_nfs=("valor", "sum"))
        .reset_index()
        .sort_values("mes_ref")
    )
    grouped["mes"] = grouped["mes_ref"].dt.month
    grouped["mes_nome"] = grouped["mes"].map(MONTH_LABELS)
    return grouped


def _monthly_workforce(session_id: str) -> pd.DataFrame:
    efetivo = _get_efetivo_frame(session_id)
    if efetivo.empty:
        return pd.DataFrame()
    grouped = (
        efetivo.groupby(["Mes", "MesNome"], dropna=False)
        .agg(total_worker_days=("Quantidade", "sum"))
        .reset_index()
        .sort_values("Mes")
    )
    grouped["mes"] = grouped["Mes"]
    grouped["mes_nome"] = grouped["MesNome"].astype(str).str[:3]
    return grouped


def _forecast_from_series(
    values: list[float],
    horizon_months: int,
    budget_total: float | None = None,
) -> dict[str, Any]:
    if not values:
        return {
            "projected_final_cost": 0.0,
            "projected_monthly": [],
            "overrun_probability": 0.0,
            "estimated_completion_month": None,
            "confidence_interval_90": [0.0, 0.0],
            "method": "insufficient_data",
            "data_points_used": 0,
        }

    values = [float(value) for value in values]
    cumulative = np.cumsum(values)
    data_points = len(values)
    alpha = 0.3
    monthly_std = float(np.std(values)) if len(values) > 1 else 0.0
    z90 = 1.645

    if data_points < 3:
        avg = float(np.mean(values))
        projected_monthly = []
        running = float(cumulative[-1])
        for offset in range(1, horizon_months + 1):
            running += avg
            projected_monthly.append(
                {
                    "mes_offset": offset,
                    "valor_previsto": round(avg, 2),
                    "lower_bound": round(max(avg - monthly_std, 0), 2),
                    "upper_bound": round(avg + monthly_std, 2),
                    "projected_cumulative": round(running, 2),
                }
            )
        projected_final = float(cumulative[-1] + avg * horizon_months)
        return {
            "projected_final_cost": round(projected_final, 2),
            "projected_monthly": projected_monthly,
            "overrun_probability": 0.0 if budget_total in (None, 0) else float(projected_final > budget_total),
            "estimated_completion_month": None,
            "confidence_interval_90": [
                round(max(projected_final - monthly_std, 0), 2),
                round(projected_final + monthly_std, 2),
            ],
            "method": "insufficient_data",
            "data_points_used": data_points,
        }

    x = np.arange(1, data_points + 1)
    regression = linregress(x, cumulative)
    smoothed = values[0]
    for value in values[1:]:
        smoothed = alpha * value + (1 - alpha) * smoothed

    projected_monthly: list[dict[str, Any]] = []
    running_cumulative = float(cumulative[-1])
    projected_final = float(cumulative[-1])
    prediction_error = max(abs(float(regression.stderr or 0)) * max(data_points, 1), monthly_std, 1.0)

    for offset in range(1, horizon_months + 1):
        projected_cumulative = regression.intercept + regression.slope * (data_points + offset)
        previous_cumulative = regression.intercept + regression.slope * (data_points + offset - 1)
        linear_month = max(projected_cumulative - previous_cumulative, 0.0)
        smoothed = alpha * linear_month + (1 - alpha) * smoothed
        projected_final += smoothed
        running_cumulative += smoothed
        margin = z90 * max(prediction_error / math.sqrt(offset), monthly_std, 1.0)
        projected_monthly.append(
            {
                "mes_offset": offset,
                "valor_previsto": round(smoothed, 2),
                "lower_bound": round(max(smoothed - margin, 0), 2),
                "upper_bound": round(smoothed + margin, 2),
                "projected_cumulative": round(running_cumulative, 2),
            }
        )

    overrun_probability = 0.0
    estimated_completion_month = None
    if budget_total not in (None, 0):
        overrun_probability = float(norm.cdf((projected_final - budget_total) / prediction_error))
        rolling = float(cumulative[-1])
        for projected in projected_monthly:
            rolling += float(projected["valor_previsto"])
            if rolling >= float(budget_total):
                estimated_completion_month = f"+{projected['mes_offset']} meses"
                break

    final_margin = z90 * prediction_error
    return {
        "projected_final_cost": round(projected_final, 2),
        "projected_monthly": projected_monthly,
        "overrun_probability": round(min(max(overrun_probability, 0.0), 1.0), 4),
        "estimated_completion_month": estimated_completion_month,
        "confidence_interval_90": [
            round(max(projected_final - final_margin, 0), 2),
            round(projected_final + final_margin, 2),
        ],
        "method": "linear_regression",
        "data_points_used": data_points,
    }


@router.get("/api/analytics/{session_id}/executive-summary")
async def get_executive_summary(session_id: str) -> dict[str, Any]:
    nfs = _get_nfs_frame(session_id)
    total_realizado = float(nfs.get("valor", pd.Series(dtype=float)).fillna(0).sum()) if not nfs.empty else 0.0
    total_budget = _budget_total(session_id)
    saldo = total_budget - total_realizado
    pct_consumido = (total_realizado / total_budget * 100) if total_budget else 0.0
    reports = _quality_reports_for_session(session_id)
    quality_score = round(
        float(np.mean([float(report.get("completeness_pct", 0)) for report in reports])) if reports else 0.0,
        2,
    )
    dates = pd.to_datetime(nfs.get("data_vencimento"), errors="coerce", dayfirst=True) if not nfs.empty else pd.Series(dtype="datetime64[ns]")
    valid_dates = dates.dropna()
    return {
        "total_budget": round(total_budget, 2),
        "total_realizado": round(total_realizado, 2),
        "saldo": round(saldo, 2),
        "pct_consumido": round(pct_consumido, 2),
        "total_nfs": int(len(nfs)),
        "fornecedores_ativos": int(nfs.get("fornecedor", pd.Series(dtype=object)).nunique()) if not nfs.empty else 0,
        "meses_cobertos": int(valid_dates.dt.to_period("M").nunique()) if not valid_dates.empty else 0,
        "data_inicio": valid_dates.min().date().isoformat() if not valid_dates.empty else None,
        "data_fim": valid_dates.max().date().isoformat() if not valid_dates.empty else None,
        "risk_level": _risk_level(pct_consumido, 70, 85),
        "quality_score": quality_score,
    }


@router.get("/api/analytics/{session_id}/burn-rate")
async def get_burn_rate(session_id: str) -> list[dict[str, Any]]:
    nfs = _get_nfs_frame(session_id)
    monthly = _monthly_nfs(session_id)
    if monthly.empty:
        return []

    total_budget = _budget_total(session_id)
    monthly["valor_acumulado"] = monthly["valor_nfs"].cumsum()
    budget_step = total_budget / len(monthly) if len(monthly) else 0.0
    monthly["orcamento_acumulado"] = [budget_step * (index + 1) for index in range(len(monthly))]
    monthly["saldo_mes"] = monthly["orcamento_acumulado"] - monthly["valor_acumulado"]

    working = nfs[nfs["data_vencimento"].notna()].copy()
    working["mes_ref"] = working["data_vencimento"].dt.to_period("M").dt.to_timestamp()
    natureza_grouped = (
        working.groupby(["mes_ref", "natureza"], dropna=False)["valor"].sum().reset_index()
        if not working.empty
        else pd.DataFrame(columns=["mes_ref", "natureza", "valor"])
    )

    payload: list[dict[str, Any]] = []
    for _, row in monthly.iterrows():
        month_slice = natureza_grouped[natureza_grouped["mes_ref"] == row["mes_ref"]]
        by_natureza = [
            {"natureza": str(natureza or "Sem natureza"), "valor": round(float(valor or 0), 2)}
            for natureza, valor in month_slice[["natureza", "valor"]].itertuples(index=False, name=None)
        ]
        payload.append(
            {
                "mes": row["mes_ref"].date().isoformat(),
                "mes_nome": row["mes_nome"],
                "valor_nfs": round(float(row["valor_nfs"] or 0), 2),
                "valor_acumulado": round(float(row["valor_acumulado"] or 0), 2),
                "orcamento_acumulado": round(float(row["orcamento_acumulado"] or 0), 2),
                "saldo_mes": round(float(row["saldo_mes"] or 0), 2),
                "by_natureza": by_natureza,
            }
        )
    return payload


@router.get("/api/analytics/{session_id}/cost-by-natureza")
async def get_cost_by_natureza(session_id: str) -> list[dict[str, Any]]:
    nfs = _get_nfs_frame(session_id)
    if nfs.empty:
        return []
    total = float(nfs.get("valor", pd.Series(dtype=float)).fillna(0).sum())
    grouped = (
        nfs.groupby("natureza", dropna=False)
        .agg(valor_total=("valor", "sum"), count_nfs=("nf", "count"))
        .reset_index()
        .sort_values("valor_total", ascending=False)
    )
    return [
        {
            "natureza": str(row["natureza"] or "Sem natureza"),
            "valor_total": round(float(row["valor_total"] or 0), 2),
            "pct_total": round((float(row["valor_total"] or 0) / total) * 100, 2) if total else 0.0,
            "count_nfs": int(row["count_nfs"]),
        }
        for _, row in grouped.iterrows()
    ]


@router.get("/api/analytics/{session_id}/supplier-concentration")
async def get_supplier_concentration(session_id: str) -> dict[str, Any]:
    nfs = _get_nfs_frame(session_id)
    if nfs.empty:
        return {"top_10": [], "herfindahl_index": 0.0, "risk_level": "baixo"}

    grouped = (
        nfs.groupby("fornecedor", dropna=False)
        .agg(valor_total=("valor", "sum"), count_nfs=("nf", "count"))
        .reset_index()
        .sort_values("valor_total", ascending=False)
    )
    total = float(grouped["valor_total"].sum())
    grouped["share"] = grouped["valor_total"] / total if total else 0
    hhi = float((grouped["share"] ** 2).sum()) if total else 0.0
    top_10 = [
        {
            "fornecedor": str(row["fornecedor"] or "Sem fornecedor"),
            "valor_total": round(float(row["valor_total"] or 0), 2),
            "pct_total": round(float(row["share"] or 0) * 100, 2),
            "count_nfs": int(row["count_nfs"]),
        }
        for _, row in grouped.head(10).iterrows()
    ]
    return {
        "top_10": top_10,
        "herfindahl_index": round(hhi, 4),
        "risk_level": _risk_level(hhi, 0.15, 0.25),
    }


@router.get("/api/analytics/{session_id}/overdue")
async def get_overdue_nfs(session_id: str) -> list[dict[str, Any]]:
    nfs = _get_nfs_frame(session_id)
    if nfs.empty:
        return []
    today = pd.Timestamp.today().normalize()
    working = nfs[nfs["data_vencimento"].notna()].copy()
    status = working.get("situacao_planilha", pd.Series(dtype=object)).astype(str).str.upper()
    overdue = working[(working["data_vencimento"] < today) & (~status.str.contains("PAGO", na=False))].copy()
    if overdue.empty:
        return []
    overdue["days_overdue"] = (today - overdue["data_vencimento"]).dt.days
    overdue = overdue.sort_values("days_overdue", ascending=False)
    return [
        {
            "fornecedor": str(row.get("fornecedor", "") or ""),
            "nf": str(row.get("nf", "") or ""),
            "valor": round(float(row.get("valor", 0) or 0), 2),
            "data_vencimento": row["data_vencimento"].date().isoformat() if pd.notna(row["data_vencimento"]) else None,
            "days_overdue": int(row["days_overdue"]),
            "natureza": str(row.get("natureza", "") or ""),
        }
        for _, row in overdue.iterrows()
    ]


@router.get("/api/analytics/{session_id}/workforce-summary")
async def get_workforce_summary(session_id: str) -> list[dict[str, Any]]:
    efetivo = _get_efetivo_frame(session_id)
    if efetivo.empty:
        return []

    payload: list[dict[str, Any]] = []
    for mes, month_frame in efetivo.groupby("Mes", dropna=False):
        month_frame = month_frame.copy()
        total = float(month_frame["Quantidade"].sum())
        cargo_group = (
            month_frame.groupby("Funcao", dropna=False)["Quantidade"].sum().reset_index().sort_values("Quantidade", ascending=False)
        )
        fornecedor_group = (
            month_frame.groupby("Fornecedor", dropna=False)["Quantidade"].sum().reset_index().sort_values("Quantidade", ascending=False)
        )
        peak_by_day = month_frame.groupby("Dia", dropna=False)["Quantidade"].sum()
        peak_day = int(peak_by_day.idxmax()) if not peak_by_day.empty else 0
        peak_value = float(peak_by_day.max()) if not peak_by_day.empty else 0.0
        payload.append(
            {
                "mes": int(mes),
                "mes_nome": str(month_frame["MesNome"].iloc[0]),
                "total_worker_days": round(total, 2),
                "by_cargo": [
                    {"cargo": str(row["Funcao"] or "Nao informado"), "total": round(float(row["Quantidade"] or 0), 2)}
                    for _, row in cargo_group.iterrows()
                ],
                "by_fornecedor": [
                    {
                        "fornecedor": str(row["Fornecedor"] or "Nao informado"),
                        "total": round(float(row["Quantidade"] or 0), 2),
                    }
                    for _, row in fornecedor_group.iterrows()
                ],
                "peak_day": peak_day,
                "peak_value": round(peak_value, 2),
            }
        )
    return sorted(payload, key=lambda item: item["mes"])


@router.get("/api/analytics/{session_id}/cost-per-workerday")
async def get_cost_per_workerday(session_id: str) -> list[dict[str, Any]]:
    monthly_costs = _monthly_nfs(session_id)
    monthly_workforce = _monthly_workforce(session_id)
    if monthly_costs.empty or monthly_workforce.empty:
        return []

    merged = monthly_costs.merge(
        monthly_workforce[["mes", "mes_nome", "total_worker_days"]],
        on="mes",
        how="left",
    )
    payload = []
    for _, row in merged.iterrows():
        worker_days = float(row.get("total_worker_days", 0) or 0)
        valor_nfs = float(row.get("valor_nfs", 0) or 0)
        payload.append(
            {
                "mes": int(row["mes"]),
                "mes_nome": row["mes_nome"],
                "valor_nfs": round(valor_nfs, 2),
                "total_worker_days": round(worker_days, 2),
                "cost_per_workerday": round(valor_nfs / worker_days, 2) if worker_days else 0.0,
            }
        )
    return payload


@router.get("/api/analytics/{session_id}/forecast")
async def get_forecast(
    session_id: str,
    horizon_months: int = Query(3, ge=1, le=24),
) -> dict[str, Any]:
    monthly_costs = _monthly_nfs(session_id)
    if not monthly_costs.empty:
        values = monthly_costs["valor_nfs"].astype(float).tolist()
        forecast = _forecast_from_series(values, horizon_months, budget_total=_budget_total(session_id))
        forecast["mode"] = "cost"
        return forecast

    monthly_workforce = _monthly_workforce(session_id)
    values = monthly_workforce["total_worker_days"].astype(float).tolist()
    forecast = _forecast_from_series(values, horizon_months, budget_total=None)
    forecast["mode"] = "workforce"
    return forecast


@router.get("/api/sessions/merged/{session_ids_csv}")
async def get_merged_sessions(session_ids_csv: str) -> dict[str, Any]:
    session_ids = [session_id.strip() for session_id in session_ids_csv.split(",") if session_id.strip()]
    if not session_ids:
        raise HTTPException(status_code=400, detail="Nenhum session_id foi informado.")

    sessions = []
    for session_id in session_ids:
        session = get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
        sessions.append(session)

    merged = merge_sessions(sessions)
    return _json_safe(
        {
            "nfs": merged.nfs.to_dict(orient="records"),
            "orcamento": merged.orcamento.to_dict(orient="records"),
            "consolidado": merged.consolidado.to_dict(orient="records"),
            "efetivo": merged.efetivo.to_dict(orient="records"),
            "resumo": merged.resumo.to_dict(orient="records"),
            "quality_reports": merged.quality_reports,
            "schema_types": merged.schema_types,
            "date_range": [
                merged.date_range[0].isoformat() if merged.date_range[0] else None,
                merged.date_range[1].isoformat() if merged.date_range[1] else None,
            ],
            "obras": merged.obras,
            "fornecedores": merged.fornecedores,
        }
    )
