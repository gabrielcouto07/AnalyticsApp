from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split


def _normalize_text(value: Any) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", str(value or "").upper()).strip()


def _extract_code_tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[A-Z]{2,}\d+|[A-Z]{2,}|\d{3,}", _normalize_text(value))
        if len(token) >= 3
    }


def detect_common_project(efetivo_meta: dict, medicao_meta: dict) -> str | None:
    """
    Try to find a shared project identifier between two parsed files.
    """
    efetivo_obra = str(efetivo_meta.get("obra") or efetivo_meta.get("Obra") or "").strip()
    medicao_obra = str(medicao_meta.get("obra") or medicao_meta.get("Obra") or "").strip()
    if efetivo_obra and medicao_obra:
        score = SequenceMatcher(None, _normalize_text(efetivo_obra), _normalize_text(medicao_obra)).ratio()
        if score >= 0.8:
            return medicao_obra

    efetivo_name = str(efetivo_meta.get("filename") or efetivo_meta.get("arquivo_origem") or "").strip()
    medicao_name = str(medicao_meta.get("filename") or medicao_meta.get("arquivo_origem") or "").strip()
    common_codes = _extract_code_tokens(efetivo_name) & _extract_code_tokens(medicao_name)
    if common_codes:
        return sorted(common_codes)[0]
    return None


def _build_effective_month_rows(efetivo_df: pd.DataFrame) -> list[dict[str, Any]]:
    if efetivo_df.empty:
        return []

    working = efetivo_df.copy()
    if "tipo_valor" in working.columns:
        working = working[working["tipo_valor"] == "numero"].copy()
    if "quantidade_efetivo" in working.columns:
        working["quantidade_efetivo"] = pd.to_numeric(working["quantidade_efetivo"], errors="coerce").fillna(0)
    if "data" in working.columns:
        working["data"] = pd.to_datetime(working["data"], errors="coerce")
    if "mes" not in working.columns and "data" in working.columns:
        working["mes"] = working["data"].dt.strftime("%Y-%m")

    rows: list[dict[str, Any]] = []
    for mes, group in working.groupby("mes", dropna=False):
        label = str(mes or "")
        rows.append(
            {
                "mes": label,
                "total_diarias": round(float(group.get("quantidade_efetivo", pd.Series(dtype=float)).sum()), 2),
                "fornecedores": int(group.get("fornecedor", pd.Series(dtype=object)).nunique()),
                "funcoes_distintas": int(group.get("funcao", pd.Series(dtype=object)).nunique()),
            }
        )
    rows.sort(key=lambda item: item["mes"])
    return rows


def build_cross_dataset(efetivo_df: pd.DataFrame, medicao_data: dict[str, Any]) -> dict[str, Any]:
    medicao_summary = dict(medicao_data.get("summary") or {})
    medicao_meta = dict(medicao_data.get("metadata") or {})
    medicao_boletins = list(medicao_data.get("boletins") or [])
    efetivo_meta = {
        "obra": (
            efetivo_df["obra"].dropna().astype(str).iloc[0]
            if "obra" in efetivo_df.columns and not efetivo_df.empty
            else ""
        ),
        "filename": medicao_meta.get("efetivo_filename"),
    }
    projeto = detect_common_project(efetivo_meta, medicao_meta) or medicao_meta.get("obra") or efetivo_meta.get("obra") or ""

    efetivo_rows = _build_effective_month_rows(efetivo_df)
    dates = pd.to_datetime(efetivo_df.get("data"), errors="coerce") if "data" in efetivo_df.columns else pd.Series(dtype="datetime64[ns]")
    total_diarias = float(pd.to_numeric(efetivo_df.get("quantidade_efetivo"), errors="coerce").fillna(0).sum()) if "quantidade_efetivo" in efetivo_df.columns else 0.0
    meses_ativos = max(len(efetivo_rows), 0)
    custo_negociado = float(medicao_summary.get("custo_negociado") or 0.0)
    efetivo_working = efetivo_df.copy()
    if "data" in efetivo_working.columns:
        efetivo_working["data"] = pd.to_datetime(efetivo_working["data"], errors="coerce")
        efetivo_working["mes_ref"] = efetivo_working["data"].dt.strftime("%Y-%m")
    month_lookup: dict[str, dict[str, Any]] = {}
    if not efetivo_working.empty and "mes_ref" in efetivo_working.columns:
        monthly_group = (
            efetivo_working[efetivo_working.get("tipo_valor").fillna("") == "numero"]
            .groupby("mes_ref", dropna=False)
            .agg(
                total_diarias=("quantidade_efetivo", "sum"),
                fornecedores=("fornecedor", "nunique"),
                funcoes_distintas=("funcao", "nunique"),
                mes_nome=("mes", "first"),
            )
            .reset_index()
        )
        month_lookup = {
            str(row["mes_ref"]): {
                "mes": str(row["mes_nome"] or row["mes_ref"]),
                "total_diarias": round(float(row["total_diarias"] or 0), 2),
                "fornecedores": int(row["fornecedores"] or 0),
                "funcoes_distintas": int(row["funcoes_distintas"] or 0),
            }
            for _, row in monthly_group.iterrows()
            if pd.notna(row["mes_ref"])
        }

    rows: list[dict[str, Any]] = []
    source_granularity = "arquivo_total"
    boletins_with_month = [row for row in medicao_boletins if row.get("mes_ref")]
    if boletins_with_month:
        source_granularity = "boletim"
        for boletim in boletins_with_month:
            mes_ref = str(boletim.get("mes_ref"))
            efetivo_row = month_lookup.get(
                mes_ref,
                {"mes": mes_ref, "total_diarias": 0.0, "fornecedores": 0, "funcoes_distintas": 0},
            )
            rows.append(
                {
                    "mes": efetivo_row["mes"],
                    "mes_ref": mes_ref,
                    "total_diarias": efetivo_row["total_diarias"],
                    "fornecedores": efetivo_row["fornecedores"],
                    "funcoes_distintas": efetivo_row["funcoes_distintas"],
                    "custo_projeto_negociado": float(boletim.get("total") or 0.0),
                    "valor_total_boletim": float(boletim.get("valor_total_boletim") or boletim.get("total") or 0.0),
                    "boletim": boletim.get("bm_numero") or boletim.get("sheet_name"),
                }
            )
    else:
        rows = [
            {
                "mes": row["mes"],
                "total_diarias": row["total_diarias"],
                "fornecedores": row["fornecedores"],
                "funcoes_distintas": row["funcoes_distintas"],
                "custo_projeto_negociado": custo_negociado,
                "valor_total_boletim": None,
            }
            for row in efetivo_rows
        ]

    distinct_cost_points = {
        round(float(row.get("custo_projeto_negociado") or 0.0), 2)
        for row in rows
        if row.get("custo_projeto_negociado") is not None
    }

    return {
        "projeto": str(projeto),
        "periodo": {
            "inicio": dates.min().date().isoformat() if not dates.empty and dates.notna().any() else None,
            "fim": dates.max().date().isoformat() if not dates.empty and dates.notna().any() else None,
            "meses_ativos": meses_ativos,
        },
        "efetivo_por_mes": efetivo_rows,
        "custo_projeto_inicial": float(medicao_summary.get("custo_inicial") or 0.0),
        "custo_projeto_negociado": custo_negociado,
        "desconto_percentual": float(medicao_summary.get("desconto_pct") or 0.0),
        "classificacao_variacao": medicao_summary.get("classificacao_variacao"),
        "ratio_custo_por_diaria": round(custo_negociado / total_diarias, 4) if total_diarias else 0.0,
        "ratio_custo_por_mes": round(custo_negociado / meses_ativos, 4) if meses_ativos else 0.0,
        "rows": rows,
        "columns": list(rows[0].keys()) if rows else ["mes", "total_diarias", "fornecedores", "funcoes_distintas", "custo_projeto_negociado"],
        "source_granularity": source_granularity,
        "ready_for_regression": len(rows) >= 6 and len(distinct_cost_points) >= 2 and custo_negociado > 0,
    }


