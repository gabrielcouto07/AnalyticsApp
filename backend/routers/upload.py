from fastapi import APIRouter, UploadFile, File, HTTPException
from ..session import create_session
from ..services.parser import load_dataframe, get_col_types
from ..services.efetivo_template import detect_efetivo_file
from ..services.efetivo_parser import parse_efetivo_file
from ..services.orcamento_template import detect_orcamento_file
from ..services.orcamento_parser import parse_orcamento_file
from ..services.custos_template import detect_custos_file
from ..services.custos_parser import parse_custos_file

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    ext = "." + file.filename.split(".")[-1].lower()

    if ext not in allowed:
        raise HTTPException(400, f"Formato não suportado: {ext}")

    try:
        content = await file.read()

        if ext in {".xlsx", ".xls", ".xlsm"}:
            # 1) Custos (Controle de Custos Consolidados) — check first, uses .xlsm
            if detect_custos_file(content, file.filename):
                result = parse_custos_file(content, file.filename)
                df = result["nfs"]
                if df.empty:
                    # Fall back to consolidado if NFs sheet has no data rows
                    df = result["consolidado"]
                if df.empty:
                    # Both sheets empty — fall back to generic Excel parse
                    df, available_sheets = load_dataframe(content, file.filename)
                    template_type = None
                else:
                    template_type = "custos"
                    available_sheets = {}

            # 2) Efetivo
            elif detect_efetivo_file(content, file.filename):
                df = parse_efetivo_file(content, file.filename)
                if df.empty:
                    raise HTTPException(422, "Efetivo file parsed but returned no records")
                template_type = "efetivo"
                available_sheets = {}

            # 3) Orcamento (Mapa de Concorrência)
            elif detect_orcamento_file(content, file.filename):
                result = parse_orcamento_file(content, file.filename)
                df = result["flat"]
                if df.empty:
                    raise HTTPException(422, "Orcamento file parsed but returned no records")
                template_type = "orcamento"
                available_sheets = {}

            # 4) Standard Excel
            else:
                df, available_sheets = load_dataframe(content, file.filename)
                template_type = None
        else:
            df, available_sheets = load_dataframe(content, file.filename)
            template_type = None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Erro ao processar arquivo: {e}")

    # For custos, store both NFs and Consolidado DataFrames
    extras = {}
    if template_type == "custos":
        extras["consolidado"] = result["consolidado"]
        extras["custos_meta"] = result["meta"]

    session_id = create_session(df, template_type=template_type, extras=extras)
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
