"""
Utils — Módulo com funções genéricas compartilhadas entre modelos.
"""

# Formatadores
from .formatters import fmt_brl, pct_fmt, fmt_date, fmt_int

# Parsers
from .parsers import parse_num, smart_date, _get_first_mode

# Normalizadores
from .normalizers import normalize_columns, validate_required_columns

# Deduplicadores
from .deduplicators import add_dedup_flags, get_dedup_subset

# File loaders
from .file_loader import load_file, to_excel

__all__ = [
    # formatters
    "fmt_brl",
    "pct_fmt",
    "fmt_date",
    "fmt_int",
    # parsers
    "parse_num",
    "smart_date",
    "_get_first_mode",
    # normalizers
    "normalize_columns",
    "validate_required_columns",
    # deduplicators
    "add_dedup_flags",
    "get_dedup_subset",
    # file_loader
    "load_file",
    "to_excel",
]
