"""
Compatibility adapter for custos workbook parsing.
"""

from __future__ import annotations

import logging
import traceback
from typing import Any

import pandas as pd

from .custos_analyzer import parse_custos_workbook_bytes


logger = logging.getLogger(__name__)


def _build_meta(structured: dict[str, Any]) -> dict[str, Any]:
    metadata = dict(structured.get("metadata") or {})
    nfs = structured.get("nfs")
    if isinstance(nfs, pd.DataFrame) and not nfs.empty:
        dates = pd.to_datetime(nfs.get("data_vencimento"), errors="coerce", dayfirst=True)
        metadata.setdefault("TotalNFs", int(len(nfs)))
        metadata.setdefault("TotalValor", round(float(nfs.get("valor", pd.Series(dtype=float)).fillna(0).sum()), 2))
        if dates.notna().any():
            metadata.setdefault("Periodo", f"{dates.min().date().isoformat()} a {dates.max().date().isoformat()}")
    return metadata


def parse_custos_file(file_bytes: bytes, filename: str) -> dict[str, Any]:
    structured = parse_custos_workbook_bytes(file_bytes)
    logger.info(
        "[custos_parser] Parsed workbook %s: nfs=%s consolidado=%s resumo=%s",
        filename,
        len(structured.get("nfs", pd.DataFrame())),
        len(structured.get("consolidado", pd.DataFrame())),
        len(structured.get("resumo", pd.DataFrame())),
    )
    return {
        "meta": _build_meta(structured),
        "nfs": structured.get("nfs", pd.DataFrame()),
        "consolidado": structured.get("consolidado", pd.DataFrame()),
        "resumo": structured.get("resumo", pd.DataFrame()),
        "orcado_realizado": structured.get("orcado_realizado", pd.DataFrame()),
        "orcamento": structured.get("orcamento", {"budget": pd.DataFrame(), "mapas": pd.DataFrame()}),
        "quality_reports": structured.get("quality_reports", {}),
        "metadata": structured.get("metadata", {}),
    }


def detect_custos_file(file_bytes: bytes, filename: str) -> bool:
    from .custos_template import detect_custos_file as _detect

    return _detect(file_bytes, filename)
