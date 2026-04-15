from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.session import create_session
from backend.services.parser import load_dataframe, get_col_types

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = {".xlsx", ".xls", ".csv", ".txt", ".json"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    try:
        content = await file.read()
        df = load_dataframe(content, file.filename)
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")

    session_id = create_session(df)
    col_types = get_col_types(df)

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "col_types": col_types,
        # Preview das primeiras 10 linhas (datas convertidas para string)
        "preview": df.head(10).astype(str).to_dict(orient="records"),
    }
