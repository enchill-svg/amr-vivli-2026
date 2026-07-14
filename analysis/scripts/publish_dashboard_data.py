#!/usr/bin/env python3
"""Copy pipeline deliverables to data/published/ and build dashboard JSON bundle."""
from __future__ import annotations

import datetime as dt
import json
import math
import shutil
import sys
from pathlib import Path
from numbers import Real

import pandas as pd
import numpy as np

REPO = Path(__file__).resolve().parents[2]
ANALYSIS = REPO / "analysis"
DELIVERABLES = ANALYSIS / "deliverables"
BOUNDS = ANALYSIS / "bounds"
RUNS_LATEST = ANALYSIS / "runs" / "latest"
PUBLISHED = REPO / "data" / "published"
DASHBOARD_PUBLIC = REPO / "dashboard" / "public" / "data" / "published"

# Public-safe deliverable patterns (never copy ungated ranking tables).
PUBLIC_DELIVERABLE_GLOBS = [
    "*_gated_v1.csv",
    "funding_gap_summary_v1.csv",
    "gating_comparison_v1.csv",
    "identifiability_ledger_v1.csv",
    "q2_driver_evidence_summary_v1.csv",
    "section7_deliverables_index_v1.csv",
    "organism_drug_quality_gate_v1.csv",
    "dataset_manifest_v1.csv",
]

# Internal-only ranking tables that must never remain in data/published/.
UNSAFE_PUBLISHED_CSVS = frozenset(
    {
        "country_risk_ranking_bacterial_v1.csv",
        "country_risk_ranking_fungal_v1.csv",
        "cluster_typology_bacterial_v1.csv",
        "cluster_typology_fungal_v1.csv",
        "intervention_recommendations_ranked_v1.csv",
    }
)


def _copy_public_deliverables(src_dir: Path, dst_dir: Path) -> list[str]:
    copied: list[str] = []
    dst_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    for pattern in PUBLIC_DELIVERABLE_GLOBS:
        for path in sorted(src_dir.glob(pattern)):
            if path.name in seen:
                continue
            shutil.copy2(path, dst_dir / path.name)
            copied.append(path.name)
            seen.add(path.name)
    return copied


def _purge_unsafe_published() -> list[str]:
    removed: list[str] = []
    for name in sorted(UNSAFE_PUBLISHED_CSVS):
        path = PUBLISHED / name
        if path.exists():
            path.unlink()
            removed.append(name)
    return removed


def _assert_publish_policy() -> None:
    unsafe = sorted(
        p.name
        for p in PUBLISHED.glob("*.csv")
        if p.name in UNSAFE_PUBLISHED_CSVS
    )
    if unsafe:
        raise RuntimeError(
            "Unsafe ungated ranking table(s) in data/published/: "
            + ", ".join(unsafe)
        )


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    # to_json emits null for NaN — valid RFC 8259 JSON (browser-safe)
    return json.loads(pd.read_csv(path).to_json(orient="records"))


def _sanitize_for_json(value: object) -> object:
    if isinstance(value, dict):
        return {str(k): _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_json(v) for v in value]
    if value is None or value is pd.NA:
        return None
    if isinstance(value, (np.floating, float)):
        f = float(value)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(value, (np.integer, int)) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, Real) and not isinstance(value, bool):
        f = float(value)
        return None if math.isnan(f) or math.isinf(f) else f
    return value


