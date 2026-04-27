import json as _json
from typing import Any, Dict, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from ..session import create_session, get_session, get_active_df
from ..services.parser import load_dataframe, get_col_types
from ..services.analytics import calculate_kpis
from ..services.efetivo_template import detect_efetivo_file
from ..services.efetivo_parser import parse_efetivo_file
from ..services.orcamento_template import detect_orcamento_file
from ..services.orcamento_parser import parse_orcamento_file
from ..services.custos_template import detect_custos_file
from ..services.custos_parser import parse_custos_file


def _safe_preview(df):
    """Return preview records with NaN/inf replaced by None (JSON null)."""
    return _json.loads(df.head(10).to_json(orient="records", default_handler=str, force_ascii=False))

router = APIRouter(prefix="/api", tags=["upload"])

_VALID_FORCE_TEMPLATES = {"efetivo", "orcamento", "custos", "generic"}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    force_template: str = Query(None, description="Override auto-detection: efetivo|orcamento|custos|generic"),
):
    allowed = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    if force_template is not None and force_template not in _VALID_FORCE_TEMPLATES:
        raise HTTPException(400, f"force_template inválido: {force_template}. Use: {sorted(_VALID_FORCE_TEMPLATES)}")

    try:
        content = await file.read()
        custos_result = None

        if ext in {".xlsx", ".xls", ".xlsm"}:
            # ── Forced template override ─────────────────────────────────
            if force_template == "custos":
                print(f"[UPLOAD DEBUG] force_template=custos for '{file.filename}'")
                custos_result = parse_custos_file(content, file.filename)
                df = custos_result["nfs"]
                if df.empty:
                    df = custos_result["consolidado"]
                if df.empty:
                    raise HTTPException(422, "Custos file parsed but returned no records")
                template_type = "custos"
                available_sheets = {}

            elif force_template == "efetivo":
                print(f"[UPLOAD DEBUG] force_template=efetivo for '{file.filename}'")
                df = parse_efetivo_file(content, file.filename)
                if df.empty:
                    raise HTTPException(422, "Efetivo file parsed but returned no records")
                template_type = "efetivo"
                available_sheets = {}

            elif force_template == "orcamento":
                print(f"[UPLOAD DEBUG] force_template=orcamento for '{file.filename}'")
                result = parse_orcamento_file(content, file.filename)
                df = result["flat"]
                if df.empty:
                    raise HTTPException(422, "Orcamento file parsed but returned no records")
                template_type = "orcamento"
                available_sheets = {}

            elif force_template == "generic":
                print(f"[UPLOAD DEBUG] force_template=generic for '{file.filename}'")
                df, available_sheets, _ = load_dataframe(content, file.filename)
                template_type = None

            # ── Auto-detection cascade ───────────────────────────────────
            # 0) Check Custos layout FIRST (most specific — looks for NF + CONSOLIDADO sheets)
            elif detect_custos_file(content, file.filename):
                print(f"[UPLOAD DEBUG] Custos detection successful for '{file.filename}'")
                custos_result = parse_custos_file(content, file.filename)
                df = custos_result["nfs"]
                if df.empty:
                    df = custos_result["consolidado"]
                if df.empty:
                    raise HTTPException(422, "Custos file parsed but returned no records")
                template_type = "custos"
                available_sheets = {}

            # 1) Check Efetivo layout
            elif (is_efetivo := detect_efetivo_file(content, file.filename)):
                print(f"[UPLOAD DEBUG] Efetivo detection for '{file.filename}': {is_efetivo}")
                try:
                    df = parse_efetivo_file(content, file.filename)
                    print(f"[UPLOAD DEBUG] Efetivo parsed: shape={df.shape}, empty={df.empty}")
                    if df.empty:
                        raise HTTPException(422, "Efetivo file parsed but returned no records")
                    template_type = "efetivo"
                    available_sheets = {}
                except Exception as e:
                    print(f"[UPLOAD ERROR] Efetivo parsing failed: {e}")
                    raise

            # 2) Check Orçamento (Mapa de Concorrência) layout
            elif detect_orcamento_file(content, file.filename):
                try:
                    result = parse_orcamento_file(content, file.filename)
                    df = result["flat"]
                    print(f"[UPLOAD DEBUG] Orcamento parsed: shape={df.shape}")
                    if df.empty:
                        raise HTTPException(422, "Orcamento file parsed but returned no records")
                    template_type = "orcamento"
                    available_sheets = {}
                except Exception as e:
                    print(f"[UPLOAD ERROR] Orcamento parsing failed: {e}")
                    raise

            # 4) Standard Excel
            else:
                print(f"[UPLOAD DEBUG] Using standard Excel parser for '{file.filename}'")
                df, available_sheets, _ = load_dataframe(content, file.filename)
                template_type = None
        else:
            if force_template and force_template != "generic":
                raise HTTPException(400, f"force_template='{force_template}' não suportado para arquivos {ext}")
            df, available_sheets, _ = load_dataframe(content, file.filename)
            template_type = None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")

    # Get column types (ensure keys are plain Python str, not numpy.str_)
    col_types = {str(k): v for k, v in get_col_types(df).items()}

    extras = {}
    if template_type == "custos" and custos_result is not None:
        extras["consolidado"] = custos_result["consolidado"]
        extras["custos_meta"] = custos_result["meta"]

    session_id = create_session(df, template_type=template_type, extras=extras)
    session = get_session(session_id)
    if session is not None:
        calculate_kpis(df)

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "col_types": col_types,
        "available_sheets": available_sheets or {},
        "template": template_type,
        "preview": _safe_preview(df),
    }


