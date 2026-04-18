from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional
import pandas as pd
from ..session import get_session, get_active_df, invalidate_chart_cache, get_session_info

router = APIRouter(prefix="/api/filters", tags=["filters"])


class FilterRequest(BaseModel):
    """Estrutura de filtros a aplicar"""
    date_range: Optional[dict[str, str]] = None  # {col: "col_name", start: "2020-01-01", end: "2021-12-31"}
    categorical: Optional[list[dict[str, Any]]] = None  # [{col: "estado", values: ["SP", "MG"]}]
    numeric: Optional[list[dict[str, Any]]] = None  # [{col: "valor", min: 100, max: 1000}]


def _validate_and_convert_dates(df_col: pd.Series, start_str: str, end_str: str):
    """Converte strings de data para datetime com validação"""
    try:
        start = pd.to_datetime(start_str)
        end = pd.to_datetime(end_str)
        if start > end:
            raise ValueError("Data inicial deve ser anterior à data final")
        return start, end
    except Exception as e:
        raise ValueError(f"Formato de data inválido: {str(e)}")


def _apply_filters(df: pd.DataFrame, filters: dict) -> tuple[pd.DataFrame, dict]:
    """
    Aplica filtros ao dataframe e retorna cópia filtrada + filtros normalizados
    """
    df_filtered = df.copy()
    applied_filters = {}
    
    # Aplicar filtro de data
    if "date_range" in filters and filters["date_range"]:
        dr = filters["date_range"]
        col = dr.get("col")
        start_str = dr.get("start")
        end_str = dr.get("end")
        
        if col not in df_filtered.columns:
            raise ValueError(f"Coluna de data '{col}' não encontrada")
        
        try:
            start, end = _validate_and_convert_dates(df_filtered[col], start_str, end_str)
            df_filtered[col] = pd.to_datetime(df_filtered[col], errors="coerce")
            
            # Aplicar filtro com NaT handling
            mask = (df_filtered[col] >= start) & (df_filtered[col] <= end)
            df_filtered = df_filtered[mask]
            
            applied_filters["date_range"] = {
                "col": col,
                "start": start_str,
                "end": end_str,
            }
        except Exception as e:
            raise ValueError(f"Erro ao aplicar filtro de data: {str(e)}")
    
    # Aplicar filtros categóricos
    if "categorical" in filters and filters["categorical"]:
        applied_filters["categorical"] = []
        for cat_filter in filters["categorical"]:
            col = cat_filter.get("col")
            values = cat_filter.get("values", [])
            
            if not col or not values:
                continue
                
            if col not in df_filtered.columns:
                raise ValueError(f"Coluna categórica '{col}' não encontrada")
            
            df_filtered = df_filtered[df_filtered[col].isin(values)]
            applied_filters["categorical"].append({
                "col": col,
                "values": values,
            })
    
    # Aplicar filtros numéricos
    if "numeric" in filters and filters["numeric"]:
        applied_filters["numeric"] = []
        for num_filter in filters["numeric"]:
            col = num_filter.get("col")
            min_val = num_filter.get("min")
            max_val = num_filter.get("max")
            
            if not col or (min_val is None and max_val is None):
                continue
                
            if col not in df_filtered.columns:
                raise ValueError(f"Coluna numérica '{col}' não encontrada")
            
            if min_val is not None:
                df_filtered = df_filtered[df_filtered[col] >= min_val]
            if max_val is not None:
                df_filtered = df_filtered[df_filtered[col] <= max_val]
            
            applied_filters["numeric"].append({
                "col": col,
                "min": min_val,
                "max": max_val,
            })
    
    return df_filtered, applied_filters


@router.post("/{session_id}/apply")
def apply_filters(session_id: str, body: FilterRequest):
    """Aplicar filtros a uma sessão"""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, "Sessão não encontrada.")
    
    try:
        # Construir dict de filtros a partir do request
        filters = {}
        if body.date_range:
            filters["date_range"] = body.date_range
        if body.categorical:
            filters["categorical"] = body.categorical
        if body.numeric:
            filters["numeric"] = body.numeric
        
        # Se não há filtros, retornar erro
        if not filters:
            raise HTTPException(400, "Nenhum filtro fornecido.")
        
        # Aplicar filtros
        df_filtered, applied_filters = _apply_filters(session.df, filters)
        
        # Salvar na sessão
        session.df_filtered = df_filtered
        session.active_filters = applied_filters
        invalidate_chart_cache(session_id)
        
        # Contar filtros
        filter_count = (
            (1 if "date_range" in applied_filters else 0) +
            len(applied_filters.get("categorical", [])) +
            len(applied_filters.get("numeric", []))
        )
        
        return {
            "status": "applied",
            "total_rows": len(session.df),
            "filtered_rows": len(df_filtered),
            "filter_count": filter_count,
            "active_filters": applied_filters,
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erro ao aplicar filtros: {str(e)}")


@router.delete("/{session_id}")
def clear_filters(session_id: str):
    """Limpar todos os filtros de uma sessão"""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, "Sessão não encontrada.")
    
    session.df_filtered = None
    session.active_filters = {}
    invalidate_chart_cache(session_id)
    
    return {
        "status": "cleared",
        "total_rows": len(session.df),
        "filtered_rows": len(session.df),
        "active_filters": {},
    }


@router.get("/{session_id}/status")
def get_filter_status(session_id: str):
    """Verificar status de filtros da sessão"""
    info = get_session_info(session_id)
    if info is None:
        raise HTTPException(404, "Sessão não encontrada.")
    
    return {
        "total_rows": info["total_rows"],
        "filtered_rows": info["filtered_rows"],
        "is_filtered": info["is_filtered"],
        "filter_count": info["filter_count"],
        "active_filters": info["active_filters"],
        "cache_invalidated": info["cache_invalidated"],
    }


@router.get("/{session_id}/available")
def get_filter_options(session_id: str):
    """Retorna opções disponíveis para filtros (top 50 valores por coluna)"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(404, "Sessão não encontrada.")
    
    try:
        options = {}
        
        # Colunas de data
        date_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()
        options["date_columns"] = []
        for col in date_cols:
            min_date = df[col].min()
            max_date = df[col].max()
            options["date_columns"].append({
                "col": col,
                "min": min_date.isoformat() if pd.notna(min_date) else None,
                "max": max_date.isoformat() if pd.notna(max_date) else None,
            })
        
        # Colunas categóricas (top 50 por cardinalidade)
        options["categorical"] = {}
        cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
        for col in cat_cols:
            top_values = df[col].value_counts().head(50).index.tolist()
            options["categorical"][col] = [str(v) for v in top_values if pd.notna(v)]
        
        # Colunas numéricas
        num_cols = df.select_dtypes(include=["number"]).columns.tolist()
        options["numeric"] = {}
        for col in num_cols:
            options["numeric"][col] = {
                "min": float(df[col].min()) if df[col].notna().any() else 0,
                "max": float(df[col].max()) if df[col].notna().any() else 0,
                "mean": float(df[col].mean()) if df[col].notna().any() else 0,
                "std": float(df[col].std()) if df[col].notna().any() else 0,
            }
        
        return options
    except Exception as e:
        raise HTTPException(500, f"Erro ao obter opções de filtro: {str(e)}")
