#!/usr/bin/env python3
"""Clean a YouTube auto-sub .vtt into a deduped, timestamped transcript.

Usage:  python clean_vtt.py <path/to/file.en.vtt>  [more.vtt ...]
Output: a sibling <name>.clean.txt for each input (timestamps ~every 25s for citation).
"""
import re
import sys
import os


def clean(path):
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    out, last, cur_ts, seen = [], None, None, set()
    for ln in lines:
        if ln.startswith(("WEBVTT", "Kind:", "Language:")):
            continue
        m = re.match(r"^(\d{2}:\d{2}:\d{2})\.\d+\s*-->", ln)
        if m:
            cur_ts = m.group(1)
            continue
        if not ln.strip():
            continue
        txt = re.sub(r"<[^>]+>", "", ln).strip()      # strip inline tags
        txt = re.sub(r"\s+", " ", txt)
        if not txt or txt == last:                    # drop consecutive repeats
            continue
        last = txt
        key = txt.lower()
        if key in seen:                               # drop rolling-caption repeats
            continue
        seen.add(key)
        out.append((cur_ts, txt))

    def secs(t):
        h, m_, s = t.split(":")
        return int(h) * 3600 + int(m_) * 60 + int(s)

    result, last_emit = [], None
    for ts, txt in out:
        prefix = ""
        if ts and (last_emit is None or secs(ts) - secs(last_emit) >= 25):
            prefix, last_emit = f"[{ts}] ", ts
        result.append(prefix + txt)
    return "\n".join(result)


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    for path in argv:
        cleaned = clean(path)
        out_path = re.sub(r"\.vtt$", "", path) + ".clean.txt"
        out_path = out_path.replace(".en", "").replace(".en-orig", "")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(cleaned)
        print(f"{os.path.basename(path)}: {len(cleaned.split())} words -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