@router.get("/compare/{session_id_efetivo}/{session_id_orcamento}/{session_id_custos}")
async def compare_sessions(
    session_id_efetivo: str,
    session_id_orcamento: str,
    session_id_custos: str,
) -> Dict[str, Any]:
    """
    Cross-analysis joining Efetivo, Orçamento and Custos DataFrames on the Obra field.

    Pass "none" for any session_id to skip that dimension.

    Returns:
      efetivo_total_diarias       – total Quantidade from the efetivo session
      orcamento_total_valor       – total Preco from the orcamento session
      custos_total_valor          – total Valor from the custos session
      delta_orcamento_custos_pct  – % difference (custos vs orcamento)
      delta_efetivo_vs_orcamento_pct – placeholder for workforce-vs-budget comparison
    """
    import pandas as pd

    def _get_df_or_none(sid: str) -> Optional[Any]:
        return None if sid.lower() == "none" else get_active_df(sid)

    df_ef = _get_df_or_none(session_id_efetivo)
    df_orc = _get_df_or_none(session_id_orcamento)
    df_cus = _get_df_or_none(session_id_custos)

    if df_ef is None and df_orc is None and df_cus is None:
        raise HTTPException(status_code=400, detail="All session_ids are 'none' — nothing to compare")

    # ── Efetivo ────────────────────────────────────────────────────────
    efetivo_total_diarias: Optional[float] = None
    efetivo_obra: Optional[str] = None
    if df_ef is not None:
        if "Quantidade" in df_ef.columns:
            efetivo_total_diarias = round(float(pd.to_numeric(df_ef["Quantidade"], errors="coerce").sum()), 2)
        if "Obra" in df_ef.columns and len(df_ef) > 0:
            efetivo_obra = str(df_ef["Obra"].iloc[0])

    # ── Orçamento ──────────────────────────────────────────────────────
    orcamento_total_valor: Optional[float] = None
    orcamento_obra: Optional[str] = None
    if df_orc is not None:
        price_col = next((c for c in ["Preco", "ValorTotal", "ValorUnitario"] if c in df_orc.columns), None)
        if price_col:
            orcamento_total_valor = round(float(pd.to_numeric(df_orc[price_col], errors="coerce").sum()), 2)
        if "Obra" in df_orc.columns and len(df_orc) > 0:
            orcamento_obra = str(df_orc["Obra"].iloc[0])

    # ── Custos ─────────────────────────────────────────────────────────
    custos_total_valor: Optional[float] = None
    if df_cus is not None and "Valor" in df_cus.columns:
        custos_total_valor = round(float(pd.to_numeric(df_cus["Valor"], errors="coerce").sum()), 2)

    # ── Deltas ─────────────────────────────────────────────────────────
    delta_orcamento_custos_pct: Optional[float] = None
    if orcamento_total_valor is not None and custos_total_valor is not None and orcamento_total_valor != 0:
        delta_orcamento_custos_pct = round(
            (custos_total_valor - orcamento_total_valor) / orcamento_total_valor * 100, 2
        )

    delta_efetivo_vs_orcamento_pct: Optional[float] = None
    if efetivo_total_diarias is not None and orcamento_total_valor is not None and orcamento_total_valor != 0:
        delta_efetivo_vs_orcamento_pct = round(
            (efetivo_total_diarias - orcamento_total_valor) / orcamento_total_valor * 100, 2
        )

    return {
        "efetivo_total_diarias": efetivo_total_diarias,
        "orcamento_total_valor": orcamento_total_valor,
        "custos_total_valor": custos_total_valor,
        "delta_orcamento_custos_pct": delta_orcamento_custos_pct,
        "delta_efetivo_vs_orcamento_pct": delta_efetivo_vs_orcamento_pct,
        "obras": {
            "efetivo": efetivo_obra,
            "orcamento": orcamento_obra,
        },
    }
