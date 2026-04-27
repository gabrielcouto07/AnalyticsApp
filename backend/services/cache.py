"""
Cache manager para resultados de análises custosas
"""

import logging
from typing import Dict, Any, Optional
import hashlib
from datetime import datetime, timedelta
import pandas as pd

logger = logging.getLogger(__name__)


class CacheEntry:
    """Entry com timestamp e TTL"""
    def __init__(self, data: Any, ttl_seconds: int = 3600):
        self.data = data
        self.created_at = datetime.now()
        self.ttl_seconds = ttl_seconds
    
    def is_expired(self) -> bool:
        """Verifica se o cache expirou"""
        age = (datetime.now() - self.created_at).total_seconds()
        return age > self.ttl_seconds
    
    def __repr__(self):
        age = (datetime.now() - self.created_at).total_seconds()
        return f"CacheEntry(age={age:.1f}s, ttl={self.ttl_seconds}s)"


class AnalysisCache:
    """Cache thread-safe para resultados de análises"""
    
    def __init__(self, max_size: int = 100, default_ttl: int = 3600):
        self._cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0
    
    @staticmethod
    def _make_key(session_id: str, analysis_type: str, **kwargs) -> str:
        """Gera chave determinística para cache"""
        parts = [session_id, analysis_type]
        for k, v in sorted(kwargs.items()):
            parts.append(f"{k}={v}")
        key_str = "|".join(parts)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, session_id: str, analysis_type: str, **kwargs) -> Optional[Any]:
        """Tenta recuperar do cache"""
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
        logger.debug(f"[cache_hit] {analysis_type} ({self.hits} hits total)")
        return entry.data
    
    def set(self, session_id: str, analysis_type: str, data: Any, ttl: Optional[int] = None, **kwargs) -> None:
        """Armazena no cache"""
        # Limpar entradas expiradas se necessário
        if len(self._cache) >= self.max_size:
            expired = [k for k, v in self._cache.items() if v.is_expired()]
            for k in expired:
                del self._cache[k]
        
        # Se ainda estiver full, limpar LRU (least recent use)
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
            del self._cache[oldest_key]
            logger.debug(f"[cache] Evicted oldest entry (size={len(self._cache)})")
        
        key = self._make_key(session_id, analysis_type, **kwargs)
        ttl_to_use = ttl or self.default_ttl
        self._cache[key] = CacheEntry(data, ttl_to_use)
        logger.debug(f"[cache] Stored {analysis_type} (size={len(self._cache)}/{self.max_size})")
    
    def invalidate(self, session_id: str = None, analysis_type: str = None) -> int:
        """Remove entradas do cache (por session ou tipo)"""
        if session_id is None and analysis_type is None:
            count = len(self._cache)
            self._cache.clear()
            return count
        
        keys_to_remove = []
        for key in self._cache.keys():
            if session_id and session_id in key:
                keys_to_remove.append(key)
            elif analysis_type and analysis_type in key:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._cache[key]
        
        logger.debug(f"[cache] Invalidated {len(keys_to_remove)} entries")
        return len(keys_to_remove)
    
    def stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache"""
        total_requests = self.hits + self.misses
        hit_rate = self.hits / total_requests if total_requests > 0 else 0
        
        return {
            'size': len(self._cache),
            'max_size': self.max_size,
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': round(hit_rate, 3),
            'total_requests': total_requests,
        }


# Instância global de cache
_analysis_cache = AnalysisCache(max_size=100, default_ttl=3600)


def get_analysis_cache() -> AnalysisCache:
    """Retorna instância global de cache"""
    return _analysis_cache
