import unicodedata
from typing import Dict, List, Sequence, Set

import numpy as np
import pandas as pd

CONTEXT_RULES: dict[str, list[tuple[Sequence[str], float]]] = {
    "vendas": [
        (("cliente", "vendedor"), 1.0),
        (("produto", "item"), 1.0),
        (("valor", "preco", "faturament"), 1.0),
        (("quantidade", "qtd"), 1.0),
    ],
    "comissoes": [
        (("comissao", "percentual"), 2.0),
        (("vendedor",), 1.0),
        (("base",), 1.0),
        (("meta", "bonus"), 1.0),
    ],
    "compras": [
        (("fornecedor", "supplier"), 2.0),
        (("item", "produto"), 1.0),
        (("quantidade",), 1.0),
        (("valor_unitario", "preco_unitario"), 1.0),
    ],
    "financeiro": [
        (("conta", "centro_custo"), 1.0),
        (("saldo", "valor"), 1.0),
        (("tipo_movimento", "lancamento"), 1.0),
        (("data_pagamento", "data_vencimento"), 1.0),
    ],
    "rh": [
        (("funcionario", "colaborador"), 1.0),
        (("cargo", "funcao"), 1.0),
        (("salario",), 1.0),
        (("setor", "departamento"), 1.0),
    ],
    "obra": [
        (("obra",), 1.5),
        (("etapa", "fase"), 1.0),
        (("medicao",), 1.0),
        (("servico",), 1.0),
    ],
    "estoque": [
        (("estoque", "saldo"), 1.5),
        (("entrada", "saida"), 1.0),
        (("produto", "sku"), 1.0),
    ],
    "logistica": [
        (("entrega", "destinatario"), 1.0),
        (("frete",), 1.0),
        (("rota", "origem", "destino"), 1.0),
        (("motorista", "transportadora"), 1.0),
    ],
}

DIMENSION_KEYWORDS = (
    "vendedor",
    "cliente",
    "produto",
    "categoria",
    "tipo",
    "status",
    "regional",
    "estado",
    "uf",
    "departamento",
    "setor",
    "gerente",
    "responsavel",
    "projeto",
)

ID_PATTERNS = ("id", "codigo", "cod", "nr", "num", "numero", "interno")


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return normalized.lower()


def _normalize_col_names(df: pd.DataFrame) -> Dict[str, str]:
    return {column: _normalize_text(str(column)) for column in df.columns}


def _check_keywords(col_names_normalized: Set[str], keywords: Sequence[str]) -> int:
    count = 0
    for column_name in col_names_normalized:
        if any(keyword in column_name for keyword in keywords):
            count += 1
    return count


def _score_context(col_names_normalized: Set[str], rules: Sequence[tuple[Sequence[str], float]]) -> float:
    total_weight = sum(weight for _, weight in rules)
    matched_weight = sum(
        _check_keywords(col_names_normalized, keywords) * weight
        for keywords, weight in rules
    )
    return matched_weight / total_weight if total_weight else 0.0


def _is_id_column(col_name: str, series: pd.Series) -> bool:
    normalized_name = _normalize_text(col_name)
    if not any(pattern in normalized_name for pattern in ID_PATTERNS):
        return False

    unique_ratio = series.nunique() / len(series) if len(series) else 0
    if unique_ratio <= 0.8:
        return False

    if pd.api.types.is_numeric_dtype(series):
        diffs = series.diff().dropna()
        if not diffs.empty and ((diffs > 0).all() or (diffs < 0).all()):
            return True

    return True


def _get_key_metrics(df: pd.DataFrame, numeric_cols: List[str]) -> List[str]:
    if not numeric_cols:
        return []

    valid_metrics = [column for column in numeric_cols if not _is_id_column(column, df[column])]
    if not valid_metrics:
        return numeric_cols[:4]

    scored_metrics = []
    for column in valid_metrics:
        mean_value = df[column].mean()
        std_value = df[column].std()
        score = abs(std_value / mean_value) if mean_value else 0
        scored_metrics.append((column, score))

    scored_metrics.sort(key=lambda item: item[1], reverse=True)
    return [column for column, _ in scored_metrics[:6]]


def _get_key_dimensions(df: pd.DataFrame, categorical_cols: List[str]) -> List[str]:
    if not categorical_cols:
        return []

    valid_dimensions = [column for column in categorical_cols if 2 <= df[column].nunique() <= 30]
    if not valid_dimensions:
        return []

    scored_dimensions = []
    for column in valid_dimensions:
        normalized_name = _normalize_text(column)
        score = 1 if any(keyword in normalized_name for keyword in DIMENSION_KEYWORDS) else 0
        scored_dimensions.append((column, score))

    scored_dimensions.sort(key=lambda item: item[1], reverse=True)
    return [column for column, _ in scored_dimensions[:4]]


def detect_context(df: pd.DataFrame) -> Dict:
    if df.empty:
        return {
            "context": "generico",
            "confidence": 0.0,
            "context_scores": {},
            "date_cols": [],
            "numeric_cols": [],
            "categorical_cols": [],
            "text_cols": [],
            "id_cols": [],
            "key_metrics": [],
            "key_dimensions": [],
            "time_grain": None,
            "suggested_views": [],
        }

    date_cols = df.select_dtypes(include=["datetime64", "datetimetz"]).columns.tolist()
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    text_cols = []
    id_cols = []
    for column in categorical_cols:
        if df[column].nunique() > 50:
            text_cols.append(column)
        elif _is_id_column(column, df[column]):
            id_cols.append(column)

    categorical_cols = [column for column in categorical_cols if column not in text_cols and column not in id_cols]
    normalized_names = set(_normalize_col_names(df).values())
    scores = {name: _score_context(normalized_names, rules) for name, rules in CONTEXT_RULES.items()}

    max_score = max(scores.values(), default=0)
    if max_score < 0.05:
        best_context = "generico"
        confidence = 0.0
    else:
        best_context = max(scores, key=scores.get)
        confidence = min(max_score, 1.0)

    time_grain = None
    if date_cols:
        try:
            span_in_days = (df[date_cols[0]].max() - df[date_cols[0]].min()).days
            if span_in_days <= 30:
                time_grain = "day"
            elif span_in_days <= 120:
                time_grain = "week"
            elif span_in_days <= 730:
                time_grain = "month"
            elif span_in_days <= 1460:
                time_grain = "quarter"
            else:
                time_grain = "year"
        except Exception:
            time_grain = "month"

    return {
        "context": best_context,
        "confidence": confidence,
        "context_scores": scores,
        "date_cols": date_cols,
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "text_cols": text_cols,
        "id_cols": id_cols,
        "key_metrics": _get_key_metrics(df, numeric_cols),
        "key_dimensions": _get_key_dimensions(df, categorical_cols),
        "time_grain": time_grain,
        "suggested_views": [],
    }
