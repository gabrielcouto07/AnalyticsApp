"""
CustosAnalyzer — Analytics for Planilha Controle de Custos Consolidados.

Works on two DataFrames:
  - nfs: NFs Entrada de Dados (all invoices)
  - consolidado: Planilha Consolidado (current period report)

Provides:
  - Summary KPIs
  - Fornecedor ranking by total value
  - Natureza breakdown
  - Monthly timeline
  - Consolidado period report
  - Payment method analysis
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any


class CustosAnalyzer:

    def __init__(self, nfs: pd.DataFrame, consolidado: pd.DataFrame, meta: Dict[str, Any] = None):
        self.nfs = nfs.copy()
        self.cons = consolidado.copy()
        self.meta = meta or {}
        self._ensure_types()

    def _ensure_types(self):
        for df in (self.nfs, self.cons):
            for col in ("Valor", "ValorItem", "SaldoPlanilha", "ApropriValor"):
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            for col in ("DataVencto",):
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors="coerce")

    # ─── Summary ──────────────────────────────────────────────────────

    def get_summary(self) -> Dict[str, Any]:
        nfs = self.nfs
        total_valor = float(nfs["Valor"].sum()) if "Valor" in nfs.columns else 0
        total_nfs = len(nfs)
        unique_forn = int(nfs["Fornecedor"].nunique()) if "Fornecedor" in nfs.columns else 0
        unique_cons = int(nfs["NumConsolidado"].nunique()) if "NumConsolidado" in nfs.columns else 0

        avg_nf = total_valor / total_nfs if total_nfs > 0 else 0

        # Date range
        data_min = nfs["DataVencto"].min() if "DataVencto" in nfs.columns and nfs["DataVencto"].notna().any() else None
        data_max = nfs["DataVencto"].max() if "DataVencto" in nfs.columns and nfs["DataVencto"].notna().any() else None

        # Consolidado current period
        cons_total = float(self.cons["Valor"].sum()) if "Valor" in self.cons.columns else 0
        cons_count = len(self.cons)

        return {
            "obra": self.meta.get("Obra", ""),
            "endereco": self.meta.get("Endereco", ""),
            "periodo": self.meta.get("Periodo", ""),
            "total_nfs": total_nfs,
            "total_valor": round(total_valor, 2),
            "valor_medio_nf": round(avg_nf, 2),
            "unique_fornecedores": unique_forn,
            "unique_consolidados": unique_cons,
            "data_inicio": str(data_min.date()) if data_min and pd.notna(data_min) else "",
            "data_fim": str(data_max.date()) if data_max and pd.notna(data_max) else "",
            "consolidado_atual": {
                "total_nfs": cons_count,
                "total_valor": round(cons_total, 2),
            },
        }

    # ─── Fornecedor Ranking ───────────────────────────────────────────

    def get_fornecedor_ranking(self, limit: int = 20) -> List[Dict[str, Any]]:
        nfs = self.nfs
        if nfs.empty or "Fornecedor" not in nfs.columns:
            return []
        agg = nfs.groupby("Fornecedor").agg(
            total_valor=("Valor", "sum"),
            qtd_nfs=("NF", "count"),
            naturezas=("Natureza", "nunique") if "Natureza" in nfs.columns else ("Fornecedor", "count"),
        ).reset_index().sort_values("total_valor", ascending=False).head(limit)

        total_geral = nfs["Valor"].sum()
        return [
            {
                "fornecedor": str(r["Fornecedor"]),
                "total_valor": round(float(r["total_valor"]), 2),
                "qtd_nfs": int(r["qtd_nfs"]),
                "pct_total": round(float(r["total_valor"]) / total_geral * 100, 1) if total_geral > 0 else 0,
            }
            for _, r in agg.iterrows()
        ]

    # ─── Natureza / Mapa Breakdown ────────────────────────────────────

    def get_natureza_breakdown(self) -> List[Dict[str, Any]]:
        nfs = self.nfs
        col = "MapaPrecos" if "MapaPrecos" in nfs.columns else "Natureza"
        if nfs.empty or col not in nfs.columns:
            return []
        agg = nfs.groupby(col).agg(
            total_valor=("Valor", "sum"),
            qtd_nfs=("NF", "count"),
        ).reset_index().sort_values("total_valor", ascending=False)

        return [
            {
                "natureza": str(r[col]),
                "total_valor": round(float(r["total_valor"]), 2),
                "qtd_nfs": int(r["qtd_nfs"]),
            }
            for _, r in agg.iterrows() if str(r[col]).strip()
        ]

    # ─── Payment Method ───────────────────────────────────────────────

    def get_pagamento_breakdown(self) -> List[Dict[str, Any]]:
        nfs = self.nfs
        if nfs.empty or "CondPagto" not in nfs.columns:
            return []
        agg = nfs.groupby("CondPagto").agg(
            total_valor=("Valor", "sum"),
            qtd_nfs=("NF", "count"),
        ).reset_index().sort_values("total_valor", ascending=False)

        return [
            {
                "metodo": str(r["CondPagto"]).strip(),
                "total_valor": round(float(r["total_valor"]), 2),
                "qtd_nfs": int(r["qtd_nfs"]),
            }
            for _, r in agg.iterrows() if str(r["CondPagto"]).strip()
        ]

    # ─── Monthly Timeline ─────────────────────────────────────────────

    def get_monthly_timeline(self) -> List[Dict[str, Any]]:
        nfs = self.nfs
        if nfs.empty or "DataVencto" not in nfs.columns:
            return []
        df = nfs[nfs["DataVencto"].notna()].copy()
        if df.empty:
            return []
        df["MesAno"] = df["DataVencto"].dt.to_period("M").astype(str)
        agg = df.groupby("MesAno").agg(
            total_valor=("Valor", "sum"),
            qtd_nfs=("NF", "count"),
            fornecedores=("Fornecedor", "nunique"),
        ).reset_index().sort_values("MesAno")

        return [
            {
                "mes": str(r["MesAno"]),
                "total_valor": round(float(r["total_valor"]), 2),
                "qtd_nfs": int(r["qtd_nfs"]),
                "fornecedores": int(r["fornecedores"]),
            }
            for _, r in agg.iterrows()
        ]

    # ─── Per-Consolidado Breakdown ────────────────────────────────────

    def get_consolidado_breakdown(self) -> List[Dict[str, Any]]:
        nfs = self.nfs
        if nfs.empty or "NumConsolidado" not in nfs.columns:
            return []
        agg = nfs.groupby("NumConsolidado").agg(
            total_valor=("Valor", "sum"),
            qtd_nfs=("NF", "count"),
            fornecedores=("Fornecedor", "nunique"),
        ).reset_index().sort_values("NumConsolidado")

        return [
            {
                "consolidado": str(r["NumConsolidado"]),
                "total_valor": round(float(r["total_valor"]), 2),
                "qtd_nfs": int(r["qtd_nfs"]),
                "fornecedores": int(r["fornecedores"]),
            }
            for _, r in agg.iterrows()
            if str(r["NumConsolidado"]).strip() and str(r["NumConsolidado"]).strip() != "0"
        ]

    # ─── Top NFs ──────────────────────────────────────────────────────

    def get_top_nfs(self, limit: int = 20) -> List[Dict[str, Any]]:
        nfs = self.nfs
        if nfs.empty:
            return []
        top = nfs.nlargest(limit, "Valor") if "Valor" in nfs.columns else nfs.head(limit)
        return [
            {
                "fornecedor": str(r.get("Fornecedor", "")),
                "nf": str(r.get("NF", "")),
                "mapa": str(r.get("MapaPrecos", "")),
                "valor": round(float(r.get("Valor", 0)), 2) if pd.notna(r.get("Valor")) else 0,
                "data_vencto": str(r["DataVencto"].date()) if pd.notna(r.get("DataVencto")) else "",
                "cond_pagto": str(r.get("CondPagto", "")),
                "consolidado": str(r.get("NumConsolidado", "")),
            }
            for _, r in top.iterrows()
        ]

    # ─── Consolidado Period Detail ────────────────────────────────────

    def get_consolidado_detail(self) -> List[Dict[str, Any]]:
        cons = self.cons
        if cons.empty:
            return []
        return [
            {
                "num": str(r.get("NumConsolidado", "")),
                "fornecedor": str(r.get("Fornecedor", "")),
                "nf": str(r.get("NF", "")),
                "mapa": str(r.get("Mapa", "")),
                "natureza": str(r.get("Natureza", "")),
                "cond_pagto": str(r.get("CondPagto", "")),
                "data_vencto": str(r["DataVencto"].date()) if pd.notna(r.get("DataVencto")) else "",
                "valor": round(float(r.get("Valor", 0)), 2) if pd.notna(r.get("Valor")) else 0,
            }
            for _, r in cons.iterrows()
        ]

    # ─── All NFS rows (for DB persistence) ───────────────────────────────

    def get_all_nfs(self) -> List[Dict[str, Any]]:
        """Return ALL rows from the NFs Entrada de Dados sheet, for DB storage."""
        nfs = self.nfs
        if nfs.empty:
            return []
        result = []
        for _, r in nfs.iterrows():
            forn = str(r.get("Fornecedor") or "").strip()
            if not forn:
                continue
            valor = r.get("Valor")
            dt = r.get("DataVencto")
            result.append({
                "fornecedor":      forn,
                "nf":              str(r.get("NF") or ""),
                "num_consolidado": str(r.get("NumConsolidado") or ""),
                "mapa":            str(r.get("MapaPrecos") or ""),
                "natureza":        str(r.get("Natureza") or ""),
                "cond_pagto":      str(r.get("CondPagto") or ""),
                "data_vencto":     str(dt.date()) if pd.notna(dt) else "",
                "valor":           round(float(valor), 2) if pd.notna(valor) else 0.0,
            })
        return result

    # ─── Consolidated Report ──────────────────────────────────────────

    def get_consolidated_report(self) -> Dict[str, Any]:
        return {
            "summary": self.get_summary(),
            "fornecedor_ranking": self.get_fornecedor_ranking(20),
            "natureza_breakdown": self.get_natureza_breakdown(),
            "pagamento_breakdown": self.get_pagamento_breakdown(),
            "monthly_timeline": self.get_monthly_timeline(),
            "consolidado_breakdown": self.get_consolidado_breakdown(),
            "top_nfs": self.get_top_nfs(20),
            "consolidado_detail": self.get_consolidado_detail(),
        }
