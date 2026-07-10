"""Step 19a — Clean ATLAS + PLEA into Evidence Gate clean store."""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from evidence_gate_core.ingest_atlas import clean_atlas_kp
from evidence_gate_core.ingest_plea import clean_plea
from evidence_gate_core.paths import ATLAS_KP_CLEAN, CLEAN_MANIFEST, PLEA_CLEAN


def main():
    failed = False
    today = dt.date.today().isoformat()

    kp = clean_atlas_kp()
    plea = clean_plea()
    print(f"Wrote {len(kp)} ATLAS Kp row(s) to {ATLAS_KP_CLEAN.relative_to(ROOT)}")
    print(f"Wrote {len(plea)} PLEA row(s) to {PLEA_CLEAN.relative_to(ROOT)}")

    manifest = pd.DataFrame(
        [
            {"cohort": "ATLAS_Kp", "path": str(ATLAS_KP_CLEAN.relative_to(ROOT)), "rows": len(kp), "version": "v1", "date_added": today},
            {"cohort": "PLEA_I", "path": str(PLEA_CLEAN.relative_to(ROOT)), "rows": len(plea), "version": "v1", "date_added": today},
        ]
    )
    CLEAN_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    manifest.to_csv(CLEAN_MANIFEST, index=False)
    print(f"Wrote manifest to {CLEAN_MANIFEST.relative_to(ROOT)}")

    for path in (ATLAS_KP_CLEAN, PLEA_CLEAN):
        if not path.exists() or path.stat().st_size == 0:
            print(f"FAIL: {path} missing or empty")
            failed = True

    if failed:
        print("\nStep 19a Check: FAIL")
        sys.exit(1)
    print("\nStep 19a Check: PASS")


if __name__ == "__main__":
    main()
