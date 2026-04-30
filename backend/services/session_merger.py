from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

import pandas as pd

from ..session import Session
from .custos_analyzer import (
    canonicalize_budget_frame,
    canonicalize_consolidado_frame,
    canonicalize_nfs_frame,
    canonicalize_resumo_frame,
)


@dataclass
class MergedAnalyticsModel:
    nfs: pd.DataFrame
    orcamento: pd.DataFrame
    consolidado: pd.DataFrame
    efetivo: pd.DataFrame
    resumo: pd.DataFrame
    quality_reports: dict[str, Any]
    schema_types: list[str]
    date_range: tuple[date | None, date | None]
    obras: list[str]
    fornecedores: list[str]


def _get_structured(session: Session) -> dict[str, Any]:
    structured = session.extras.get("structured_data")
    return structured if isinstance(structured, dict) else {}


def _get_nfs(session: Session) -> pd.DataFrame:
    structured = _get_structured(session)
    for frame in (structured.get("nfs"), session.extras.get("nfs"), session.df):
        normalized = canonicalize_nfs_frame(frame)
        if not normalized.empty:
            return normalized
    return pd.DataFrame()


def _get_consolidado(session: Session) -> pd.DataFrame:
    structured = _get_structured(session)
    for frame in (structured.get("consolidado"), session.extras.get("consolidado")):
        normalized = canonicalize_consolidado_frame(frame)
        if not normalized.empty:
            return normalized
    return pd.DataFrame()


def _get_orcamento(session: Session) -> pd.DataFrame:
    structured = _get_structured(session)
    if isinstance(structured.get("orcamento"), dict):
        budget = canonicalize_budget_frame(structured["orcamento"].get("budget"))
        if not budget.empty:
            return budget
    for frame in (session.extras.get("orcamento_budget"), session.extras.get("flat")):
        normalized = canonicalize_budget_frame(frame)
        if not normalized.empty:
            return normalized
    return pd.DataFrame()


def _get_resumo(session: Session) -> pd.DataFrame:
    structured = _get_structured(session)
    for frame in (structured.get("resumo"), session.extras.get("resumo")):
        normalized = canonicalize_resumo_frame(frame)
        if not normalized.empty:
            return normalized
    return pd.DataFrame()


def _get_efetivo(session: Session) -> pd.DataFrame:
    if "efetivo" not in session.schema_types and "Quantidade" not in session.df.columns:
        return pd.DataFrame()
    return session.df.copy()


def _collect_quality_report(frame: pd.DataFrame, fallback_key: str) -> dict[str, Any]:
    report = frame.attrs.get("quality_report") if isinstance(frame, pd.DataFrame) else None
    if isinstance(report, dict):
        return report
    return {"key": fallback_key}


