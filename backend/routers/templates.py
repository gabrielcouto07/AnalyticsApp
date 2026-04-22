"""
Templates router - Serves template definitions + specialized analysis endpoints
for NF, Efetivo, and Orçamento (Mapa de Concorrência) data types.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Dict, Any

from ..services.templates import (
    get_all_templates,
    get_template,
    get_template_suggestions,
    filter_dataframe_for_template,
)
from ..services.nf_analyzer import NFAnalyzer
from ..services.semantic import SemanticAnalyzer
from ..services.efetivo_analyzer import EfetivoAnalyzer
from ..services.orcamento_analyzer import OrcamentoAnalyzer
from ..services.custos_analyzer import CustosAnalyzer
from ..session import get_active_df, get_session_extra

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
async def suggest_templates(payload: Dict[str, List[str]] = Body(...)) -> Dict[str, Any]:
    """
    Suggest appropriate templates based on column names
    
    Args:
        payload: Dictionary with 'columns' key containing list of column names from uploaded file
    
    Returns:
        Dictionary with suggested template IDs and details
    """
    columns = payload.get("columns", [])
    if not columns:
        return {
            "suggestions": [],
            "primary": None,
        }
    
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


@router.get("/nf/semantic/{session_id}")
async def get_nf_semantic(session_id: str) -> Dict[str, Any]:
    """
    Get semantic classification of NF data columns
    
    Returns semantic analysis including:
    - Column classifications (monetary, temporal, category, etc.)
    - Confidence scores for each classification
    - Column groupings by semantic type
    - Primary column identifications
    
    Args:
        session_id: Session ID with uploaded NF data
    
    Returns:
        Dictionary with semantic analysis results
    
    Raises:
        HTTPException: If session not found
    """
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = SemanticAnalyzer()
        profile = analyzer.build_dataset_profile(df)
        return profile
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
        print(f"[ERROR] Efetivo analysis failed for {session_id}: {str(e)}")
        return {"summary": {}, "error": f"Efetivo analysis error: {str(e)}"}


@router.get("/efetivo/monthly-breakdown/{session_id}")
async def get_efetivo_monthly_breakdown(session_id: str) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        analyzer = EfetivoAnalyzer(df)
        result = analyzer.get_monthly_breakdown()
        return result if result else []
    except Exception as e:
        # Log error but return empty list - file might not be Efetivo format
        print(f"[ERROR] Efetivo monthly breakdown failed for {session_id}: {str(e)}")
        return []


@router.get("/nf/nature/{session_id}")
async def get_nf_nature(session_id: str) -> List[Dict[str, Any]]:
    """Get nature/category analysis"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_nature_analysis()
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


@router.get("/nf/payment/{session_id}")
async def get_nf_payment(session_id: str) -> List[Dict[str, Any]]:
    """Get payment method analysis"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_payment_method_analysis()
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


@router.get("/nf/timeline/{session_id}")
async def get_nf_timeline(session_id: str) -> List[Dict[str, Any]]:
    """Get timeline/period analysis"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        return analyzer.get_timeline_analysis()
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


@router.post("/nf/data/{session_id}")
async def get_nf_data(
    session_id: str,
    filters: Dict[str, Any] = Body(None),
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0)
) -> Dict[str, Any]:
    """Get filtered NF data with pagination"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        df_filtered = analyzer.get_filtered_data(filters)
        
        total_rows = len(df_filtered)
        df_paginated = df_filtered.iloc[offset:offset + limit]
        
        return {
            "total": total_rows,
            "limit": limit,
            "offset": offset,
            "rows": df_paginated.to_dict(orient='records'),
            "columns": list(df_filtered.columns)
        }
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


@router.get("/nf/stats/{session_id}")
async def get_nf_stats(session_id: str) -> Dict[str, Any]:
    """Get comprehensive NF statistics for dashboard"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        analyzer = NFAnalyzer(df)
        summary = analyzer.get_summary()
        suppliers = analyzer.get_supplier_analysis(limit=10)
        nature = analyzer.get_nature_analysis(limit=10)
        payment = analyzer.get_payment_method_analysis()
        
        return {
            "summary": summary,
            "top_suppliers": suppliers[:5],
            "nature_breakdown": nature,
            "payment_methods": payment,
            "column_mapping": analyzer.column_map
        }
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


