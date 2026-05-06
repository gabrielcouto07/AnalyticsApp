"""
Medicao Analyzer — Derives summary, items, and quality from parsed Boletim de Medição data.

Maps the nested medicao_parser output to the flat shape expected by MedicaoDashboard.jsx:
  summary  → KPI cards, boletins table, boletim bar chart
  items    → full servicos table with search/filter
  quality  → schema warnings, null-value counts
"""

from __future__ import annotations


class MedicaoAnalyzer:
    def __init__(self, data: dict):
        self.data = data
        self.medicoes: list[dict] = data.get("medicoes", [])

    def get_summary(self) -> dict:
        boletins = []
        for m in self.medicoes:
            header = m.get("header", {})
            servicos = m.get("servicos", [])
            fat = m.get("faturamento_direto", {})
            totais = m.get("totais_contratual", {})

            efetivo = [s for s in servicos if s.get("tipo") == "efetivo"]
            outros = [s for s in servicos if s.get("tipo") != "efetivo"]

            valor_mao_obra = sum(s.get("total_desta_medicao") or 0 for s in efetivo)
            valor_equipamentos = sum(s.get("total_desta_medicao") or 0 for s in outros)
            total_diarias = sum(s.get("qtde_medicao") or 0 for s in efetivo)
            funcoes_distintas = len({s.get("nome", "") for s in efetivo if s.get("nome")})
            valor_total_boletim = totais.get("total_desta_medicao") or 0
            valor_abatido = fat.get("valor_fat_direto") or 0
            valor_nf = fat.get("valor_nf_a_emitir") or 0

            boletins.append({
                "sheet_name": m.get("aba"),
                "bm_numero": header.get("bm_numero"),
                "fornecedor": header.get("fornecedor"),
                "periodo_medicao": (header.get("periodo") or {}).get("raw"),
                "periodo_inicio": (header.get("periodo") or {}).get("inicio"),
                "periodo_fim": (header.get("periodo") or {}).get("fim"),
                "vencimento": header.get("vencimento"),
                "valor_mao_obra": round(valor_mao_obra, 2),
                "valor_equipamentos": round(valor_equipamentos, 2),
                "valor_abatido_fornecedor": round(valor_abatido, 2),
                "valor_liquido": round(valor_nf, 2),
                "total_diarias": round(total_diarias, 2),
                "funcoes_distintas": funcoes_distintas,
                "valor_total_boletim": round(valor_total_boletim, 2),
                "num_itens": len(servicos),
            })

        total_mao_obra = sum(b["valor_mao_obra"] for b in boletins)
        total_equipamentos = sum(b["valor_equipamentos"] for b in boletins)
        total_abatido = sum(b["valor_abatido_fornecedor"] for b in boletins)
        total_liquido = sum(b["valor_liquido"] for b in boletins)
        total_diarias_all = sum(b["total_diarias"] for b in boletins)
        total_valor = sum(b["valor_total_boletim"] for b in boletins)

        maior = max(boletins, key=lambda x: x["valor_total_boletim"]) if boletins else None
        menor = min(boletins, key=lambda x: x["valor_total_boletim"]) if boletins else None
        media = round(total_valor / len(boletins), 2) if boletins else 0

        metadata = {
            "obra": self.data.get("obra"),
            "fornecedor": self.data.get("fornecedor"),
            "tipo_documento": "boletim_medicao",
            "num_boletins": len(boletins),
        }

        return {
            "metadata": metadata,
            "num_boletins": len(boletins),
            "boletins": boletins,
            "valor_mao_obra": round(total_mao_obra, 2),
            "valor_equipamentos": round(total_equipamentos, 2),
            "valor_abatido_fornecedor": round(total_abatido, 2),
            "valor_liquido": round(total_liquido, 2),
            "total_diarias": round(total_diarias_all, 2),
            "num_itens": sum(b["num_itens"] for b in boletins),
            "maior_boletim": maior,
            "menor_boletim": menor,
            "media_por_boletim": media,
        }

    def get_items(self) -> dict:
        items = []
        for m in self.medicoes:
            aba = m.get("aba", "")
            bm_numero = m.get("header", {}).get("bm_numero")
            for s in m.get("servicos", []):
                items.append({
                    "item": s.get("item"),
                    "descricao_servico": s.get("nome"),
                    "funcao": s.get("nome") if s.get("tipo") == "efetivo" else "—",
                    "tipo_item": s.get("tipo"),
                    "quantidade": s.get("qtde_medicao"),
                    "unidade": s.get("unidade"),
                    "valor_inicial": s.get("valor_unitario_contratual"),
                    "valor_negociado": s.get("valor_unitario_medicao"),
                    "total": s.get("total_desta_medicao"),
                    "bm_numero": bm_numero,
                    "sheet_name": aba,
                })
        return {"items": items, "total": len(items)}

    def get_quality(self) -> dict:
        warnings = []
        null_total_count = 0
        for m in self.medicoes:
            aba = m.get("aba", "?")
            totais = m.get("totais_contratual", {})
            fat = m.get("faturamento_direto", {})

            if totais.get("total_desta_medicao") is None:
                warnings.append(f"{aba}: total desta medição não encontrado na planilha")
                null_total_count += 1
            if fat.get("valor_nf_a_emitir") is None:
                warnings.append(f"{aba}: valor NF a emitir não encontrado (linha FARKAS CONSTRUTORA)")

        return {
            "error_cells": null_total_count,
            "empty_cells": 0,
            "dash_cells": 0,
            "formula_cells": 0,
            "fractional_values": 0,
            "schema_warnings": warnings if warnings else ["Nenhum problema estrutural detectado."],
            "normalization_notes": [
                f"Arquivo: {self.data.get('arquivo', '?')} · {len(self.medicoes)} boletim(ns) parseado(s)"
            ],
            "cell_errors_detail": [],
        }