def merge_sessions(sessions: list[Session]) -> MergedAnalyticsModel:
    nfs_frames: list[pd.DataFrame] = []
    orcamento_frames: list[pd.DataFrame] = []
    consolidado_frames: list[pd.DataFrame] = []
    efetivo_frames: list[pd.DataFrame] = []
    resumo_frames: list[pd.DataFrame] = []
    quality_reports: dict[str, Any] = {}
    schema_types: list[str] = []

    for session in sessions:
        schema_types.extend(session.schema_types)

        nfs = _get_nfs(session)
        consolidado = _get_consolidado(session)
        orcamento = _get_orcamento(session)
        efetivo = _get_efetivo(session)
        resumo = _get_resumo(session)

        if not nfs.empty:
            nfs_frames.append(nfs.assign(_session_id=session.filename or "session"))
            quality_reports[f"{session.filename}:nfs"] = _collect_quality_report(nfs, "nfs")
        if not consolidado.empty:
            consolidado_frames.append(consolidado.assign(_session_id=session.filename or "session"))
            quality_reports[f"{session.filename}:consolidado"] = _collect_quality_report(consolidado, "consolidado")
        if not orcamento.empty:
            orcamento_frames.append(orcamento.assign(_session_id=session.filename or "session"))
            quality_reports[f"{session.filename}:orcamento"] = _collect_quality_report(orcamento, "orcamento")
        if not efetivo.empty:
            efetivo_frames.append(efetivo.assign(_session_id=session.filename or "session"))
            quality_reports[f"{session.filename}:efetivo"] = _collect_quality_report(efetivo, "efetivo")
        if not resumo.empty:
            resumo_frames.append(resumo.assign(_session_id=session.filename or "session"))
            quality_reports[f"{session.filename}:resumo"] = _collect_quality_report(resumo, "resumo")

    merged_nfs = pd.concat(nfs_frames, ignore_index=True) if nfs_frames else pd.DataFrame()
    merged_consolidado = pd.concat(consolidado_frames, ignore_index=True) if consolidado_frames else pd.DataFrame()
    merged_orcamento = pd.concat(orcamento_frames, ignore_index=True) if orcamento_frames else pd.DataFrame()
    merged_efetivo = pd.concat(efetivo_frames, ignore_index=True) if efetivo_frames else pd.DataFrame()
    merged_resumo = pd.concat(resumo_frames, ignore_index=True) if resumo_frames else pd.DataFrame()

    if not merged_nfs.empty and not merged_consolidado.empty:
        merged_nfs = merged_nfs.merge(
            merged_consolidado[
                ["n_consolidado", "nf", "fornecedor", "apropriacao_item", "apropriacao_valor", "cond_pagto"]
            ].drop_duplicates(),
            on=["n_consolidado", "nf", "fornecedor"],
            how="left",
            suffixes=("", "_consolidado"),
        )

    if not merged_nfs.empty and not merged_orcamento.empty and {"item_planilha", "item"}.issubset(
        set(merged_nfs.columns) | set(merged_orcamento.columns)
    ):
        merged_nfs = merged_nfs.merge(
            merged_orcamento[["item", "descricao", "custo_total"]].drop_duplicates(),
            left_on="item_planilha",
            right_on="item",
            how="left",
            suffixes=("", "_orcamento"),
        )

    if not merged_efetivo.empty and not merged_nfs.empty:
        efetivo_monthly = (
            merged_efetivo.assign(
                _join_mes=lambda frame: pd.to_numeric(frame.get("Mes"), errors="coerce").fillna(0).astype(int),
                _join_obra=merged_efetivo.get("Obra", pd.Series(dtype=object)).astype(str),
            )
            .groupby(["_join_mes", "_join_obra"], dropna=False)["Quantidade"]
            .sum()
            .reset_index(name="total_worker_days")
        )
        nfs_monthly = merged_nfs.assign(
            _join_mes=pd.to_datetime(merged_nfs.get("data_vencimento"), errors="coerce", dayfirst=True).dt.month.fillna(0).astype(int),
            _join_obra=merged_nfs.get("obra", pd.Series(dtype=object)).astype(str),
        )
        merged_nfs = nfs_monthly.merge(
            efetivo_monthly,
            on=["_join_mes", "_join_obra"],
            how="left",
        )

    all_dates: list[pd.Timestamp] = []
    if not merged_nfs.empty and "data_vencimento" in merged_nfs.columns:
        all_dates.extend(pd.to_datetime(merged_nfs["data_vencimento"], errors="coerce", dayfirst=True).dropna().tolist())
    if not merged_efetivo.empty and "Data" in merged_efetivo.columns:
        all_dates.extend(pd.to_datetime(merged_efetivo["Data"], errors="coerce").dropna().tolist())

    unique_schema_types = [schema for index, schema in enumerate(schema_types) if schema and schema_types.index(schema) == index]
    obras = sorted(
        {
            str(value).strip()
            for frame, column in ((merged_efetivo, "Obra"), (merged_nfs, "obra"))
            if isinstance(frame, pd.DataFrame) and column in frame.columns
            for value in frame[column].dropna().tolist()
            if str(value).strip()
        }
    )
    fornecedores = sorted(
        {
            str(value).strip()
            for frame in (merged_nfs, merged_consolidado, merged_efetivo)
            for column in ("fornecedor", "Fornecedor")
            if isinstance(frame, pd.DataFrame) and column in frame.columns
            for value in frame[column].dropna().tolist()
            if str(value).strip()
        }
    )

    date_range = (
        min(all_dates).date() if all_dates else None,
        max(all_dates).date() if all_dates else None,
    )

    return MergedAnalyticsModel(
        nfs=merged_nfs,
        orcamento=merged_orcamento,
        consolidado=merged_consolidado,
        efetivo=merged_efetivo,
        resumo=merged_resumo,
        quality_reports=quality_reports,
        schema_types=unique_schema_types,
        date_range=date_range,
        obras=obras,
        fornecedores=fornecedores,
    )
