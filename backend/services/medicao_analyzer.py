from __future__ import annotations

import math
import re
import unicodedata
from io import BytesIO
from typing import Any

import pandas as pd

from .data_quality import build_quality_report


METADATA_LABELS = {
    "obra": {"OBRA", "PROJETO", "EMPREENDIMENTO"},
    "assunto": {"ASSUNTO", "ASSU", "SERVICO", "DESCRICAO"},
    "numero": {"N", "NO", "NRO", "NUMERO", "N O"},
    "data": {"DATA", "DATA DA PROPOSTA"},
    "fornecedor": {"FORNECEDOR", "EMPRESA", "CONTRATADA"},
    "contato": {"CONTATO", "RESPONSAVEL"},
    "telefone": {"TELEFONE", "TEL", "FONE", "CELULAR"},
    "email": {"EMAIL", "E MAIL"},
    "endereco": {"ENDERECO", "ENDERECO OBRA"},
    "periodo_medicao": {"PERIODO MEDICAO"},
    "bm_numero": {"BM N", "BM-N", "BM NUMERO", "BM NO", "BM-NO"},
    "vencimento": {"VENCIMENTO"},
}


def _normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").strip())
    text = text.encode("ascii", "ignore").decode("ascii").upper()
    text = re.sub(r"[^A-Z0-9:./ -]+", " ", text)
    return " ".join(text.split())


def _safe_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return value


def _extract_row_values(row: pd.Series) -> list[Any]:
    return [_safe_value(value) for value in row.tolist()]


def _find_label_key(text: str) -> str | None:
    if not text:
        return None
    candidate = text.split(":", 1)[0].strip()
    normalized = _normalize_text(candidate)
    if not normalized:
        return None
    for key, candidates in METADATA_LABELS.items():
        if normalized in candidates:
            return key
        for item in candidates:
            if normalized.startswith(f"{item}:") or normalized.startswith(f"{item} -") or normalized.startswith(f"{item}."):
                return key
            if normalized.startswith(f"{item} "):
                remainder = normalized[len(item) :].strip()
                if remainder.isdigit():
                    return key
    return None


def _extract_inline_value(text: str) -> tuple[str | None, Any]:
    original = str(text or "").strip()
    normalized = _normalize_text(original)
    if ":" not in original:
        return None, None
    raw_label, _ = normalized.split(":", 1)
    _, original_value = original.split(":", 1)
    label_key = _find_label_key(raw_label)
    value = original_value.strip()
    if label_key is None or not value:
        return None, None
    return label_key, value


def _is_label_like(value: Any) -> bool:
    if value is None:
        return False
    inline_key, _ = _extract_inline_value(str(value))
    if inline_key is not None:
        return True
    return _find_label_key(str(value)) is not None


def _find_next_value(values: list[Any], start_index: int, *, skip_labels: bool = False) -> Any:
    for value in values[start_index + 1 :]:
        if _safe_value(value) is not None:
            if skip_labels and _is_label_like(value):
                continue
            return value
    return None


def _find_next_value_with_index(
    values: list[Any],
    start_index: int,
    *,
    skip_labels: bool = False,
) -> tuple[Any, int | None]:
    for index, value in enumerate(values[start_index + 1 :], start=start_index + 1):
        if _safe_value(value) is not None:
            if skip_labels and _is_label_like(value):
                continue
            return value, index
    return None, None


def _find_vertical_value(df_raw: pd.DataFrame, row_index: int, cell_index: int, max_depth: int = 3) -> Any:
    limit = min(len(df_raw), row_index + max_depth + 1)
    for next_row in range(row_index + 1, limit):
        for candidate_col in (cell_index, cell_index + 1, cell_index - 1):
            if candidate_col < 0 or candidate_col >= df_raw.shape[1]:
                continue
            candidate = _safe_value(df_raw.iat[next_row, candidate_col])
            if candidate is None or _is_label_like(candidate):
                continue
            return candidate
    return None


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if pd.isna(value):
            return None
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    cleaned = (
        text.replace("R$", "")
        .replace("\xa0", " ")
        .replace(".", "")
        .replace(",", ".")
        .strip()
    )
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if not cleaned or cleaned in {"-", ".", "-."}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _is_error_value(value: Any) -> bool:
    return isinstance(value, str) and value.strip().startswith("#")


