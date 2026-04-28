from __future__ import annotations

from pathlib import Path

from backend.services.nf_analyzer import NFAnalyzer
from backend.services.parser import _load_csv


def test_nf_analyzer_builds_summary():
    sample_path = Path(__file__).resolve().parents[1] / "data" / "samples" / "12.csv"
    file_bytes = sample_path.read_bytes()
    df = _load_csv(file_bytes, "12.csv")

    analyzer = NFAnalyzer(df)
    summary = analyzer.get_summary()

    assert isinstance(summary, dict)
    assert summary
