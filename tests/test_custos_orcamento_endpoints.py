from __future__ import annotations

from io import BytesIO

import pandas as pd


def _build_workbook_bytes() -> bytes:
    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(
            {
                "Nº CONSOLIDADO": [1, 2],
                "COD": ["1-1", "1-2"],
                "FORNECEDOR": ["Fornecedor A", "Fornecedor B"],
                "NF": ["1001", "1002"],
                "MAPA PREÇOS": ["MAPA-01", "MAPA-02"],
                "NATUREZA": ["Material / Serviço", "Staff"],
                "BOLETO/DEPÓSITO": ["Boleto", "Deposito"],
                "DATA VENCTO": ["2026-01-10", "2026-02-15"],
                "VALOR": [1500.0, 2100.0],
                "SITUAÇÃO PLANILHA": ["Aberto", "Pago"],
                "SALDO PLANILHA": [1500.0, 0.0],
            }
        ).to_excel(writer, sheet_name="PLANILHA NFs - Entrada de Dados", index=False, startrow=7)

        pd.DataFrame(
            {
                "ITEM": ["1", "2"],
                "SUBITEM": ["1.1", "2.1"],
                "DESCRIÇÃO": ["Cimento", "Equipe"],
                "UNID": ["sc", "mes"],
                "QTD": [50, 2],
                "CUSTO UNITÁRIO": [30.0, 5000.0],
                "CUSTO TOTAL": [1500.0, 10000.0],
                "EXTRA 1": ["A", "B"],
                "EXTRA 2": ["C", "D"],
                "MAPA 001": [1500.0, 2500.0],
                "MAPA 002": [0.0, 1200.0],
            }
        ).to_excel(writer, sheet_name="PLANILHA ORÇAMENTO - Entrada de", index=False, startrow=8)

        pd.DataFrame(
            {
                "ITEM/SUBITEM": ["1", "2"],
                "DESCRIÇÃO": ["Cimento", "Equipe"],
                "VERBA TOTAL CUSTO DIRETO": [1500.0, 10000.0],
                "1": [500.0, 3000.0],
                "2": [700.0, 2500.0],
            }
        ).to_excel(writer, sheet_name="PLANILHA ORÇADOxREALIZADO", index=False, startrow=10)

        pd.DataFrame(
            {
                "Nº CONSOLIDADO": [1, 2],
                "FORNECEDOR": ["Fornecedor A", "Fornecedor B"],
                "NF": ["1001", "1002"],
                "NATUREZA": ["Material / Serviço", "Staff"],
                "DATA VENCTO": ["2026-01-10", "2026-02-15"],
                "VALOR": [1500.0, 2100.0],
            }
        ).to_excel(writer, sheet_name="PLANILHA CONSOLIDADO", index=False, startrow=5)

        pd.DataFrame(
            {
                "Nº CONSOLIDADO": [1, 2],
                "TOTAL": [1500.0, 2100.0],
                "TAXA ADMINISTRAÇÃO": [195.0, 273.0],
                "%": [13.0, 13.0],
                "TOTAL GERAL": [1695.0, 2373.0],
                "DATA VENCTO": ["2026-01-10", "2026-02-15"],
            }
        ).to_excel(writer, sheet_name="RESUMO CONSOLIDADOS - CLIENTE", index=False, startrow=9)

        pd.DataFrame({"A": [1]}).to_excel(writer, sheet_name="CALENDÁRIO", index=False)

    output.seek(0)
    return output.read()


def test_custos_orcamento_endpoints_from_workbook(client) -> None:
    workbook_bytes = _build_workbook_bytes()
    response = client.post(
        "/api/upload",
        files={"file": ("custos_orcamento.xlsx", workbook_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "custos" in payload["schema_types"]
    assert "orcamento" in payload["schema_types"]

    session_id = payload["session_id"]

    custos_resumo = client.get(f"/api/custos/{session_id}/resumo")
    assert custos_resumo.status_code == 200
    assert custos_resumo.json()["total_nfs"] == 2

    custos_fluxo = client.get(f"/api/custos/{session_id}/fluxo")
    assert custos_fluxo.status_code == 200
    assert len(custos_fluxo.json()["months"]) == 2

    budget = client.get(f"/api/orcamento/{session_id}/budget")
    assert budget.status_code == 200
    assert budget.json()["total_orcado"] == 11500.0

    mapas = client.get(f"/api/orcamento/{session_id}/mapas")
    assert mapas.status_code == 200
    assert len(mapas.json()["items"]) == 3
    assert isinstance(mapas.json()["items"][0]["mapa_num"], int)

    variancia = client.get(f"/api/orcamento/{session_id}/variancia")
    assert variancia.status_code == 200
    assert len(variancia.json()["items"]) == 2

    evolucao = client.get(f"/api/orcamento/{session_id}/evolucao_mensal")
    assert evolucao.status_code == 200
    assert evolucao.json()["months"][-1]["realizado_acumulado"] == 6700.0
