"""Measure an extracted attack's contact window from the motion itself, and emit it with its basis.

Read-only (saves no asset). Run after retarget (stage 3), before the clip is wired as an attack:
  UnrealEditor-Cmd <PoF.uproject> -run=pythonscript -script="shots/contact_window.py"
  env CW_ANIM   = AnimSequence path            (default /Game/MHA/AS_JediSaber_Manny)
  env CW_BONES  = contact point bone(s), comma  (default hand_r,hand_l: two-handed grip)
  env CW_DIR    = target direction: down|fwd|any (default down: an overhead strike)
  env CW_FRAC   = fraction of peak speed        (default 0.5)
  env CW_OUT    = sidecar JSON path             (default shots/out/contact_window_<anim>.json)

Why: the video route hands combat a clip whose strike moment is already in the motion. An
authored or constant hit time is a second answer to that question and nothing compares the two
(GA_MeleeAttack applies gray-box damage at GrayBoxHitDelay when the montage has no hit notify,
and a montage made from an extracted clip has none). This writes the measured answer down:
window = the run of native frames around peak contact-point speed (along CW_DIR) that stays at
or above CW_FRAC of the peak. Frames are the clip's own; seconds are derived, never stored alone.

The rate basis is reported as RESAMPLED: mha_capture.py re-encodes to 30 fps and forces 30 when
the extractor cannot read a rate, so the generator's native rate is not recoverable here.

Emits no window (status "not-measured") when the bone is missing or the clip never moves.
"""
import hashlib
import json
import math
import os

import unreal as u


def L(m):
    u.log("CWIN: %s" % m)


ANIM = os.environ.get("CW_ANIM", "/Game/MHA/AS_JediSaber_Manny")
BONES = [b.strip() for b in os.environ.get("CW_BONES", "hand_r,hand_l").split(",") if b.strip()]
DIRECTION = os.environ.get("CW_DIR", "down")
FRAC = float(os.environ.get("CW_FRAC", "0.5"))
NAME = ANIM.rsplit("/", 1)[-1]
OUT = os.environ.get("CW_OUT") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "out", "contact_window_%s.json" % NAME)
# Component space: mannequin up is +Z, the mesh faces +Y.
AXES = {"down": (2, -1.0), "fwd": (1, 1.0), "any": None}
MIN_PEAK_CM_S = 50.0  # below this the clip did not strike; refuse rather than report noise


def speeds(pos, rate, axis):
    out = [0.0]
    for i in range(1, len(pos)):
        dv = [(pos[i][k] - pos[i - 1][k]) * rate for k in range(3)]
        out.append(math.sqrt(sum(c * c for c in dv)) if axis is None else dv[axis[0]] * axis[1])
    return out


def window(sp, frac):
    pk = max(range(len(sp)), key=lambda i: sp[i])
    thr = sp[pk] * frac
    a, b = pk, pk
    while a - 1 >= 0 and sp[a - 1] >= thr:
        a -= 1
    while b + 1 < len(sp) and sp[b + 1] >= thr:
        b += 1
    return pk, a, b, sp[pk]


def main():
    seq = u.load_asset(ANIM)
    rec = {"clip": ANIM, "contact_points": BONES, "direction": DIRECTION, "fraction": FRAC}
    if not seq:
        rec.update(status="not-measured", reason="asset missing")
        return rec
    nf = u.AnimationLibrary.get_num_frames(seq)
    length = seq.get_play_length()
    rate = round(nf / length, 3) if length > 0 else 0.0
    rec.update(frames=nf, length_sec=length, rate_fps=rate,
               rate_basis="resampled (mha_capture forces 30 fps; generator native rate not recorded)")
    opts = u.AnimPoseEvaluationOptions()
    pos = {b: [] for b in BONES}
    for f in range(nf):
        pose = u.AnimPoseExtensions.get_anim_pose_at_time(seq, f / rate, opts)
        for b in BONES:
            p = u.AnimPoseExtensions.get_bone_pose(pose, b, u.AnimPoseSpaces.WORLD).translation
            pos[b].append([p.x, p.y, p.z])
    # Fingerprint: the window speaks for this clip only; a re-roll or re-solve changes it.
    h = hashlib.sha1(json.dumps([nf, round(length, 4), [[round(c, 2) for c in v] for b in BONES for v in pos[b]]]).encode())
    rec["clip_fingerprint"] = h.hexdigest()[:16]
    per = {}
    for b in BONES:
        if all(v == pos[b][0] for v in pos[b]):
            per[b] = {"status": "not-measured", "reason": "bone never moves (missing or unweighted)"}
            continue
        pk, a, s_end, v = window(speeds(pos[b], rate, AXES.get(DIRECTION)), FRAC)
        per[b] = {"peak_frame": pk, "start_frame": a, "end_frame": s_end, "peak_cm_s": round(v, 1)}
    rec["per_point"] = per
    measured = [w for w in per.values() if "start_frame" in w and w["peak_cm_s"] >= MIN_PEAK_CM_S]
    if not measured:
        rec.update(status="not-measured", reason="no contact point reached %.0f cm/s" % MIN_PEAK_CM_S)
        return rec
    a = min(w["start_frame"] for w in measured)
    b = max(w["end_frame"] for w in measured)
    rec.update(status="measured", start_frame=a, end_frame=b,
               start_sec=round(a / rate, 3), end_sec=round((b + 1) / rate, 3),
               resolution_ms=round(1000 / rate, 1))
    if b - a + 1 < 2:
        rec["note"] = "window shorter than two frames: it is as much a statement about the rate as the strike"
    # The second answer this clip currently gets, stated beside the measured one, never replacing it.
    try:
        cdo = u.get_default_object(u.load_class(None, "/Script/PoF.GA_MeleeAttack"))
        delay = float(cdo.get_editor_property("gray_box_hit_delay"))
        play_rate = float(cdo.get_editor_property("montage_play_rate")) or 1.0
        hit_frame = delay * play_rate * rate
        rec["authored"] = {"source": "GA_MeleeAttack.GrayBoxHitDelay", "sec": delay, "frame": round(hit_frame, 1),
                           "inside_window": a <= hit_frame <= b + 1,
                           "offset_sec": round(a / rate - delay * play_rate, 3)}
    except Exception as e:  # the ability may not exist in another project
        rec["authored"] = {"error": str(e)}
    return rec


rec = main()
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as fh:
    json.dump(rec, fh, indent=1)
L(json.dumps({k: rec.get(k) for k in ("status", "start_frame", "end_frame", "rate_fps", "start_sec", "end_sec", "authored")}))
L("wrote %s" % OUT)
