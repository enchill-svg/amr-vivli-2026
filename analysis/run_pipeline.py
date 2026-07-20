"""
Preprocessing-only runner (Section 5, Steps 1–10).

For the full one-pipeline run — harmonize through brief deliverables — use:
  python run_all.py
"""
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent / "src"
sys.path.insert(0, str(SRC))

from pipeline_runner import run_preprocessing_only  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(run_preprocessing_only())
