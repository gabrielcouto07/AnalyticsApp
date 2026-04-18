"""
EfetivoAnalyzer — Analytics service for parsed Efetivo (workforce control) data.

Provides analysis endpoints analogous to NFAnalyzer:
- Summary metrics
- Fornecedor breakdown
- Função breakdown
- Monthly evolution
- Daily timeline
- Heatmap data (day-of-week patterns)
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any


class EfetivoAnalyzer:
    """Specialized analyzer for Efetivo (Controle de Efetivo) data."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self._ensure_types()

    def _ensure_types(self):
        """Ensure correct dtypes on the parsed DataFrame."""
        if "Quantidade" in self.df.columns:
            self.df["Quantidade"] = pd.to_numeric(self.df["Quantidade"], errors="coerce").fillna(0)
        if "DiariasTotal" in self.df.columns:
            self.df["DiariasTotal"] = pd.to_numeric(self.df["DiariasTotal"], errors="coerce").fillna(0)
        if "Data" in self.df.columns:
            self.df["Data"] = pd.to_datetime(self.df["Data"], errors="coerce")
        if "Dia" in self.df.columns:
            self.df["Dia"] = pd.to_numeric(self.df["Dia"], errors="coerce").fillna(0).astype(int)

    def _work_df(self) -> pd.DataFrame:
        """Filter to rows where actual work happened."""
        return self.df[self.df["Quantidade"] > 0]

    # ─── Summary ──────────────────────────────────────────────────────

    def get_summary(self) -> Dict[str, Any]:
        df_w = self._work_df()
        total_diarias = float(df_w["Quantidade"].sum())
        unique_fornecedores = int(self.df["Fornecedor"].nunique()) if "Fornecedor" in self.df.columns else 0
        unique_funcoes = int(self.df["Funcao"].nunique()) if "Funcao" in self.df.columns else 0
        dias_ativos = int(df_w["Data"].nunique()) if "Data" in df_w.columns else 0
        media_diaria = total_diarias / dias_ativos if dias_ativos > 0 else 0

        obra = str(self.df["Obra"].iloc[0]) if "Obra" in self.df.columns and len(self.df) > 0 else ""
        ano = int(self.df["Ano"].iloc[0]) if "Ano" in self.df.columns and len(self.df) > 0 else 0

        return {
            "total_diarias": round(total_diarias, 1),
            "unique_fornecedores": unique_fornecedores,
            "unique_funcoes": unique_funcoes,
            "dias_ativos": dias_ativos,
            "media_diaria": round(media_diaria, 1),
            "obra": obra,
            "ano": ano,
            "meses_cobertos": int(self.df["Mes"].nunique()) if "Mes" in self.df.columns else 0,
            "data_quality": {
                "total_rows": len(self.df),
                "work_rows": len(df_w),
                "fornecedores": sorted(self.df["Fornecedor"].unique().tolist()) if "Fornecedor" in self.df.columns else [],
                "funcoes": sorted(self.df["Funcao"].unique().tolist()) if "Funcao" in self.df.columns else [],
            },
        }

    # ─── Fornecedor Analysis ─────────────────────────────────────────

    def get_fornecedor_analysis(self) -> List[Dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Fornecedor" not in df_w.columns:
            return []

        agg = df_w.groupby("Fornecedor").agg(
            total_diarias=("Quantidade", "sum"),
            funcoes_count=("Funcao", "nunique"),
            dias_ativos=("Data", "nunique"),
            media_por_dia=("Quantidade", "mean"),
        ).reset_index().sort_values("total_diarias", ascending=False)

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

    # ─── Função Analysis ──────────────────────────────────────────────

    def get_funcao_analysis(self) -> List[Dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Funcao" not in df_w.columns:
            return []

        agg = df_w.groupby("Funcao").agg(
            total_diarias=("Quantidade", "sum"),
            fornecedores_count=("Fornecedor", "nunique"),
            dias_ativos=("Data", "nunique"),
        ).reset_index().sort_values("total_diarias", ascending=False)

        return [
            {
                "funcao": str(row["Funcao"]),
                "total_diarias": round(float(row["total_diarias"]), 1),
                "fornecedores_count": int(row["fornecedores_count"]),
                "dias_ativos": int(row["dias_ativos"]),
            }
            for _, row in agg.iterrows()
        ]

    # ─── Monthly Analysis ─────────────────────────────────────────────

    def get_monthly_analysis(self) -> List[Dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Mes" not in df_w.columns:
            return []

        agg = df_w.groupby(["Mes", "MesNome"]).agg(
            total_diarias=("Quantidade", "sum"),
            fornecedores=("Fornecedor", "nunique"),
            funcoes=("Funcao", "nunique"),
            dias_ativos=("Data", "nunique"),
        ).reset_index().sort_values("Mes")

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

    # ─── Daily Timeline ───────────────────────────────────────────────

    def get_daily_timeline(self) -> List[Dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty or "Data" not in df_w.columns:
            return []

        daily = df_w.groupby("Data").agg(
            total_trabalhadores=("Quantidade", "sum"),
            fornecedores=("Fornecedor", "nunique"),
            funcoes=("Funcao", "nunique"),
        ).reset_index().sort_values("Data")

        return [
            {
                "data": str(row["Data"].date()),
                "total_trabalhadores": round(float(row["total_trabalhadores"]), 1),
                "fornecedores": int(row["fornecedores"]),
                "funcoes": int(row["funcoes"]),
            }
            for _, row in daily.iterrows()
        ]

    # ─── Fornecedor x Função Matrix ───────────────────────────────────

    def get_fornecedor_funcao_matrix(self) -> Dict[str, Any]:
        df_w = self._work_df()
        if df_w.empty:
            return {"fornecedores": [], "funcoes": [], "matrix": []}

        pivot = df_w.pivot_table(
            index="Fornecedor", columns="Funcao",
            values="Quantidade", aggfunc="sum", fill_value=0,
        )

        return {
            "fornecedores": pivot.index.tolist(),
            "funcoes": pivot.columns.tolist(),
            "matrix": pivot.values.tolist(),
        }

    # ─── Top Workers by Fornecedor+Função ─────────────────────────────

    def get_top_servicos(self, limit: int = 20) -> List[Dict[str, Any]]:
        df_w = self._work_df()
        if df_w.empty:
            return []

        agg = df_w.groupby(["Fornecedor", "Funcao"]).agg(
            total_diarias=("Quantidade", "sum"),
            dias_ativos=("Data", "nunique"),
        ).reset_index().sort_values("total_diarias", ascending=False).head(limit)

        return [
            {
                "fornecedor": str(row["Fornecedor"]),
                "funcao": str(row["Funcao"]),
                "total_diarias": round(float(row["total_diarias"]), 1),
                "dias_ativos": int(row["dias_ativos"]),
            }
            for _, row in agg.iterrows()
        ]

    # ─── Consolidated Report ──────────────────────────────────────────

    def get_consolidated_report(self) -> Dict[str, Any]:
        return {
            "summary": self.get_summary(),
            "fornecedor_analysis": self.get_fornecedor_analysis(),
            "funcao_analysis": self.get_funcao_analysis(),
            "monthly_analysis": self.get_monthly_analysis(),
            "daily_timeline": self.get_daily_timeline(),
            "top_servicos": self.get_top_servicos(20),
            "matrix": self.get_fornecedor_funcao_matrix(),
        }
