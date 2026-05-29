"""Identify which Chrome profile is logged into Mixamo by scanning each profile's
Cookies SQLite for mixamo.com / adobe host entries. Cookie *values* are encrypted
(App-Bound), but host_key + name are plaintext — enough to pick the right profile.

Copies the locked Cookies DB to temp before reading (Chrome holds a lock).
"""

from __future__ import annotations

import os
import shutil
import sqlite3
import tempfile

USER_DATA = r"C:\Users\kazda\AppData\Local\Google\Chrome\User Data"
PROFILES = ["Default", "Profile 1", "Profile 2", "Profile 3"]
HOST_HINTS = ("mixamo", "adobe", "ims-na")


def scan(profile: str) -> dict:
    # Chrome 96+: cookies live under <profile>/Network/Cookies
    candidates = [
        os.path.join(USER_DATA, profile, "Network", "Cookies"),
        os.path.join(USER_DATA, profile, "Cookies"),
    ]
    src = next((c for c in candidates if os.path.isfile(c)), None)
    if not src:
        return {"profile": profile, "found": False, "reason": "no Cookies db"}

    tmp = tempfile.mkdtemp(prefix="ck_")
    dst = os.path.join(tmp, "Cookies")
    try:
        shutil.copy2(src, dst)
        con = sqlite3.connect(dst)
        rows = con.execute(
            "SELECT host_key, name, has_expires, is_persistent FROM cookies"
        ).fetchall()
        con.close()
        hits = {}
        for host, name, has_exp, persist in rows:
            h = (host or "").lower()
            if any(hint in h for hint in HOST_HINTS):
                hits.setdefault(host, []).append(name)
        return {"profile": profile, "found": bool(hits), "total_cookies": len(rows), "hits": hits}
    except Exception as e:  # noqa: BLE001
        return {"profile": profile, "found": False, "reason": str(e)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main() -> None:
    for p in PROFILES:
        if not os.path.isdir(os.path.join(USER_DATA, p)):
            continue
        r = scan(p)
        if r.get("found"):
            print(f"[{p}] total={r['total_cookies']} MIXAMO/ADOBE HOSTS:")
            for host, names in r["hits"].items():
                print(f"    {host}: {len(names)} cookies")
        else:
            print(f"[{p}] no mixamo/adobe cookies ({r.get('reason', 'none')})")


if __name__ == "__main__":
    main()
