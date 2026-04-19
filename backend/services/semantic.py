import re
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from AnalyticsApp.config.keywords import (
    SEMANTIC_KEYWORDS,
    MIN_CONFIDENCE_SCORE,
    KEYWORD_MATCH_WEIGHT,
    PATTERN_MATCH_WEIGHT,
    VALUE_SAMPLE_WEIGHT,
    SAMPLE_SIZE,
    MIN_PATTERN_MATCHES,
)


class SemanticAnalyzer:
    """Analisador semântico para classificação automática de colunas."""

    def __init__(self):
        self.keywords = SEMANTIC_KEYWORDS

    def _normalize_column_name(self, col_name: str) -> str:
        """Normaliza nome da coluna para busca."""
        return col_name.lower().replace(" ", "_").replace("-", "_").strip()

    def _score_by_name(self, col_name: str) -> Dict[str, float]:
        """Pontua cada tipo semântico baseado no nome da coluna."""
        normalized = self._normalize_column_name(col_name)
        scores = {}

        for semantic_type, keywords_config in self.keywords.items():
            all_keywords = keywords_config["pt"] + keywords_config["en"]
            # Busca por substring ou palavra inteira - score baseado em melhor match
            best_score = 0.0
            for kw in all_keywords:
                kw_lower = kw.lower()
                if kw_lower == normalized:
                    best_score = 1.0  # Match perfeito
                    break
                elif kw_lower in normalized or normalized in kw_lower:
                    best_score = max(best_score, 0.7)  # Match parcial
            
            scores[semantic_type] = best_score

        return scores

    def _score_by_pattern(self, sample_values: List[str]) -> Dict[str, float]:
        """Pontua cada tipo semântico baseado em padrão de valores."""
        scores = {}

        for semantic_type, keywords_config in self.keywords.items():
            if "pattern" not in keywords_config:
                scores[semantic_type] = 0.0
                continue

            patterns = keywords_config["pattern"]
            matches = 0

            for value in sample_values[:SAMPLE_SIZE]:
                if pd.isna(value) or value == "":
                    continue
                value_str = str(value).strip()
                for pattern in patterns:
                    if re.search(pattern, value_str, re.IGNORECASE):
                        matches += 1
                        break

            match_ratio = matches / len(sample_values) if sample_values else 0
            scores[semantic_type] = match_ratio if match_ratio > 0.1 else 0.0

        return scores

    def _score_by_dtype(self, dtype: np.dtype) -> str:
        """Retorna tipo semântico baseado em dtype pandas."""
        if pd.api.types.is_datetime64_any_dtype(dtype):
            return "temporal"
        elif pd.api.types.is_numeric_dtype(dtype):
            return "monetario"  # padrão para numéricos
        else:
            return "texto"

    def _score_column(
        self, col_name: str, series: pd.Series
    ) -> Tuple[str, float, Dict[str, float]]:
        """
        Classifica uma coluna retornando (semantic_type, confidence, all_scores).
        
        Score final = 60% nome + 25% padrão + 15% dtype
        """
        name_scores = self._score_by_name(col_name)
        
        # Amostra de valores não-nulos
        non_null = series.dropna()
        sample = non_null.astype(str).tolist()[:SAMPLE_SIZE]
        
        if not sample:
            # Se não houver valores, usar apenas dtype
            dtype_type = self._score_by_dtype(series.dtype)
            return dtype_type, 0.3, {dtype_type: 0.3}
        
        pattern_scores = self._score_by_pattern(sample)
        
        # Verificar se é data
        try:
            pd.to_datetime(series.dropna(), errors="coerce")
            temporal_valid = pd.to_datetime(series.dropna(), errors="coerce").notna().sum() / len(
                series.dropna()
            )
            if temporal_valid > 0.8:
                pattern_scores["temporal"] = 0.9
        except Exception:
            pass
        
        # Combinar scores
        combined_scores = {}
        for semantic_type in self.keywords.keys():
            name_score = name_scores.get(semantic_type, 0.0)
            pattern_score = pattern_scores.get(semantic_type, 0.0)
            
            # Peso por tipo (dtype bonus)
            dtype_bonus = 0.2 if self._score_by_dtype(series.dtype) == semantic_type else 0.0
            
            combined_scores[semantic_type] = (
                name_score * KEYWORD_MATCH_WEIGHT
                + pattern_score * PATTERN_MATCH_WEIGHT
                + dtype_bonus * VALUE_SAMPLE_WEIGHT
            )
        
        # Encontrar melhor
        best_type = max(combined_scores, key=combined_scores.get)
        best_score = combined_scores[best_type]
        
        # Se score < threshold, retornar "generico"
        if best_score < MIN_CONFIDENCE_SCORE:
            return "generico", best_score, combined_scores
        
        return best_type, best_score, combined_scores

    def build_dataset_profile(self, df: pd.DataFrame) -> Dict:
        """
        Constrói perfil semântico completo do dataset.
        
        Retorna:
        {
            "columns": [
                {
                    "name": "col1",
                    "dtype": "int64",
                    "semantic_type": "monetario",
                    "confidence": 0.85,
                    "null_count": 0,
                    "null_pct": 0.0,
                    "unique_count": 1250,
                    "sample_values": ["10", "20", "30"],
                    "scores": {...}
                },
                ...
            ],
            "column_groups": {
                "temporal": ["data", "data_fim"],
                "monetario": ["valor", "preco"],
                "categoria": ["tipo", "status"],
                ...
            },
            "primary_temporal_col": "data",
            "primary_category_cols": ["tipo", "status"],
            "primary_numeric_cols": ["valor", "preco"],
        }
        """
        columns_profile = []
        col_groups = {
            "temporal": [],
            "monetario": [],
            "percentual": [],
            "contagem": [],
            "identificador": [],
            "categoria": [],
            "texto": [],
            "booleano": [],
            "geolocalização": [],
            "email": [],
            "telefone": [],
            "url": [],
            "generico": [],
        }
        
        for col_name in df.columns:
            semantic_type, confidence, scores = self._score_column(col_name, df[col_name])
            
            sample_values = (
                df[col_name]
                .dropna()
                .astype(str)
                .head(5)
                .tolist()
            )
            
            col_profile = {
                "name": col_name,
                "dtype": str(df[col_name].dtype),
                "semantic_type": semantic_type,
                "confidence": round(confidence, 3),
                "null_count": int(df[col_name].isnull().sum()),
                "null_pct": round(df[col_name].isnull().mean() * 100, 1),
                "unique_count": int(df[col_name].nunique()),
                "sample_values": sample_values,
                "scores": {k: round(v, 3) for k, v in scores.items()},
            }
            
            columns_profile.append(col_profile)
            col_groups[semantic_type].append(col_name)
        
        # Identificar colunas principais
        primary_temporal = next((c for c in col_groups["temporal"]), None)
        primary_categories = col_groups["categoria"][:5]
        primary_numerics = col_groups["monetario"] + col_groups["percentual"] + col_groups["contagem"]
        
        return {
            "columns": columns_profile,
            "column_groups": {k: v for k, v in col_groups.items() if v},
            "primary_temporal_col": primary_temporal,
            "primary_category_cols": primary_categories,
            "primary_numeric_cols": primary_numerics[:5],
            "total_rows": len(df),
            "total_cols": len(df.columns),
        }
