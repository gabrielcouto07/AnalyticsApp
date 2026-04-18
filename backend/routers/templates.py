"""
Templates router - Serve template definitions for different data types
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any

from ..services.templates import (
    get_all_templates,
    get_template,
    get_template_suggestions,
    filter_dataframe_for_template,
)
from ..services.nf_analyzer import NFAnalyzer
from ..session import get_active_df

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/list")
async def list_templates() -> Dict[str, Dict[str, Any]]:
    """
    Get list of all available templates
    
    Returns:
        Dictionary with all templates and their configurations
    """
    templates = get_all_templates()
    # Return only essential info for listing
    result = {}
    for template_id, template in templates.items():
        result[template_id] = {
            "name": template["name"],
            "description": template["description"],
            "icon": template["icon"],
            "color": template["color"],
        }
    return result


@router.get("/{template_id}")
async def get_template_detail(template_id: str) -> Dict[str, Any]:
    """
    Get detailed template configuration
    
    Args:
        template_id: Template identifier (nf, sales, inventory, projects, hr)
    
    Returns:
        Complete template definition with metrics, visualizations, and filters
    
    Raises:
        HTTPException: If template not found
    """
    template = get_template(template_id)
    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"Template '{template_id}' not found. Available: nf, sales, inventory, projects, hr"
        )
    return template


@router.post("/suggest")
async def suggest_templates(columns: List[str]) -> Dict[str, Any]:
    """
    Suggest appropriate templates based on column names
    
    Args:
        columns: List of column names from uploaded file
    
    Returns:
        Dictionary with suggested template IDs and details
    """
    suggestions = get_template_suggestions(columns)
    templates = get_all_templates()
    
    result = {
        "suggestions": [],
        "primary": None,
    }
    
    for template_id in suggestions:
        template = templates[template_id]
        result["suggestions"].append({
            "id": template_id,
            "name": template["name"],
            "description": template["description"],
            "icon": template["icon"],
        })
    
    if result["suggestions"]:
        result["primary"] = suggestions[0]
    
    return result


@router.get("/{template_id}/data/{session_id}")
async def get_template_data(template_id: str, session_id: str) -> Dict[str, Any]:
    """
    Get filtered and cleaned data for a specific template.
    Returns only essential columns defined for the template, removes auxiliary columns.
    
    Args:
        template_id: Template identifier (nf, sales, inventory, projects, hr)
        session_id: Session ID to retrieve data from
    
    Returns:
        Dictionary with filtered data, essential columns, and column metadata
    
    Raises:
        HTTPException: If template or session not found
    """
    # Validate template exists
    template = get_template(template_id)
    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"Template '{template_id}' not found"
        )
    
    # Get dataframe from session
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found or no data loaded"
        )
    
    # Filter dataframe for template
    df_filtered = filter_dataframe_for_template(df, template_id)
    
    # Convert to JSON-serializable format
    result = {
        "template_id": template_id,
        "template_name": template["name"],
        "essential_columns": list(df_filtered.columns),
        "row_count": len(df_filtered),
        "preview_rows": df_filtered.head(5).to_dict(orient='records'),
        "column_stats": {
            col: {
                "type": "numeric" if df_filtered[col].dtype in ['int64', 'float64'] else "text",
                "null_count": int(df_filtered[col].isna().sum()),
                "null_percent": round(float(df_filtered[col].isna().sum() / len(df_filtered) * 100), 2),
                "sample": str(df_filtered[col].dropna().iloc[0]) if df_filtered[col].notna().any() else None,
            }
            for col in df_filtered.columns
        }
    }
    
    return result


@router.get("/nf/analysis/{session_id}")
async def get_nf_analysis(session_id: str) -> Dict[str, Any]:
    """
    Get comprehensive NF (Notas Fiscais) analysis with:
    - Summary metrics (total value, count, suppliers)
    - Supplier breakdown
    - Payment method analysis
    - Nature/type analysis
    - Timeline analysis
    - Top 20 invoices
    
    Args:
        session_id: Session ID with uploaded NF data (12.csv)
    
    Returns:
        Complete analysis report with all breakdowns and metrics
    
    Raises:
        HTTPException: If session not found
    """
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found"
        )
    
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_consolidated_report()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing NF data: {str(e)}"
        )


@router.get("/nf/summary/{session_id}")
async def get_nf_summary(session_id: str) -> Dict[str, Any]:
    """Get NF summary metrics only (faster endpoint for KPI cards)"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/nf/suppliers/{session_id}")
async def get_nf_suppliers(
    session_id: str,
    limit: int = Query(10, ge=1, le=100)
) -> List[Dict[str, Any]]:
    """Get supplier analysis with top N suppliers"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        suppliers = analyzer.get_supplier_analysis()
        return suppliers[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/nf/top-invoices/{session_id}")
async def get_nf_top_invoices(
    session_id: str,
    limit: int = Query(20, ge=1, le=100)
) -> List[Dict[str, Any]]:
    """Get top invoices by value"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_top_invoices(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
