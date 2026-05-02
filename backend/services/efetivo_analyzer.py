from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def _canonicalize_efetivo_frame(dataframe: pd.DataFrame) -> pd.DataFrame:
    if dataframe.empty:
        return pd.DataFrame(
            columns=[
                "obra",
                "mes",
                "mes_num",
                "dia",
                "data",
                "fornecedor",
                "funcao",
                "quantidade_efetivo",
                "tipo_valor",
                "observacao",
            ]
        )

    aliases = {
        "obra": ["obra", "Obra"],
        "mes": ["mes", "MesNome"],
        "mes_num": ["mes_num", "Mes"],
        "dia": ["dia", "Dia"],
        "data": ["data", "Data"],
        "fornecedor": ["fornecedor", "Fornecedor"],
        "funcao": ["funcao", "Funcao", "Cargo/Função", "Cargo/Funcao"],
        "quantidade_efetivo": ["quantidade_efetivo", "Quantidade"],
        "tipo_valor": ["tipo_valor"],
        "observacao": ["observacao"],
    }
    normalized = pd.DataFrame()
    for target, candidates in aliases.items():
        for candidate in candidates:
            if candidate in dataframe.columns:
                normalized[target] = dataframe[candidate]
                break
        else:
            normalized[target] = pd.NA

    normalized["data"] = pd.to_datetime(normalized["data"], errors="coerce")
    normalized["mes_num"] = pd.to_numeric(normalized["mes_num"], errors="coerce")
    normalized["dia"] = pd.to_numeric(normalized["dia"], errors="coerce")
    normalized["quantidade_efetivo"] = pd.to_numeric(normalized["quantidade_efetivo"], errors="coerce")
    if normalized["tipo_valor"].isna().all():
        normalized["tipo_valor"] = normalized["quantidade_efetivo"].apply(
            lambda value: "numero" if pd.notna(value) and value > 0 else "zero" if pd.notna(value) and value == 0 else "vazio"
        )
    return normalized


