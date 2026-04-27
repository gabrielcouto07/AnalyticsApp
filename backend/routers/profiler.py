"""
FASE 5: Data Profiler Router
Endpoints para análise de estrutura e perfil de dados
"""

from fastapi import APIRouter, HTTPException
import pandas as pd
import numpy as np
import logging
from pydantic import BaseModel

from ..session import get_session, get_active_df
from ..services.data_profiler import profile_dataset
from ..services.cache import get_analysis_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/profiler", tags=["profiler"])
cache = get_analysis_cache()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{session_id}/profile")
async def get_data_profile(session_id: str):
    """
    Retorna perfil completo do dataset.
    
    Inclui:
    - Estrutura geral (linhas, colunas, células, memória)
    - Perfil de cada coluna (tipos, stats, issues)
    - Sugestões de limpeza
    """
    try:
        # Tentar recuperar do cache
        cached = cache.get(session_id, 'profile')
        if cached is not None:
            logger.info(f"[profile] Cache hit for session={session_id}")
            return {"data_profile": cached}
        
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        profile = profile_dataset(df)
        
        # Armazenar no cache (TTL 1 hora)
        cache.set(session_id, 'profile', profile, ttl=3600)
        
        logger.info(f"[profile] session={session_id} | rows={len(df)} | cols={len(df.columns)}")
        return {"data_profile": profile}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[profile] error: {e}", exc_info=True)
        raise HTTPException(500, f"Profiling failed: {str(e)}")


@router.get("/{session_id}/column/{column_name}")
async def get_column_profile(session_id: str, column_name: str):
    """
    Retorna perfil detalhado de uma coluna específica.
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        if column_name not in df.columns:
            raise HTTPException(422, f"Column '{column_name}' not found")
        
        from ..services.data_profiler import ColumnProfiler
        profile = ColumnProfiler.profile_column(df[column_name], column_name)
        
        logger.info(f"[column_profile] session={session_id} | column={column_name}")
        return {"column_profile": profile}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[column_profile] error: {e}", exc_info=True)
        raise HTTPException(500, f"Column profiling failed: {str(e)}")


@router.get("/{session_id}/issues")
async def get_data_issues(session_id: str):
    """
    Retorna lista de problemas encontrados no dataset.
    
    Categorias:
    - Estrutura (duplicatas, células nulas)
    - Colunas (tipos mistos, muitos nulos)
    - Limpeza (sugestões)
    """
    try:
        # Cache first
        cached = cache.get(session_id, 'issues')
        if cached is not None:
            return {"data_issues": cached}
        
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        issues = {
            'structure_issues': [],
            'column_issues': [],
            'data_quality_score': 100,
        }
        
        # Problemas estruturais
        dup_rows = df.duplicated().sum()
        if dup_rows > 0:
            issues['structure_issues'].append({
                'type': 'duplicate_rows',
                'severity': 'warning',
                'count': int(dup_rows),
                'percentage': round(float(dup_rows) / len(df) * 100, 2),
                'description': f'{dup_rows} linhas completamente duplicadas'
            })
            issues['data_quality_score'] -= 5
        
        # Problemas por coluna
        from ..services.data_profiler import DataTypeDetector
        for col in df.columns:
            type_info = DataTypeDetector.infer_column_type(df[col])
            col_issues = []
            
            # Tipo misto
            if type_info['confidence'] < 0.8:
                col_issues.append({
                    'issue': 'mixed_types',
                    'severity': 'warning',
                    'details': {k: float(v) if isinstance(v, (np.floating, np.integer)) else v 
                               for k, v in type_info['type_distribution'].items()}
                })
                issues['data_quality_score'] -= 3
            
            # Muitos nulos
            null_pct = float(df[col].isna().sum()) / len(df) * 100
            if null_pct > 50:
                col_issues.append({
                    'issue': 'high_nulls',
                    'severity': 'critical' if null_pct > 80 else 'warning',
                    'percentage': round(null_pct, 2)
                })
                issues['data_quality_score'] -= (5 if null_pct > 80 else 2)
            
            if col_issues:
                issues['column_issues'].append({
                    'column': col,
                    'issues': col_issues
                })
        
        # Data quality score
        issues['data_quality_score'] = max(0, min(100, issues['data_quality_score']))
        
        # Cache result
        cache.set(session_id, 'issues', issues, ttl=3600)
        
        logger.info(f"[issues] session={session_id} | quality_score={issues['data_quality_score']}")
        return {"data_issues": issues}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[issues] error: {e}", exc_info=True)
        raise HTTPException(500, f"Issues analysis failed: {str(e)}")


@router.get("/{session_id}/summary")
async def get_data_summary(session_id: str):
    """
    Retorna resumo rápido do dataset.
    
    Ideal para visualizar na dashboard.
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        from ..services.data_profiler import DataStructureAnalyzer, DataTypeDetector
        
        structure = DataStructureAnalyzer.analyze_structure(df)
        
        # Coluna com mais problemas
        problem_cols = []
        for col in df.columns:
            type_info = DataTypeDetector.infer_column_type(df[col])
            null_pct = df[col].isna().sum() / len(df) * 100
            
            issue_count = len(type_info['issues']) + (1 if null_pct > 50 else 0)
            if issue_count > 0:
                problem_cols.append({
                    'column': col,
                    'issue_count': issue_count,
                    'null_pct': round(null_pct, 2),
                    'type_confidence': type_info['confidence']
                })
        
        problem_cols.sort(key=lambda x: x['issue_count'], reverse=True)
        
        summary = {
            'rows': structure['total_rows'],
            'columns': structure['total_columns'],
            'memory_mb': structure['memory_usage_mb'],
            'null_percentage': structure['null_cells_pct'],
            'column_types': structure['column_types'],
            'problems_found': len(structure['issues']),
            'top_problem_columns': problem_cols[:5],
            'data_quality_issues': structure['issues'][:3],
        }
        
        logger.info(f"[summary] session={session_id} | rows={summary['rows']} | cols={summary['columns']}")
        return {"data_summary": summary}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[summary] error: {e}", exc_info=True)
        raise HTTPException(500, f"Summary generation failed: {str(e)}")