# ═══════════════════════════════════════════════════════════════════════════════
# MATERIAIS (MAPA DE CONCORRÊNCIA) ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/materiais/analysis/{session_id}")
async def get_materiais_analysis(session_id: str) -> Dict[str, Any]:
    """Full materiais/mapa de concorrência analysis with KPI, charts and comparisons"""
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        import pandas as pd
        import numpy as np
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[Materiais Analysis] DataFrame shape: {df.shape}, columns: {list(df.columns)}")
        logger.info(f"[Materiais Analysis] First row:\n{df.iloc[0] if len(df) > 0 else 'Empty'}")
        
        # Extract KPI data - handle None/NaN values
        items_count = 0
        if 'Item' in df.columns:
            items_count = len(df[df['Item'].notna()].drop_duplicates(subset=['Item'], keep='first'))
        else:
            items_count = len(df)
        
        suppliers_count = 0
        if 'FornecedorNome' in df.columns:
            suppliers_count = len(df['FornecedorNome'].dropna().unique())
        else:
            suppliers_count = 1
        
        # Find minimum price and supplier
        min_price = 0.0
        supplier_min = "N/A"
        if 'ValorTotal' in df.columns:
            df['ValorTotal_numeric'] = pd.to_numeric(df['ValorTotal'], errors='coerce')
            valid_prices = df[df['ValorTotal_numeric'].notna()]['ValorTotal_numeric']
            if len(valid_prices) > 0 and valid_prices.min() > 0:
                min_price = float(valid_prices.min())
                # Find supplier with this min price
                supplier_rows = df[df['ValorTotal_numeric'] == min_price]
                if len(supplier_rows) > 0 and 'FornecedorNome' in supplier_rows.columns:
                    supplier_min = str(supplier_rows.iloc[0]['FornecedorNome'])
        
        # Calculate total value
        total_value = 0.0
        if 'ValorTotal' in df.columns:
            total_series = pd.to_numeric(df['ValorTotal'], errors='coerce').dropna()
            if len(total_series) > 0:
                total_value = float(total_series.sum())
        
        # Count services vs inputs
        services = 0
        inputs = 0
        if 'Tipo' in df.columns:
            tipo_counts = df['Tipo'].value_counts()
            services = int(tipo_counts.get('Serviço', 0))
            inputs = int(tipo_counts.get('Insumo', 0))
        
        logger.info(f"[Materiais Analysis] KPI - Items: {items_count}, Suppliers: {suppliers_count}, Min Price: {min_price}, Total: {total_value}")
        
        # Supplier price chart
        supplier_chart = []
        if 'FornecedorNome' in df.columns and 'ValorTotal' in df.columns:
            df['ValorTotal_numeric'] = pd.to_numeric(df['ValorTotal'], errors='coerce')
            supplier_totals = df.groupby('FornecedorNome')['ValorTotal_numeric'].sum().sort_values(ascending=False)
            supplier_chart = [
                {
                    "name": str(supplier),
                    "value": float(value),
                    "formatted": f"R$ {float(value):,.2f}"
                }
                for supplier, value in supplier_totals.items() if pd.notna(value) and value > 0
            ]
            logger.info(f"[Materiais Analysis] Supplier chart - {len(supplier_chart)} entries")
        
        # Type distribution chart
        type_chart = []
        if 'Tipo' in df.columns:
            tipo_counts = df['Tipo'].value_counts()
            type_chart = [
                {"name": str(tipo), "value": int(count)}
                for tipo, count in tipo_counts.items()
            ]
            logger.info(f"[Materiais Analysis] Type chart - {len(type_chart)} types")
        
        # Comparison data (price comparison table)
        comparison = []
        if 'Item' in df.columns and 'Descricao' in df.columns:
            items_data = df[df['Item'].notna()].drop_duplicates(subset=['Item'], keep='first')
            for idx, (_, item) in enumerate(items_data.head(10).iterrows()):
                item_prices = {}
                item_id = item.get('Item')
                if pd.isna(item_id):
                    continue
                    
                item_df = df[df['Item'] == item_id]
                if 'FornecedorNome' in item_df.columns and 'ValorUnitario' in item_df.columns:
                    for _, supplier_row in item_df.iterrows():
                        supplier_name = supplier_row.get('FornecedorNome', 'Unknown')
                        if pd.isna(supplier_name):
                            supplier_name = 'Unknown'
                        price_raw = supplier_row.get('ValorUnitario')
                        if price_raw is not None and price_raw != '':
                            try:
                                price = float(price_raw) if isinstance(price_raw, (int, float)) else float(str(price_raw).replace('R$', '').replace(',', '.').strip())
                                item_prices[str(supplier_name)] = price
                            except (ValueError, TypeError):
                                pass
                
                if item_prices:  # Only add if has prices
                    comparison.append({
                        "item": str(item.get('Descricao', item.get('Item', 'N/A')))[:50],
                        "quantity": int(item.get('Quant', 1)) if pd.notna(item.get('Quant')) else 1,
                        "type": str(item.get('Tipo', 'Serviço')),
                        "prices": item_prices
                    })
            
            logger.info(f"[Materiais Analysis] Comparison data - {len(comparison)} items")
        
        response = {
            "kpi": {
                "items": items_count,
                "suppliers": suppliers_count,
                "minPrice": min_price,
                "supplier": supplier_min,
                "totalValue": total_value,
                "services": services,
                "inputs": inputs
            },
            "supplierChart": supplier_chart,
            "typeChart": type_chart,
            "comparison": comparison
        }
        
        logger.info(f"[Materiais Analysis] Response prepared successfully")
        return response
        
    except Exception as e:
        import traceback
        logger_err = logging.getLogger(__name__)
        logger_err.error(f"Materiais analysis error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Materiais analysis error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# CUSTOS (CONTROLE DE CUSTOS CONSOLIDADOS) ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/custos/analysis/{session_id}")
