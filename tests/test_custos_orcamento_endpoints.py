from __future__ import annotations

from io import BytesIO

import pandas as pd


def _build_workbook_bytes() -> bytes:
    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(
            {
                "N CONSOLIDADO": [1, 2],
                "COD": ["1-1", "1-2"],
                "FORNECEDOR": ["Fornecedor A", "Fornecedor B"],
                "NF": ["1001", "1002"],
                "MAPA PRECOS": ["MAPA-01", "MAPA-02"],
                "NATUREZA": ["Material / Servico", "Staff"],
                "DATA VENCTO": ["2026-01-10", "2026-02-15"],
                "VALOR": [1500.0, 2100.0],
                "ITEM PLANILHA": ["1.1", "2.1"],
            }
        ).to_excel(writer, sheet_name="PLANILHA NFs - Entrada de Dados", index=False, startrow=7)

        pd.DataFrame(
            {
                "ITEM": ["1", "2"],
                "SUBITEM": ["1.1", "2.1"],
                "DESCRICAO": ["Cimento", "Equipe"],
                "UNID": ["sc", "mes"],
                "QTD": [50, 2],
                "CUSTO UNITARIO": [30.0, 5000.0],
                "CUSTO TOTAL": [1500.0, 10000.0],
                "EXTRA 1": ["A", "B"],
                "EXTRA 2": ["C", "D"],
                "MAPA 001": [1500.0, 2500.0],
                "MAPA 002": [0.0, 1200.0],
            }
        ).to_excel(writer, sheet_name="PLANILHA ORCAMENTO - Entrada de", index=False, startrow=8)

        pd.DataFrame(
            {
                "ITEM/SUBITEM": ["1", "2"],
                "DESCRICAO": ["Cimento", "Equipe"],
                "VERBA TOTAL CUSTO DIRETO": [1500.0, 10000.0],
                "1": [500.0, 3000.0],
                "2": [700.0, 2500.0],
            }
        ).to_excel(writer, sheet_name="PLANILHA ORCADOxREALIZADO", index=False, startrow=10)

        pd.DataFrame(
            {
                "N CONSOLIDADO": [1, 2],
                "FORNECEDOR": ["Fornecedor A", "Fornecedor B"],
                "NF": ["1001", "1002"],
                "MAPA": ["MAPA-01", "MAPA-02"],
                "NATUREZA": ["Material / Servico", "Staff"],
                "COND PAGTO": ["Boleto", "Deposito"],
                "DATA VENCTO": ["2026-01-10", "2026-02-15"],
                "VALOR": [1500.0, 2100.0],
                "APROPRIITEM": ["1.1", "2.1"],
                "APROPRIVALOR": [1000.0, 2000.0],
            }
        ).to_excel(writer, sheet_name="PLANILHA CONSOLIDADO", index=False, startrow=5)

        pd.DataFrame(
            {
                "N CONSOLIDADO": [1, 2],
                "TOTAL": [1500.0, 2100.0],
                "TAXA ADMINISTRACAO": [195.0, 273.0],
                "TOTAL GERAL": [1695.0, 2373.0],
                "DATA VENCTO": ["2026-01-10", "2026-02-15"],
            }
        ).to_excel(writer, sheet_name="RESUMO CONSOLIDADOS - CLIENTE", index=False, startrow=9)

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

    custos_nfs = client.get(f"/api/custos/{session_id}/nfs")
    assert custos_nfs.status_code == 200
    custos_nfs_payload = custos_nfs.json()
    assert len(custos_nfs_payload) == 2
    assert any("FORNECEDOR" in key.upper() for key in custos_nfs_payload[0].keys())

    custos_consolidado = client.get(f"/api/custos/{session_id}/consolidado")
    assert custos_consolidado.status_code == 200
    custos_consolidado_payload = custos_consolidado.json()
    assert len(custos_consolidado_payload) == 2

    custos_orcado_realizado = client.get(f"/api/custos/{session_id}/orcado_realizado")
    assert custos_orcado_realizado.status_code == 200
    orcado_realizado_payload = custos_orcado_realizado.json()
    assert len(orcado_realizado_payload) == 2
    assert orcado_realizado_payload[0]["periodos"][0]["periodo"] == 1

    custos_resumo = client.get(f"/api/custos/{session_id}/resumo")
    assert custos_resumo.status_code == 200
    resumo_payload = custos_resumo.json()
    assert len(resumo_payload) == 2
    assert any("TOTAL GERAL" in key.upper() for key in resumo_payload[0].keys())

    budget = client.get(f"/api/orcamento/{session_id}/flat")
    assert budget.status_code == 200
    budget_payload = budget.json()
    assert len(budget_payload) == 2

    mapas = client.get(f"/api/orcamento/{session_id}/mapas")
    assert mapas.status_code == 200
    mapas_payload = mapas.json()
    assert len(mapas_payload) == 3
    assert any("VALOR_MAPA" in key.upper() for key in mapas_payload[0].keys())
