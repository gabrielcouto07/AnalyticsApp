from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
import io
from ..services.converter import (
    analyze_xlsx, convert_to_format, get_preview, load_file_to_df
)

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


@router.post("/preview")
async def preview(file: UploadFile = File(...)):
    """Get preview of any file (CSV, Excel, JSON)"""
    try:
        content = await file.read()
        df = load_file_to_df(content, file.filename or "data")
        return get_preview(df, rows=5)
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")


@router.post("/convert")
async def convert(
    file: UploadFile = File(...),
    target_format: str = Form(...)
):
    """Convert file to target format (csv, json, xlsx)"""
    try:
        content = await file.read()
        df = load_file_to_df(content, file.filename or "data")
        
        converted_bytes, content_type = convert_to_format(df, target_format, file.filename)
        
        # Determine output filename
        base_name = file.filename.rsplit(".", 1)[0] if file.filename else "data"
        ext_map = {"csv": "csv", "json": "json", "xlsx": "xlsx", "excel": "xlsx"}
        output_ext = ext_map.get(target_format.lower(), target_format.lower())
        output_filename = f"{base_name}_converted.{output_ext}"
        
        return StreamingResponse(
            io.BytesIO(converted_bytes),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{output_filename}"'},
        )
    except Exception as e:
        raise HTTPException(422, f"Erro na conversão: {e}")
