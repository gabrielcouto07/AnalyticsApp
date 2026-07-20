"""Detecção de região de tabela dentro de uma aba de Excel.

Uma aba real do workbook não começa necessariamente em A1: pode ter linhas de
título/resumo antes do cabeçalho, colunas decorativas em branco, cabeçalhos
repetidos no meio dos dados e blocos-resumo pequenos ao lado da tabela grande.

Este módulo acha o cabeçalho verdadeiro pontuando linhas candidatas e devolve a
tabela normalizada (cabeçalho + linhas de dados), opcionalmente guiado por uma
assinatura de schema conhecido.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

import pandas as pd

from config.workbook import normalize_name


@dataclass
class TableRegion:
    header_row: int
    columns: list[str]
    df: pd.DataFrame
    score: float


def _is_number(x) -> bool:
    if isinstance(x, bool):
        return False
    if isinstance(x, (int, float)):
        return True
    try:
        float(str(x).replace(".", "").replace(",", "."))
        return True
    except (TypeError, ValueError):
        return False


def _label_cells(row: pd.Series) -> list[str]:
    return [str(x).strip() for x in row.tolist() if pd.notna(x) and str(x).strip()]


def _score_header(raw: pd.DataFrame, i: int, expected: set[str]) -> float:
    """Pontua a linha `i` como candidata a cabeçalho da tabela principal."""
    row = raw.iloc[i]
    labels = _label_cells(row)
    if len(labels) < 2:
        return float("-inf")

    non_null = len(labels)
    text_labels = [l for l in labels if not _is_number(l)]
    text_frac = len(text_labels) / non_null
    uniqueness = len(set(normalize_name(l) for l in labels)) / non_null

    # Densidade de dados logo abaixo — um cabeçalho de verdade é seguido de dados
    below = raw.iloc[i + 1 : i + 51]
    density = float(below.notna().to_numpy().mean()) if len(below) else 0.0
    rows_below = int(below.notna().any(axis=1).sum())

    score = non_null + text_frac * 5 + uniqueness * 3 + density * 10
    score += min(rows_below, 50) * 0.2  # tabela grande vence bloco-resumo pequeno

    if expected:
        present = sum(1 for l in labels if normalize_name(l) in expected)
        score += 25 * (present / len(expected))
        if present >= max(2, len(expected) // 2):
            score += 15  # forte match de schema conhecido

    return score


def find_header_row(raw: pd.DataFrame, expected: Optional[Iterable[str]] = None,
                    max_scan: int = 25) -> int:
    """Índice (0-based) da linha de cabeçalho mais provável nas `max_scan` iniciais."""
    expected_norm = {normalize_name(x) for x in expected} if expected else set()
    best_i, best_score = 0, float("-inf")
    scan = min(max_scan, len(raw))
    for i in range(scan):
        s = _score_header(raw, i, expected_norm)
        if s > best_score:
            best_i, best_score = i, s
    return best_i


def _dedupe_columns(cols: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for c in cols:
        name = c if c else "col"
        if name in seen:
            seen[name] += 1
            out.append(f"{name}.{seen[name]}")
        else:
            seen[name] = 0
            out.append(name)
    return out


def extract_region(raw: pd.DataFrame, expected: Optional[Iterable[str]] = None,
                   max_scan: int = 25) -> TableRegion:
    """Extrai a tabela principal de uma aba lida com header=None.

    - acha o cabeçalho (pode não ser a 1ª linha);
    - descarta linhas totalmente vazias e cabeçalhos repetidos no meio;
    - descarta colunas decorativas totalmente vazias sem rótulo.
    """
    expected_norm = {normalize_name(x) for x in expected} if expected else set()
    header_row = find_header_row(raw, expected, max_scan)
    score = _score_header(raw, header_row, expected_norm)

    header_vals = raw.iloc[header_row].tolist()
    columns = [str(x).strip() if pd.notna(x) else "" for x in header_vals]

    body = raw.iloc[header_row + 1 :].copy()
    body.columns = range(len(columns))

    # Colunas decorativas: totalmente vazias E sem rótulo → removidas
    keep_idx = [
        j for j, name in enumerate(columns)
        if name or body[j].notna().any()
    ]
    body = body[keep_idx]
    kept_columns = _dedupe_columns([columns[j] for j in keep_idx])
    body.columns = kept_columns

    # Descarta linhas totalmente vazias
    body = body.dropna(how="all")

    # Descarta cabeçalhos repetidos no meio dos dados (linha == cabeçalho).
    # Otimização: só inspeciona a fundo as linhas cuja 1ª célula já bate com o
    # 1º rótulo do cabeçalho — evita normalizar 13k×305 células (era O(linhas×cols)
    # e travava o upload). Nas linhas de dados a 1ª célula é um VALOR, não o rótulo.
    if len(body) and kept_columns:
        norm_header = [normalize_name(c) for c in kept_columns]
        first_label = norm_header[0]
        col0 = body.iloc[:, 0].map(lambda x: normalize_name(x) if pd.notna(x) else "")
        candidates = col0.index[col0 == first_label]
        drop_idx = []
        for i in candidates:
            vals = [normalize_name(x) for x in body.loc[i].tolist()]
            match = sum(1 for a, b in zip(vals, norm_header) if a == b and b)
            if match >= max(2, len(norm_header) // 2):
                drop_idx.append(i)
        if drop_idx:
            body = body.drop(index=drop_idx)

    body = body.reset_index(drop=True)
    return TableRegion(header_row=header_row, columns=kept_columns, df=body, score=score)
