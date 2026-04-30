from __future__ import annotations

import pandas as pd
import pytest

from backend.services.schema_detector import detect_schema


@pytest.mark.parametrize(
    ("sheets", "expected"),
    [
        (
            {
                "Sheet1": pd.DataFrame(
                    columns=["CARGO/FUNÇÃO", "FORNECEDOR", "FILIAL/OBRA", "PERÍODO"],
                )
            },
            ["efetivo"],
        ),
        (
            {
                "Sheet1": pd.DataFrame(
                    columns=["NATUREZA", "FORNECEDOR", "NF", "DATA VENCTO", "VALOR"],
                )
            },
            ["custos"],
        ),
        (
            {
                "Sheet1": pd.DataFrame(
                    columns=["CUSTO TOTAL", "QTD", "DESCRIÇÃO", "UNID"],
                )
            },
            ["orcamento"],
        ),
        (
            {
                "Sheet1": pd.DataFrame(columns=["foo", "bar", "baz"]),
            },
            ["generic"],
        ),
        (
            {
                "Efetivo": pd.DataFrame(columns=["CARGO/FUNÇÃO", "FILIAL/OBRA"]),
                "Custos": pd.DataFrame(columns=["NATUREZA", "FORNECEDOR", "NF", "VALOR"]),
            },
            ["efetivo", "custos"],
        ),
    ],
)
def test_detect_schema(sheets: dict[str, pd.DataFrame], expected: list[str]) -> None:
    assert detect_schema(sheets) == expected
