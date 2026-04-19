"""
Templates router - Serves template definitions + specialized analysis endpoints
for NF, Efetivo, and Orçamento (Mapa de Concorrência) data types.
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
from ..services.efetivo_analyzer import EfetivoAnalyzer
from ..services.orcamento_analyzer import OrcamentoAnalyzer
from ..session import get_active_df

router = APIRouter(prefix="/api/templates", tags=["templates"])


# ═══════════════════════════════════════════════════════════════════════════════
# GENERIC TEMPLATE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/list")
async def list_templates() -> Dict[str, Dict[str, Any]]:
    templates = get_all_templates()
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
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return template


@router.post("/suggest")
async def suggest_templates(columns: List[str]) -> Dict[str, Any]:
    suggestions = get_template_suggestions(columns)
    templates = get_all_templates()

    result = {"suggestions": [], "primary": None}
    for template_id in suggestions:
        template = templates.get(template_id)
        if template:
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
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    df_filtered = filter_dataframe_for_template(df, template_id)

    return {
        "template_id": template_id,
        "template_name": template["name"],
        "essential_columns": list(df_filtered.columns),
        "row_count": len(df_filtered),
        "preview_rows": df_filtered.head(5).to_dict(orient="records"),
        "column_stats": {
            col: {
                "type": "numeric" if df_filtered[col].dtype in ["int64", "float64"] else "text",
                "null_count": int(df_filtered[col].isna().sum()),
                "null_percent": round(float(df_filtered[col].isna().sum() / len(df_filtered) * 100), 2),
                "sample": str(df_filtered[col].dropna().iloc[0]) if df_filtered[col].notna().any() else None,
            }
            for col in df_filtered.columns
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# NF ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/nf/analysis/{session_id}")
async def get_nf_analysis(session_id: str) -> Dict[str, Any]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_consolidated_report()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NF analysis error: {str(e)}")


@router.get("/nf/summary/{session_id}")
async def get_nf_summary(session_id: str) -> Dict[str, Any]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/nf/suppliers/{session_id}")
async def get_nf_suppliers(session_id: str, limit: int = Query(10, ge=1, le=100)) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_supplier_analysis()[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/nf/top-invoices/{session_id}")
async def get_nf_top_invoices(session_id: str, limit: int = Query(20, ge=1, le=100)) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_top_invoices(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# EFETIVO ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/efetivo/analysis/{session_id}")
async def get_efetivo_analysis(session_id: str) -> Dict[str, Any]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = EfetivoAnalyzer(df)
        return analyzer.get_consolidated_report()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Efetivo analysis error: {str(e)}")


@router.get("/efetivo/monthly-breakdown/{session_id}")
async def get_efetivo_monthly_breakdown(session_id: str) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = EfetivoAnalyzer(df)
        return analyzer.get_monthly_breakdown()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/efetivo/media-diaria/{session_id}")
async def get_efetivo_media_diaria(session_id: str) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = EfetivoAnalyzer(df)
        return analyzer.get_media_diaria_by_fornecedor()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/efetivo/daily-by-fornecedor/{session_id}")
async def get_efetivo_daily_by_fornecedor(session_id: str) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = EfetivoAnalyzer(df)
        return analyzer.get_daily_by_fornecedor()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# ORÇAMENTO (MAPA DE CONCORRÊNCIA) ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/orcamento/analysis/{session_id}")
async def get_orcamento_analysis(session_id: str) -> Dict[str, Any]:
    """Full consolidated report: summary + price pivot + ranking + item analysis."""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = OrcamentoAnalyzer(df)
        return analyzer.get_consolidated_report()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Orcamento analysis error: {str(e)}")


@router.get("/orcamento/summary/{session_id}")
async def get_orcamento_summary(session_id: str) -> Dict[str, Any]:
    """Quick summary: obra, assunto, totals per fornecedor, cheapest."""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = OrcamentoAnalyzer(df)
        return analyzer.get_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/orcamento/price-pivot/{session_id}")
async def get_orcamento_price_pivot(session_id: str) -> Dict[str, Any]:
    """Price comparison table: item × fornecedor with cheapest highlight."""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = OrcamentoAnalyzer(df)
        return analyzer.get_price_pivot()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/orcamento/fornecedor-ranking/{session_id}")
async def get_orcamento_fornecedor_ranking(session_id: str) -> List[Dict[str, Any]]:
    """Fornecedores ranked by total price, with wins count and coverage."""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = OrcamentoAnalyzer(df)
        return analyzer.get_fornecedor_ranking()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/orcamento/item-analysis/{session_id}")
async def get_orcamento_item_analysis(session_id: str) -> List[Dict[str, Any]]:
    """Per-item analysis: price spread, cheapest/most expensive fornecedor."""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = OrcamentoAnalyzer(df)
        return analyzer.get_item_analysis()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/orcamento/tipo-breakdown/{session_id}")
async def get_orcamento_tipo_breakdown(session_id: str) -> Dict[str, Any]:
    """Serviço vs Insumo breakdown."""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = OrcamentoAnalyzer(df)
        return analyzer.get_tipo_breakdown()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