def _build_composite_headers(df_raw: pd.DataFrame, start_row: int, header_height: int = 3) -> list[str]:
    headers: list[str] = []
    for column_idx in range(df_raw.shape[1]):
        tokens: list[str] = []
        for offset in range(header_height):
            row_index = start_row + offset
            if row_index >= len(df_raw):
                break
            value = _safe_value(df_raw.iat[row_index, column_idx])
            if value is None:
                continue
            token = _normalize_text(value)
            if token and token not in tokens:
                tokens.append(token)
        headers.append(" | ".join(tokens))
    return headers


def _find_item_table_start(df_raw: pd.DataFrame) -> int | None:
    limit = min(len(df_raw), 50)
    for row_index in range(limit):
        values = [_normalize_text(value) for value in _extract_row_values(df_raw.iloc[row_index]) if value is not None]
        if "ITEM" not in values:
            continue
        nearby = " ".join(values)
        if any(token in nearby for token in ("DESCRICAO", "SERVICO", "VALOR", "QUANT", "QTDE", "MEDICAO")):
            return row_index
    return None


def _resolve_candidate(headers: list[str], keywords: list[str], prefer: list[str] | None = None) -> int | None:
    prefer = prefer or []
    scored: list[tuple[int, int]] = []
    for index, header in enumerate(headers):
        score = 0
        matched_keyword = False
        for token in keywords:
            if header == token:
                score += 8
                matched_keyword = True
            elif token in header:
                score += 3
                matched_keyword = True
        if matched_keyword:
            for token in prefer:
                if token in header:
                    score += 4
        if score > 0:
            scored.append((score, index))
    if not scored:
        return None
    scored.sort(key=lambda item: (-item[0], item[1]))
    return scored[0][1]


def _resolve_quantity_column(headers: list[str]) -> int | None:
    scored: list[tuple[int, int]] = []
    for index, header in enumerate(headers):
        if not header:
            continue
        score = 0
        if "QTDE" in header or "QUANTIDADE" in header or "QUANT" in header:
            score += 6
        if "ESTA MEDICAO" in header:
            score += 3
        if "VALOR" in header or "TOTAL" in header:
            score -= 4
        if score > 0:
            scored.append((score, index))
    if not scored:
        return None
    scored.sort(key=lambda item: (-item[0], item[1]))
    return scored[0][1]


def _resolve_total_column(headers: list[str]) -> int | None:
    scored: list[tuple[int, int]] = []
    for index, header in enumerate(headers):
        if not header:
            continue
        score = 0
        if "TOTAL DESTA MEDICAO" in header:
            score += 10
        if "VALOR TOTAL" in header:
            score += 4
        if header == "TOTAL":
            score += 4
        if "SALDO TOTAL" in header:
            score += 2
        if "VALOR UNITARIO" in header:
            score -= 5
        if score > 0:
            scored.append((score, index))
    if not scored:
        return None
    scored.sort(key=lambda item: (-item[0], item[1]))
    return scored[0][1]


def _looks_like_description_series(series: pd.Series) -> bool:
    values = [str(value).strip() for value in series.tolist() if _safe_value(value) is not None]
    if not values:
        return False
    text_values = [value for value in values[:10] if not _normalize_text(value).isdigit()]
    return bool(text_values)


def _looks_like_unit_series(series: pd.Series) -> bool:
    values = [str(value).strip().upper() for value in series.tolist() if _safe_value(value) is not None]
    if not values:
        return False
    sample = values[:12]
    return all(len(value) <= 8 and " " not in value for value in sample)


