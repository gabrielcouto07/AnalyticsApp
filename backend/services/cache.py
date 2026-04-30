"""
Cache manager para resultados de analises custosas.
"""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime
from typing import Any, Optional

import pandas as pd


logger = logging.getLogger(__name__)

_parsed_cache: dict[str, tuple[pd.DataFrame, float]] = {}


class CacheEntry:
    """Entry com timestamp e TTL."""

    def __init__(self, data: Any, ttl_seconds: int = 3600):
        self.data = data
        self.created_at = datetime.now()
        self.ttl_seconds = ttl_seconds

    def is_expired(self) -> bool:
        age = (datetime.now() - self.created_at).total_seconds()
        return age > self.ttl_seconds

    def __repr__(self) -> str:
        age = (datetime.now() - self.created_at).total_seconds()
        return f"CacheEntry(age={age:.1f}s, ttl={self.ttl_seconds}s)"


class AnalysisCache:
    """Cache simples para resultados de analise."""

    def __init__(self, max_size: int = 100, default_ttl: int = 3600):
        self._cache: dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0

    @staticmethod
    def _make_key(session_id: str, analysis_type: str, **kwargs: Any) -> str:
        parts = [session_id, analysis_type]
        for key, value in sorted(kwargs.items()):
            parts.append(f"{key}={value}")
        return hashlib.md5("|".join(parts).encode()).hexdigest()

    def get(self, session_id: str, analysis_type: str, **kwargs: Any) -> Optional[Any]:
        key = self._make_key(session_id, analysis_type, **kwargs)
        if key not in self._cache:
            self.misses += 1
            return None

        entry = self._cache[key]
        if entry.is_expired():
            del self._cache[key]
            self.misses += 1
            return None

        self.hits += 1
        logger.debug("[cache_hit] %s (%s hits total)", analysis_type, self.hits)
        return entry.data

    def set(
        self,
        session_id: str,
        analysis_type: str,
        data: Any,
        ttl: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        if len(self._cache) >= self.max_size:
            expired = [key for key, value in self._cache.items() if value.is_expired()]
            for key in expired:
                del self._cache[key]

        if len(self._cache) >= self.max_size and self._cache:
            oldest_key = min(self._cache.keys(), key=lambda key: self._cache[key].created_at)
            del self._cache[oldest_key]

        key = self._make_key(session_id, analysis_type, **kwargs)
        self._cache[key] = CacheEntry(data, ttl or self.default_ttl)

    def invalidate(self, session_id: str | None = None, analysis_type: str | None = None) -> int:
        if session_id is None and analysis_type is None:
            count = len(self._cache)
            self._cache.clear()
            return count

        keys_to_remove: list[str] = []
        for key in list(self._cache.keys()):
            if session_id and session_id in key:
                keys_to_remove.append(key)
            elif analysis_type and analysis_type in key:
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del self._cache[key]
        return len(keys_to_remove)

    def stats(self) -> dict[str, Any]:
        total_requests = self.hits + self.misses
        hit_rate = self.hits / total_requests if total_requests > 0 else 0
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(hit_rate, 3),
            "total_requests": total_requests,
        }


_analysis_cache = AnalysisCache(max_size=100, default_ttl=3600)


def get_analysis_cache() -> AnalysisCache:
    return _analysis_cache


def get_parsed_df(session_id: str) -> pd.DataFrame | None:
    entry = _parsed_cache.get(session_id)
    if entry is None:
        return None

    dataframe, timestamp = entry
    if time.time() - timestamp > 3600:
        _parsed_cache.pop(session_id, None)
        return None

    return dataframe


def set_parsed_df(session_id: str, df: pd.DataFrame) -> None:
    _parsed_cache[session_id] = (df.copy(), time.time())
