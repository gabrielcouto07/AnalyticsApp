import logging
import traceback
import math

from fastapi import APIRouter, UploadFile, File, HTTPException
from ..session import create_session
from ..services.parser import load_dataframe, get_col_types
from ..services.efetivo_template import detect_efetivo_file
from ..services.efetivo_parser import parse_efetivo_file
from ..services.orcamento_template import detect_orcamento_file
from ..services.orcamento_parser import parse_orcamento_file
from ..services.custos_template import detect_custos_file
from ..services.custos_parser import parse_custos_file
from ..services.medicao_parser import detect_medicao_file, parse_workbook_from_bytes as parse_medicao_bytes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["upload"])


def _clean_nan(o):
    """Recursively replace NaN/Inf with None for JSON safety."""
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
        return None
    if isinstance(o, dict):
        return {str(k): _clean_nan(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean_nan(v) for v in o]
    return o


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    try:
        content = await file.read()
        result = None
        available_sheets = {}
        template_type = None

        if ext in {".xlsx", ".xls", ".xlsm"}:
            if detect_medicao_file(content, file.filename):
                logger.info(f"[upload] {file.filename} → detected as MEDICAO")
                result = parse_medicao_bytes(content, file.filename)
                import pandas as pd
                rows = []
                for m in result.get("medicoes", []):
                    for s in m.get("servicos", []):
                        rows.append({
                            "fornecedor": m["header"].get("fornecedor"),
                            "aba": m.get("aba"),
                            "bm_numero": m["header"].get("bm_numero"),
                            "item": s.get("item"),
                            "nome": s.get("nome"),
                            "tipo": s.get("tipo"),
                            "qtde_medicao": s.get("qtde_medicao"),
                            "total_desta_medicao": s.get("total_desta_medicao"),
                        })
                df = pd.DataFrame(rows) if rows else pd.DataFrame(
                    columns=["fornecedor", "aba", "bm_numero", "item", "nome", "tipo", "qtde_medicao", "total_desta_medicao"]
                )
                template_type = "medicao"

            elif detect_custos_file(content, file.filename):
                logger.info(f"[upload] {file.filename} → detected as CUSTOS")
                result = parse_custos_file(content, file.filename)
                df = result["nfs"]
                if df.empty:
                    df = result["consolidado"]
                if df.empty:
                    df, available_sheets = load_dataframe(content, file.filename)
                    template_type = None
                else:
                    template_type = "custos"

            elif detect_efetivo_file(content, file.filename):
                logger.info(f"[upload] {file.filename} → detected as EFETIVO")
                df = parse_efetivo_file(content, file.filename)
                if df.empty:
                    raise HTTPException(422, "Efetivo file parsed but returned no records")
                template_type = "efetivo"

            elif detect_orcamento_file(content, file.filename):
                logger.info(f"[upload] {file.filename} → detected as ORCAMENTO")
                result = parse_orcamento_file(content, file.filename)
                df = result["flat"]
                if df.empty:
                    raise HTTPException(422, "Orcamento file parsed but returned no records")
                template_type = "orcamento"

            else:
                logger.info(f"[upload] {file.filename} → generic Excel (no template matched)")
                df, available_sheets = load_dataframe(content, file.filename)
                template_type = None
        else:
            df, available_sheets = load_dataframe(content, file.filename)
            template_type = None

        extras = {}
        if template_type == "medicao" and result is not None:
            extras["medicao_data"] = result
        elif template_type == "custos" and result is not None:
            extras["consolidado"] = result["consolidado"]
            extras["custos_meta"] = result["meta"]

        session_id = create_session(df, template_type=template_type, extras=extras)
        col_types = {str(k): v for k, v in get_col_types(df).items()}

        # Build preview with full NaN sanitization
        preview_raw = df.head(10).astype(object).where(df.head(10).notna(), None).to_dict(orient="records")
        preview = _clean_nan(preview_raw)

        response = {
            "session_id": session_id,
            "filename": file.filename,
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "col_types": col_types,
            "available_sheets": available_sheets or {},
            "template": template_type,
            "preview": preview,
        }
        return _clean_nan(response)

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[upload] FAILED on {file.filename}:\n{tb}")
        raise HTTPException(422, f"Erro ao processar arquivo: {type(e).__name__}: {e}")
