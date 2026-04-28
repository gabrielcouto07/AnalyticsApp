import json as _json

from fastapi import APIRouter, UploadFile, File, HTTPException, Query

from ..session import create_session, get_session
from ..services.analytics import calculate_kpis
from ..services.custos_parser import parse_custos_file
from ..services.custos_template import detect_custos_file
from ..services.efetivo_parser import parse_efetivo_file
from ..services.efetivo_template import detect_efetivo_file
from ..services.orcamento_parser import parse_orcamento_file
from ..services.orcamento_template import detect_orcamento_file
from ..services.parser import get_col_types, load_dataframe, normalize_col_name
from utils.file_reader import read_file_bytes


def _safe_preview(df):
    """Return preview records with NaN/inf replaced by None (JSON null)."""
    return _json.loads(df.head(10).to_json(orient="records", default_handler=str, force_ascii=False))


def _detect_schema_types(df):
    normalized_columns = {normalize_col_name(col) for col in df.columns}
    schema_types: list[str] = []

    if "valor" in normalized_columns and any(
        key in normalized_columns for key in {"centro_de_custo", "centro_custo"}
    ):
        schema_types.append("custos")

    if any("fornecedor" in column for column in normalized_columns) or any(
        "cargo" in column and "func" in column for column in normalized_columns
    ):
        schema_types.append("efetivo")

    if not schema_types:
        return ["generic"]

    return schema_types
def _merge_schema_types(template_type: str | None, detected_schema: list[str]) -> list[str]:
    merged = list(detected_schema or [])
    if template_type and template_type not in merged and template_type != "generic":
        merged.insert(0, template_type)
    if not merged:
        return ["generic"]
    if len(merged) > 1 and "generic" in merged:
        merged = [schema for schema in merged if schema != "generic"]
    return list(dict.fromkeys(merged))


router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    force_template: str | None = Query(None, pattern="^(efetivo|orcamento|custos|generic)$"),
):
    allowed = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    detected_schema = ["generic"]

    try:
        content = await file.read()
        custos_result = None

        def _parse_generic():
            print(f"[UPLOAD DEBUG] Using standard parser for '{file.filename}'")
            parsed_df, parsed_sheets, _ = load_dataframe(content, file.filename)
            return parsed_df, parsed_sheets, None

        if force_template == "custos":
            custos_result = parse_custos_file(content, file.filename)
            df = custos_result["nfs"]
            if df.empty:
                df = custos_result["consolidado"]
            if df.empty:
                raise HTTPException(422, "Custos file parsed but returned no records")
            template_type = "custos"
            available_sheets = {}
            detected_schema = _detect_schema_types(df)

        elif force_template == "efetivo":
            df = parse_efetivo_file(content, file.filename)
            if df.empty:
                raise HTTPException(422, "Efetivo file parsed but returned no records")
            template_type = "efetivo"
            available_sheets = {}
            detected_schema = _detect_schema_types(df)

        elif force_template == "orcamento":
            result = parse_orcamento_file(content, file.filename)
            df = result["flat"]
            if df.empty:
                raise HTTPException(422, "Orcamento file parsed but returned no records")
            template_type = "orcamento"
            available_sheets = {}
            detected_schema = _detect_schema_types(df)

        elif ext in {".csv", ".txt", ".json"}:
            df = read_file_bytes(content, ext)
            available_sheets = {}
            detected_schema = _detect_schema_types(df)
            template_type = detected_schema[0] if detected_schema[0] != "generic" else "generic"

        elif force_template == "generic":
            df, available_sheets, template_type = _parse_generic()
            detected_schema = _detect_schema_types(df)
            if template_type == "generic" and detected_schema[0] != "generic":
                template_type = detected_schema[0]

        elif ext in {".xlsx", ".xls", ".xlsm"}:
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

            else:
                df, available_sheets, template_type = _parse_generic()
                detected_schema = _detect_schema_types(df)
                if template_type == "generic" and detected_schema[0] != "generic":
                    template_type = detected_schema[0]

        else:
            df, available_sheets, template_type = _parse_generic()
            detected_schema = _detect_schema_types(df)
            if template_type == "generic" and detected_schema[0] != "generic":
                template_type = detected_schema[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")

    detected_schema = _merge_schema_types(template_type, detected_schema)
    col_types = {str(k): v for k, v in get_col_types(df).items()}

    extras = {}
    if template_type == "custos" and custos_result is not None:
        extras["consolidado"] = custos_result["consolidado"]
        extras["custos_meta"] = custos_result["meta"]

    session_id = create_session(df, template_type=template_type, extras=extras, schema_types=detected_schema)
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
        "detected_schema": detected_schema,
        "preview": _safe_preview(df),
    }
