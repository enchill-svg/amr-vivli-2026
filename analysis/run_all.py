"""Single entry point for the full AMR Life Expectancy pipeline.

Harmonize → integrity → analytics → brief §7 deliverables → verification.
Writes runs/<run_id>/pipeline_run_manifest_v1.json on every run.
"""
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent / "src"
sys.path.insert(0, str(SRC))

from pipeline_runner import run_full_pipeline  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(run_full_pipeline())
