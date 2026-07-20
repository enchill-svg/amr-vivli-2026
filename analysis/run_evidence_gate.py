"""Run integrity proof pipeline (ATLAS/PLEA bounds, validation, allocator, validator).

Brief harmonization (Steps 1–10) and gated policy deliverables (Steps 11–18b)
are orchestrated by run_all.py. This runner is for integrity proof only.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

STEPS = [
    ("step19a_clean_evidence_gate_cohorts.py", "Clean ATLAS + PLEA"),
    ("step19_evidence_gate_bounds.py", "Identifiability bounds"),
    ("step20_sampling_validation.py", "Sampling validation"),
]

POST_STEPS = [
    ([sys.executable, "-m", "evidence_gate_core.allocator", "--budget", "200"], "Budget allocator"),
    ([sys.executable, "-m", "evidence_gate_core.export_validator"], "Export validator"),
]


def main():
    sys.path.insert(0, str(SRC))
    for script, label in STEPS:
        print(f"\n{'=' * 60}\n{label}: {script}\n{'=' * 60}")
        result = subprocess.run([sys.executable, str(SRC / script)], cwd=str(SRC))
        if result.returncode != 0:
            print(f"\nIntegrity proof HALTED at {script}")
            sys.exit(result.returncode)

    for cmd, label in POST_STEPS:
        print(f"\n{'=' * 60}\n{label}\n{'=' * 60}")
        result = subprocess.run(cmd, cwd=str(SRC))
        if result.returncode != 0:
            print(f"\nIntegrity proof HALTED at {label}")
            sys.exit(result.returncode)

    verify = ROOT / "scripts" / "verify_all_figures.py"
    if verify.exists():
        print(f"\n{'=' * 60}\nVerification script\n{'=' * 60}")
        result = subprocess.run([sys.executable, str(verify)], cwd=str(ROOT))
        if result.returncode != 0:
            sys.exit(result.returncode)

    print(f"\n{'=' * 60}\nIntegrity proof pipeline: ALL STEPS PASSED\n{'=' * 60}")


if __name__ == "__main__":
    main()
