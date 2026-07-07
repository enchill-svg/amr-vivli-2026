"""
Top-level pipeline runner.

Issue (Part 5 / Part 7 of the plan): the plan recommends against adopting a
full workflow-orchestration framework (Airflow, Prefect, Dagster) - this
pipeline's scale and four-tier dependency graph do not need one - and instead
recommends "a single top-level runner (a Makefile or a short run_pipeline.py)
that executes them in Part 7's Tier A -> B -> C -> D order and halts on the
first failed step's Check rather than continuing past it."

Action: run every step script as a subprocess, in Part 7's exact tier order,
stopping immediately (non-zero exit) the first time one step's own Check
fails - never continuing past a failed step to build on unverified output,
per Design Principle 2 ("nothing downstream depends on an unverified upstream
transform").

Check: this runner's own exit code is 0 only if every step's own script
exited 0; the first non-zero exit halts the run and is reported by name.

Persisted per-step check log (Part 9 Acceptance Criterion 6): before this
addition, every step's PASS/FAIL/exclusion-count evidence existed only as
ephemeral console output, gone the moment the terminal scrolled past it -
Criterion 6 explicitly requires an artifact the team can inspect after the
fact, not just a design intention that a check ran. This runner now captures
each step's stdout, derives pass/fail from its own exit code (the same gate
each step already enforces internally - this is not a second, independent
judgment, just its persisted record), extracts every "Wrote N row(s) to
<path>" line the step printed (its own exclusion/artifact counts, verbatim -
never recomputed or guessed here), and appends one row per step to
logs/pipeline_check_log_v1.csv, timestamped and versioned per Design
Principle 1.

Tier order (Part 7):
  Tier A (independent):      step01_country, step02_date, step03_organism,
                              step04_drug, step06_evaluability, step09_age
  Tier B (single upstream):  step05_mic (needs Step 4 for its full Check),
                              step08_beta_lactamase_bounds (needs Step 3)
  Tier C (multi-step dep.):  eucast_breakpoints (this session's addition -
                              Step 7's bacterial half, see step07's own
                              docstring), step07_classification (fungal half;
                              needs Steps 3+4+5+6)
  Tier D (terminal):         step10_master (needs Steps 1,2,3,4,5,6,7,9)
  Post-build verification:   pipeline_acceptance_check (independent re-check
                              of the persisted master table, not part of the
                              plan's original 10 steps but added this session
                              as a second, independent verification layer)

This runner does not parallelize Tier A even though the plan notes it could -
at this pipeline's scale (seconds per step) sequential execution costs
nothing worth the added complexity, consistent with the plan's own
recommendation to keep the runner simple.
"""
import datetime as dt
import re
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
LOG_PATH = ROOT / "logs" / "pipeline_check_log_v1.csv"

sys.path.insert(0, str(SRC))
from _data_paths import validate_raw_inputs

# Matches each step's own "Wrote N row(s) to <path>" artifact-count lines
# verbatim - this is never a recomputation of the count, only a capture of
# what the step itself already asserted about its own output.
WROTE_LINE_RE = re.compile(r"Wrote \d+ .*? to \S+")

TIERS = [
    ("Tier A - independent", [
        "step01_country.py",
        "step02_date.py",
        "step03_organism.py",
        "step04_drug.py",
        "step06_evaluability.py",
        "step09_age.py",
    ]),
    ("Tier B - single upstream dependency", [
        "step05_mic.py",
        "step08_beta_lactamase_bounds.py",
    ]),
    ("Tier C - multi-step dependency (Step 7)", [
        "eucast_breakpoints.py",
        "step07_classification.py",
    ]),
    ("Tier D - terminal (master assembly)", [
        "step10_master.py",
        "step06_evaluability_rates.py",
    ]),
    ("Post-build - independent re-verification", [
        "pipeline_acceptance_check.py",
    ]),
]


def main():
    try:
        validate_raw_inputs()
        print("Preflight: all required raw input files are present under raw_inputs/.")
    except FileNotFoundError as exc:
        print(exc)
        sys.exit(1)

    log_rows = []

    for tier_name, scripts in TIERS:
        print(f"\n{'=' * 70}\n{tier_name}\n{'=' * 70}")
        for script in scripts:
            script_path = SRC / script
            print(f"\n--- running {script} ---")
            result = subprocess.run(
                [sys.executable, str(script_path)], cwd=SRC,
                capture_output=True, text=True,
            )
            print(result.stdout, end="")
            if result.stderr:
                print(result.stderr, end="", file=sys.stderr)

            pass_fail = "PASS" if result.returncode == 0 else "FAIL"
            exclusion_summary = "; ".join(WROTE_LINE_RE.findall(result.stdout)) or "n/a"
            log_rows.append({
                "step": script,
                "pass_fail": pass_fail,
                "exclusion_summary": exclusion_summary,
                "timestamp": dt.datetime.now().isoformat(timespec="seconds"),
                "version": "v1",
            })

            if result.returncode != 0:
                _write_log(log_rows)
                print(f"\nPipeline run HALTED: {script} exited with code {result.returncode}. "
                      "No downstream step was run, per Design Principle 2 - nothing should build "
                      "on an unverified upstream transform.")
                sys.exit(1)

    _write_log(log_rows)
    print(f"\n{'=' * 70}\nPipeline run: ALL STEPS PASSED\n{'=' * 70}")


def _write_log(log_rows):
    """Append this run's rows to the persisted check log (Part 9 Criterion 6) -
    never overwritten in place, per Design Principle 1: every run's evidence
    accumulates so a past run's PASS/FAIL record is never lost to a later one."""
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    new_df = pd.DataFrame(log_rows, columns=[
        "step", "pass_fail", "exclusion_summary", "timestamp", "version",
    ])
    if LOG_PATH.exists():
        existing_df = pd.read_csv(LOG_PATH)
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        combined_df = new_df
    combined_df.to_csv(LOG_PATH, index=False)
    print(f"\nWrote {len(new_df)} row(s) this run to {LOG_PATH.relative_to(ROOT)} "
          f"({len(combined_df)} total row(s) across all runs).")


if __name__ == "__main__":
    main()
