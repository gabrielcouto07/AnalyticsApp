from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.services.converter import analyze_xlsx

router = APIRouter(prefix="/api/converter", tags=["converter"])


@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    name = (file.filename or "").lower()
    if not name.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Apenas arquivos .xlsx/.xls são suportados.")
    try:
        content = await file.read()
        return analyze_xlsx(content, file.filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")
