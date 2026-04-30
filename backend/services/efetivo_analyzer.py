"""
Efetivo analytics service for parsed workforce-control data.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


OTHERS_KEY = "Outros"


def _resolve_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Resolve a column name from common Efetivo aliases."""
    normalized = {str(column).strip().lower(): str(column) for column in df.columns}
    for candidate in candidates:
        key = candidate.strip().lower()
        if key in normalized:
            return normalized[key]
    return None


class EfetivoAnalyzer:
    """Specialized analyzer for Efetivo (Controle de Efetivo) data."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self._ensure_types()

    def _ensure_types(self) -> None:
        if "Quantidade" in self.df.columns:
            self.df["Quantidade"] = pd.to_numeric(self.df["Quantidade"], errors="coerce").fillna(0)
        if "DiariasTotal" in self.df.columns:
            self.df["DiariasTotal"] = pd.to_numeric(self.df["DiariasTotal"], errors="coerce").fillna(0)
        if "Data" in self.df.columns:
            self.df["Data"] = pd.to_datetime(self.df["Data"], errors="coerce")
        if "Dia" in self.df.columns:
            self.df["Dia"] = pd.to_numeric(self.df["Dia"], errors="coerce").fillna(0).astype(int)
        if "Mes" in self.df.columns:
            self.df["Mes"] = pd.to_numeric(self.df["Mes"], errors="coerce").fillna(0).astype(int)

    def _work_df(self) -> pd.DataFrame:
        if "Quantidade" not in self.df.columns:
            return pd.DataFrame(columns=self.df.columns)
        return self.df[self.df["Quantidade"] > 0].copy()

    @staticmethod
    def _string_list(series: pd.Series) -> list[str]:
        return sorted(series.dropna().astype(str).map(str.strip).replace("", pd.NA).dropna().unique().tolist())

    def get_summary(self) -> dict[str, Any]:
        df_w = self._work_df()
        total_diarias = float(df_w.get("Quantidade", pd.Series(dtype=float)).sum())
        unique_position_cols = [
            column
            for column in [
                _resolve_column(df_w, ["Filial/Obra", "Obra"]),
                _resolve_column(df_w, ["Fornecedor"]),
                _resolve_column(df_w, ["Cargo/Função", "Cargo/Funcao", "Funcao"]),
                _resolve_column(df_w, ["Período", "Periodo"]),
            ]
            if column is not None
        ]
        total_funcionarios = (
            int(df_w.drop_duplicates(subset=unique_position_cols).shape[0])
            if len(unique_position_cols) >= 4
            else 0
        )
        total_fornecedores = int(df_w["Fornecedor"].nunique()) if "Fornecedor" in df_w.columns else 0
        total_funcoes = int(self.df["Funcao"].nunique()) if "Funcao" in self.df.columns else 0
        dias_ativos = int(df_w["Data"].nunique()) if "Data" in df_w.columns else 0
        media_diaria = total_diarias / dias_ativos if dias_ativos > 0 else 0.0
        obra = str(self.df["Obra"].iloc[0]) if "Obra" in self.df.columns and not self.df.empty else ""
        ano = int(self.df["Ano"].iloc[0]) if "Ano" in self.df.columns and not self.df.empty else 0

        return {
            "total_diarias": round(total_diarias, 1),
            "total_funcionarios": total_funcionarios,
            "total_fornecedores": total_fornecedores,
            "total_funcoes": total_funcoes,
            "unique_fornecedores": total_fornecedores,
            "unique_funcoes": total_funcoes,
            "dias_ativos": dias_ativos,
            "media_diaria": round(media_diaria, 1),
            "obra": obra,
            "ano": ano,
            "meses_cobertos": int(self.df["Mes"].nunique()) if "Mes" in self.df.columns else 0,
            "data_quality": {
                "total_rows": len(self.df),
                "work_rows": len(df_w),
                "fornecedores": self._string_list(self.df["Fornecedor"]) if "Fornecedor" in self.df.columns else [],
                "funcoes": self._string_list(self.df["Funcao"]) if "Funcao" in self.df.columns else [],
            },
        }

    def get_fornecedor_analysis(self) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Fornecedor" not in df_w.columns:
            return []

        agg = (
            df_w.groupby("Fornecedor")
            .agg(
                total_diarias=("Quantidade", "sum"),
                funcoes_count=("Funcao", "nunique"),
                dias_ativos=("Data", "nunique"),
                media_por_dia=("Quantidade", "mean"),
            )
            .reset_index()
            .sort_values("total_diarias", ascending=False)
        )
        return [
            {
                "fornecedor": str(row["Fornecedor"]),
                "total_diarias": round(float(row["total_diarias"]), 1),
                "funcoes_count": int(row["funcoes_count"]),
                "dias_ativos": int(row["dias_ativos"]),
                "media_por_dia": round(float(row["media_por_dia"]), 2),
            }
            for _, row in agg.iterrows()
        ]

    def get_funcao_analysis(self) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Funcao" not in df_w.columns:
            return []

        agg = (
            df_w.groupby("Funcao")
            .agg(
                total_diarias=("Quantidade", "sum"),
                fornecedores_count=("Fornecedor", "nunique"),
                dias_ativos=("Data", "nunique"),
            )
            .reset_index()
            .sort_values("total_diarias", ascending=False)
        )
        return [
            {
                "funcao": str(row["Funcao"]),
                "total_diarias": round(float(row["total_diarias"]), 1),
                "fornecedores_count": int(row["fornecedores_count"]),
                "dias_ativos": int(row["dias_ativos"]),
            }
            for _, row in agg.iterrows()
        ]

    def get_monthly_analysis(self) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Mes" not in df_w.columns:
            return []

        agg = (
            df_w.groupby(["Mes", "MesNome"])
            .agg(
                total_diarias=("Quantidade", "sum"),
                fornecedores=("Fornecedor", "nunique"),
                funcoes=("Funcao", "nunique"),
                dias_ativos=("Data", "nunique"),
            )
            .reset_index()
            .sort_values("Mes")
        )
        return [
            {
                "mes": int(row["Mes"]),
                "mes_nome": str(row["MesNome"]),
                "total_diarias": round(float(row["total_diarias"]), 1),
                "fornecedores": int(row["fornecedores"]),
                "funcoes": int(row["funcoes"]),
                "dias_ativos": int(row["dias_ativos"]),
            }
            for _, row in agg.iterrows()
        ]

    def get_daily_timeline(self) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Data" not in df_w.columns:
            return []

        daily = (
            df_w.groupby("Data")
            .agg(
                total_trabalhadores=("Quantidade", "sum"),
                fornecedores=("Fornecedor", "nunique"),
                funcoes=("Funcao", "nunique"),
            )
            .reset_index()
            .sort_values("Data")
        )
        return [
            {
                "data": str(row["Data"].date()),
                "total_trabalhadores": round(float(row["total_trabalhadores"]), 1),
                "fornecedores": int(row["fornecedores"]),
                "funcoes": int(row["funcoes"]),
            }
            for _, row in daily.iterrows()
        ]

    def get_fornecedor_funcao_matrix(self) -> dict[str, Any]:
        df_w = self._work_df()
        if df_w.empty:
            return {"fornecedores": [], "funcoes": [], "matrix": []}

        pivot = df_w.pivot_table(
            index="Fornecedor",
            columns="Funcao",
            values="Quantidade",
            aggfunc="sum",
            fill_value=0,
        )
        return {
            "fornecedores": pivot.index.tolist(),
            "funcoes": pivot.columns.tolist(),
            "matrix": pivot.values.tolist(),
        }

    def get_top_servicos(self, limit: int = 20) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty:
            return []

        agg = (
            df_w.groupby(["Fornecedor", "Funcao"])
            .agg(total_diarias=("Quantidade", "sum"), dias_ativos=("Data", "nunique"))
            .reset_index()
            .sort_values("total_diarias", ascending=False)
            .head(limit)
        )
        return [
            {
                "fornecedor": str(row["Fornecedor"]),
                "funcao": str(row["Funcao"]),
                "total_diarias": round(float(row["total_diarias"]), 1),
                "dias_ativos": int(row["dias_ativos"]),
            }
            for _, row in agg.iterrows()
        ]

    def get_daily_by_fornecedor(self) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Dia" not in df_w.columns or "Fornecedor" not in df_w.columns:
            return []

        pivot = (
            df_w.groupby(["Dia", "Fornecedor"])["Quantidade"]
            .sum()
            .reset_index()
            .pivot(index="Dia", columns="Fornecedor", values="Quantidade")
            .fillna(0)
            .reset_index()
            .sort_values("Dia")
        )
        pivot.columns.name = None
        return pivot.to_dict(orient="records")

    def get_all_rows(self) -> list[dict[str, Any]]:
        if self.df.empty:
            return []

        rows: list[dict[str, Any]] = []
        for _, row in self.df.iterrows():
            data_val = row.get("Data")
            rows.append(
                {
                    "obra": str(row.get("Obra", "")),
                    "ano": int(row["Ano"]) if pd.notna(row.get("Ano")) else None,
                    "mes": int(row["Mes"]) if pd.notna(row.get("Mes")) else None,
                    "mes_nome": str(row.get("MesNome", "")),
                    "fornecedor": str(row.get("Fornecedor", "")),
                    "funcao": str(row.get("Funcao", "")),
                    "dia": int(row["Dia"]) if pd.notna(row.get("Dia")) else None,
                    "quantidade": round(float(row.get("Quantidade", 0)), 1) if pd.notna(row.get("Quantidade")) else 0,
                    "diarias_total": round(float(row.get("DiariasTotal", 0)), 1)
                    if pd.notna(row.get("DiariasTotal"))
                    else 0,
                    "data": str(data_val.date()) if pd.notna(data_val) else "",
                    "dia_semana": str(row.get("DiaSemana", "")),
                    "periodo": str(row.get("Periodo", "")),
                    "fornecedor_funcao": str(row.get("FornecedorFuncao", "")),
                    "trabalhou": int(row.get("Trabalhou", 0)) if pd.notna(row.get("Trabalhou")) else 0,
                }
            )
        return rows

    def get_media_diaria_by_fornecedor(self) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Fornecedor" not in df_w.columns:
            return []

        result: list[dict[str, Any]] = []
        for fornecedor in sorted(df_w["Fornecedor"].dropna().astype(str).unique().tolist()):
            df_fornecedor = df_w[df_w["Fornecedor"] == fornecedor]
            dias_ativos = int(df_fornecedor["Dia"].nunique())
            total = float(df_fornecedor["Quantidade"].sum())
            media = round(total / dias_ativos, 2) if dias_ativos > 0 else 0.0
            by_day = df_fornecedor.groupby("Dia")["Quantidade"].sum().reset_index().sort_values("Dia")
            positive_days = by_day[by_day["Quantidade"] > 0]

            result.append(
                {
                    "fornecedor": fornecedor,
                    "total_diarias": round(total, 1),
                    "dias_ativos": dias_ativos,
                    "media_diaria": media,
                    "max_dia": round(float(by_day["Quantidade"].max()), 1) if not by_day.empty else 0,
                    "min_dia": round(float(positive_days["Quantidade"].min()), 1) if not positive_days.empty else 0,
                    "by_day": by_day.rename(columns={"Quantidade": "total"}).to_dict(orient="records"),
                }
            )
        return result

    def get_monthly_breakdown(self) -> list[dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Mes" not in df_w.columns:
            return []

        result: list[dict[str, Any]] = []
        for mes_num in sorted(df_w["Mes"].unique()):
            df_month = df_w[df_w["Mes"] == mes_num].copy()
            mes_nome = str(df_month["MesNome"].iloc[0]) if "MesNome" in df_month.columns else str(mes_num)
            fornecedores = sorted(df_month["Fornecedor"].dropna().astype(str).unique().tolist())
            pivot = (
                df_month.groupby(["Dia", "Fornecedor"])["Quantidade"]
                .sum()
                .reset_index()
                .pivot(index="Dia", columns="Fornecedor", values="Quantidade")
                .fillna(0)
                .reset_index()
                .sort_values("Dia")
            )
            pivot.columns.name = None

            group_columns = [column for column in ["Dia", "Obra", "Fornecedor", "Funcao"] if column in df_month.columns]
            funcao_agg = df_month.groupby(group_columns)["Quantidade"].sum().reset_index().sort_values(["Dia", "Fornecedor"])
            funcao_rows = [
                {
                    "dia": int(row["Dia"]),
                    "obra": str(row["Obra"]) if "Obra" in row else "",
                    "fornecedor": str(row["Fornecedor"]) if "Fornecedor" in row else "",
                    "funcao": str(row["Funcao"]) if "Funcao" in row else "",
                    "quantidade": float(row["Quantidade"]),
                }
                for _, row in funcao_agg.iterrows()
            ]

            result.append(
                {
                    "mes": int(mes_num),
                    "mes_nome": mes_nome,
                    "fornecedores": fornecedores,
                    "daily_pivot": pivot.to_dict(orient="records"),
                    "funcao_detail": funcao_rows,
                }
            )
        return result

    def get_por_obra_data(self) -> dict[str, Any]:
        df_w = self._work_df()
        if df_w.empty:
            return {"obras": [], "cargo_por_mes": [], "evolucao_por_obra": []}

        working = df_w.copy()
        working["Obra"] = working.get("Obra", pd.Series(dtype=object)).fillna("").astype(str).str.strip()
        working["Obra"] = working["Obra"].replace("", "Obra nao identificada")
        working["Funcao"] = working.get("Funcao", pd.Series(dtype=object)).fillna("").astype(str).str.strip()
        working["Funcao"] = working["Funcao"].replace("", "Nao informado")

        obras = (
            working.groupby("Obra")
            .agg(total_diarias=("Quantidade", "sum"), meses=("Mes", "nunique"))
            .reset_index()
            .sort_values("total_diarias", ascending=False)
        )

        cargo_totals = (
            working.groupby("Funcao")["Quantidade"].sum().reset_index().sort_values("Quantidade", ascending=False)
        )
        top_cargos = cargo_totals.head(8)["Funcao"].tolist()

        cargo_por_mes = (
            working.groupby(["MesNome", "Mes", "Funcao"])["Quantidade"]
            .sum()
            .reset_index()
            .assign(cargo=lambda frame: frame["Funcao"].where(frame["Funcao"].isin(top_cargos), OTHERS_KEY))
            .groupby(["MesNome", "Mes", "cargo"], as_index=False)["Quantidade"]
            .sum()
            .sort_values(["Mes", "cargo"])
        )

        evolucao_por_obra = (
            working.groupby(["MesNome", "Mes", "Obra"])["Quantidade"]
            .sum()
            .reset_index()
            .sort_values(["Mes", "Obra"])
        )

        return {
            "obras": [
                {
                    "obra": str(row["Obra"]),
                    "total_diarias": round(float(row["total_diarias"]), 1),
                    "meses": int(row["meses"]),
                }
                for _, row in obras.iterrows()
            ],
            "cargo_por_mes": [
                {
                    "mes": str(row["MesNome"]),
                    "mes_num": int(row["Mes"]),
                    "cargo": str(row["cargo"]),
                    "diarias": round(float(row["Quantidade"]), 1),
                }
                for _, row in cargo_por_mes.iterrows()
            ],
            "evolucao_por_obra": [
                {
                    "mes": str(row["MesNome"]),
                    "obra": str(row["Obra"]),
                    "diarias": round(float(row["Quantidade"]), 1),
                }
                for _, row in evolucao_por_obra.iterrows()
            ],
        }

    def get_por_obra_summary(self) -> dict[str, Any]:
        """Retorna métricas consolidadas de Efetivo por obra."""
        df_w = self._work_df()
        if df_w.empty:
            return {"obras": [], "total_geral": {"headcount": 0, "total_diarias": 0.0}}

        working = df_w.copy()
        obra_col = _resolve_column(working, ["Filial/Obra", "Obra"])
        fornecedor_col = _resolve_column(working, ["Fornecedor"])
        cargo_col = _resolve_column(working, ["Cargo/Função", "Cargo/Funcao", "Funcao"])
        periodo_col = _resolve_column(working, ["Período", "Periodo"])
        dia_col = _resolve_column(working, ["Dia", "Data"])

        if obra_col is None:
            working["Obra"] = "Obra nao identificada"
            obra_col = "Obra"

        obras: list[dict[str, Any]] = []
        total_headcount = 0
        total_diarias = 0.0
        for obra, group in working.groupby(obra_col, dropna=False):
            unique_cols = [column for column in [fornecedor_col, cargo_col, periodo_col] if column is not None]
            headcount = int(group.drop_duplicates(subset=unique_cols).shape[0]) if len(unique_cols) >= 3 else 0
            diarias = float(group["Quantidade"].sum())
            dias_ativos = int(group[dia_col].nunique()) if dia_col is not None else 0
            obras.append(
                {
                    "obra": str(obra or "Obra nao identificada"),
                    "headcount": headcount,
                    "total_diarias": round(diarias, 1),
                    "media_diaria": round(diarias / dias_ativos, 2) if dias_ativos else 0.0,
                    "fornecedores": int(group[fornecedor_col].nunique()) if fornecedor_col is not None else 0,
                    "cargos": int(group[cargo_col].nunique()) if cargo_col is not None else 0,
                }
            )
            total_headcount += headcount
            total_diarias += diarias

        obras.sort(key=lambda item: item["total_diarias"], reverse=True)
        return {
            "obras": obras,
            "total_geral": {
                "headcount": total_headcount,
                "total_diarias": round(total_diarias, 1),
            },
        }

    def get_consolidated_report(self) -> dict[str, Any]:
        return {
            "summary": self.get_summary(),
            "fornecedor_analysis": self.get_fornecedor_analysis(),
            "funcao_analysis": self.get_funcao_analysis(),
            "monthly_analysis": self.get_monthly_analysis(),
            "daily_timeline": self.get_daily_timeline(),
            "daily_by_fornecedor": self.get_daily_by_fornecedor(),
            "media_diaria_by_fornecedor": self.get_media_diaria_by_fornecedor(),
            "top_servicos": self.get_top_servicos(20),
            "matrix": self.get_fornecedor_funcao_matrix(),
            "por_obra": self.get_por_obra_data(),
        }


def get_efetivo_summary(source: pd.DataFrame | str | Path) -> dict[str, Any]:
    """Calcula o resumo de Efetivo a partir de DataFrame ou caminho de arquivo."""
    if isinstance(source, pd.DataFrame):
        dataframe = source.copy()
    else:
        from .efetivo_parser import parse_efetivo_file

        path = Path(source)
        dataframe = parse_efetivo_file(path.read_bytes(), path.name)
    return EfetivoAnalyzer(dataframe).get_summary()
