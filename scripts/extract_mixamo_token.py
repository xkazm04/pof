"""Extract the Mixamo access_token from Chrome's on-disk Local Storage (LevelDB).

Chrome stores localStorage in a LevelDB under each profile's "Local Storage/leveldb".
While Chrome runs, the DB is locked, so we copy the .ldb/.log files to a temp dir and
binary-scan them for the mixamo.com access_token (a JWT, "eyJ...").

No external deps — raw byte scan. Prints the token + which profile it came from.
"""

from __future__ import annotations

import os
import re
import shutil
import sys
import tempfile

USER_DATA = r"C:\Users\kazda\AppData\Local\Google\Chrome\User Data"
PROFILES = ["Default", "Profile 1", "Profile 2", "Profile 3"]

# JWT: three base64url segments separated by dots. Tokens are long; require a real header.
JWT_RE = re.compile(rb"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
# We only trust a JWT that appears in a blob that also mentions mixamo + access_token.
MIXAMO_RE = re.compile(rb"mixamo", re.IGNORECASE)
ACCESS_RE = re.compile(rb"access_token", re.IGNORECASE)


def scan_profile(profile: str) -> list[tuple[str, bytes]]:
    src = os.path.join(USER_DATA, profile, "Local Storage", "leveldb")
    if not os.path.isdir(src):
        return []
    tmp = tempfile.mkdtemp(prefix=f"ls_{profile.replace(' ', '_')}_")
    hits: list[tuple[str, bytes]] = []
    try:
        for name in os.listdir(src):
            if not name.endswith((".ldb", ".log")):
                continue
            try:
                shutil.copy2(os.path.join(src, name), os.path.join(tmp, name))
            except (PermissionError, OSError):
                # Locked file — try a raw read instead of copy
                try:
                    with open(os.path.join(src, name), "rb") as fh:
                        data = fh.read()
                    with open(os.path.join(tmp, name), "wb") as out:
                        out.write(data)
                except OSError:
                    continue
        for name in os.listdir(tmp):
            with open(os.path.join(tmp, name), "rb") as fh:
                blob = fh.read()
            if not (MIXAMO_RE.search(blob) and ACCESS_RE.search(blob)):
                continue
            # Find the JWT that sits closest after an "access_token" marker.
            for m in ACCESS_RE.finditer(blob):
                window = blob[m.start(): m.start() + 4096]
                jwt = JWT_RE.search(window)
                if jwt:
                    hits.append((profile, jwt.group(0)))
            # Fallback: any JWT in a mixamo blob
            if not hits:
                for jwt in JWT_RE.finditer(blob):
                    hits.append((profile, jwt.group(0)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return hits


def main() -> int:
    all_hits: list[tuple[str, bytes]] = []
    for p in PROFILES:
        all_hits.extend(scan_profile(p))

    if not all_hits:
        print("NO_TOKEN_FOUND")
        return 1

    # Dedupe, prefer the longest token (full JWT) per profile
    seen: set[bytes] = set()
    for profile, tok in sorted(all_hits, key=lambda x: -len(x[1])):
        if tok in seen:
            continue
        seen.add(tok)
        token = tok.decode("ascii", errors="replace")
        # JWTs have 2 dots; sanity check + report payload length
        print(f"PROFILE={profile}")
        print(f"TOKEN={token}")
        print(f"TOKEN_LEN={len(token)}")
        break
    return 0


if __name__ == "__main__":
    sys.exit(main())
