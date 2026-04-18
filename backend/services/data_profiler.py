"""
FASE 5: Data Profiler & Structure Analysis
Análise profunda de estrutura de dados, tipos, erros e inconsistências
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
from collections import Counter
import re

logger = logging.getLogger(__name__)


def convert_to_serializable(obj: Any) -> Any:
    """Converte tipos NumPy/pandas em tipos Python nativos para JSON."""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (pd.Series, pd.Index)):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_serializable(item) for item in obj]
    elif pd.isna(obj):
        return None
    return obj


class DataTypeDetector:
    """Detecta tipos de dados reais, independente de formatação ou erros."""
    
    @staticmethod
    def detect_value_type(value: Any) -> str:
        """
        Detecta o tipo real de um valor.
        Retorna: 'null', 'number', 'date', 'boolean', 'email', 'url', 'text'
        """
        if pd.isna(value) or value == '' or value is None:
            return 'null'
        
        value_str = str(value).strip()
        
        # Boolean
        if value_str.lower() in ['true', 'false', '1', '0', 'yes', 'no', 's', 'n', 'sim', 'não']:
            return 'boolean'
        
        # Number (int ou float)
        try:
            float(value_str.replace(',', '.'))
            if '.' in value_str or ',' in value_str:
                return 'float'
            return 'integer'
        except (ValueError, AttributeError):
            pass
        
        # Date (múltiplos formatos)
        date_patterns = [
            r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$',  # DD/MM/YYYY
            r'^\d{4}[/-]\d{1,2}[/-]\d{1,2}$',    # YYYY-MM-DD
            r'^\d{1,2}[-]\w+[-]\d{2,4}$',        # DD-Mon-YYYY
        ]
        for pattern in date_patterns:
            if re.match(pattern, value_str):
                return 'date'
        
        # Email
        if re.match(r'^[^@]+@[^@]+\.[^@]+$', value_str):
            return 'email'
        
        # URL
        if re.match(r'^(http|https|ftp)://', value_str, re.IGNORECASE):
            return 'url'
        
        # Phone (padrões comuns)
        if re.match(r'^[\d\s\-\(\)\+]+$', value_str) and len(re.sub(r'\D', '', value_str)) >= 7:
            return 'phone'
        
        # UUID/ID pattern
        if re.match(r'^[a-f0-9\-]{36}$', value_str, re.IGNORECASE):
            return 'uuid'
        
        # Default: text
        return 'text'
    
    @staticmethod
    def infer_column_type(series: pd.Series, sample_size: int = 100) -> Dict[str, Any]:
        """
        Infere o tipo real de uma coluna analisando amostra.
        Retorna {primary_type, confidence, type_distribution, issues}
        """
        if len(series) == 0:
            return {'primary_type': 'unknown', 'confidence': 0, 'type_distribution': {}, 'issues': ['Empty column']}
        
        # Amostra
        sample = series.dropna().head(sample_size) if len(series) > sample_size else series.dropna()
        if len(sample) == 0:
            return {'primary_type': 'null', 'confidence': 1.0, 'type_distribution': {'null': len(series)}, 'issues': ['All null']}
        
        # Detectar tipos
        type_counts = Counter()
        issues = []
        
        for val in sample:
            detected_type = DataTypeDetector.detect_value_type(val)
            type_counts[detected_type] += 1
        
        # Tipo mais comum
        total_detected = sum(type_counts.values())
        type_dist = {t: count / total_detected for t, count in type_counts.items()}
        
        primary_type = type_counts.most_common(1)[0][0]
        confidence = type_dist[primary_type]
        
        # Detectar inconsistências
        if confidence < 0.8 and len(type_counts) > 1:
            issues.append(f"Tipos mistos: {dict(type_counts)}")
        
        if 'null' in type_counts and type_counts['null'] / len(series) > 0.5:
            issues.append(f"Muitos valores nulos: {type_counts['null']/len(series)*100:.1f}%")
        
        return {
            'primary_type': primary_type,
            'confidence': round(confidence, 3),
            'type_distribution': {t: int(c) for t, c in type_counts.items()},
            'issues': issues
        }


class ColumnProfiler:
    """Cria perfil completo de uma coluna."""
    
    @staticmethod
    def profile_column(series: pd.Series, col_name: str) -> Dict[str, Any]:
        """
        Cria perfil abrangente de uma coluna.
        """
        if len(series) == 0:
            return {'name': col_name, 'empty': True}
        
        profile = {
            'name': col_name,
            'total_rows': len(series),
            'null_count': series.isna().sum(),
            'null_pct': round(series.isna().sum() / len(series) * 100, 2),
            'unique_count': series.nunique(),
            'unique_pct': round(series.nunique() / len(series) * 100, 2),
        }
        
        # Type information
        type_info = DataTypeDetector.infer_column_type(series)
        profile['data_type'] = type_info['primary_type']
        profile['type_confidence'] = type_info['confidence']
        profile['type_distribution'] = type_info['type_distribution']
        profile['issues'] = type_info['issues']
        
        # Sample values
        non_null = series.dropna()
        if len(non_null) > 0:
            profile['sample_values'] = non_null.head(3).astype(str).tolist()
        
        # Type-specific stats
        if type_info['primary_type'] in ['integer', 'float']:
            numeric = pd.to_numeric(series, errors='coerce')
            profile['numeric_stats'] = {
                'min': float(numeric.min()) if not pd.isna(numeric.min()) else None,
                'max': float(numeric.max()) if not pd.isna(numeric.max()) else None,
                'mean': round(float(numeric.mean()), 4) if not pd.isna(numeric.mean()) else None,
                'median': float(numeric.median()) if not pd.isna(numeric.median()) else None,
                'std': round(float(numeric.std()), 4) if not pd.isna(numeric.std()) else None,
            }
        
        elif type_info['primary_type'] == 'text':
            profile['text_stats'] = {
                'min_length': int(non_null.astype(str).str.len().min()),
                'max_length': int(non_null.astype(str).str.len().max()),
                'avg_length': round(float(non_null.astype(str).str.len().mean()), 2),
                'top_values': series.value_counts().head(5).index.tolist(),
                'top_counts': series.value_counts().head(5).values.tolist(),
            }
        
        elif type_info['primary_type'] == 'date':
            profile['date_stats'] = {
                'earliest': str(non_null.min()),
                'latest': str(non_null.max()),
                'date_range_days': (pd.to_datetime(non_null, errors='coerce').max() - 
                                   pd.to_datetime(non_null, errors='coerce').min()).days,
            }
        
        elif type_info['primary_type'] == 'boolean':
            profile['boolean_stats'] = {
                'true_count': series.isin(['true', 'True', '1', 'yes', 'Yes', 's', 'S']).sum(),
                'false_count': series.isin(['false', 'False', '0', 'no', 'No', 'n', 'N']).sum(),
            }
        
        return profile


class DataStructureAnalyzer:
    """Analisa estrutura geral do dataset."""
    
    @staticmethod
    def analyze_structure(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analisa estrutura completa do dataset.
        """
        analysis = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'total_cells': len(df) * len(df.columns),
            'null_cells': df.isna().sum().sum(),
            'null_cells_pct': round(df.isna().sum().sum() / (len(df) * len(df.columns)) * 100, 2),
            'memory_usage_mb': round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
        }
        
        # Colunas por tipo
        type_summary = {
            'numeric': 0,
            'text': 0,
            'date': 0,
            'boolean': 0,
            'mixed': 0,
            'null': 0,
        }
        
        for col in df.columns:
            type_info = DataTypeDetector.infer_column_type(df[col])
            ptype = type_info['primary_type']
            
            if ptype == 'null':
                type_summary['null'] += 1
            elif ptype in ['integer', 'float']:
                type_summary['numeric'] += 1
            elif ptype == 'text':
                type_summary['text'] += 1
            elif ptype == 'date':
                type_summary['date'] += 1
            elif ptype == 'boolean':
                type_summary['boolean'] += 1
            else:
                type_summary['mixed'] += 1
        
        analysis['column_types'] = type_summary
        
        # Issues globais
        issues = []
        
        # Duplicate rows
        dup_rows = df.duplicated().sum()
        if dup_rows > 0:
            issues.append(f"Linhas duplicadas: {dup_rows} ({dup_rows/len(df)*100:.1f}%)")
        
        # Too many nulls
        high_null_cols = []
        for col in df.columns:
            null_pct = df[col].isna().sum() / len(df) * 100
            if null_pct > 50:
                high_null_cols.append((col, null_pct))
        
        if high_null_cols:
            for col, pct in high_null_cols[:3]:
                issues.append(f"Coluna '{col}' com {pct:.1f}% nulos")
        
        analysis['issues'] = issues
        
        return analysis


