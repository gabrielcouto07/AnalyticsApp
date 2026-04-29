from __future__ import annotations

from io import BytesIO

import pandas as pd

from backend.session import get_session


def _build_multisheet_workbook() -> bytes:
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
                "BOLETO/DEPÓSITO": ["Boleto", "Depósito"],
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
            [
                ["OBRA", "OBRA RIL - RESIDÊNCIA ISABELA E LUIZ"],
                ["CLIENTE", "ISABELA E LUIZ RENÓ"],
                ["INÍCIO", "2026-02-03"],
                ["TAXA ADM", "13,00"],
            ]
        ).to_excel(
            writer,
            sheet_name="RESUMO CONSOLIDADOS - CLIENTE",
            index=False,
            header=False,
            startrow=0,
        )
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
        pd.DataFrame({"A": [1]}).to_excel(writer, sheet_name="ENTENDA COMO OPERAR", index=False)
        pd.DataFrame({0: [None] * 12, 1: [None] * 12}).to_excel(writer, sheet_name="VAZIA", index=False, header=False)

    output.seek(0)
    return output.read()


def test_multisheet_upload_persists_sheet_dict_and_endpoints_read_memory(client) -> None:
    workbook_bytes = _build_multisheet_workbook()
    response = client.post(
        "/api/upload",
        files={
          "file": (
            "BD_Planilha Controle Custos.xlsx",
            workbook_bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    session_id = payload["session_id"]

    session = get_session(session_id)
    assert session is not None
    assert session.filename == "BD_Planilha Controle Custos.xlsx"
    assert "PLANILHA NFs - Entrada de Dados" in session.sheets
    assert "PLANILHA ORÇAMENTO - Entrada de" in session.sheets
    assert "PLANILHA CONSOLIDADO" in session.sheets
    assert "RESUMO CONSOLIDADOS - CLIENTE" in session.sheets
    assert "CALENDÁRIO" not in session.sheets
    assert "ENTENDA COMO OPERAR" not in session.sheets
    assert "VAZIA" not in session.sheets

    session.extras.pop("structured_data", None)

    nfs_response = client.get(f"/api/custos/{session_id}/nfs")
    assert nfs_response.status_code == 200
    assert nfs_response.json()["total"] == 2

    budget_response = client.get(f"/api/orcamento/{session_id}/budget")
    assert budget_response.status_code == 200
    assert budget_response.json()["total_orcado"] == 11500.0

    resumo_response = client.get(f"/api/custos/{session_id}/resumo")
    assert resumo_response.status_code == 200
    resumo_payload = resumo_response.json()
    assert resumo_payload["obra_nome"] == "OBRA RIL - RESIDÊNCIA ISABELA E LUIZ"
    assert resumo_payload["cliente"] == "ISABELA E LUIZ RENÓ"
    assert resumo_payload["taxa_adm_pct"] == 13.0
