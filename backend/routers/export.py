from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io
from ..session import get_active_df
from ..services.export import to_excel_bytes, to_csv_string

router = APIRouter(prefix="/api/export", tags=["export"])


def _stream_excel(df, session_id: str) -> StreamingResponse:
    excel_bytes = to_excel_bytes(df)
    return StreamingResponse(
        iter([excel_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=export_{session_id[:8]}.xlsx"}
    )


@router.get("/{session_id}")
def export_default_excel(session_id: str):
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(404, "Sessao nao encontrada.")

    try:
        return _stream_excel(df, session_id)
    except Exception as e:
        raise HTTPException(500, f"Erro ao exportar Excel: {str(e)}")


@router.get("/{session_id}/excel")
def export_excel(session_id: str):
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(404, "Sessão não encontrada.")
    
    try:
        return _stream_excel(df, session_id)
    except Exception as e:
        raise HTTPException(500, f"Erro ao exportar Excel: {str(e)}")


@router.get("/{session_id}/csv")
def export_csv(session_id: str):
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(404, "Sessão não encontrada.")
    
    try:
        csv_string = to_csv_string(df)
        csv_bytes = csv_string.encode('utf-8')
        return StreamingResponse(
            iter([csv_bytes]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{session_id[:8]}.csv"}
        )
    except Exception as e:
        raise HTTPException(500, f"Erro ao exportar CSV: {str(e)}")
