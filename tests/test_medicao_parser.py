from __future__ import annotations

from pathlib import Path

from backend.services.medicao_analyzer import parse_medicao_workbook


def test_parse_mp_workbook_from_sample_15_returns_single_document() -> None:
    sample_path = Path("data/samples") / "15.2.1 - MP-FKR018-RIL-001 - PROJETO DE PISCINA E AQUECIMENTO.xlsx"

    payload = parse_medicao_workbook(sample_path.read_bytes(), sample_path.name)

    assert payload["summary"]["tipo_documento"] == "proposta_mp"
    assert payload["summary"]["num_itens"] > 0
    assert payload["summary"]["num_boletins"] == 1
    assert payload["metadata"]["obra"]
    assert payload["metadata"]["fornecedor"] == "BOM CALOR"
    assert payload["metadata"]["contato"] == "Eduardo Tenenwurcel"
    assert payload["summary"]["classificacao_variacao"] == "acrescimo"
    assert payload["summary"]["desconto_pct"] is None
    assert payload["summary"]["diferenca_valor"] > 0
    assert not payload["items"].empty


def test_parse_boletim_workbook_from_sample_16_aggregates_multiple_med_sheets() -> None:
    sample_path = sorted(Path("data/samples").glob("16.3*.xlsx"))[0]

    payload = parse_medicao_workbook(sample_path.read_bytes(), sample_path.name)

    assert payload["summary"]["tipo_documento"] == "boletim_medicao"
    assert payload["summary"]["num_boletins"] >= 4
    assert payload["summary"]["quantidade_boletins"] == payload["summary"]["num_boletins"]
    assert payload["summary"]["classificacao_variacao"] == "neutro"
    assert payload["summary"]["valor_total_arquivo"] > 0
    assert payload["summary"]["media_por_boletim"] > 0
    assert len(payload["boletins"]) == payload["summary"]["num_boletins"]
    assert not payload["items"].empty
    assert payload["items"]["sheet_name"].nunique() >= 4
    assert payload["items"]["unidade"].eq("DIA").any()
    assert str(payload["boletins"][0]["periodo_medicao"]).startswith("DE ")
    assert payload["boletins"][0]["bm_numero"] is not None
