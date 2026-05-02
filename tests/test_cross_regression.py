from __future__ import annotations

from backend.services.cross_analyzer import run_cross_regression


def _dataset(size: int) -> dict:
    return {
        "rows": [
            {
                "mes": f"2026-{index + 1:02d}",
                "total_diarias": 10 + index,
                "fornecedores": 2 + (index % 3),
                "funcoes_distintas": 3 + (index % 2),
                "custo_projeto_negociado": 1000 + (index * 100),
            }
            for index in range(size)
        ]
    }


def test_run_cross_regression_requires_minimum_observations() -> None:
    result = run_cross_regression(_dataset(5))
    assert result["regression_available"] is False
    assert result["reason"] == "insufficient_observations"


def test_run_cross_regression_supports_small_dataset_without_split() -> None:
    result = run_cross_regression(_dataset(6))
    assert result["dataset_prepared"] is True
    assert result["observations_available"] == 6


def test_run_cross_regression_runs_for_larger_dataset() -> None:
    result = run_cross_regression(_dataset(12))
    assert result["regression_available"] is True
    assert result["model_type"] in {"linear", "multiple"}
    assert result["r2"] is not None
    assert result["mae"] is not None


def test_run_cross_regression_rejects_single_cost_point() -> None:
    dataset = _dataset(6)
    for row in dataset["rows"]:
        row["custo_projeto_negociado"] = 1000

    result = run_cross_regression(dataset)

    assert result["regression_available"] is False
    assert result["reason"] == "single_cost_point"
    assert "comparacao descritiva" in result["message"].lower()
