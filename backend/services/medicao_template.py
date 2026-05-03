"""
Medição template detection.

Adapted from GABRIEL's `schema_detector` (which produced a list of detected
schemas). BACK-API uses one detect_<type>_file(content, filename) -> bool per
template, called sequentially in `routers/upload.py`. This module exposes the
single boolean check needed for that flow.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from io import BytesIO
from typing import Any, Dict, Iterable

import pandas as pd


MEDICAO_TEMPLATE: Dict[str, Any] = {
    "name": "Medição - BM / Proposta MP",
    "description": "Boletins de medição e propostas de mão de obra (MP).",
    "icon": "📐",
    "color": "indigo",
    "key_metrics": [
        {"name": "Custo Negociado", "field": "custo_negociado", "description": "Total negociado", "type": "currency"},
        {"name": "Custo Inicial", "field": "custo_inicial", "description": "Total inicial", "type": "currency"},
        {"name": "Variação", "field": "variacao_percentual", "description": "% de desconto/acréscimo", "type": "percentage"},
        {"name": "Itens", "field": "num_itens", "description": "Itens medidos", "type": "number"},
        {"name": "Boletins", "field": "num_boletins", "description": "Boletins consolidados", "type": "number"},
    ],
    "required_columns": ["item", "descricao_servico", "quantidade", "unidade", "valor_negociado", "total"],
    "visualizations": [
        {"type": "bar", "title": "Valor por Boletim", "field": "bm_numero", "value_field": "total"},
        {"type": "pie", "title": "MO vs Equipamentos", "field": "tipo_item", "value_field": "total"},
    ],
    "filters": ["sheet_name", "tipo_item", "bm_numero"],
    "sample_columns": {
        "item": "text", "descricao_servico": "text", "quantidade": "numeric",
        "unidade": "text", "valor_inicial": "numeric", "valor_negociado": "numeric",
        "total": "numeric", "tipo_item": "text", "bm_numero": "text",
    },
    "custom_parser": "medicao",
}


def _normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").strip())
    text = text.encode("ascii", "ignore").decode("ascii").upper()
    text = re.sub(r"[^A-Z0-9 -]+", " ", text)
    return " ".join(text.split())


def _has_medicao_sheet_name(sheet_names: Iterable[str], filename: str) -> bool:
    candidates = [_normalize(name) for name in sheet_names]
    candidates.append(_normalize(filename))
    return any(
        value in {"MP", "MEDICAO", "MEDICAO 01", "PROPOSTA"}
        or value.startswith("MED ")
        or "BOLETIM MEDICAO" in value
        or "MP-" in value
        for value in candidates
    )


_HEADER_SIGNALS = {"ITEM", "DESCRICAO", "QUANTIDADE", "UNIDADE", "VALOR", "VALOR INICIAL", "VALOR NEGOCIADO"}
_BODY_MARKERS = {
    "TOTAL DO PERIODO ANTERIOR", "TOTAL DO PERIODO ATUAL",
    "TOTAL DESTA MEDICAO", "PERIODO MEDICAO", "TOTAL ACUMULADO",
    "MEDICAO",
}


def _normalize_columns(columns: Iterable[object]) -> set[str]:
    out = set()
    for column in columns:
        text = _normalize(column)
        if text:
            out.add(text)
    return out


def detect_medicao_file(file_bytes: bytes, filename: str) -> bool:
    """Returns True if the file looks like a Medição BM / Proposta MP."""
    logger = logging.getLogger(__name__)

    # 1) Cheap filename hint — handles MP-..., Boletim Medição, Proposta MP, etc.
    if _has_medicao_sheet_name([], filename):
        logger.info(f"[medicao_detect] {filename} matched by filename")
        # Still verify it parses cleanly — some Custos files include "MP" in name
        # and would be misclassified without sheet inspection.

    # 2) Read sheet names + headers (cheap header=None scan, max 30 rows per sheet)
    try:
        workbook = pd.read_excel(BytesIO(file_bytes), sheet_name=None, header=None, nrows=40)
    except Exception as exc:
        logger.info(f"[medicao_detect] {filename} not an xlsx ({exc})")
        return False

    if not workbook:
        return False

    sheet_names = list(workbook.keys())
    sheet_hint = _has_medicao_sheet_name(sheet_names, filename)

    # 3) Header signature: at least 3 of the medicao header tokens in any row of any sheet
    header_match = False
    body_marker_match = False
    for df in workbook.values():
        sampled_values = set()
        for row in df.head(30).itertuples(index=False):
            for cell in row:
                token = _normalize(cell)
                if token:
                    sampled_values.add(token)
        if len(_HEADER_SIGNALS & sampled_values) >= 3:
            header_match = True
        if any(any(marker in value for marker in _BODY_MARKERS) for value in sampled_values):
            body_marker_match = True
        if header_match and body_marker_match:
            break

    detected = sheet_hint and (header_match or body_marker_match)
    logger.info(
        f"[medicao_detect] {filename} sheet_hint={sheet_hint} headers={header_match} "
        f"body_markers={body_marker_match} detected={detected}"
    )
    return detected


def get_medicao_template() -> Dict[str, Any]:
    return MEDICAO_TEMPLATE