def extract_medicao_metadata(df_raw: pd.DataFrame) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    item_table_start = _find_item_table_start(df_raw)
    scan_limit = min(len(df_raw), item_table_start if item_table_start is not None else 24, 24)
    for row_index in range(scan_limit):
        values = _extract_row_values(df_raw.iloc[row_index])
        for cell_index, cell_value in enumerate(values):
            if cell_value is None:
                continue
            inline_key, inline_value = _extract_inline_value(str(cell_value))
            if inline_key is not None and inline_key not in metadata and inline_value is not None:
                metadata[inline_key] = inline_value
                continue
            label_key = _find_label_key(str(cell_value))
            if label_key is None or label_key in metadata:
                continue
            next_value, next_index = _find_next_value_with_index(values, cell_index, skip_labels=True)
            vertical_value = _find_vertical_value(df_raw, row_index, cell_index)
            if label_key == "periodo_medicao" and vertical_value is not None:
                next_value = vertical_value
            if next_value is not None:
                metadata[label_key] = next_value

    if "fornecedor" not in metadata:
        for row_index in range(scan_limit):
            values = _extract_row_values(df_raw.iloc[row_index])
            normalized_values = [_normalize_text(value) for value in values if value is not None]
            if not any("FORNECEDOR" in value for value in normalized_values):
                continue
            for candidate_row in range(row_index, min(scan_limit, row_index + 4)):
                candidate_values = _extract_row_values(df_raw.iloc[candidate_row])
                for cell_index, cell_value in enumerate(candidate_values):
                    if _normalize_text(cell_value) in {"NOME", "EMPRESA"}:
                        supplier_value = _find_next_value(candidate_values, cell_index, skip_labels=True)
                        if supplier_value is not None:
                            metadata["fornecedor"] = supplier_value
                            break
                if "fornecedor" in metadata:
                    break
            if "fornecedor" in metadata:
                break

    if "numero" in metadata:
        metadata["documento"] = metadata["numero"]
    return metadata


def extract_medicao_items(df_raw: pd.DataFrame) -> pd.DataFrame:
    start_row = _find_item_table_start(df_raw)
    columns = [
        "item",
        "descricao_servico",
        "quantidade",
        "unidade",
        "valor_inicial",
        "valor_negociado",
        "total",
        "tipo_celula",
        "observacao",
    ]
    if start_row is None:
        return pd.DataFrame(columns=columns)

    headers = _build_composite_headers(df_raw, start_row)
    item_col = _resolve_candidate(headers, ["ITEM"])
    descricao_col = _resolve_candidate(headers, ["DESCRICAO", "SERVICO", "PRODUTO", "RECURSO"])
    quantidade_col = _resolve_quantity_column(headers)
    unidade_col = _resolve_candidate(headers, ["UNID", "UNIDADE", "DIA"])
    valor_inicial_col = _resolve_candidate(
        headers,
        ["VALOR INICIAL", "VALOR UNITARIO", "PRECO UNITARIO", "TOTAL CONTRATUAL"],
        ["VALOR UNITARIO", "TOTAL CONTRATUAL"],
    )
    valor_negociado_col = _resolve_candidate(headers, ["VALOR NEGOCIADO", "NEGOCIADO"])
    total_col = _resolve_total_column(headers)

    data_start = start_row + 1
    while data_start < len(df_raw):
        row = df_raw.iloc[data_start]
        first_candidate = row.iloc[item_col] if item_col is not None and item_col < len(row) else None
        if isinstance(first_candidate, (int, float)) and not pd.isna(first_candidate):
            break
        if isinstance(first_candidate, str) and first_candidate.strip().isdigit():
            break
        data_start += 1

    preview_end = min(len(df_raw), data_start + 5)
    if descricao_col is None and item_col is not None:
        description_candidate = item_col + 1
        if description_candidate < df_raw.shape[1] and _looks_like_description_series(df_raw.iloc[data_start:preview_end, description_candidate]):
            descricao_col = description_candidate
    if unidade_col is None and item_col is not None:
        unit_candidate = item_col + 2
        if unit_candidate < df_raw.shape[1] and _looks_like_unit_series(df_raw.iloc[data_start:preview_end, unit_candidate]):
            unidade_col = unit_candidate

    records: list[dict[str, Any]] = []
    blank_streak = 0
    for row_index in range(data_start, len(df_raw)):
        row = df_raw.iloc[row_index]
        item_value = row.iloc[item_col] if item_col is not None and item_col < len(row) else None
        descricao_value = row.iloc[descricao_col] if descricao_col is not None and descricao_col < len(row) else None
        row_text = " ".join(
            _normalize_text(value)
            for value in _extract_row_values(row)
            if value is not None
        )
        if "TOTAL" in row_text and _coerce_float(item_value) is None:
            break

        if _safe_value(item_value) is None and _safe_value(descricao_value) is None:
            blank_streak += 1
            if blank_streak >= 3:
                break
            continue
        blank_streak = 0

        item_number = _coerce_float(item_value)
        if item_number is None:
            continue

        quantidade = _coerce_float(row.iloc[quantidade_col]) if quantidade_col is not None else None
        valor_inicial = _coerce_float(row.iloc[valor_inicial_col]) if valor_inicial_col is not None else None
        valor_negociado = _coerce_float(row.iloc[valor_negociado_col]) if valor_negociado_col is not None else None
        total_value = _coerce_float(row.iloc[total_col]) if total_col is not None else None

        unidade = _safe_value(row.iloc[unidade_col]) if unidade_col is not None else None
        tipo_celula = "ok"
        observacao = None
        for value in row.tolist():
            if _is_error_value(value):
                tipo_celula = "erro"
                observacao = str(value).strip()
                break

        if quantidade is None:
            quantidade = 0.0
        if total_value is not None:
            total = total_value
        elif valor_negociado is not None and quantidade:
            total = valor_negociado * quantidade
        else:
            total = (valor_inicial or 0.0) * quantidade

        records.append(
            {
                "item": int(item_number) if float(item_number).is_integer() else item_number,
                "descricao_servico": str(_safe_value(descricao_value) or ""),
                "quantidade": float(quantidade),
                "unidade": str(unidade or ""),
                "valor_inicial": float(valor_inicial) if valor_inicial is not None else None,
                "valor_negociado": float(valor_negociado) if valor_negociado is not None else None,
                "total": float(total),
                "tipo_celula": tipo_celula,
                "observacao": observacao,
            }
        )

    return pd.DataFrame(records, columns=columns)


