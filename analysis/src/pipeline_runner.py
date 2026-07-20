"""Shared runner for the one-pipeline orchestrator."""
from __future__ import annotations

import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd

from pipeline_registry import (
    BRIEF_DELIVERABLE_FILES,
    FULL_PIPELINE_STAGES,
    GATED_DELIVERABLE_FILES,
    PHASE_BY_ID,
    PREPROCESSING_STAGES,
    PipelineStage,
)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
RUNS_DIR = ROOT / "runs"
LEGACY_LOG_PATH = ROOT / "logs" / "pipeline_check_log_v1.csv"
WROTE_LINE_RE = re.compile(r"Wrote \d+ .*? to \S+")


@dataclass
class StageRunResult:
    stage_id: str
    label: str
    phase_id: str
    status: str
    started_at: str
    finished_at: str
    exit_code: int
    artifact_summary: str
    target: str


def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def _run_id_started_at() -> tuple[str, str]:
    started_at = dt.datetime.now()
    return started_at.strftime("%Y%m%dT%H%M%S"), started_at.isoformat(timespec="seconds")


def _extract_artifact_summary(stdout: str) -> str:
    matches = WROTE_LINE_RE.findall(stdout)
    return "; ".join(matches) if matches else "n/a"


def run_stage(stage: PipelineStage) -> tuple[StageRunResult, str]:
    started_at = _now()
    cwd = SRC

    if stage.kind == "script":
        script_path = (SRC / stage.target).resolve()
        if not script_path.exists():
            script_path = (ROOT / stage.target).resolve()
        cmd = [sys.executable, str(script_path)]
        cwd = ROOT if script_path.parent.name == "scripts" else SRC
    else:
        cmd = [sys.executable, "-m", stage.target, *stage.module_args]

    result = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True)
    stdout = result.stdout or ""
    stderr = result.stderr or ""
    combined_output = stdout + (f"\n{stderr}" if stderr else "")

    finished_at = _now()
    status = "pass" if result.returncode == 0 else "fail"
    return (
        StageRunResult(
            stage_id=stage.stage_id,
            label=stage.label,
            phase_id=stage.phase_id,
            status=status,
            started_at=started_at,
            finished_at=finished_at,
            exit_code=result.returncode,
            artifact_summary=_extract_artifact_summary(stdout),
            target=stage.target,
        ),
        combined_output,
    )


def _append_legacy_preprocessing_log(results: list[StageRunResult]) -> None:
    rows = [
        {
            "step": result.target,
            "pass_fail": "PASS" if result.status == "pass" else "FAIL",
            "exclusion_summary": result.artifact_summary,
            "timestamp": result.finished_at,
            "version": "v1",
        }
        for result in results
    ]
    new_df = pd.DataFrame(
        rows,
        columns=["step", "pass_fail", "exclusion_summary", "timestamp", "version"],
    )
    LEGACY_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if LEGACY_LOG_PATH.exists():
        combined_df = pd.concat([pd.read_csv(LEGACY_LOG_PATH), new_df], ignore_index=True)
    else:
        combined_df = new_df
    combined_df.to_csv(LEGACY_LOG_PATH, index=False)


def _artifact_presence(relative_paths: tuple[str, ...]) -> list[dict]:
    rows: list[dict] = []
    for item in relative_paths:
        if isinstance(item, tuple):
            number, rel_path = item
            rows.append(
                {
                    "brief_output_number": number,
                    "path": rel_path,
                    "present": (ROOT / rel_path).exists(),
                }
            )
        else:
            rows.append({"path": item, "present": (ROOT / item).exists()})
    return rows


def _load_documented_data_gaps() -> list[dict]:
    ledger_path = ROOT / "deliverables" / "identifiability_ledger_v1.csv"
    if not ledger_path.exists():
        return []
    ledger = pd.read_csv(ledger_path)
    if "gap_category" not in ledger.columns:
        return []
    gap_mask = ledger["gap_category"].astype(str).str.contains(
        r"external_data_gap|data_gap|partial_coverage|breakpoint_absent|breakpoint_or_standard_absent|breakpoint_and_ecv_absent|unresolved",
        case=False,
        na=False,
    )
    rows = ledger[gap_mask]
    return [
        {
            "ledger_id": row.get("ledger_id"),
            "field_or_drug": row.get("field_or_drug"),
            "description": row.get("description"),
            "assumption_or_caveat": row.get("assumption_or_caveat"),
        }
        for _, row in rows.iterrows()
    ]


