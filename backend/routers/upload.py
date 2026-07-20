import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from backend.errors import ProcessingError, Stage
from backend.session import create_session, dataset_names
from backend.services.parser import get_col_types, load_bundle, meaningful_columns
from backend.services.serialize import df_records

logger = logging.getLogger("analytics.upload")

router = APIRouter(prefix="/api", tags=["upload"])

ALLOWED = {".xlsx", ".xls", ".csv", ".txt", ".json"}


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), sheet: Optional[str] = Form(None)):
    """Upload de arquivo. `sheet` (opcional) força a análise de uma aba específica.

    Falhas retornam JSON estruturado {detail, stage, code} em pt-BR (sem
    traceback do Python); o detalhe técnico + estágio vão para o log do servidor.
    A sessão só é ativada quando TODO o processamento conclui com sucesso.
    """
    filename = file.filename or "arquivo"
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ALLOWED:
        raise HTTPException(400, f"Formato não suportado: {ext or '(sem extensão)'}")

    try:
        content = await file.read()
        bundle = load_bundle(content, filename, sheet=sheet)
    except ProcessingError as e:
        logger.error("Upload falhou [%s] arquivo=%r code=%s: %s",
                     e.stage, filename, e.code, e.technical)
        return JSONResponse(status_code=422, content=e.to_payload())
    except ValueError as e:
        logger.error("Upload inválido arquivo=%r: %s", filename, e)
        return JSONResponse(status_code=422,
                            content={"detail": str(e), "stage": Stage.READING, "code": "value_error"})
    except Exception as e:  # rede de segurança — nunca vaza traceback
        logger.exception("Erro inesperado no upload arquivo=%r", filename)
        return JSONResponse(status_code=422, content={
            "detail": "Não foi possível processar esta planilha. Nenhum dado anterior foi perdido. "
                      "Consulte os detalhes e tente novamente.",
            "stage": Stage.READING, "code": "unexpected_error",
        })

    df = bundle["df"]
    useful = meaningful_columns(df)
    source = bundle.get("source", {})

    meta = {
        "filename": filename,
        "model": bundle["model"],
        "sheets": bundle["sheets"],
        "meaningful_columns": useful,
        "source": source,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
    }
    session_id = create_session(
        df, meta,
        file_bytes=content,
        datasets=bundle.get("datasets"),
        lazy_datasets=bundle.get("lazy_datasets"),
    )

    col_types = get_col_types(df[useful] if useful else df)

    return {
        "session_id": session_id,
        "filename": filename,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "col_types": col_types,
        "preview": df_records(df.head(10)),
        "model": bundle["model"],
        "sheets": bundle["sheets"],
        "meaningful_columns": useful,
        "datasets": dataset_names(session_id),
        "source": source,
    }
