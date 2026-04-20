from fastapi import APIRouter, UploadFile, File, HTTPException
from ..session import create_session, get_session
from ..services.parser import load_dataframe, get_col_types
from ..services.analytics import calculate_kpis
from ..services.efetivo_template import detect_efetivo_file
from ..services.efetivo_parser import parse_efetivo_file
from ..services.orcamento_template import detect_orcamento_file
from ..services.orcamento_parser import parse_orcamento_file
from ..services.materiais_template import detect_materiais_file
from ..services.mapa_concorrencia_parser import MapaConcorrenciaParser

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = {".xlsx", ".xls", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    try:
        content = await file.read()

        if ext in {".xlsx", ".xls"}:
            # 1) Check Efetivo layout
            is_efetivo = detect_efetivo_file(content, file.filename)
            print(f"[UPLOAD DEBUG] Efetivo detection for '{file.filename}': {is_efetivo}")
            if is_efetivo:
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

            # 2) Check Materiais (Mapa de Concorrência) layout BEFORE Orcamento
            elif detect_materiais_file(content, file.filename):
                try:
                    print(f"[UPLOAD DEBUG] Materiais detection successful for '{file.filename}'")
                    # Use specialized Mapa de Concorrência parser
                    parser = MapaConcorrenciaParser(content, file.filename)
                    df, metadata = parser.parse()
                    print(f"[UPLOAD DEBUG] Materiais parsed: shape={df.shape}, metadata={metadata}")
                    if df.empty:
                        raise HTTPException(422, "Materiais file parsed but returned no records")
                    template_type = "materiais"
                    available_sheets = {}
                except Exception as e:
                    print(f"[UPLOAD ERROR] Materiais parsing failed: {e}")
                    import traceback
                    traceback.print_exc()
                    raise

            # 3) Check Orçamento (Mapa de Concorrência) layout
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

    # Get column types
    col_types = get_col_types(df)

    session_id = create_session(df, template_type=template_type)
    session = get_session(session_id)
    if session is not None:
        calculate_kpis(df)

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "col_types": col_types,
        "available_sheets": available_sheets or {},
        "template": template_type,
        "preview": df.head(10).astype(str).to_dict(orient="records"),
    }
