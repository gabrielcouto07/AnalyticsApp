"""
Router para dashboard de Materiais/Mapa de Concorrência.

Fornece os 6 níveis de análise:
1. Executive
2. Cost Structure
3. Temporal
4. Efficiency
5. Relationships
6. Explanations
"""

from fastapi import APIRouter, HTTPException
from ..session import get_session
from ..services.materiais_analytics import MateriaisAnalytics

router = APIRouter(prefix="/api/materiais", tags=["materiais"])


@router.get("/analyze/{session_id}")
async def analyze_materiais(session_id: str):
    """
    Get complete 6-layer analysis for Materiais data.
    
    Returns all layers:
    - layer_1: Executive KPIs
    - layer_2: Cost Structure
    - layer_3: Temporal Analysis
    - layer_4: Efficiency & Problems
    - layer_5: Relationships
    - layer_6: Explanations (THE DIFFERENTIATOR)
    """
    session = get_session(session_id)
    if not session or session.data.empty:
        raise HTTPException(404, "Session not found or empty")
    
    try:
        analytics = MateriaisAnalytics(session.data)
        analysis = analytics.analyze()
        
        return {
            "session_id": session_id,
            "template": "materiais",
            "analysis": analysis,
            "data_summary": {
                "rows": len(session.data),
                "columns": len(session.data.columns),
                "columns_list": list(session.data.columns),
            }
        }
    except Exception as e:
        print(f"[ERROR] Materiais analysis failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Analysis failed: {e}")


@router.get("/layer/{session_id}/{layer}")
async def get_layer(session_id: str, layer: str):
    """
    Get specific layer of analysis.
    
    Layers:
    - layer_1: Executive
    - layer_2: Cost Structure
    - layer_3: Temporal
    - layer_4: Efficiency
    - layer_5: Relationships
    - layer_6: Explanations
    """
    session = get_session(session_id)
    if not session or session.data.empty:
        raise HTTPException(404, "Session not found")
    
    valid_layers = ["layer_1", "layer_2", "layer_3", "layer_4", "layer_5", "layer_6"]
    if layer not in valid_layers:
        raise HTTPException(400, f"Invalid layer. Must be one of: {valid_layers}")
    
    try:
        analytics = MateriaisAnalytics(session.data)
        analysis = analytics.analyze()
        
        return {
            "session_id": session_id,
            "layer": layer,
            "data": analysis.get(layer, {})
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get layer: {e}")


@router.get("/kpis/{session_id}")
async def get_kpis(session_id: str):
    """Quick access to executive KPIs."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    analytics = MateriaisAnalytics(session.data)
    layer_1 = analytics.layer_1_executive()
    
    return layer_1.get("kpis", {})


@router.get("/costs/{session_id}")
async def get_costs(session_id: str):
    """Quick access to cost breakdown."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    analytics = MateriaisAnalytics(session.data)
    layer_2 = analytics.layer_2_cost_structure()
    
    return {
        "cost_breakdown": layer_2.get("cost_breakdown", []),
        "suppliers": layer_2.get("fornecedor_performance", []),
        "projects": layer_2.get("projeto_custo", [])
    }


@router.get("/suppliers/{session_id}")
async def get_suppliers(session_id: str):
    """Get supplier performance data."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    analytics = MateriaisAnalytics(session.data)
    layer_2 = analytics.layer_2_cost_structure()
    
    return {
        "suppliers": layer_2.get("fornecedor_performance", [])
    }


@router.get("/calculation-log/{session_id}")
async def get_calculation_log(session_id: str):
    """Get calculation log (layer 6 - THE DIFFERENTIATOR)."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    analytics = MateriaisAnalytics(session.data)
    layer_6 = analytics.layer_6_explanations()
    
    return {
        "calculation_log": layer_6.get("calculation_log", []),
        "metadata": layer_6.get("metadata", {}),
        "insights": layer_6.get("insights", [])
    }