async def get_custos_analysis(session_id: str) -> Dict[str, Any]:
    """Full consolidated report from both NFs and Consolidado sheets."""
    df_nfs = get_active_df(session_id)
    if df_nfs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    df_cons = get_session_extra(session_id, "consolidado")
    meta = get_session_extra(session_id, "custos_meta") or {}
    if df_cons is None:
        import pandas as pd
        df_cons = pd.DataFrame()
    try:
        return CustosAnalyzer(df_nfs, df_cons, meta).get_consolidated_report()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Custos analysis error: {str(e)}")


@router.get("/custos/summary/{session_id}")
async def get_custos_summary(session_id: str) -> Dict[str, Any]:
    df_nfs = get_active_df(session_id)
    if df_nfs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    df_cons = get_session_extra(session_id, "consolidado")
    meta = get_session_extra(session_id, "custos_meta") or {}
    import pandas as pd
    return CustosAnalyzer(df_nfs, df_cons if df_cons is not None else pd.DataFrame(), meta).get_summary()


@router.get("/custos/fornecedor-ranking/{session_id}")
async def get_custos_fornecedor_ranking(session_id: str, limit: int = Query(20, ge=1, le=100)) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    import pandas as pd
    return CustosAnalyzer(df, pd.DataFrame()).get_fornecedor_ranking(limit)


@router.get("/custos/top-nfs/{session_id}")
async def get_custos_top_nfs(session_id: str, limit: int = Query(20, ge=1, le=100)) -> List[Dict[str, Any]]:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    import pandas as pd
    return CustosAnalyzer(df, pd.DataFrame()).get_top_nfs(limit)


@router.get("/custos/consolidado-detail/{session_id}")
async def get_custos_consolidado_detail(session_id: str) -> List[Dict[str, Any]]:
    df_nfs = get_active_df(session_id)
    if df_nfs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    df_cons = get_session_extra(session_id, "consolidado")
    import pandas as pd
    return CustosAnalyzer(df_nfs, df_cons if df_cons is not None else pd.DataFrame()).get_consolidado_detail()
