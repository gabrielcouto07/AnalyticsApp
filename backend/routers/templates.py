"""
Templates router — NF, Efetivo, Orcamento, Custos endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any

from ..services.templates import get_all_templates, get_template, get_template_suggestions, filter_dataframe_for_template
from ..services.nf_analyzer import NFAnalyzer
from ..services.efetivo_analyzer import EfetivoAnalyzer
from ..services.orcamento_analyzer import OrcamentoAnalyzer
from ..services.custos_analyzer import CustosAnalyzer
from ..session import get_active_df, get_session_extra

router = APIRouter(prefix="/api/templates", tags=["templates"])


# ── Generic ──────────────────────────────────────────────────────────────────

@router.get("/list")
async def list_templates() -> Dict[str, Dict[str, Any]]:
    templates = get_all_templates()
    return {tid: {"name": t["name"], "description": t["description"], "icon": t["icon"], "color": t["color"]} for tid, t in templates.items()}

@router.get("/{template_id}")
async def get_template_detail(template_id: str) -> Dict[str, Any]:
    t = get_template(template_id)
    if not t: raise HTTPException(404, f"Template '{template_id}' not found")
    return t

@router.post("/suggest")
async def suggest_templates(columns: List[str]) -> Dict[str, Any]:
    suggestions = get_template_suggestions(columns)
    templates = get_all_templates()
    result = {"suggestions": [{"id": tid, "name": templates[tid]["name"], "description": templates[tid]["description"], "icon": templates[tid]["icon"]} for tid in suggestions if tid in templates], "primary": suggestions[0] if suggestions else None}
    return result

@router.get("/{template_id}/data/{session_id}")
async def get_template_data(template_id: str, session_id: str) -> Dict[str, Any]:
    t = get_template(template_id)
    if not t: raise HTTPException(404, "Template not found")
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    df_f = filter_dataframe_for_template(df, template_id)
    return {"template_id": template_id, "template_name": t["name"], "essential_columns": list(df_f.columns), "row_count": len(df_f), "preview_rows": df_f.head(5).to_dict(orient="records")}


# ── NF ───────────────────────────────────────────────────────────────────────

@router.get("/nf/analysis/{session_id}")
async def get_nf_analysis(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return NFAnalyzer(df).get_consolidated_report()

@router.get("/nf/summary/{session_id}")
async def get_nf_summary(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return NFAnalyzer(df).get_summary()

@router.get("/nf/suppliers/{session_id}")
async def get_nf_suppliers(session_id: str, limit: int = Query(10, ge=1, le=100)):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return NFAnalyzer(df).get_supplier_analysis()[:limit]

@router.get("/nf/top-invoices/{session_id}")
async def get_nf_top_invoices(session_id: str, limit: int = Query(20, ge=1, le=100)):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return NFAnalyzer(df).get_top_invoices(limit)


# ── Efetivo ──────────────────────────────────────────────────────────────────

@router.get("/efetivo/analysis/{session_id}")
async def get_efetivo_analysis(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return EfetivoAnalyzer(df).get_consolidated_report()

@router.get("/efetivo/monthly-breakdown/{session_id}")
async def get_efetivo_monthly_breakdown(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return EfetivoAnalyzer(df).get_monthly_breakdown()

@router.get("/efetivo/media-diaria/{session_id}")
async def get_efetivo_media_diaria(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return EfetivoAnalyzer(df).get_media_diaria_by_fornecedor()

@router.get("/efetivo/daily-by-fornecedor/{session_id}")
async def get_efetivo_daily_by_fornecedor(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return EfetivoAnalyzer(df).get_daily_by_fornecedor()


# ── Orcamento ────────────────────────────────────────────────────────────────

@router.get("/orcamento/analysis/{session_id}")
async def get_orcamento_analysis(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return OrcamentoAnalyzer(df).get_consolidated_report()

@router.get("/orcamento/summary/{session_id}")
async def get_orcamento_summary(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return OrcamentoAnalyzer(df).get_summary()

@router.get("/orcamento/price-pivot/{session_id}")
async def get_orcamento_price_pivot(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return OrcamentoAnalyzer(df).get_price_pivot()

@router.get("/orcamento/fornecedor-ranking/{session_id}")
async def get_orcamento_fornecedor_ranking(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return OrcamentoAnalyzer(df).get_fornecedor_ranking()

@router.get("/orcamento/item-analysis/{session_id}")
async def get_orcamento_item_analysis(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return OrcamentoAnalyzer(df).get_item_analysis()

@router.get("/orcamento/tipo-breakdown/{session_id}")
async def get_orcamento_tipo_breakdown(session_id: str):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    return OrcamentoAnalyzer(df).get_tipo_breakdown()


# ── Custos ───────────────────────────────────────────────────────────────────

@router.get("/custos/analysis/{session_id}")
async def get_custos_analysis(session_id: str):
    """Full consolidated report from both NFs and Consolidado sheets."""
    df_nfs = get_active_df(session_id)
    if df_nfs is None: raise HTTPException(404, "Session not found")
    df_cons = get_session_extra(session_id, "consolidado")
    meta = get_session_extra(session_id, "custos_meta") or {}
    if df_cons is None:
        import pandas as pd
        df_cons = pd.DataFrame()
    return CustosAnalyzer(df_nfs, df_cons, meta).get_consolidated_report()

@router.get("/custos/summary/{session_id}")
async def get_custos_summary(session_id: str):
    df_nfs = get_active_df(session_id)
    if df_nfs is None: raise HTTPException(404, "Session not found")
    df_cons = get_session_extra(session_id, "consolidado")
    meta = get_session_extra(session_id, "custos_meta") or {}
    import pandas as pd
    return CustosAnalyzer(df_nfs, df_cons if df_cons is not None else pd.DataFrame(), meta).get_summary()

@router.get("/custos/fornecedor-ranking/{session_id}")
async def get_custos_fornecedor_ranking(session_id: str, limit: int = Query(20, ge=1, le=100)):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    import pandas as pd
    return CustosAnalyzer(df, pd.DataFrame()).get_fornecedor_ranking(limit)

@router.get("/custos/top-nfs/{session_id}")
async def get_custos_top_nfs(session_id: str, limit: int = Query(20, ge=1, le=100)):
    df = get_active_df(session_id)
    if df is None: raise HTTPException(404, "Session not found")
    import pandas as pd
    return CustosAnalyzer(df, pd.DataFrame()).get_top_nfs(limit)

@router.get("/custos/consolidado-detail/{session_id}")
async def get_custos_consolidado_detail(session_id: str):
    df_nfs = get_active_df(session_id)
    if df_nfs is None: raise HTTPException(404, "Session not found")
    df_cons = get_session_extra(session_id, "consolidado")
    import pandas as pd
    return CustosAnalyzer(df_nfs, df_cons if df_cons is not None else pd.DataFrame()).get_consolidado_detail()
