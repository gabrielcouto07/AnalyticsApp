"""
Custos Template — Detects "Planilha Controle de Custos Consolidados" files.
Uses zipfile for sheet name detection (< 1ms) instead of openpyxl (slow).
"""
from typing import Dict, List, Any

CUSTOS_TEMPLATE = {
    "name": "Custos - Controle Consolidado",
    "description": "Controle de custos de obra com NFs, consolidados, fornecedores e naturezas.",
    "icon": "📊",
    "color": "blue",
    "key_metrics": [
        {"name": "Total NFs", "field": "count", "description": "Notas fiscais registradas", "type": "number"},
        {"name": "Valor Total", "field": "Valor", "description": "Soma de todas NFs", "type": "currency"},
        {"name": "Fornecedores", "field": "Fornecedor", "description": "Fornecedores únicos", "type": "unique_count"},
        {"name": "Consolidados", "field": "NumConsolidado", "description": "Relatórios emitidos", "type": "unique_count"},
    ],
    "required_columns": ["NumConsolidado", "Fornecedor", "NF", "Valor", "DataVencto"],
    "visualizations": [
        {"type": "bar", "title": "Top Fornecedores por Valor", "field": "Fornecedor", "value_field": "Valor"},
        {"type": "pie", "title": "Boleto vs Depósito", "field": "CondPagto", "value_field": "Valor"},
        {"type": "bar", "title": "Valor por Consolidado", "field": "NumConsolidado", "value_field": "Valor"},
        {"type": "timeline", "title": "Evolução Mensal", "date_field": "DataVencto", "value_field": "Valor"},
    ],
    "filters": ["Fornecedor", "Natureza", "CondPagto", "NumConsolidado"],
    "sample_columns": {
        "NumConsolidado": "numeric", "Fornecedor": "text", "NF": "text",
        "MapaPrecos": "text", "Natureza": "text", "CondPagto": "text",
        "DataVencto": "date", "Valor": "numeric", "ValorItem": "numeric",
    },
    "custom_parser": "custos",
}


def _get_sheet_names_fast(file_bytes: bytes) -> list:
    """Extract sheet names from xlsx/xlsm using zipfile (< 1ms) instead of openpyxl."""
    try:
        import zipfile
        import xml.etree.ElementTree as ET
        from io import BytesIO
        zf = zipfile.ZipFile(BytesIO(file_bytes))
        workbook_xml = zf.read("xl/workbook.xml")
        root = ET.fromstring(workbook_xml)
        ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        return [s.attrib["name"] for s in root.findall(f".//{{{ns}}}sheet")]
    except Exception:
        return []


def detect_custos_file(file_bytes: bytes, filename: str) -> bool:
    """
    Detect Planilha Controle de Custos.
    Uses zipfile for sheet name extraction (< 1ms) — never opens openpyxl for detection.
    """
    import logging
    logger = logging.getLogger(__name__)

    name_lower = filename.lower()
    # Normalize common Portuguese accents for matching
    for src, dst in [("ç", "c"), ("ã", "a"), ("á", "a"), ("é", "e"), ("ê", "e"), ("ó", "o"), ("ú", "u")]:
        name_lower = name_lower.replace(src, dst)

    # Filename heuristics (loosened — "custo" alone is enough)
    if "controle" in name_lower and "custo" in name_lower:
        return True
    if "custo" in name_lower and name_lower.endswith((".xlsm", ".xlsx", ".xls")):
        return True

    # Sheet structure check (fast zipfile)
    sheets = _get_sheet_names_fast(file_bytes)
    logger.info(f"[custos_detect] {filename} — sheets: {sheets}")
    if sheets:
        sheets_upper = [s.upper() for s in sheets]
        # Strict: sheet with both NF + ENTRADA in name
        has_nfs_strict = any("NF" in s and "ENTRADA" in s for s in sheets_upper)
        # Loose fallback: any sheet with "NF" in name
        has_nfs_loose = any("NF" in s for s in sheets_upper)
        # Consolidado: present in any form (with or without RESUMO)
        has_cons = any("CONSOLIDADO" in s for s in sheets_upper)

        if (has_nfs_strict or has_nfs_loose) and has_cons:
            return True

        # Last resort: "consolidado" in filename + has a "NF"-named sheet
        if "consolidado" in name_lower and has_nfs_loose:
            return True

    return False


def get_custos_template() -> Dict[str, Any]:
    return CUSTOS_TEMPLATE
