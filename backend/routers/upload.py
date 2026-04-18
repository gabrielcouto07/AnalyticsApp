from fastapi import APIRouter, UploadFile, File, HTTPException
from ..session import create_session
from ..services.parser import load_dataframe, get_col_types
from ..services.efetivo_template import detect_efetivo_file
from ..services.efetivo_parser import parse_efetivo_file

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = {".xlsx", ".xls", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    try:
        content = await file.read()

        # Efetivo files use a non-standard layout — route to custom parser
        if ext in {".xlsx", ".xls"} and detect_efetivo_file(content, file.filename):
            df = parse_efetivo_file(content, file.filename)
            if df.empty:
                raise HTTPException(422, "Efetivo file parsed but returned no records")
            template_type = "efetivo"
            available_sheets = {}
        else:
            df, available_sheets = load_dataframe(content, file.filename)
            template_type = None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")

    session_id = create_session(df, template_type=template_type)
    col_types = get_col_types(df)

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
