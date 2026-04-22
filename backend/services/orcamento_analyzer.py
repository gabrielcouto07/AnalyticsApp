"""
OrcamentoAnalyzer — Analytics service for parsed Mapa de Concorrência data.

Works on the flat DataFrame produced by orcamento_parser.parse_orcamento_file(),
which has one row per (Item × Fornecedor) with columns:
    Obra, Assunto, Numero, Data, Filename,
    Item, Descricao, Quant, Unid, Tipo,
    FornecedorIndex, FornecedorNome, Contato, Telefone, Email,
    ValorA, ValorB, Preco

Provides:
- Summary metrics
- Price comparison pivot (Item × Fornecedor)
- Fornecedor ranking (total price, item coverage)
- Item-level analysis (cheapest fornecedor per item)
- Serviço vs Insumo breakdown
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional


class OrcamentoAnalyzer:
    """Specialized analyzer for Mapa de Concorrência data."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self._ensure_types()

    def _ensure_types(self):
        if "Preco" in self.df.columns:
            self.df["Preco"] = pd.to_numeric(self.df["Preco"], errors="coerce")
        if "ValorA" in self.df.columns:
            self.df["ValorA"] = pd.to_numeric(self.df["ValorA"], errors="coerce")
        if "ValorB" in self.df.columns:
            self.df["ValorB"] = pd.to_numeric(self.df["ValorB"], errors="coerce")
        if "Quant" in self.df.columns:
            self.df["Quant"] = pd.to_numeric(self.df["Quant"], errors="coerce").fillna(0)
        if "Item" in self.df.columns:
            self.df["Item"] = pd.to_numeric(self.df["Item"], errors="coerce").fillna(0).astype(int)

    # ─── Summary ──────────────────────────────────────────────────────

    def get_summary(self) -> Dict[str, Any]:
        df = self.df
        total_items = int(df["Item"].nunique()) if "Item" in df.columns else 0
        total_forn = int(df["FornecedorNome"].nunique()) if "FornecedorNome" in df.columns else 0

        obra = str(df["Obra"].iloc[0]) if "Obra" in df.columns and len(df) > 0 else ""
        assunto = str(df["Assunto"].iloc[0]) if "Assunto" in df.columns and len(df) > 0 else ""
        numero = str(df["Numero"].iloc[0]) if "Numero" in df.columns and len(df) > 0 else ""

        # Total price per fornecedor (sum of Preco)
        forn_totals = {}
        if "FornecedorNome" in df.columns and "Preco" in df.columns:
            forn_totals = (
                df.groupby("FornecedorNome")["Preco"]
                .sum()
                .dropna()
                .sort_values()
                .to_dict()
            )

        menor_preco_forn = ""
        menor_preco_val = 0
        if forn_totals:
            # Only consider fornecedores with actual prices
            valid = {k: v for k, v in forn_totals.items() if v > 0 and k}
            if valid:
                menor_preco_forn = min(valid, key=valid.get)
                menor_preco_val = valid[menor_preco_forn]

        # Tipo breakdown
        tipo_counts = {}
        if "Tipo" in df.columns:
            tipo_counts = df.drop_duplicates("Item")["Tipo"].value_counts().to_dict()

        return {
            "obra": obra,
            "assunto": assunto,
            "numero": numero,
            "total_items": total_items,
            "total_fornecedores": total_forn,
            "menor_preco_fornecedor": menor_preco_forn,
            "menor_preco_valor": round(menor_preco_val, 2),
            "fornecedor_totals": {k: round(v, 2) for k, v in forn_totals.items()},
            "tipo_breakdown": tipo_counts,
            "fornecedores_list": sorted(
                [f for f in df["FornecedorNome"].unique() if f],
            ) if "FornecedorNome" in df.columns else [],
        }

    # ─── Price Comparison Pivot ───────────────────────────────────────

    def get_price_pivot(self) -> Dict[str, Any]:
        """
        Pivot: rows = items, columns = fornecedores, values = Preco.
        Returns {items: [...], fornecedores: [...], rows: [{item, desc, forn1: price, ...}]}
        """
        df = self.df
        if df.empty or "Item" not in df.columns:
            return {"items": [], "fornecedores": [], "rows": []}

        fornecedores = sorted([f for f in df["FornecedorNome"].unique() if f])
        items = df.drop_duplicates("Item").sort_values("Item")

        rows = []
        for _, item_row in items.iterrows():
            item_id = item_row["Item"]
            row_data = {
                "item": int(item_id),
                "descricao": str(item_row.get("Descricao", "")),
                "quant": float(item_row.get("Quant", 0)),
                "unid": str(item_row.get("Unid", "")),
                "tipo": str(item_row.get("Tipo", "")),
            }

            precos = {}
            for forn in fornecedores:
                match = df[(df["Item"] == item_id) & (df["FornecedorNome"] == forn)]
                if not match.empty and pd.notna(match.iloc[0]["Preco"]):
                    precos[forn] = round(float(match.iloc[0]["Preco"]), 2)
                else:
                    precos[forn] = None

            row_data["precos"] = precos

            # Find cheapest fornecedor for this item
            valid_precos = {k: v for k, v in precos.items() if v is not None and v > 0}
            if valid_precos:
                cheapest = min(valid_precos, key=valid_precos.get)
                row_data["cheapest"] = cheapest
                row_data["cheapest_preco"] = valid_precos[cheapest]
            else:
                row_data["cheapest"] = None
                row_data["cheapest_preco"] = None

            rows.append(row_data)

        return {
            "items": [r["item"] for r in rows],
            "fornecedores": fornecedores,
            "rows": rows,
        }

    # ─── Fornecedor Ranking ───────────────────────────────────────────

    def get_fornecedor_ranking(self) -> List[Dict[str, Any]]:
        df = self.df
        if df.empty or "FornecedorNome" not in df.columns:
            return []

        result = []
        fornecedores = [f for f in df["FornecedorNome"].unique() if f]

        for forn in fornecedores:
            df_f = df[df["FornecedorNome"] == forn]
            total = df_f["Preco"].sum() if "Preco" in df_f.columns else 0
            items_quoted = int(df_f["Preco"].notna().sum()) if "Preco" in df_f.columns else 0
            total_items = int(df_f["Item"].nunique())

            contato = str(df_f["Contato"].iloc[0]) if "Contato" in df_f.columns and len(df_f) > 0 else ""
            telefone = str(df_f["Telefone"].iloc[0]) if "Telefone" in df_f.columns and len(df_f) > 0 else ""
            email = str(df_f["Email"].iloc[0]) if "Email" in df_f.columns and len(df_f) > 0 else ""

            # How many items is this forn the cheapest?
            pivot = self.get_price_pivot()
            wins = sum(1 for r in pivot["rows"] if r.get("cheapest") == forn)

            result.append({
                "fornecedor": forn,
                "total_preco": round(float(total), 2) if pd.notna(total) else 0,
                "items_cotados": items_quoted,
                "total_items": total_items,
                "cobertura_pct": round(items_quoted / total_items * 100, 1) if total_items > 0 else 0,
                "itens_mais_barato": wins,
                "contato": contato,
                "telefone": telefone,
                "email": email,
            })

        result.sort(key=lambda x: x["total_preco"] if x["total_preco"] > 0 else float("inf"))
        return result

    # ─── Item Analysis ────────────────────────────────────────────────

    def get_item_analysis(self) -> List[Dict[str, Any]]:
        """Per-item analysis: price spread, cheapest, most expensive."""
        df = self.df
        if df.empty or "Item" not in df.columns:
            return []

        items = df.drop_duplicates("Item").sort_values("Item")
        result = []

        for _, item_row in items.iterrows():
            item_id = item_row["Item"]
            df_item = df[df["Item"] == item_id]
            precos = df_item[df_item["Preco"].notna() & (df_item["Preco"] > 0)]

            entry = {
                "item": int(item_id),
                "descricao": str(item_row.get("Descricao", "")),
                "quant": float(item_row.get("Quant", 0)),
                "unid": str(item_row.get("Unid", "")),
                "tipo": str(item_row.get("Tipo", "")),
                "cotacoes": int(len(precos)),
            }

            if not precos.empty:
                cheapest_row = precos.loc[precos["Preco"].idxmin()]
                most_exp_row = precos.loc[precos["Preco"].idxmax()]
                entry["menor_preco"] = round(float(cheapest_row["Preco"]), 2)
                entry["menor_fornecedor"] = str(cheapest_row["FornecedorNome"])
                entry["maior_preco"] = round(float(most_exp_row["Preco"]), 2)
                entry["maior_fornecedor"] = str(most_exp_row["FornecedorNome"])
                entry["spread"] = round(float(most_exp_row["Preco"] - cheapest_row["Preco"]), 2)
                entry["spread_pct"] = round(
                    (float(most_exp_row["Preco"]) - float(cheapest_row["Preco"]))
                    / float(cheapest_row["Preco"]) * 100, 1
                ) if float(cheapest_row["Preco"]) > 0 else 0
            else:
                entry["menor_preco"] = None
                entry["menor_fornecedor"] = None
                entry["maior_preco"] = None
                entry["maior_fornecedor"] = None
                entry["spread"] = None
                entry["spread_pct"] = None

            result.append(entry)

        return result

    # ─── Tipo Breakdown ───────────────────────────────────────────────

    def get_tipo_breakdown(self) -> Dict[str, Any]:
        df = self.df
        if df.empty or "Tipo" not in df.columns:
            return {"servicos": 0, "insumos": 0, "items": []}

        unique_items = df.drop_duplicates("Item")
        servicos = unique_items[unique_items["Tipo"] == "Serviço"]
        insumos = unique_items[unique_items["Tipo"] == "Insumo"]

        return {
            "servicos": int(len(servicos)),
            "insumos": int(len(insumos)),
            "items": [
                {"item": int(r["Item"]), "descricao": str(r["Descricao"]), "tipo": str(r["Tipo"])}
                for _, r in unique_items.iterrows()
            ],
        }

    # ─── Consolidated Report ──────────────────────────────────────────

    def get_consolidated_report(self) -> Dict[str, Any]:
        return {
            "summary": self.get_summary(),
            "price_pivot": self.get_price_pivot(),
            "fornecedor_ranking": self.get_fornecedor_ranking(),
            "item_analysis": self.get_item_analysis(),
            "tipo_breakdown": self.get_tipo_breakdown(),
        }
