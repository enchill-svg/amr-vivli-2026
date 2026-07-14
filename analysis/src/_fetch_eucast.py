"""Download historical EUCAST breakpoint Excel files."""
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _data_paths import EUCAST_DIR  # noqa: E402

DEST = EUCAST_DIR
DEST.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (compatible; amr-vivli-pipeline/1.0)"}
BASE = "https://www.eucast.org"

URLS = {
    "6.0": [
        f"{BASE}/fileadmin/src/media/PDFs/EUCAST_files/Breakpoint_tables/v_6.0_Breakpoint_table.xlsx",
        f"{BASE}/fileadmin/src/media/PDFs/EUCAST_files/Breakpoint_tables/v_6.0_Breakpoint_Table.xlsx",
        f"{BASE}/fileadmin/eucast/pdf/Document_Archive/bacteria/breakpoint_tables/v_6.0_Breakpoint_Tables.xlsx",
    ],
    "8.1": [f"{BASE}/fileadmin/eucast/pdf/Document_Archive/bacteria/breakpoint_tables/v_8.1_Breakpoint_Tables.xlsx"],
    "10.0": [f"{BASE}/fileadmin/eucast/pdf/Document_Archive/bacteria/breakpoint_tables/v_10.0_Breakpoint_Tables.xlsx"],
    "11.0": [f"{BASE}/fileadmin/eucast/pdf/Document_Archive/bacteria/breakpoint_tables/v_11.0_Breakpoint_Tables.xlsx"],
}

for ver, candidates in URLS.items():
    out = DEST / f"v_{ver}_Breakpoint_Tables.xlsx"
    if out.exists() and out.stat().st_size > 10000:
        print(f"SKIP v{ver} - already exists ({out.stat().st_size:,} bytes)")
        continue
    ok = False
    for url in candidates:
        print(f"Trying v{ver}: {url}")
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as resp, open(out, "wb") as f:
                data = resp.read()
            if len(data) < 10000:
                print(f"  too small ({len(data)} bytes), skip")
                continue
            out.write_bytes(data)
            print(f"  OK -> {out.name} ({len(data):,} bytes)")
            ok = True
            break
        except Exception as e:
            print(f"  FAIL: {e}")
    if not ok:
        print(f"WARNING: could not download EUCAST v{ver}")
