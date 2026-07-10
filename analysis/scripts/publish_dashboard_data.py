#!/usr/bin/env python3
"""Copy pipeline deliverables to data/published/ and build dashboard JSON bundle."""
from __future__ import annotations

import datetime as dt
import json
import shutil
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[2]
ANALYSIS = REPO / "analysis"
DELIVERABLES = ANALYSIS / "deliverables"
BOUNDS = ANALYSIS / "bounds"
RUNS_LATEST = ANALYSIS / "runs" / "latest"
PUBLISHED = REPO / "data" / "published"
DASHBOARD_PUBLIC = REPO / "dashboard" / "public" / "data" / "published"


def _copy_csvs(src_dir: Path, dst_dir: Path, pattern: str) -> list[str]:
    copied: list[str] = []
    dst_dir.mkdir(parents=True, exist_ok=True)
    for path in sorted(src_dir.glob(pattern)):
        shutil.copy2(path, dst_dir / path.name)
        copied.append(path.name)
    return copied


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return pd.read_csv(path).where(pd.notna, None).to_dict(orient="records")


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
            "pipeline_wired": "yes" if GBD_LRI_INCLUDED else "no",
            "on_disk": on_disk(
                "analysis/docs/Global Burden of Disease Study 2021 (GBD 2021) "
                "Lower Respiratory Infections and Aetiologies Incidence and Mortality Estimates 1990-2021"
            ),
        },
    ]
    wired = sum(1 for d in datasets if d.get("pipeline_wired") == "yes")
    return {
        "generated_at": today,
        "wired_count": wired,
        "gap_count": len(datasets) - wired,
        "published_count": len(copied_files),
        "dashboard_source": "data/published/dashboard_bundle_v1.json",
        "datasets": datasets,
    }


def build_dashboard_bundle() -> dict:
    manifest = _manifest_run()
    return {
        "bundle_version": "v1",
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "pipeline_run": {
            "run_id": manifest.get("run_id"),
            "status": manifest.get("status"),
        },
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
    copied += _copy_csvs(DELIVERABLES, PUBLISHED, "*.csv")

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
    bundle_path.write_text(json.dumps(bundle, indent=2), encoding="utf-8")

    status = build_dataset_status(copied_files=copied)
    (PUBLISHED / "dataset_status_v1.json").write_text(
        json.dumps(status, indent=2),
        encoding="utf-8",
    )

    DASHBOARD_PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy2(bundle_path, DASHBOARD_PUBLIC / bundle_path.name)
    shutil.copy2(PUBLISHED / "dataset_status_v1.json", DASHBOARD_PUBLIC / "dataset_status_v1.json")

    print(f"Wrote {len(copied)} artifact(s) to {PUBLISHED.relative_to(REPO)}")
    print(f"Wrote dashboard_bundle_v1.json ({len(bundle['countryRiskBacterial'])} bacterial risk rows)")
    print(f"Synced bundle to {DASHBOARD_PUBLIC.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
