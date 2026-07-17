from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.session import get_dataset
from backend.services.export import to_csv_string, to_excel_bytes
from backend.services.serialize import build_view

router = APIRouter(prefix="/api/export", tags=["export"])


def _get_view(
    session_id: str,
    dataset: Optional[str],
    columns: Optional[str],
    sort_by: Optional[str],
    sort_dir: str,
):
    """Monta a 'visão atual' (dataset + colunas + ordenação) para exportar."""
    df = get_dataset(session_id, dataset)
    if df is None:
        raise HTTPException(404, "Sessão ou dataset não encontrado.")
    wanted = [c.strip() for c in columns.split(",")] if columns else None
    return build_view(df, columns=wanted, sort_by=sort_by, sort_dir=sort_dir)


@router.get("/{session_id}/excel")
def export_excel(
    session_id: str,
    dataset: Optional[str] = None,
    columns: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
):
    df = _get_view(session_id, dataset, columns, sort_by, sort_dir)
    try:
        excel_bytes = to_excel_bytes(df)
        return StreamingResponse(
            iter([excel_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=export_{session_id[:8]}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(500, f"Erro ao exportar Excel: {str(e)}")


@router.get("/{session_id}/csv")
def export_csv(
    session_id: str,
    dataset: Optional[str] = None,
    columns: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
):
    df = _get_view(session_id, dataset, columns, sort_by, sort_dir)
    try:
        csv_bytes = to_csv_string(df).encode("utf-8-sig")
        return StreamingResponse(
            iter([csv_bytes]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{session_id[:8]}.csv"}
        )
    except Exception as e:
        raise HTTPException(500, f"Erro ao exportar CSV: {str(e)}")
