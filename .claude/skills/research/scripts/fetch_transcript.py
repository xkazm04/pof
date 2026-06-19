#!/usr/bin/env python3
"""Fallback transcript fetch via youtube-transcript-api (hits YouTube's caption
endpoint directly — use when yt-dlp's extraction hangs/throttles).

Usage:  python fetch_transcript.py <video_id>
Output: $TEMP/pof-research/<video_id>.clean.txt  (deduped, ~25s timestamps)
"""
import sys
import os
import subprocess


def ensure_pkg():
    try:
        import youtube_transcript_api  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q",
                        "youtube-transcript-api"], check=True)


def fetch_raw(vid):
    from youtube_transcript_api import YouTubeTranscriptApi
    langs = ["en", "en-US", "en-GB"]
    # 1.x instance API
    try:
        fetched = YouTubeTranscriptApi().fetch(vid, languages=langs)
        if hasattr(fetched, "to_raw_data"):
            return fetched.to_raw_data()
        return [{"text": s.text, "start": s.start} for s in fetched]
    except Exception as e1:
        # <=0.6 classmethod API
        try:
            return YouTubeTranscriptApi.get_transcript(vid, languages=langs)
        except Exception as e2:
            print(f"FETCH_FAIL: {e1!r} | {e2!r}")
            sys.exit(2)


def fmt(t):
    s = int(t)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def main(vid):
    ensure_pkg()
    raw = fetch_raw(vid)
    out, last, last_emit = [], None, None
    for snip in raw:
        txt = " ".join(snip["text"].split())
        if not txt or txt == last:
            continue
        last = txt
        st = snip.get("start", 0)
        prefix = ""
        if last_emit is None or st - last_emit >= 25:
            prefix, last_emit = f"[{fmt(st)}] ", st
        out.append(prefix + txt)
    text = "\n".join(out)
    work = os.path.join(os.environ.get("TEMP", ""), "pof-research")
    os.makedirs(work, exist_ok=True)
    op = os.path.join(work, vid + ".clean.txt")
    with open(op, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"{vid}: {len(text.split())} words -> {op}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