@router.get("/{session_id}/recommendations")
async def get_optimization_recommendations(session_id: str):
    """
    Retorna recomendações de otimização baseadas no perfil dos dados.
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        recommendations = {
            'data_cleaning': [],
            'performance': [],
            'analysis': [],
            'priority': 'normal',
        }
        
        # Recomendações de limpeza
        from ..services.data_profiler import DataCleaner
        cleaning = DataCleaner.suggest_cleaning(df)
        
        if cleaning['remove_columns']:
            recommendations['data_cleaning'].append({
                'action': 'remove_empty_columns',
                'severity': 'high',
                'details': f"Remover {len(cleaning['remove_columns'])} colunas totalmente nulas",
                'columns': [c['column'] for c in cleaning['remove_columns']]
            })
        
        if cleaning['remove_rows']:
            recommendations['data_cleaning'].append({
                'action': 'remove_duplicates',
                'severity': 'medium',
                'details': f"Remover {cleaning['remove_rows'][0]['count']} linhas duplicadas" if cleaning['remove_rows'] else "",
            })
        
        # Recomendações de performance
        memory_mb = df.memory_usage(deep=True).sum() / 1024**2
        if memory_mb > 100:
            recommendations['performance'].append({
                'action': 'optimize_dtypes',
                'severity': 'medium',
                'details': f"Dataset usa {memory_mb:.1f}MB. Considere otimizar tipos de dados (usar int32, float32, category)",
            })
        
        # Recomendações de análise
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(numeric_cols) > 2:
            recommendations['analysis'].append({
                'action': 'correlation_analysis',
                'severity': 'low',
                'details': f"Executar análise de correlação entre {len(numeric_cols)} colunas numéricas",
            })
        
        if len(df) > 1000:
            recommendations['analysis'].append({
                'action': 'clustering',
                'severity': 'low',
                'details': f"Dataset com {len(df)} linhas é adequado para clustering ou segmentação",
            })
        
        # Definir prioridade geral
        high_severity = len([r for r in recommendations['data_cleaning'] + recommendations['performance'] if r.get('severity') == 'high'])
        if high_severity > 0:
            recommendations['priority'] = 'high'
        elif len(recommendations['data_cleaning']) > 0:
            recommendations['priority'] = 'medium'
        
        logger.info(f"[recommendations] session={session_id} | actions={len(recommendations['data_cleaning'] + recommendations['performance'])}")
        return {"recommendations": recommendations}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[recommendations] error: {e}", exc_info=True)
        raise HTTPException(500, f"Recommendations generation failed: {str(e)}")
