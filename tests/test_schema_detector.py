from __future__ import annotations

import pandas as pd
import pytest

from backend.services.schema_detector import detect_schema


@pytest.mark.parametrize(
    ("sheets", "expected"),
    [
        (
            {
                "Sheet1": pd.DataFrame(columns=["CARGO/FUNCAO", "FORNECEDOR", "FILIAL/OBRA", "PERIODO"]),
            },
            ["efetivo"],
        ),
        (
            {
                "Sheet1": pd.DataFrame(columns=["NATUREZA", "FORNECEDOR", "NF", "DATA VENCTO", "VALOR"]),
            },
            ["custos"],
        ),
        (
            {
                "Sheet1": pd.DataFrame(columns=["CUSTO TOTAL", "QTD", "DESCRICAO", "UNID"]),
            },
            ["orcamento"],
        ),
        (
            {
                "MP": pd.DataFrame(columns=["ITEM", "DESCRICAO", "QUANTIDADE", "UNIDADE", "VALOR"]),
            },
            ["medicao"],
        ),
        (
            {
                "Sheet1": pd.DataFrame(columns=["foo", "bar", "baz"]),
            },
            ["generic"],
        ),
        (
            {
                "PLANILHA CONSOLIDADO": pd.DataFrame(columns=["FORNECEDOR", "NF", "VALOR", "DATA VENCTO"]),
            },
            ["custos"],
        ),
        (
            {
                "Efetivo": pd.DataFrame(columns=["CARGO/FUNCAO", "FILIAL/OBRA"] + [str(day) for day in range(1, 25)]),
                "Custos": pd.DataFrame(columns=["NATUREZA", "FORNECEDOR", "NF", "VALOR"]),
            },
            ["efetivo", "custos"],
        ),
    ],
)
def test_detect_schema(sheets: dict[str, pd.DataFrame], expected: list[str]) -> None:
    assert detect_schema(sheets) == expected


def test_detect_schema_uses_filename_hint_for_consolidated_costs() -> None:
    sheets = {
        "Resumo": pd.DataFrame(columns=["FORNECEDOR", "NF", "VALOR"]),
    }

    detected = detect_schema(sheets, filename="12.1 - BD_Planilha Controle Custos_Consolidados NOVA 09_2024 (1).xlsx")

    assert "custos" in detected


def test_detect_schema_identifies_boletim_medicao_family_from_med_sheets() -> None:
    sheets = {
        "MED 01": pd.DataFrame(
            [
                ["OBRA: FKR-018 - RIL", None, None],
                ["ITEM", "DESCRIÇÃO", "TOTAL DESTA MEDIÇÃO"],
                [1, "DIÁRIA DE SERVENTE", 24948],
            ]
        ),
        "Auxiliar": pd.DataFrame([[1, 2, 3]]),
    }

    detected = detect_schema(sheets, filename="16.3 - BD_Boletim Medição Elevare.xlsx")

    assert "medicao" in detected
