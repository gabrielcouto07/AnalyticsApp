from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.session import create_session
from backend.services.parser import get_col_types, load_bundle, meaningful_columns
from backend.services.serialize import df_records

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), sheet: Optional[str] = Form(None)):
    """Upload de arquivo. `sheet` (opcional) força a análise de uma aba específica."""
    allowed = {".xlsx", ".xls", ".csv", ".txt", ".json"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    try:
        content = await file.read()
        bundle = load_bundle(content, file.filename, sheet=sheet)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")

    df = bundle["df"]
    useful = meaningful_columns(df)

    meta = {
        "filename": file.filename,
        "model": bundle["model"],
        "sheets": bundle["sheets"],
        "datasets": bundle["datasets"],
        "meaningful_columns": useful,
    }
    session_id = create_session(df, meta)

    # KPIs/gráficos padrão são guiados só pelas colunas úteis; a tabela
    # completa (todas as colunas) continua acessível em /api/data/{id}/table
    col_types = get_col_types(df[useful] if useful else df)

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "col_types": col_types,
        "preview": df_records(df.head(10)),
        # Campos novos (aditivos — não quebram consumidores antigos)
        "model": bundle["model"],
        "sheets": bundle["sheets"],
        "meaningful_columns": useful,
        "datasets": list(bundle["datasets"].keys()),
    }
