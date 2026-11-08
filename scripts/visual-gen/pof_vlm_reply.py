"""PoF VLM reply protocol - the ONE Python parser for `SCORE=<0-10>; DEFECTS=...; VERDICT=...`.

Shared by pof_vlm_critique.py and pof_vlm_batch.py. TS mirror: parseGateReply in
src/lib/visual-gen/input-gate.ts; src/__tests__/scripts/vlmReplyParity.test.ts pins both to
one fixture table. Import it from a script with the script directory put on sys.path first:
`python -I` drops that directory, so a bare `import pof_vlm_reply` would fail.
"""
import re

# The prompt asks for 0-10: anything else is no verdict, never a number to pass along.
SCORE_RE = re.compile(r"\s*(\d+(?:\.\d+)?)\s*(?:(?:/|out of)\s*10)?\s*\.?\s*")


def parse_score(raw):
    m = SCORE_RE.fullmatch(raw or "")
    if not m:
        return None
    value = float(m.group(1))
    return value if 0 <= value <= 10 else None


def parse_fields(gen):
    """The raw SCORE / DEFECTS / VERDICT values present in a single-line reply."""
    fields = {}
    for key in ("SCORE", "DEFECTS", "VERDICT"):
        m = re.search(key + r"=([^;]+)", gen)
        if m:
            fields[key] = m.group(1).strip()
    return fields