def _write_json(path: Path, payload: dict) -> None:
    safe = _sanitize_for_json(payload)
    path.write_text(
        json.dumps(safe, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def _manifest_run() -> dict:
    manifest_path = RUNS_LATEST / "pipeline_run_manifest_v1.json"
    if not manifest_path.exists():
        return {"status": "missing", "run_id": None}
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def build_dataset_status(*, copied_files: list[str]) -> dict:
    from _section6_external import (  # noqa: WPS433
        CONSUMPTION_DATA_AVAILABLE,
        GBD_LRI_INCLUDED,
        GBD_SDI_PATH,
        HOSPITAL_BEDS_PATH,
        SDI_INCLUDED,
    )

    def on_disk(rel: str) -> bool:
        return (REPO / rel).exists() or (ANALYSIS / rel).exists()

    today = dt.date.today().isoformat()
    datasets = [
        {
            "id": "esac_consumption",
            "name": "ECDC ESAC-Net antimicrobial consumption",
            "pipeline_wired": "yes" if CONSUMPTION_DATA_AVAILABLE else "metadata_only",
            "published_output": "dashboard_bundle_v1.json",
            "on_disk": CONSUMPTION_DATA_AVAILABLE,
        },
        {
            "id": "hospital_beds",
            "name": "World Bank hospital beds per capita",
            "pipeline_wired": "yes" if HOSPITAL_BEDS_PATH.exists() else "no",
            "on_disk": HOSPITAL_BEDS_PATH.exists(),
        },
        {
            "id": "gbd_sdi",
            "name": "GBD 2023 SDI",
            "pipeline_wired": "yes" if SDI_INCLUDED else "no",
            "on_disk": GBD_SDI_PATH.exists(),
        },
        {
            "id": "gbd_lri",
            "name": "GBD LRI pathogen burden comparator",
            "pipeline_wired": "joined_unused" if GBD_LRI_INCLUDED else "no",
            "on_disk": on_disk(
                "analysis/docs/Global Burden of Disease Study 2021 (GBD 2021) "
                "Lower Respiratory Infections and Aetiologies Incidence and Mortality Estimates 1990-2021"
            ),
        },
    ]
    wired = sum(1 for d in datasets if d.get("pipeline_wired") in ("yes", "joined_unused"))
    return {
        "generated_at": today,
        "wired_count": wired,
        "gap_count": len(datasets) - wired,
        "published_count": len(copied_files),
        "dashboard_source": "data/published/dashboard_bundle_v1.json",
        "datasets": datasets,
    }


def build_pipeline_summary() -> dict:
    summary: dict[str, int | str | None] = {}
    registry = ANALYSIS / "master" / "isolate_registry_v1.csv"
    master = ANALYSIS / "master" / "master_table_v1.csv"
    if registry.exists():
        summary["raw_isolate_count"] = int(len(pd.read_csv(registry, low_memory=False)))
    if master.exists():
        master_df = pd.read_csv(master, usecols=["isolate_id"], low_memory=False)
        summary["master_isolate_count"] = int(master_df["isolate_id"].nunique())
        summary["master_row_count"] = int(len(master_df))
    manifest = _manifest_run()
    summary["pipeline_run_id"] = manifest.get("run_id")
    return summary


def build_dashboard_bundle() -> dict:
    manifest = _manifest_run()
    return {
        "bundle_version": "v1",
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "pipeline_run": {
            "run_id": manifest.get("run_id"),
            "status": manifest.get("status"),
        },
        "pipelineSummary": build_pipeline_summary(),
        "countryRiskBacterial": _read_csv(PUBLISHED / "country_risk_ranking_bacterial_gated_v1.csv"),
        "countryRiskFungal": _read_csv(PUBLISHED / "country_risk_ranking_fungal_gated_v1.csv"),
        "clusterTypologyBacterial": _read_csv(PUBLISHED / "cluster_typology_bacterial_gated_v1.csv"),
        "clusterTypologyFungal": _read_csv(PUBLISHED / "cluster_typology_fungal_gated_v1.csv"),
        "interventions": _read_csv(PUBLISHED / "intervention_recommendations_ranked_gated_v1.csv"),
        "fundingGap": _read_csv(PUBLISHED / "funding_gap_summary_v1.csv"),
        "gatingComparison": _read_csv(PUBLISHED / "gating_comparison_v1.csv"),
        "identifiabilityLedger": _read_csv(PUBLISHED / "identifiability_ledger_v1.csv"),
        "q2DriverSummary": _read_csv(PUBLISHED / "q2_driver_evidence_summary_v1.csv"),
        "associationSensitivity": _read_csv(PUBLISHED / "association_sensitivity_manifest_v1.csv"),
        "deliverablesIndex": _read_csv(PUBLISHED / "section7_deliverables_index_v1.csv"),
    }


def main() -> int:
    sys.path.insert(0, str(ANALYSIS / "src"))
    if not DELIVERABLES.exists():
        print(f"FAIL: missing {DELIVERABLES}")
        return 1

    copied: list[str] = []
    copied += _copy_public_deliverables(DELIVERABLES, PUBLISHED)
    removed = _purge_unsafe_published()
    if removed:
        print(f"Removed {len(removed)} unsafe ungated file(s) from {PUBLISHED.relative_to(REPO)}")

    sens = BOUNDS / "association_sensitivity_manifest_v1.csv"
    if sens.exists():
        shutil.copy2(sens, PUBLISHED / sens.name)
        copied.append(sens.name)

    run_dst = PUBLISHED / "runs" / "latest"
    run_dst.mkdir(parents=True, exist_ok=True)
    if RUNS_LATEST.exists():
        for name in ("pipeline_run_manifest_v1.json", "pipeline_run_stages_v1.csv"):
            src = RUNS_LATEST / name
            if src.exists():
                shutil.copy2(src, run_dst / name)
                copied.append(f"runs/latest/{name}")

    bundle = build_dashboard_bundle()
    bundle_path = PUBLISHED / "dashboard_bundle_v1.json"
    _write_json(bundle_path, bundle)

    status = build_dataset_status(copied_files=copied)
    _write_json(PUBLISHED / "dataset_status_v1.json", status)

    DASHBOARD_PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy2(bundle_path, DASHBOARD_PUBLIC / bundle_path.name)
    shutil.copy2(PUBLISHED / "dataset_status_v1.json", DASHBOARD_PUBLIC / "dataset_status_v1.json")

    _assert_publish_policy()

    print(f"Wrote {len(copied)} artifact(s) to {PUBLISHED.relative_to(REPO)}")
    print(f"Wrote dashboard_bundle_v1.json ({len(bundle['countryRiskBacterial'])} bacterial risk rows)")
    print(f"Synced bundle to {DASHBOARD_PUBLIC.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