class DataCleaner:
    """Sugestões de limpeza de dados."""
    
    @staticmethod
    def suggest_cleaning(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Sugere ações de limpeza.
        """
        suggestions = {
            'remove_columns': [],
            'remove_rows': [],
            'normalize_columns': [],
            'standardize_types': [],
            'handle_nulls': [],
        }
        
        # Colunas totalmente nulas
        for col in df.columns:
            null_pct = df[col].isna().sum() / len(df) * 100
            if null_pct == 100:
                suggestions['remove_columns'].append({
                    'column': col,
                    'reason': 'Totalmente nula',
                    'priority': 'high'
                })
            elif null_pct > 80:
                suggestions['handle_nulls'].append({
                    'column': col,
                    'null_pct': null_pct,
                    'recommendation': 'Considerar remover ou imputar'
                })
        
        # Linhas duplicadas
        dup_rows = df.duplicated().sum()
        if dup_rows > 0:
            suggestions['remove_rows'].append({
                'count': dup_rows,
                'reason': 'Linhas completamente duplicadas',
                'priority': 'medium'
            })
        
        # Tipos inconsistentes
        for col in df.columns:
            type_info = DataTypeDetector.infer_column_type(df[col])
            if type_info['confidence'] < 0.8 and len(type_info['type_distribution']) > 1:
                suggestions['standardize_types'].append({
                    'column': col,
                    'current_types': type_info['type_distribution'],
                    'primary_type': type_info['primary_type'],
                    'confidence': type_info['confidence'],
                    'recommendation': f"Padronizar para '{type_info['primary_type']}'"
                })
        
        # Normalização de texto
        for col in df.columns:
            type_info = DataTypeDetector.infer_column_type(df[col])
            if type_info['primary_type'] == 'text':
                series = df[col].dropna().astype(str)
                if len(series) > 0:
                    has_leading_space = (series.str.startswith(' ').sum() > 0)
                    has_mixed_case = (series.str.islower().sum() > 0 and 
                                    series.str.isupper().sum() > 0)
                    
                    if has_leading_space or has_mixed_case:
                        suggestions['normalize_columns'].append({
                            'column': col,
                            'issues': ['Espaços em branco' if has_leading_space else '',
                                     'Casos mistos' if has_mixed_case else ''],
                            'recommendation': 'Trim e normalizar case'
                        })
        
        return suggestions


def profile_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Cria perfil completo do dataset.
    """
    try:
        # Estrutura geral
        structure = DataStructureAnalyzer.analyze_structure(df)
        
        # Perfil de cada coluna
        column_profiles = []
        for col in df.columns:
            profile = ColumnProfiler.profile_column(df[col], col)
            column_profiles.append(profile)
        
        # Sugestões de limpeza
        cleaning_suggestions = DataCleaner.suggest_cleaning(df)
        
        result = {
            'structure': structure,
            'columns': column_profiles,
            'cleaning_suggestions': cleaning_suggestions,
            'timestamp': pd.Timestamp.now().isoformat(),
        }
        
        # Convert all numpy types to native Python types for JSON serialization
        return convert_to_serializable(result)
    
    except Exception as e:
        logger.error(f"[profiler] error: {e}", exc_info=True)
        return {
            'error': str(e),
            'structure': {},
            'columns': [],
            'cleaning_suggestions': {},
        }
