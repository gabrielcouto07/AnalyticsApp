import logging
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats

from ..session import get_session

router = APIRouter(prefix="/api/charts", tags=["charts"])
logger = logging.getLogger(__name__)


def _resolve_df(session_id: str) -> pd.DataFrame:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=422, detail=f"Session '{session_id}' not found or expired")
    df_filtered = getattr(session, "df_filtered", None)
    return df_filtered if df_filtered is not None else session.df


class TemporalRequest(BaseModel):
    date_col: str
    metric_col: str
    granularity: str = "month"


class CrossRequest(BaseModel):
    cat_col: str
    num_col: str
    agg_fn: str = "sum"
    top_n: int = 20


class RankingRequest(BaseModel):
    cat_col: str
    num_col: str
    agg_fn: str = "sum"
    top_n: int = 10
    direction: str = "top"


class ScatterRequest(BaseModel):
    x_col: str
    y_col: str
    color_col: Optional[str] = None
    size_col: Optional[str] = None
    sample_n: int = 5000


@router.post("/{session_id}/temporal")
async def temporal_chart(session_id: str, body: TemporalRequest):
    t0 = time.time()
    df = _resolve_df(session_id)

    if body.date_col not in df.columns:
        raise HTTPException(422, f"Column '{body.date_col}' not found")
    if body.metric_col not in df.columns:
        raise HTTPException(422, f"Column '{body.metric_col}' not found")

    try:
        d = df[[body.date_col, body.metric_col]].copy()
        d[body.date_col] = pd.to_datetime(d[body.date_col], errors="coerce")
        d[body.metric_col] = pd.to_numeric(d[body.metric_col], errors="coerce")
        d = d.dropna()

        if len(d) == 0:
            raise HTTPException(422, "No valid data after cleaning")

        freq_map = {"day": "D", "month": "ME", "year": "YE"}
        freq = freq_map.get(body.granularity, "ME")

        grouped = (
            d.groupby(pd.Grouper(key=body.date_col, freq=freq))[body.metric_col]
            .sum()
            .reset_index()
        )
        grouped.columns = ["date", "value"]
        grouped = grouped[grouped["value"] > 0]
        grouped["date"] = grouped["date"].dt.strftime("%Y-%m-%d")
        grouped["cumulative"] = grouped["value"].cumsum()

        date_series = pd.to_datetime(grouped["date"], errors="coerce").dropna()
        time_range = ""
        if len(date_series) >= 2:
            time_range = (
                f"{date_series.min().strftime('%d/%m/%Y')} – "
                f"{date_series.max().strftime('%d/%m/%Y')}"
            )

        logger.info(f"[temporal] {len(grouped)} pts | {time.time() - t0:.3f}s")
        return {
            "data": grouped.to_dict(orient="records"),
            "summary": {
                "time_range": time_range,
                "total_records": len(d),
                "avg_per_period": round(float(grouped["value"].mean()), 2) if len(grouped) else 0,
                "data_gaps": int((grouped["value"] == 0).sum()),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[temporal] error: {e}", exc_info=True)
        raise HTTPException(500, f"Temporal analysis failed: {str(e)}")


@router.post("/{session_id}/cross")
async def cross_chart(session_id: str, body: CrossRequest):
    t0 = time.time()
    df = _resolve_df(session_id)

    try:
        d = df[[body.cat_col, body.num_col]].copy()
        d[body.num_col] = pd.to_numeric(d[body.num_col], errors="coerce")

        fn = {"sum": "sum", "mean": "mean", "count": "count",
              "max": "max", "min": "min"}.get(body.agg_fn, "sum")

        if fn == "count":
            grouped = d.groupby(body.cat_col)[body.num_col].count()
        else:
            grouped = d.groupby(body.cat_col)[body.num_col].agg(fn)

        grouped = grouped.dropna().sort_values(ascending=False).head(body.top_n)
        result = [
            {"category": str(k), "aggregated_value": round(float(v), 4)}
            for k, v in grouped.items()
        ]

        logger.info(f"[cross] {len(result)} cats | {time.time() - t0:.3f}s")
        return {"data": result}
    except Exception as e:
        logger.error(f"[cross] error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.get("/{session_id}/correlation")
async def correlation_chart(session_id: str):
    t0 = time.time()
    df = _resolve_df(session_id)

    try:
        num_df = df.select_dtypes(include=[np.number])
        if len(num_df.columns) < 2:
            raise HTTPException(422, "Need at least 2 numeric columns")

        if len(num_df.columns) > 20:
            num_df = num_df.iloc[:, :20]

        corr = num_df.corr().fillna(0).round(4)
        vals = corr.values
        upper = vals[np.triu_indices_from(vals, k=1)]
        strong = int(np.sum(np.abs(upper) >= 0.7))
        weak   = int(np.sum((np.abs(upper) >= 0.3) & (np.abs(upper) < 0.7)))
        no_c   = int(np.sum(np.abs(upper) < 0.3))

        cols = list(corr.columns)
        pairs = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                pairs.append({
                    "col_a": cols[i],
                    "col_b": cols[j],
                    "value": round(float(corr.iloc[i, j]), 4),  # type: ignore
                })
        pairs.sort(key=lambda x: abs(x["value"]), reverse=True)

        logger.info(f"[correlation] {len(cols)}x{len(cols)} | {time.time() - t0:.3f}s")
        return {
            "columns": cols,
            "data": corr.values.tolist(),
            "strong_count": strong,
            "weak_count": weak,
            "no_corr_count": no_c,
            "top_correlations": pairs[:10],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[correlation] error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.get("/{session_id}/distribution/{col}")
async def distribution_chart(session_id: str, col: str):
    t0 = time.time()
    df = _resolve_df(session_id)

    if col not in df.columns:
        raise HTTPException(422, f"Column '{col}' not found")

    try:
        series = pd.to_numeric(df[col], errors="coerce").dropna()

        if len(series) < 5:
            raise HTTPException(422, f"Column '{col}' has fewer than 5 non-null numeric values")

        if len(series) > 5000:
            series = series.sample(5000, random_state=42)

        n_bins = min(50, max(10, int(np.sqrt(len(series)))))
        counts, edges = np.histogram(series, bins=n_bins)
        bins = [
            {"x": float((edges[i] + edges[i + 1]) / 2), "count": int(counts[i])}
            for i in range(len(counts))
        ]

        q1  = float(series.quantile(0.25))
        q3  = float(series.quantile(0.75))
        iqr = q3 - q1
        outliers = int(((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum())

        logger.info(f"[distribution] col={col} n={len(series)} | {time.time() - t0:.3f}s")
        return {
            "values": series.tolist(),
            "bins": bins,
            "stats": {
                "mean":          round(float(series.mean()), 4),
                "median":        round(float(series.median()), 4),
                "std":           round(float(series.std()), 4),
                "min":           round(float(series.min()), 4),
                "max":           round(float(series.max()), 4),
                "q1":            round(q1, 4),
                "q3":            round(q3, 4),
                "iqr":           round(iqr, 4),
                "skewness":      round(float(series.skew()), 4),  # type: ignore
                "kurtosis":      round(float(series.kurtosis()), 4),  # type: ignore
                "outlier_count": outliers,
                "count":         len(series),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[distribution] error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.post("/{session_id}/ranking")
async def ranking_chart(session_id: str, body: RankingRequest):
    t0 = time.time()
    df = _resolve_df(session_id)

    try:
        d = df[[body.cat_col, body.num_col]].copy()
        d[body.num_col] = pd.to_numeric(d[body.num_col], errors="coerce")

        fn = {"sum": "sum", "mean": "mean", "count": "count",
              "max": "max", "min": "min"}.get(body.agg_fn, "sum")

        if fn == "count":
            grouped = d.groupby(body.cat_col)[body.num_col].count()
        else:
            grouped = d.groupby(body.cat_col)[body.num_col].agg(fn)

        grouped = grouped.dropna().sort_values(ascending=(body.direction == "bottom"))
        grouped = grouped.head(body.top_n)

        total    = float(grouped.sum()) or 1.0
        mean_val = float(grouped.mean()) or 1.0

        result = [
            {
                "rank": i + 1,
                "category": str(cat),
                "value": round(float(val), 2),
                "pct_of_total": round(float(val) / total * 100, 2),
                "vs_mean_pct": round((float(val) - mean_val) / abs(mean_val) * 100, 2),
            }
            for i, (cat, val) in enumerate(grouped.items())
        ]

        logger.info(f"[ranking] {len(result)} items | {time.time() - t0:.3f}s")
        return {"data": result}
    except Exception as e:
        logger.error(f"[ranking] error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.post("/{session_id}/scatter")
async def scatter_chart(session_id: str, body: ScatterRequest):
    t0 = time.time()
    df = _resolve_df(session_id)

    if body.x_col not in df.columns:
        raise HTTPException(422, f"Column '{body.x_col}' not found")
    if body.y_col not in df.columns:
        raise HTTPException(422, f"Column '{body.y_col}' not found")

    try:
        keep_cols = [body.x_col, body.y_col]
        if body.color_col and body.color_col in df.columns:
            keep_cols.append(body.color_col)
        if body.size_col and body.size_col in df.columns:
            keep_cols.append(body.size_col)

        d = df[keep_cols].copy()
        d[body.x_col] = pd.to_numeric(d[body.x_col], errors="coerce")
        d[body.y_col] = pd.to_numeric(d[body.y_col], errors="coerce")
        d = d.dropna(subset=[body.x_col, body.y_col])

        if len(d) == 0:
            raise HTTPException(422, "No valid data after removing nulls")

        if len(d) > body.sample_n:
            d = d.sample(body.sample_n, random_state=42)

        x = d[body.x_col].values.astype(float)
        y = d[body.y_col].values.astype(float)

        slope, intercept, r_val, p_val, _ = scipy_stats.linregress(x, y)
        pearson_r,  _  = scipy_stats.pearsonr(x, y)
        spearman_r, _  = scipy_stats.spearmanr(x, y)
        try:
            kendall_r, _ = scipy_stats.kendalltau(x, y)
        except Exception:
            kendall_r = 0.0

        records: List[Any] = []
        for _, row in d.iterrows():
            rec: dict = {"x": float(row[body.x_col]), "y": float(row[body.y_col])}
            if body.color_col and body.color_col in d.columns:
                rec["color"] = str(row[body.color_col])
            if body.size_col and body.size_col in d.columns:
                try:
                    rec["size"] = float(row[body.size_col])
                except Exception:
                    pass
            records.append(rec)

        logger.info(f"[scatter] {len(records)} pts | {time.time() - t0:.3f}s")
        return {
            "data": records,
            "regression": {
                "slope":     round(float(slope), 6),  # type: ignore
                "intercept": round(float(intercept), 6),  # type: ignore
                "r2":        round(float(r_val ** 2), 4),  # type: ignore
                "p_value":   round(float(p_val), 6),  # type: ignore
            },
            "correlation": {
                "pearson":  round(float(pearson_r), 4),  # type: ignore
                "spearman": round(float(spearman_r), 4),  # type: ignore
                "kendall":  round(float(kendall_r), 4),  # type: ignore
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[scatter] error: {e}", exc_info=True)
        raise HTTPException(500, str(e))