def _select_medicao_sheets(workbook: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    selected: dict[str, pd.DataFrame] = {}
    for sheet_name, dataframe in workbook.items():
        normalized_name = _normalize_text(sheet_name)
        if normalized_name == "AUXILIAR":
            continue
        if normalized_name == "MP" or normalized_name.startswith("MED ") or normalized_name.startswith("MEDICAO"):
            selected[sheet_name] = dataframe
            continue
        if _find_item_table_start(dataframe) is not None:
            selected[sheet_name] = dataframe
    return selected or workbook


def _build_sheet_summary(sheet_name: str, metadata: dict[str, Any], items: pd.DataFrame) -> dict[str, Any]:
    total = float(items["total"].fillna(0).sum()) if not items.empty else 0.0
    data_ref = metadata.get("data")
    if data_ref is None and metadata.get("periodo_medicao"):
        match = re.search(r"(\d{2}/\d{2}/\d{4})", str(metadata["periodo_medicao"]))
        if match:
            data_ref = match.group(1)
    mes_ref = None
    if data_ref is not None:
        parsed_date = pd.to_datetime(data_ref, dayfirst=True, errors="coerce")
        if pd.notna(parsed_date):
            mes_ref = parsed_date.strftime("%Y-%m")
    return {
        "sheet_name": sheet_name,
        "bm_numero": metadata.get("bm_numero"),
        "periodo_medicao": metadata.get("periodo_medicao"),
        "vencimento": metadata.get("vencimento"),
        "fornecedor": metadata.get("fornecedor"),
        "obra": metadata.get("obra"),
        "valor_total_boletim": round(total, 2),
        "total": round(total, 2),
        "total_itens": int(len(items)),
        "num_itens": int(len(items)),
        "mes_ref": mes_ref,
    }


def _classify_variation(custo_inicial: float, custo_negociado: float) -> tuple[float, float, str, float | None]:
    diferenca_valor = custo_negociado - custo_inicial
    variacao_percentual = (diferenca_valor / custo_inicial) if custo_inicial > 0 else 0.0
    if math.isclose(custo_negociado, custo_inicial, rel_tol=0, abs_tol=1e-9):
        return diferenca_valor, variacao_percentual, "neutro", None
    if custo_negociado < custo_inicial:
        return diferenca_valor, variacao_percentual, "desconto", abs(variacao_percentual)
    return diferenca_valor, variacao_percentual, "acrescimo", None


def parse_medicao_workbook(file_bytes: bytes, filename: str) -> dict[str, Any]:
    workbook = pd.read_excel(BytesIO(file_bytes), sheet_name=None, header=None)
    if not workbook:
        empty = pd.DataFrame()
        return {
            "metadata": {},
            "items": empty,
            "summary": {
                "custo_inicial": 0.0,
                "custo_negociado": 0.0,
                "diferenca": 0.0,
                "diferenca_valor": 0.0,
                "variacao_percentual": 0.0,
                "classificacao_variacao": "neutro",
                "desconto_pct": None,
                "num_itens": 0,
                "num_boletins": 0,
                "quantidade_boletins": 0,
                "valor_total_arquivo": 0.0,
                "media_por_boletim": 0.0,
                "maior_boletim": None,
                "menor_boletim": None,
                "tipo_documento": "medicao",
            },
            "boletins": [],
            "quality_report": build_quality_report({}, schema_warnings=["Nenhuma planilha encontrada"]).to_dict(),
        }

    relevant_sheets = _select_medicao_sheets(workbook)
    all_items: list[pd.DataFrame] = []
    boletins: list[dict[str, Any]] = []
    first_metadata: dict[str, Any] = {}

    for sheet_name, df_raw in relevant_sheets.items():
        metadata = extract_medicao_metadata(df_raw)
        metadata.setdefault("arquivo_origem", filename)
        metadata.setdefault("sheet_name", sheet_name)
        if not first_metadata:
            first_metadata = dict(metadata)
        items = extract_medicao_items(df_raw)
        if not items.empty:
            items = items.copy()
            items["sheet_name"] = sheet_name
            items["bm_numero"] = metadata.get("bm_numero")
            items["periodo_medicao"] = metadata.get("periodo_medicao")
            boletins.append(_build_sheet_summary(sheet_name, metadata, items))
            all_items.append(items)

    items = pd.concat(all_items, ignore_index=True) if all_items else pd.DataFrame(
        columns=[
            "item",
            "descricao_servico",
            "quantidade",
            "unidade",
            "valor_inicial",
            "valor_negociado",
            "total",
            "tipo_celula",
            "observacao",
            "sheet_name",
            "bm_numero",
            "periodo_medicao",
        ]
    )

    custo_inicial = (
        float(items["valor_inicial"].fillna(0).mul(items["quantidade"].fillna(0)).sum())
        if not items.empty
        else 0.0
    )
    custo_negociado = (
        float(items["total"].fillna(0).sum())
        if not items.empty
        else 0.0
    )
    diferenca = custo_inicial - custo_negociado
    diferenca_valor, variacao_percentual, classificacao_variacao, desconto_percentual = _classify_variation(
        custo_inicial,
        custo_negociado,
    )
    quantidade_boletins = len(boletins) if boletins else (1 if not items.empty else 0)
    valor_total_arquivo = round(custo_negociado, 2)
    media_por_boletim = round((valor_total_arquivo / quantidade_boletins), 2) if quantidade_boletins else 0.0
    maior_boletim = max(boletins, key=lambda item: item.get("valor_total_boletim", 0)) if boletins else None
    menor_boletim = min(boletins, key=lambda item: item.get("valor_total_boletim", 0)) if boletins else None

    quality = build_quality_report(
        relevant_sheets,
        schema_warnings=["TOTAL row detected and excluded from items"] if not items.empty else [],
    )

    metadata = dict(first_metadata)
    metadata.setdefault("arquivo_origem", filename)
    metadata["boletins"] = boletins
    metadata["num_boletins"] = quantidade_boletins
    metadata["tipo_documento"] = "boletim_medicao" if quantidade_boletins > 1 else "proposta_mp"

    summary = {
        "custo_inicial": round(custo_inicial, 2),
        "custo_negociado": round(custo_negociado, 2),
        "diferenca": round(diferenca, 2),
        "diferenca_valor": round(diferenca_valor, 2),
        "variacao_percentual": round(variacao_percentual, 4),
        "classificacao_variacao": classificacao_variacao,
        "desconto_pct": round(desconto_percentual, 4) if desconto_percentual is not None else None,
        "num_itens": int(len(items)),
        "total_itens": int(len(items)),
        "num_boletins": quantidade_boletins,
        "quantidade_boletins": quantidade_boletins,
        "valor_total_arquivo": valor_total_arquivo,
        "media_por_boletim": media_por_boletim,
        "maior_boletim": maior_boletim,
        "menor_boletim": menor_boletim,
        "tipo_documento": metadata["tipo_documento"],
    }
    return {
        "metadata": metadata,
        "items": items,
        "summary": summary,
        "boletins": boletins,
        "quality_report": quality.to_dict(),
    }