def _run_duration_seconds(started_at: str, finished_at: str) -> float | None:
    try:
        start = dt.datetime.fromisoformat(started_at)
        end = dt.datetime.fromisoformat(finished_at)
        return round((end - start).total_seconds(), 1)
    except ValueError:
        return None


def write_run_manifest(
    *,
    run_id: str,
    started_at: str,
    finished_at: str,
    status: str,
    stage_results: list[StageRunResult],
    halted_at_stage: str | None,
) -> Path:
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    stages_df = pd.DataFrame([asdict(result) for result in stage_results])
    stages_csv = run_dir / "pipeline_run_stages_v1.csv"
    stages_df.to_csv(stages_csv, index=False)

    phases: list[dict] = []
    for phase_id, phase in PHASE_BY_ID.items():
        phase_stages = [asdict(result) for result in stage_results if result.phase_id == phase_id]
        if not phase_stages:
            continue
        phases.append(
            {
                "phase_id": phase_id,
                "label": phase.label,
                "dashboard_stage": phase.dashboard_stage,
                "status": "fail" if any(s["status"] == "fail" for s in phase_stages) else "pass",
                "stages": phase_stages,
            }
        )

    brief_deliverables = _artifact_presence(BRIEF_DELIVERABLE_FILES)
    gated_deliverables = _artifact_presence(GATED_DELIVERABLE_FILES)
    # "status" reflects only whether every stage exited 0; a stage can exit 0
    # while silently failing to write an expected deliverable (empty result,
    # wrong path, etc.), so surface deliverable presence as its own signal
    # rather than folding it into "status" and changing existing semantics.
    deliverables_complete = all(row["present"] for row in brief_deliverables) and all(
        row["present"] for row in gated_deliverables
    )

    manifest = {
        "run_id": run_id,
        "pipeline_version": "v1",
        "entrypoint": "run_all.py",
        "status": status,
        "deliverables_complete": deliverables_complete,
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_seconds": _run_duration_seconds(started_at, finished_at),
        "halted_at_stage": halted_at_stage,
        "stage_count": len(stage_results),
        "phases": phases,
        "brief_deliverables": brief_deliverables,
        "gated_deliverables": gated_deliverables,
        "section7_index": {
            "path": "deliverables/section7_deliverables_index_v1.csv",
            "present": (ROOT / "deliverables" / "section7_deliverables_index_v1.csv").exists(),
        },
        "documented_data_gaps": _load_documented_data_gaps() if status == "passed" else [],
        "stage_log_csv": str(stages_csv.relative_to(ROOT)).replace("\\", "/"),
    }

    manifest_path = run_dir / "pipeline_run_manifest_v1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    latest_dir = RUNS_DIR / "latest"
    latest_dir.mkdir(parents=True, exist_ok=True)
    (latest_dir / "pipeline_run_manifest_v1.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    stages_df.to_csv(latest_dir / "pipeline_run_stages_v1.csv", index=False)
    return manifest_path


def _resync_published_manifest(manifest_path: Path) -> None:
    """Overwrite data/published/runs/latest/ with this run's true final manifest.

    publish_dashboard_data.py (a mid-pipeline stage) copies analysis/runs/latest/
    into data/published/runs/latest/ while it runs - at that point the only
    manifest on disk is the provisional snapshot written just before it started
    (see the provisional_publish_result comment below), so the published copy
    always ends up with a placeholder ("n/a", zero duration) publish_dashboard_data
    entry. The true final manifest, with that stage's real result, is only
    written afterward, to analysis/runs/latest/. Re-copying it here - once it
    exists - closes that gap.
    """
    published_run_dir = ROOT.parent / "data" / "published" / "runs" / "latest"
    if not published_run_dir.exists():
        return
    shutil.copy2(manifest_path, published_run_dir / "pipeline_run_manifest_v1.json")
    stages_csv = RUNS_DIR / "latest" / "pipeline_run_stages_v1.csv"
    if stages_csv.exists():
        shutil.copy2(stages_csv, published_run_dir / "pipeline_run_stages_v1.csv")


def run_pipeline_stages(
    stages: tuple[PipelineStage, ...],
    *,
    run_id: str,
    started_at: str,
    write_legacy_preprocessing_log: bool = False,
) -> int:
    stage_results: list[StageRunResult] = []
    preprocessing_results: list[StageRunResult] = []

    for stage in stages:
        phase = PHASE_BY_ID[stage.phase_id]
        print(f"\n{'=' * 70}\n[{phase.label}]\n{stage.label} ({stage.target})\n{'=' * 70}")

        if stage.stage_id == "publish_dashboard_data":
            # publish_dashboard_data snapshots analysis/runs/latest/ into
            # data/published/ and the dashboard bundle. Refresh that snapshot
            # with this run's id right before it runs (every prior stage in
            # this loop already passed, or we would have returned above),
            # otherwise it publishes whatever a previous run left behind.
            #
            # publish_dashboard_data is itself about to be the 30th stage,
            # but its true StageRunResult (real timing, exit code) only
            # exists after run_stage() below returns - and by then the
            # manifest has already been read and copied into
            # data/published/ from inside that subprocess. Without a
            # provisional entry here, the published manifest would always
            # undercount stage_count by one and silently omit
            # publish_dashboard_data from phases/stage_results, even though
            # its own output is the artifact being published. The real
            # result (line ~274) still supersedes this in the final
            # end-of-loop manifest write to analysis/runs/latest/; only the
            # copy already taken by this successful-so-far run uses the
            # provisional entry.
            provisional_publish_result = StageRunResult(
                stage_id=stage.stage_id,
                label=stage.label,
                phase_id=stage.phase_id,
                status="pass",
                started_at=_now(),
                finished_at=_now(),
                exit_code=0,
                artifact_summary="n/a",
                target=stage.target,
            )
            write_run_manifest(
                run_id=run_id,
                started_at=started_at,
                finished_at=_now(),
                status="passed",
                stage_results=stage_results + [provisional_publish_result],
                halted_at_stage=None,
            )

        result, output = run_stage(stage)
        if output.strip():
            print(output, end="" if output.endswith("\n") else "\n")
        stage_results.append(result)

        if stage.phase_id == "preprocessing":
            preprocessing_results.append(result)

        if result.status == "fail":
            finished_at = _now()
            manifest_path = write_run_manifest(
                run_id=run_id,
                started_at=started_at,
                finished_at=finished_at,
                status="failed",
                stage_results=stage_results,
                halted_at_stage=stage.stage_id,
            )
            if write_legacy_preprocessing_log and preprocessing_results:
                _append_legacy_preprocessing_log(preprocessing_results)
            print(
                f"\nPipeline HALTED at {stage.stage_id} (exit {result.exit_code}). "
                f"Run manifest: {manifest_path.relative_to(ROOT)}"
            )
            return result.exit_code or 1

    finished_at = _now()
    manifest_path = write_run_manifest(
        run_id=run_id,
        started_at=started_at,
        finished_at=finished_at,
        status="passed",
        stage_results=stage_results,
        halted_at_stage=None,
    )
    _resync_published_manifest(manifest_path)
    if write_legacy_preprocessing_log and preprocessing_results:
        _append_legacy_preprocessing_log(preprocessing_results)
    print(f"\n{'=' * 70}\nONE PIPELINE RUN: ALL STAGES PASSED\n{'=' * 70}")
    print(f"Run manifest: {manifest_path.relative_to(ROOT)}")
    return 0


def run_full_pipeline() -> int:
    sys.path.insert(0, str(SRC))
    from _data_paths import validate_raw_inputs

    run_id, started_at = _run_id_started_at()
    print("AMR Life Expectancy — one pipeline run")
    print(f"Run ID: {run_id}\n")

    try:
        validate_raw_inputs()
        print("Preflight: all required raw input files are present under raw_inputs/.")
    except FileNotFoundError as exc:
        print(exc)
        write_run_manifest(
            run_id=run_id,
            started_at=started_at,
            finished_at=_now(),
            status="failed",
            stage_results=[],
            halted_at_stage="preflight",
        )
        return 1

    return run_pipeline_stages(
        FULL_PIPELINE_STAGES,
        run_id=run_id,
        started_at=started_at,
        write_legacy_preprocessing_log=True,
    )


def run_preprocessing_only() -> int:
    sys.path.insert(0, str(SRC))
    from _data_paths import validate_raw_inputs

    run_id, started_at = _run_id_started_at()
    print("AMR Life Expectancy — preprocessing-only run")
    print(f"Run ID: {run_id}\n")

    try:
        validate_raw_inputs()
        print("Preflight: all required raw input files are present under raw_inputs/.")
    except FileNotFoundError as exc:
        print(exc)
        write_run_manifest(
            run_id=run_id,
            started_at=started_at,
            finished_at=_now(),
            status="failed",
            stage_results=[],
            halted_at_stage="preflight",
        )
        return 1

    return run_pipeline_stages(
        PREPROCESSING_STAGES,
        run_id=run_id,
        started_at=started_at,
        write_legacy_preprocessing_log=True,
    )