class EfetivoAnalyzer:
    def __init__(self, df: pd.DataFrame):
        self.df = _canonicalize_efetivo_frame(df)

    def _numeric_rows(self) -> pd.DataFrame:
        working = self.df.copy()
        working = working[working["tipo_valor"] == "numero"].copy()
        working["quantidade_efetivo"] = working["quantidade_efetivo"].fillna(0)
        return working

    def _all_rows(self) -> pd.DataFrame:
        working = self.df.copy()
        working["quantidade_efetivo"] = working["quantidade_efetivo"].fillna(0)
        return working

    def get_summary(self) -> dict[str, Any]:
        numeric = self._numeric_rows()
        daily_totals = (
            numeric.groupby("data", dropna=False)["quantidade_efetivo"].sum().reset_index(name="total")
            if not numeric.empty
            else pd.DataFrame(columns=["data", "total"])
        )
        total_diarias = float(numeric["quantidade_efetivo"].sum()) if not numeric.empty else 0.0
        dias_ativos = int(daily_totals[daily_totals["total"] > 0]["data"].nunique()) if not daily_totals.empty else 0
        media_diaria = float(daily_totals["total"].mean()) if not daily_totals.empty else 0.0
        pico_diario = float(daily_totals["total"].max()) if not daily_totals.empty else 0.0
        return {
            "total_diarias": round(total_diarias, 2),
            "fornecedores_ativos": int(numeric["fornecedor"].nunique()) if not numeric.empty else 0,
            "funcoes_distintas": int(numeric["funcao"].nunique()) if not numeric.empty else 0,
            "dias_ativos": dias_ativos,
            "media_diaria": round(media_diaria, 2),
            "pico_diario": round(pico_diario, 2),
            "efetivo_por_mes": self.get_monthly_totals(),
            "top_fornecedores": self.get_top_fornecedores(),
            "unique_fornecedores": int(numeric["fornecedor"].nunique()) if not numeric.empty else 0,
            "unique_funcoes": int(numeric["funcao"].nunique()) if not numeric.empty else 0,
            "obra": str(numeric["obra"].dropna().astype(str).iloc[0]) if not numeric.empty else "",
            "ano": int(numeric["data"].dt.year.mode().iloc[0]) if not numeric.empty and numeric["data"].notna().any() else 0,
            "meses_cobertos": int(numeric["mes"].nunique()) if not numeric.empty else 0,
            "data_quality": {
                "fornecedores": sorted(numeric["fornecedor"].dropna().astype(str).unique().tolist()) if not numeric.empty else [],
                "funcoes": sorted(numeric["funcao"].dropna().astype(str).unique().tolist()) if not numeric.empty else [],
            },
        }

    def get_monthly_totals(self) -> list[dict[str, Any]]:
        numeric = self._numeric_rows()
        if numeric.empty:
            return []
        grouped = (
            numeric.groupby(["mes_num", "mes"], dropna=False)["quantidade_efetivo"]
            .sum()
            .reset_index()
            .sort_values(["mes_num", "mes"])
        )
        return [
            {
                "mes": str(row["mes"]),
                "mes_num": int(row["mes_num"]) if pd.notna(row["mes_num"]) else None,
                "total": round(float(row["quantidade_efetivo"]), 2),
            }
            for _, row in grouped.iterrows()
        ]

    def get_top_fornecedores(self, limit: int = 5) -> list[dict[str, Any]]:
        numeric = self._numeric_rows()
        if numeric.empty:
            return []
        grouped = (
            numeric.groupby("fornecedor", dropna=False)["quantidade_efetivo"]
            .sum()
            .reset_index()
            .sort_values("quantidade_efetivo", ascending=False)
            .head(limit)
        )
        return [
            {"fornecedor": str(row["fornecedor"] or "Nao informado"), "total": round(float(row["quantidade_efetivo"]), 2)}
            for _, row in grouped.iterrows()
        ]

    def get_by_supplier(self) -> list[dict[str, Any]]:
        numeric = self._numeric_rows()
        if numeric.empty:
            return []
        total = float(numeric["quantidade_efetivo"].sum())
        grouped = (
            numeric.groupby("fornecedor", dropna=False)
            .agg(
                total_diarias=("quantidade_efetivo", "sum"),
                meses_ativos=("mes", "nunique"),
                funcoes=("funcao", lambda series: sorted(series.dropna().astype(str).unique().tolist())),
            )
            .reset_index()
            .sort_values("total_diarias", ascending=False)
        )
        return [
            {
                "fornecedor": str(row["fornecedor"] or "Nao informado"),
                "total_diarias": round(float(row["total_diarias"]), 2),
                "meses_ativos": int(row["meses_ativos"]),
                "funcoes": row["funcoes"],
                "pct_total": round((float(row["total_diarias"]) / total) * 100, 2) if total else 0.0,
            }
            for _, row in grouped.iterrows()
        ]

    def get_by_function(self) -> list[dict[str, Any]]:
        numeric = self._numeric_rows()
        if numeric.empty:
            return []
        total = float(numeric["quantidade_efetivo"].sum())
        grouped = (
            numeric.groupby("funcao", dropna=False)
            .agg(
                total_diarias=("quantidade_efetivo", "sum"),
                fornecedores=("fornecedor", lambda series: sorted(series.dropna().astype(str).unique().tolist())),
            )
            .reset_index()
            .sort_values("total_diarias", ascending=False)
        )
        return [
            {
                "funcao": str(row["funcao"] or "Nao informado"),
                "total_diarias": round(float(row["total_diarias"]), 2),
                "fornecedores": row["fornecedores"],
                "pct_total": round((float(row["total_diarias"]) / total) * 100, 2) if total else 0.0,
            }
            for _, row in grouped.iterrows()
        ]

    def get_monthly_evolution(self) -> list[dict[str, Any]]:
        numeric = self._numeric_rows()
        if numeric.empty:
            return []
        rows: list[dict[str, Any]] = []
        for (mes_num, mes), group in numeric.groupby(["mes_num", "mes"], dropna=False):
            by_supplier = (
                group.groupby("fornecedor", dropna=False)["quantidade_efetivo"]
                .sum()
                .reset_index()
                .sort_values("quantidade_efetivo", ascending=False)
            )
            rows.append(
                {
                    "mes": str(mes),
                    "mes_num": int(mes_num) if pd.notna(mes_num) else None,
                    "total": round(float(group["quantidade_efetivo"].sum()), 2),
                    "by_fornecedor": [
                        {"fornecedor": str(item["fornecedor"] or "Nao informado"), "total": round(float(item["quantidade_efetivo"]), 2)}
                        for _, item in by_supplier.iterrows()
                    ],
                }
            )
        rows.sort(key=lambda item: item["mes_num"] or 0)
        return rows

    def get_calendar_heatmap(self) -> list[dict[str, Any]]:
        all_rows = self._all_rows()
        if all_rows.empty:
            return []
        cells: list[dict[str, Any]] = []
        grouped = all_rows.groupby(["mes", "dia", "data", "tipo_valor"], dropna=False)["quantidade_efetivo"].sum().reset_index()
        for _, row in grouped.iterrows():
            cells.append(
                {
                    "mes": str(row["mes"]),
                    "dia": int(row["dia"]) if pd.notna(row["dia"]) else None,
                    "data": row["data"].date().isoformat() if pd.notna(row["data"]) else None,
                    "total": round(float(row["quantidade_efetivo"] or 0), 2),
                    "tipo": str(row["tipo_valor"]),
                }
            )
        return cells

    def get_detail(self) -> list[dict[str, Any]]:
        rows = self._all_rows().sort_values(["data", "fornecedor", "funcao", "dia"], na_position="last")
        payload: list[dict[str, Any]] = []
        for _, row in rows.iterrows():
            payload.append(
                {
                    "mes": str(row["mes"]),
                    "dia": int(row["dia"]) if pd.notna(row["dia"]) else None,
                    "data": row["data"].date().isoformat() if pd.notna(row["data"]) else None,
                    "fornecedor": str(row["fornecedor"] or ""),
                    "funcao": str(row["funcao"] or ""),
                    "quantidade_efetivo": float(row["quantidade_efetivo"]) if pd.notna(row["quantidade_efetivo"]) else None,
                    "tipo_valor": str(row["tipo_valor"]),
                    "observacao": None if pd.isna(row["observacao"]) else str(row["observacao"]),
                }
            )
        return payload

    def get_monthly_breakdown(self) -> list[dict[str, Any]]:
        numeric = self._numeric_rows()
        if numeric.empty:
            return []
        rows: list[dict[str, Any]] = []
        for (mes_num, mes), group in numeric.groupby(["mes_num", "mes"], dropna=False):
            pivot = (
                group.groupby(["dia", "fornecedor"], dropna=False)["quantidade_efetivo"]
                .sum()
                .reset_index()
                .pivot(index="dia", columns="fornecedor", values="quantidade_efetivo")
                .fillna(0)
                .reset_index()
                .sort_values("dia")
            )
            detail = group.groupby(["dia", "obra", "fornecedor", "funcao"], dropna=False)["quantidade_efetivo"].sum().reset_index()
            rows.append(
                {
                    "mes": int(mes_num) if pd.notna(mes_num) else 0,
                    "mes_nome": str(mes),
                    "fornecedores": sorted(group["fornecedor"].dropna().astype(str).unique().tolist()),
                    "daily_pivot": pivot.rename(columns={"dia": "Dia"}).to_dict(orient="records"),
                    "funcao_detail": [
                        {
                            "dia": int(item["dia"]) if pd.notna(item["dia"]) else None,
                            "obra": str(item["obra"] or ""),
                            "fornecedor": str(item["fornecedor"] or ""),
                            "funcao": str(item["funcao"] or ""),
                            "quantidade": float(item["quantidade_efetivo"]),
                        }
                        for _, item in detail.iterrows()
                    ],
                }
            )
        rows.sort(key=lambda item: item["mes"])
        return rows

    def get_daily_timeline(self) -> list[dict[str, Any]]:
        numeric = self._numeric_rows()
        if numeric.empty:
            return []

        grouped = (
            numeric.groupby("data", dropna=False)
            .agg(
                total_trabalhadores=("quantidade_efetivo", "sum"),
                fornecedores=("fornecedor", "nunique"),
                funcoes=("funcao", "nunique"),
            )
            .reset_index()
            .sort_values("data")
        )

        return [
            {
                "data": row["data"].date().isoformat() if pd.notna(row["data"]) else None,
                "total_trabalhadores": round(float(row["total_trabalhadores"]), 2),
                "fornecedores": int(row["fornecedores"]),
                "funcoes": int(row["funcoes"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_consolidated_report(self) -> dict[str, Any]:
        return {
            "summary": self.get_summary(),
            "fornecedor_analysis": self.get_by_supplier(),
            "funcao_analysis": self.get_by_function(),
            "monthly_analysis": self.get_monthly_evolution(),
            "daily_timeline": self.get_calendar_heatmap(),
            "daily_by_fornecedor": [],
            "media_diaria_by_fornecedor": [],
            "top_servicos": [],
            "matrix": {},
            "por_obra": {},
        }


def get_efetivo_summary(source: pd.DataFrame | str | Path) -> dict[str, Any]:
    if isinstance(source, pd.DataFrame):
        dataframe = source.copy()
    else:
        from .efetivo_parser import parse_efetivo_file

        path = Path(source)
        dataframe = parse_efetivo_file(path.read_bytes(), path.name)
    return EfetivoAnalyzer(dataframe).get_summary()