def run_cross_regression(dataset: dict) -> dict:
    """
    Run a safe regression only when there are enough observations.
    """
    rows = dataset.get("rows") or []
    observations = len(rows)
    base_response = {
        "regression_available": False,
        "reason": "insufficient_observations",
        "message": "Sao necessarias pelo menos 6 observacoes independentes para regressao robusta.",
        "model_type": "none",
        "r2": None,
        "mae": None,
        "coefficients": None,
        "feature_importances": None,
        "prediction_next_month": None,
        "confidence_interval": None,
        "dataset_prepared": bool(rows),
        "observations_available": observations,
    }
    if observations < 6:
        return base_response

    frame = pd.DataFrame(rows)
    if frame.empty or "total_diarias" not in frame.columns or "custo_projeto_negociado" not in frame.columns:
        return base_response

    if frame["custo_projeto_negociado"].nunique() < 2:
        response = dict(base_response)
        response["reason"] = "single_cost_point"
        response["message"] = (
            "O custo do arquivo ainda funciona como ponto unico. Isso permite comparacao descritiva, "
            "mas nao sustenta regressao confiavel."
        )
        return response

    feature_columns = ["total_diarias", "fornecedores", "funcoes_distintas"]
    X = frame[feature_columns].fillna(0)
    y = frame["custo_projeto_negociado"].fillna(0)

    if observations >= 10:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    else:
        X_train, X_test, y_train, y_test = X, X, y, y

    model = LinearRegression()
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    next_features = X.iloc[[-1]].copy()
    next_features["total_diarias"] = float(X["total_diarias"].mean())
    next_prediction = float(model.predict(next_features)[0])
    residuals = np.abs(y_test - predictions)
    margin = float(residuals.mean()) if len(residuals) else 0.0

    coefficients = {
        feature: round(float(value), 6)
        for feature, value in zip(feature_columns, model.coef_)
    }
    importances = {
        feature: round(abs(float(value)), 6)
        for feature, value in zip(feature_columns, model.coef_)
    }
    return {
        "regression_available": True,
        "reason": None,
        "message": "Regressao calculada com observacoes suficientes para leitura exploratoria.",
        "model_type": "multiple" if len(feature_columns) > 1 else "linear",
        "r2": round(float(r2_score(y_test, predictions)), 6),
        "mae": round(float(mean_absolute_error(y_test, predictions)), 6),
        "coefficients": coefficients,
        "feature_importances": importances,
        "prediction_next_month": round(next_prediction, 2),
        "confidence_interval": [round(next_prediction - margin, 2), round(next_prediction + margin, 2)],
        "dataset_prepared": True,
        "observations_available": observations,
    }
