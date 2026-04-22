import json as _json

from fastapi import APIRouter, UploadFile, File, HTTPException
from ..session import create_session, get_session
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


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    try:
        content = await file.read()
        custos_result = None

        if ext in {".xlsx", ".xls", ".xlsm"}:
            # 0) Check Custos layout FIRST (most specific — looks for NF + CONSOLIDADO sheets)
            if detect_custos_file(content, file.filename):
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
