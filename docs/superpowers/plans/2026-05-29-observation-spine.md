# Observation Spine (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ground-truth observation substrate (Tiers T3/T4) so a Claude Code agent can verify UE work against reality — and prove it by diagnosing + catching the live player-movement T-pose that every symbolic gate missed.

**Architecture:** Five observation verbs behind the existing `/pof/python/run` bridge route, each returning a typed `Observation`; a shared `Observation`/`Verdict` contract (Python + TypeScript); recording to `pipeline_artifacts`. Pure-Python verbs (`GetState`, `ApiGroundingProbe`, clip-level `EvaluatePose`) ship first (no C++ build); the `RunScenario` PIE harness (C++) is the capstone. The agent's own multimodal `Read` of a captured PNG is the T4 perceptual authority.

**Tech Stack:** UE 5.7 Python (`unreal` module) + C++ (PoF/PoFEditor + PillarsOfFortuneBridge), Next.js/TypeScript (app-side contract + recording), vitest, pytest with a mocked `unreal`.

**Spec:** `docs/superpowers/specs/2026-05-29-llm-ue-interface-design.md`

**Repos:** UE work → `pof-exp` (branch `feature/observation-spine`); app contract → PoF app `master`.

**Conventions:** `@/` alias, no raw console, no hex; UE judged by `-abslog` not exit code; editor launch via the hardened helper (Task 3); commit trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**UE (pof-exp):**
- `Content/Python/observation/__init__.py` — package + the shared `make_observation()` envelope helper
- `Content/Python/observation/get_state.py` — `GetState` verb (T3, semantic asset introspection)
- `Content/Python/observation/api_probe.py` — `ApiGroundingProbe` verb (class methods / asset props / assets-at-path)
- `Content/Python/observation/evaluate_pose.py` — `EvaluatePose` verb (T3): clip-level static detection + PIE live-pose read
- `Content/Python/observation/capture_frame.py` — `CaptureFrame` verb (T4): drive the existing snapshot, return PNG path(s)
- `Content/Python/observation/run_scenario.py` — `RunScenario` (T3+T4 driver): thin Python that calls the C++ harness
- `Content/Python/tests/test_observation_*.py` — mocked-`unreal` pytests
- `Source/PoFEditor/Public/PoFScenarioRunner.h` + `Private/PoFScenarioRunner.cpp` — C++ PIE harness (`RunScenario` capstone)

**App (PoF):**
- `src/lib/observation/types.ts` — `Observation` / `Verdict` / `Scenario` TS contract (mirror of the Python envelope)
- `src/lib/observation/client.ts` — typed client wrapping `runPython` for each verb
- `src/lib/observation/record.ts` — persist an `Observation`/`Verdict` to `pipeline_artifacts`
- `src/__tests__/lib/observation/*.test.ts` — vitest

---

## Phase 0 — Shared contract

### Task 1: The `Observation` / `Verdict` TypeScript contract

**Files:**
- Create: `src/lib/observation/types.ts`
- Test: `src/__tests__/lib/observation/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeObservation, makeVerdict, type Observation } from '@/lib/observation/types';

describe('observation contract', () => {
  it('makeObservation stamps kind + capturedAt + data', () => {
    const o = makeObservation('state', { sampleCount: 11 }, { capturedAt: '2026-05-29T00:00:00Z' });
    expect(o.kind).toBe('state');
    expect(o.data).toEqual({ sampleCount: 11 });
    expect(o.capturedAt).toBe('2026-05-29T00:00:00Z');
  });

  it('makeVerdict carries evidence + reason and defaults status', () => {
    const ev: Observation = makeObservation('pose', { isRefPose: true }, { capturedAt: 't' });
    const v = makeVerdict('intent-1', 'T3', 'fail', [ev], 'Speed>0 but pose==refpose');
    expect(v.status).toBe('fail');
    expect(v.evidence).toHaveLength(1);
    expect(v.reason).toMatch(/refpose/);
  });
});
```

- [ ] **Step 2: Run test → FAIL** (`npx vitest run src/__tests__/lib/observation/types.test.ts`) — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/observation/types.ts
export type ObservationKind = 'pose' | 'frame' | 'state' | 'metric' | 'api';
export type Tier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type VerdictStatus = 'pass' | 'fail' | 'inconclusive';

export interface Observation<T = unknown> {
  kind: ObservationKind;
  data: T;
  capturedAt: string;
  scenarioId?: string;
  /** Reference into pipeline_artifacts once recorded. */
  artifactRef?: string;
}

export interface Verdict {
  intentId: string;
  tier: Tier;
  status: VerdictStatus;
  evidence: Observation[];
  reason: string;
}

export function makeObservation<T>(
  kind: ObservationKind,
  data: T,
  opts: { capturedAt: string; scenarioId?: string; artifactRef?: string },
): Observation<T> {
  return { kind, data, capturedAt: opts.capturedAt, scenarioId: opts.scenarioId, artifactRef: opts.artifactRef };
}

export function makeVerdict(
  intentId: string,
  tier: Tier,
  status: VerdictStatus,
  evidence: Observation[],
  reason: string,
): Verdict {
  return { intentId, tier, status, evidence, reason };
}
```

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/observation/types.ts src/__tests__/lib/observation/types.test.ts
git commit -m "feat(observation): Observation/Verdict TypeScript contract (SP1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: The Python observation envelope

**Files:**
- Create: `<UE>/Content/Python/observation/__init__.py`
- Test: `<UE>/Content/Python/tests/test_observation_envelope.py`

- [ ] **Step 1: Failing pytest** (uses the existing mocked-`unreal` conftest pattern; no `unreal` needed here)

```python
# tests/test_observation_envelope.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from observation import make_observation

def test_make_observation_shape():
    o = make_observation("state", {"sample_count": 11})
    assert o["kind"] == "state"
    assert o["data"] == {"sample_count": 11}
    assert "captured_at" in o and o["captured_at"]

def test_make_observation_carries_scenario():
    o = make_observation("pose", {"is_ref_pose": True}, scenario_id="walk-fwd")
    assert o["scenario_id"] == "walk-fwd"
```

- [ ] **Step 2: Run → FAIL** (`cd <UE>/Content/Python && python -m pytest tests/test_observation_envelope.py -v`).

- [ ] **Step 3: Implement**

```python
# Content/Python/observation/__init__.py
"""Ground-truth observation verbs (SP1 Observation Spine).

Each verb's run(args) returns an Observation envelope:
    {kind, data, captured_at, scenario_id?}
mirrored by src/lib/observation/types.ts. Verbs are dispatched via the
/pof/python/run bridge route (module=observation.<verb>, function=run).
"""
from __future__ import annotations
import datetime


def make_observation(kind: str, data: dict, scenario_id: str | None = None) -> dict:
    obs = {
        "kind": kind,
        "data": data,
        "captured_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    if scenario_id is not None:
        obs["scenario_id"] = scenario_id
    return obs
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit (UE repo)**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git checkout -b feature/observation-spine
git add Content/Python/observation/__init__.py Content/Python/tests/test_observation_envelope.py
git commit -m "feat(observation): python observation envelope (SP1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 — Editor launch helper + grounding verbs (no C++ build)

### Task 3: Hardened editor launch helper

Captures this session's lessons so every future run starts the editor reliably.

**Files:**
- Create: `<UE>/Content/Python/observation/launch_editor.sh` (bash helper) — documentation + reusable script

- [ ] **Step 1: Write the helper**

```bash
#!/usr/bin/env bash
# Hardened UE editor launch for bridge-driven work. Clears crash-recovery state
# (a force-kill leaves a modal that hangs the next launch + blocks the bridge
# game thread) and launches -unattended (auto-dismisses dialogs).
set -euo pipefail
UE="/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe"
PROJ="C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject"
SAVED="/c/Users/kazda/Documents/Unreal Projects/PoF/Saved"
LOG="${1:-/c/Users/kazda/AppData/Local/Temp/pof_editor.log}"
rm -rf "$SAVED/Autosaves" "$SAVED/Crashes" "$SAVED/SaveRecovery" \
       "/c/Users/kazda/Documents/Unreal Projects/PoF/Intermediate/DisasterRecovery" 2>/dev/null || true
"$UE" "$PROJ" -unattended -abslog="$(cygpath -w "$LOG")" &
echo "launched UE editor (log: $LOG); poll http://localhost:30040/pof/status until ready"
```

- [ ] **Step 2: Verify it launches + the bridge comes up**

```bash
bash Content/Python/observation/launch_editor.sh
for i in $(seq 1 75); do curl -s --max-time 3 http://localhost:30040/pof/status && break; sleep 4; done
```
Expected: a JSON status with `"editorState"` within ~5–60s.

- [ ] **Step 3: Commit**

```bash
git add Content/Python/observation/launch_editor.sh
git commit -m "chore(observation): hardened editor launch helper (recovery-clear + -unattended)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: `ApiGroundingProbe` verb

**Files:**
- Create: `<UE>/Content/Python/observation/api_probe.py`
- Test: `<UE>/Content/Python/tests/test_observation_api_probe.py`

- [ ] **Step 1: Failing pytest** (mocked `unreal` via conftest)

```python
# tests/test_observation_api_probe.py
import sys, types
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

fake = types.ModuleType("unreal")
class _Demo:
    @staticmethod
    def alpha(): ...
    @staticmethod
    def beta(): ...
fake.Demo = _Demo
fake.EditorAssetLibrary = type("E", (), {"load_asset": staticmethod(lambda p: None)})()
sys.modules["unreal"] = fake

from observation import api_probe

def test_class_methods_lists_public_callables():
    out = api_probe.run({"mode": "class_methods", "class_name": "Demo"})
    assert out["kind"] == "api"
    assert "alpha" in out["data"]["methods"] and "beta" in out["data"]["methods"]
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```python
# Content/Python/observation/api_probe.py
import unreal
from observation import make_observation


def run(args):
    mode = args.get("mode")
    if mode == "class_methods":
        cls = getattr(unreal, args["class_name"], None)
        methods = sorted(m for m in dir(cls) if not m.startswith("_")) if cls else []
        return make_observation("api", {"class": args["class_name"], "methods": methods})
    if mode == "asset_props":
        asset = unreal.EditorAssetLibrary.load_asset(args["asset_path"])
        props = sorted(p for p in dir(asset) if not p.startswith("_")) if asset else []
        return make_observation("api", {"asset_path": args["asset_path"], "props": props})
    if mode == "assets_at":
        ar = unreal.AssetRegistryHelpers.get_asset_registry()
        f = unreal.ARFilter(package_paths=[args["path"]], recursive_paths=args.get("recursive", False))
        paths = sorted(str(a.package_name) for a in ar.get_assets(f))
        return make_observation("api", {"path": args["path"], "assets": paths})
    return make_observation("api", {"error": f"unknown mode: {mode}"})
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit**

```bash
git add Content/Python/observation/api_probe.py Content/Python/tests/test_observation_api_probe.py
git commit -m "feat(observation): ApiGroundingProbe verb (class/asset/path introspection)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5: `GetState` verb

**Files:**
- Create: `<UE>/Content/Python/observation/get_state.py`
- Test: `<UE>/Content/Python/tests/test_observation_get_state.py`

- [ ] **Step 1: Failing pytest**

```python
# tests/test_observation_get_state.py
import sys, types
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

fake = types.ModuleType("unreal")
class _Anim:
    def get_class(self): return type("C", (), {"get_name": lambda s: "AnimSequence"})()
    def get_play_length(self): return 1.5
fake.EditorAssetLibrary = type("E", (), {"load_asset": staticmethod(lambda p: _Anim())})()
fake.AnimationLibrary = type("A", (), {"get_num_keys": staticmethod(lambda a: 45), "get_num_frames": staticmethod(lambda a: 45)})
sys.modules["unreal"] = fake

from observation import get_state

def test_anim_sequence_state_reports_frames_and_length():
    out = get_state.run({"asset_path": "/Game/X"})
    assert out["kind"] == "state"
    assert out["data"]["class"] == "AnimSequence"
    assert out["data"]["num_keys"] == 45
    assert out["data"]["length"] == 1.5
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (NOTE: confirm `AnimationLibrary.get_num_keys`/`get_num_frames` exist at runtime via Task 4's ApiGroundingProbe; fall back to `get_play_length` only if absent)

```python
# Content/Python/observation/get_state.py
import unreal
from observation import make_observation


def run(args):
    path = args["asset_path"]
    asset = unreal.EditorAssetLibrary.load_asset(path)
    if not asset:
        return make_observation("state", {"path": path, "error": "asset not found"})
    cls = asset.get_class().get_name()
    data = {"path": path, "class": cls}

    if cls in ("AnimSequence", "AnimSequenceBase", "AnimMontage"):
        data["length"] = asset.get_play_length()
        al = getattr(unreal, "AnimationLibrary", None)
        if al and hasattr(al, "get_num_keys"):
            try:
                data["num_keys"] = al.get_num_keys(asset)
            except Exception:
                pass
        if al and hasattr(al, "get_num_frames"):
            try:
                data["num_frames"] = al.get_num_frames(asset)
            except Exception:
                pass
    elif cls == "BlendSpace":
        try:
            data["sample_count"] = len(asset.get_editor_property("sample_data"))
        except Exception:
            data["sample_count"] = None
        skel = asset.get_skeleton()
        data["skeleton"] = str(skel.get_path_name()) if skel else None
    elif cls == "AnimBlueprint":
        # Compile status is protected from Python; report what is readable.
        data["target_skeleton"] = (
            str(asset.get_editor_property("target_skeleton").get_path_name())
            if asset.get_editor_property("target_skeleton") else None
        )

    return make_observation("state", data)
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit**

```bash
git add Content/Python/observation/get_state.py Content/Python/tests/test_observation_get_state.py
git commit -m "feat(observation): GetState verb (semantic asset introspection)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6: DOGFOOD — diagnose the live T-pose root cause

No new code: run the verbs against the live editor to find why the player T-poses. This validates Tasks 4–5 against reality and likely pinpoints the root cause.

- [ ] **Step 1: Ensure the editor is up** (Task 3 helper). Confirm `curl http://localhost:30040/pof/status` responds.

- [ ] **Step 2: ApiGroundingProbe to confirm AnimationLibrary method names**

```bash
curl -s -X POST http://localhost:30040/pof/python/run -H "Content-Type: application/json" \
  -d '{"module":"observation.api_probe","function":"run","args":{"mode":"class_methods","class_name":"AnimationLibrary"}}'
```
Expected: a `methods` list; confirm the real `get_num_keys`/`get_num_frames` (or the correct names) — adjust `get_state.py` if they differ, re-commit.

- [ ] **Step 3: GetState every retargeted clip**

```bash
for clip in Standard_Idle Walking Running Left_Strafe Right_Strafe Forward_Roll; do
  curl -s -X POST http://localhost:30040/pof/python/run -H "Content-Type: application/json" \
    -d "{\"module\":\"observation.get_state\",\"function\":\"run\",\"args\":{\"asset_path\":\"/Game/Mixamo/Retargeted/SKM_Manny/${clip}_RT\"}}"; echo
done
```
Expected: each clip's `num_keys`/`length`. **Diagnosis:** if `num_keys` ≤ 1 or `length` ≈ 0, the retarget produced empty (ref-pose) clips → that is the T-pose root cause. If clips are richly keyed, the fault is downstream (AnimGraph output wiring) → proceed to `EvaluatePose` (Task 7) on the live mesh.

- [ ] **Step 4: Record the finding** — write the diagnosis as a comment block at the top of `docs/superpowers/plans/2026-05-29-observation-spine.md` Task 6 (or a short `Saved/diagnosis-tpose.md`) and commit. No code change unless Step 2 required an API-name fix.

```bash
git commit -am "chore(observation): T-pose diagnosis via GetState (dogfood SP1 verbs)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>" || echo "no changes to commit"
```

---

## Phase 2 — Pose + frame observation

### Task 7: `EvaluatePose` — clip-level static detection

Detects an unanimated (ref-pose/T-pose) clip without PIE by sampling the sequence at two times and measuring bone movement.

**Files:**
- Create: `<UE>/Content/Python/observation/evaluate_pose.py`
- Test: `<UE>/Content/Python/tests/test_observation_evaluate_pose.py`

- [ ] **Step 1: Failing pytest**

```python
# tests/test_observation_evaluate_pose.py
import sys, types
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

class _V:
    def __init__(self, x): self.x, self.y, self.z = x, 0.0, 0.0
class _T:
    def __init__(self, x): self.translation = _V(x)
fake = types.ModuleType("unreal")
# Hips moves 0 -> 30 over time => animated
_poses = {0.0: 0.0, 0.75: 30.0}
class _Anim:
    def get_play_length(self): return 1.5
fake.EditorAssetLibrary = type("E", (), {"load_asset": staticmethod(lambda p: _Anim())})()
fake.AnimationLibrary = type("A", (), {
    "get_bone_pose_for_time": staticmethod(lambda a, b, t, extract: _T(_poses[t]))
})
sys.modules["unreal"] = fake

from observation import evaluate_pose

def test_clip_static_detection_flags_motion():
    out = evaluate_pose.run({"mode": "clip", "asset_path": "/Game/X", "bones": ["Hips"]})
    assert out["kind"] == "pose"
    assert out["data"]["is_static"] is False
    assert out["data"]["max_bone_delta_over_time"] >= 29.0
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (confirm `get_bone_pose_for_time` via ApiGroundingProbe in Step 4; common alternates: `get_bone_pose_for_frame`)

```python
# Content/Python/observation/evaluate_pose.py
import unreal
from observation import make_observation

# Manny + Mixamo-ish root/limb bones likely present after retarget; resolved live.
DEFAULT_BONES = ["pelvis", "spine_03", "hand_l", "hand_r", "foot_l", "foot_r"]
STATIC_THRESHOLD_CM = 0.5


def _bone_pos(anim, bone, time):
    t = unreal.AnimationLibrary.get_bone_pose_for_time(anim, bone, time, False)
    return (t.translation.x, t.translation.y, t.translation.z)


def _clip(args):
    anim = unreal.EditorAssetLibrary.load_asset(args["asset_path"])
    if not anim:
        return make_observation("pose", {"error": f"not found: {args['asset_path']}"})
    bones = args.get("bones") or DEFAULT_BONES
    length = anim.get_play_length()
    t0, t1 = 0.0, max(length * 0.5, 0.01)
    max_delta = 0.0
    for b in bones:
        try:
            p0, p1 = _bone_pos(anim, b, t0), _bone_pos(anim, b, t1)
            max_delta = max(max_delta, max(abs(p0[i] - p1[i]) for i in range(3)))
        except Exception:
            continue
    return make_observation("pose", {
        "asset_path": args["asset_path"],
        "length": length,
        "max_bone_delta_over_time": max_delta,
        "is_static": max_delta < STATIC_THRESHOLD_CM,
        "bones_sampled": bones,
    })


def run(args):
    mode = args.get("mode", "clip")
    if mode == "clip":
        return _clip(args)
    if mode == "pie":
        return _pie(args)
    return make_observation("pose", {"error": f"unknown mode: {mode}"})


def _pie(args):
    """Read the live mesh pose in PIE. Requires RunScenario (Task 12) to have a PIE
    world + possessed pawn already running; reads component-space transforms."""
    actor_path = args.get("actor_tag", "Player")
    world = unreal.UnrealEditorSubsystem().get_game_world() if hasattr(unreal, "UnrealEditorSubsystem") else None
    if not world:
        return make_observation("pose", {"error": "no PIE world (run a Scenario first)"})
    # Find the player pawn's skeletal mesh + read component-space transforms.
    pawn = unreal.GameplayStatics.get_player_pawn(world, 0)
    if not pawn:
        return make_observation("pose", {"error": "no player pawn in PIE"})
    mesh = pawn.get_component_by_class(unreal.SkeletalMeshComponent)
    xforms = mesh.get_component_space_transforms() if mesh and hasattr(mesh, "get_component_space_transforms") else []
    # Compare pelvis height/position vs a stored reference if provided.
    return make_observation("pose", {
        "actor": actor_path,
        "bone_count": len(xforms),
        "has_mesh": bool(mesh),
    }, scenario_id=args.get("scenario_id"))
```

- [ ] **Step 4: Run → PASS.** Then live-confirm `get_bone_pose_for_time` via ApiGroundingProbe (`class_methods` on `AnimationLibrary`); fix the name + re-run if needed.

- [ ] **Step 5: Live dogfood + commit** — `GetState` said whether clips exist; now `EvaluatePose mode=clip` on a `_RT` clip gives the definitive *"does this clip actually animate?"* The combination (Task 6 + this) pinpoints clip-vs-graph.

```bash
git add Content/Python/observation/evaluate_pose.py Content/Python/tests/test_observation_evaluate_pose.py
git commit -m "feat(observation): EvaluatePose verb — clip static-detection + PIE pose read

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8: `CaptureFrame` verb (reuse the existing snapshot)

**Files:**
- Create: `<UE>/Content/Python/observation/capture_frame.py`
- Test: `<UE>/Content/Python/tests/test_observation_capture_frame.py`

- [ ] **Step 1: Failing pytest** (mock the snapshot helper)

```python
# tests/test_observation_capture_frame.py
import sys, types
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
fake = types.ModuleType("unreal")
fake.AutomationLibrary = type("A", (), {
    "take_high_res_screenshot": staticmethod(lambda w, h, name, *a, **k: True)
})
sys.modules["unreal"] = fake
from observation import capture_frame

def test_capture_returns_png_path():
    out = capture_frame.run({"out_name": "tpose_check", "width": 512, "height": 512})
    assert out["kind"] == "frame"
    assert out["data"]["png"].endswith(".png")
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (uses `AutomationLibrary.take_high_res_screenshot`; the bridge already has `/pof/snapshot/capture` — this verb wraps the same mechanism + returns the path the agent will `Read`)

```python
# Content/Python/observation/capture_frame.py
import os
import unreal
from observation import make_observation

SHOT_DIR = r"C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Observations"


def run(args):
    os.makedirs(SHOT_DIR, exist_ok=True)
    name = args.get("out_name", "frame")
    w, h = int(args.get("width", 512)), int(args.get("height", 512))
    png = os.path.join(SHOT_DIR, f"{name}.png")
    try:
        unreal.AutomationLibrary.take_high_res_screenshot(w, h, png)
        return make_observation("frame", {"png": png, "width": w, "height": h},
                                scenario_id=args.get("scenario_id"))
    except Exception as e:  # noqa: BLE001
        return make_observation("frame", {"error": str(e)})
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit**

```bash
git add Content/Python/observation/capture_frame.py Content/Python/tests/test_observation_capture_frame.py
git commit -m "feat(observation): CaptureFrame verb (high-res screenshot -> PNG for agent Read)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — App-side client + recording

### Task 9: Typed observation client

**Files:**
- Create: `src/lib/observation/client.ts`
- Test: `src/__tests__/lib/observation/client.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { observe } from '@/lib/observation/client';

describe('observe', () => {
  it('dispatches the verb module via runPython and returns the Observation', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ ok: true, data: { kind: 'state', data: { sample_count: 11 }, captured_at: 't' } }),
    });
    const obs = await observe('get_state', { asset_path: '/Game/X' }, { fetchImpl: fetchSpy as never });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as { body: string }).body);
    expect(body.module).toBe('observation.get_state');
    expect(obs.kind).toBe('state');
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/observation/client.ts
import { runPython, type RunPythonOptions } from '@/lib/bridge/run-python';
import type { Observation, ObservationKind } from './types';

export type Verb = 'get_state' | 'api_probe' | 'evaluate_pose' | 'capture_frame' | 'run_scenario';

export async function observe<T = unknown>(
  verb: Verb,
  args: Record<string, unknown>,
  opts: RunPythonOptions = {},
): Promise<Observation<T>> {
  const res = await runPython<Observation<T>>(`observation.${verb}`, 'run', args, opts);
  if (!res.ok) {
    return { kind: 'metric' as ObservationKind, data: { error: res.error } as T, capturedAt: new Date(0).toISOString() };
  }
  return res.data;
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/observation/client.ts src/__tests__/lib/observation/client.test.ts
git commit -m "feat(observation): typed observe() client over the /pof/python/run bridge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10: Record an Observation/Verdict to `pipeline_artifacts`

**Files:**
- Create: `src/lib/observation/record.ts`
- Test: `src/__tests__/lib/observation/record.test.ts`

- [ ] **Step 1: Read the existing artifact-write path** — open `src/lib/catalog/pipeline-artifacts-db.ts` (or the artifact client used by `labArtifactClient.postArtifact`) and mirror its insert signature. (The recorder appends an observation row keyed by `{catalogId, entityId, step, kind}`.)

- [ ] **Step 2: Failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { recordObservation } from '@/lib/observation/record';
import { makeObservation } from '@/lib/observation/types';

describe('recordObservation', () => {
  it('persists via the injected writer and returns an artifactRef', async () => {
    const writer = vi.fn().mockResolvedValue('artifact-123');
    const obs = makeObservation('pose', { isRefPose: true }, { capturedAt: 't' });
    const ref = await recordObservation({ catalogId: 'player-movement', entityId: 'v1', step: 'playable-gate' }, obs, writer);
    expect(writer).toHaveBeenCalledOnce();
    expect(ref).toBe('artifact-123');
  });
});
```

- [ ] **Step 3: Implement** (writer injected for testability; production caller passes the real `pipeline_artifacts` insert)

```ts
// src/lib/observation/record.ts
import type { Observation } from './types';

export interface ObservationKey {
  catalogId: string;
  entityId: string;
  step: string;
}

export type ArtifactWriter = (key: ObservationKey, obs: Observation) => Promise<string>;

export async function recordObservation(
  key: ObservationKey,
  obs: Observation,
  writer: ArtifactWriter,
): Promise<string> {
  const ref = await writer(key, obs);
  obs.artifactRef = ref;
  return ref;
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/observation/record.ts src/__tests__/lib/observation/record.test.ts
git commit -m "feat(observation): recordObservation -> pipeline_artifacts (injectable writer)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — RunScenario PIE harness (C++) + the T-pose gate

### Task 11: `PoFScenarioRunner` C++ harness

A C++ helper (PoFEditor module) that runs a scenario: open PIE at a map, possess the pawn, inject EnhancedInput over a timeline, tick deterministically, and leave the PIE world live for `EvaluatePose mode=pie` + `CaptureFrame` to read. Exposed to Python as `unreal.PoFScenarioRunner`.

**Files:**
- Create: `<UE>/Source/PoFEditor/Public/PoFScenarioRunner.h`
- Create: `<UE>/Source/PoFEditor/Private/PoFScenarioRunner.cpp`

- [ ] **Step 1: Header**

```cpp
#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "PoFScenarioRunner.generated.h"

USTRUCT(BlueprintType)
struct FPoFTimedInput
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadWrite) FString ActionPath;   // /Game/Input/Actions/IA_Move
    UPROPERTY(BlueprintReadWrite) FVector2D Value = FVector2D::ZeroVector;
    UPROPERTY(BlueprintReadWrite) float StartSeconds = 0.f;
    UPROPERTY(BlueprintReadWrite) float DurationSeconds = 1.f;
};

UCLASS()
class POFEDITOR_API UPoFScenarioRunner : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    /** Open PIE at MapPath, possess player 0, inject the timed inputs while ticking
     *  for TotalSeconds. Leaves PIE running so pose/frame observers can read it.
     *  Returns true if PIE started + a pawn was possessed. */
    UFUNCTION(BlueprintCallable, Category="PoF|Scenario", meta=(ScriptMethod))
    static bool RunScenario(const FString& MapPath, const TArray<FPoFTimedInput>& Inputs, float TotalSeconds);

    /** Stop the active PIE session. */
    UFUNCTION(BlueprintCallable, Category="PoF|Scenario", meta=(ScriptMethod))
    static void StopScenario();
};
```

- [ ] **Step 2: Implement** (uses `GEditor->RequestPlaySession` + `UEnhancedInputLocalPlayerSubsystem::InjectInputForAction` + `World->Tick`; the input-injection pattern matches the existing `VSPlayerMovementTest` notes)

```cpp
#include "PoFScenarioRunner.h"
#include "Editor.h"
#include "Editor/EditorEngine.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "FileHelpers.h"

bool UPoFScenarioRunner::RunScenario(const FString& MapPath, const TArray<FPoFTimedInput>& Inputs, float TotalSeconds)
{
    if (!GEditor) return false;
    FEditorFileUtils::LoadMap(MapPath);
    FRequestPlaySessionParams Params;
    GEditor->RequestPlaySession(Params);
    GEditor->StartQueuedPlaySessionRequest();

    UWorld* World = GEditor->PlayWorld;
    if (!World) { World = GEditor->GetPIEWorldContext() ? GEditor->GetPIEWorldContext()->World() : nullptr; }
    if (!World) return false;

    APlayerController* PC = nullptr;
    const double Start = FPlatformTime::Seconds();
    while (FPlatformTime::Seconds() - Start < 2.0)
    {
        PC = World->GetFirstPlayerController();
        if (PC && PC->GetPawn()) break;
        World->Tick(LEVELTICK_All, 1.f / 60.f);
    }
    if (!PC || !PC->GetPawn()) return false;

    auto* Subsys = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer());
    const int32 TotalFrames = FMath::CeilToInt(TotalSeconds * 60.f);
    for (int32 Frame = 0; Frame < TotalFrames; ++Frame)
    {
        const float T = Frame / 60.f;
        for (const FPoFTimedInput& In : Inputs)
        {
            if (T >= In.StartSeconds && T < In.StartSeconds + In.DurationSeconds)
            {
                if (UInputAction* IA = LoadObject<UInputAction>(nullptr, *In.ActionPath))
                {
                    Subsys->InjectInputForAction(IA, FInputActionValue(In.Value), {}, {});
                }
            }
        }
        World->Tick(LEVELTICK_All, 1.f / 60.f);
    }
    return true;  // PIE left running for observers
}

void UPoFScenarioRunner::StopScenario()
{
    if (GEditor) GEditor->RequestEndPlayMap();
}
```

- [ ] **Step 3: Build PoFEditor** (`Build.bat PoFEditor Win64 Development -DisableAdaptiveUnity`); confirm `Result: Succeeded`. Restart the editor via the Task 3 helper.

- [ ] **Step 4: Commit**

```bash
git add Source/PoFEditor/Public/PoFScenarioRunner.h Source/PoFEditor/Private/PoFScenarioRunner.cpp
git commit -m "feat(observation): PoFScenarioRunner C++ PIE harness (RunScenario)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 12: `run_scenario.py` Python wrapper

**Files:**
- Create: `<UE>/Content/Python/observation/run_scenario.py`
- Test: `<UE>/Content/Python/tests/test_observation_run_scenario.py`

- [ ] **Step 1: Failing pytest** (mock `unreal.PoFScenarioRunner` + the struct)

```python
# tests/test_observation_run_scenario.py
import sys, types
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
calls = {}
fake = types.ModuleType("unreal")
class _Struct:
    def __init__(self): self.action_path=""; self.value=None; self.start_seconds=0.0; self.duration_seconds=1.0
    def set_editor_property(self, k, v): setattr(self, k, v)
fake.PoFTimedInput = _Struct
fake.Vector2D = lambda x, y: (x, y)
fake.PoFScenarioRunner = type("R", (), {
    "run_scenario": staticmethod(lambda m, inp, t: calls.update({"map": m, "n": len(inp), "t": t}) or True),
})
sys.modules["unreal"] = fake
from observation import run_scenario

def test_builds_timed_inputs_and_calls_harness():
    out = run_scenario.run({"map": "/Game/Maps/Test", "total_seconds": 1.5,
        "inputs": [{"action": "/Game/Input/Actions/IA_Move", "value": [0, 1], "start": 0, "duration": 1.5}]})
    assert out["kind"] == "metric"
    assert out["data"]["started"] is True
    assert calls["map"] == "/Game/Maps/Test" and calls["n"] == 1
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```python
# Content/Python/observation/run_scenario.py
import unreal
from observation import make_observation


def run(args):
    timed = []
    for spec in args.get("inputs", []):
        ti = unreal.PoFTimedInput()
        ti.set_editor_property("action_path", spec["action"])
        v = spec.get("value", [0, 0])
        ti.set_editor_property("value", unreal.Vector2D(float(v[0]), float(v[1])))
        ti.set_editor_property("start_seconds", float(spec.get("start", 0.0)))
        ti.set_editor_property("duration_seconds", float(spec.get("duration", 1.0)))
        timed.append(ti)
    started = unreal.PoFScenarioRunner.run_scenario(
        args["map"], timed, float(args.get("total_seconds", 1.5)))
    return make_observation("metric", {"started": bool(started)}, scenario_id=args.get("scenario_id"))
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit**

```bash
git add Content/Python/observation/run_scenario.py Content/Python/tests/test_observation_run_scenario.py
git commit -m "feat(observation): run_scenario.py wrapper over PoFScenarioRunner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 13: CLOSE THE LOOP — the live T-pose gate

Wire the verbs into the full §4 vertical slice against the live editor. This is the integration proof.

- [ ] **Step 1: Start editor (Task 3), confirm bridge + `PoFScenarioRunner` present**

```bash
curl -s -X POST http://localhost:30040/pof/python/run -H "Content-Type: application/json" \
  -d '{"module":"observation.api_probe","function":"run","args":{"mode":"class_methods","class_name":"PoFScenarioRunner"}}'
```
Expected: `run_scenario` in the methods list (confirms the C++ built + loaded).

- [ ] **Step 2: Run the walk-forward scenario**

```bash
curl -s -X POST http://localhost:30040/pof/python/run -H "Content-Type: application/json" -d '{
  "module":"observation.run_scenario","function":"run","args":{
    "map":"/Game/Maps/TestLevel_PlayerMovement","total_seconds":1.5,"scenario_id":"walk-fwd",
    "inputs":[{"action":"/Game/Input/Actions/IA_Move","value":[0,1],"start":0,"duration":1.5}]}}'
```
Expected: `{"started": true}`.

- [ ] **Step 3: Observe pose (T3) + frame (T4) while PIE runs**

```bash
curl -s -X POST http://localhost:30040/pof/python/run -H "Content-Type: application/json" \
  -d '{"module":"observation.evaluate_pose","function":"run","args":{"mode":"pie","scenario_id":"walk-fwd"}}'
curl -s -X POST http://localhost:30040/pof/python/run -H "Content-Type: application/json" \
  -d '{"module":"observation.capture_frame","function":"run","args":{"out_name":"walk_fwd_t1","scenario_id":"walk-fwd"}}'
```

- [ ] **Step 4: T4 perceptual verdict — the agent `Read`s the PNG**

Use the Read tool on `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Observations\walk_fwd_t1.png`. Judge: is this a walking character or a T-pose? Record a `Verdict` (via `recordObservation`) with the evidence. **This is the gate that would have caught the original failure.**

- [ ] **Step 5: Fix the root cause + re-verify** — based on Task 6/7 diagnosis (empty clips → re-retarget with corrected chain mapping; or unconnected AnimGraph output → fix `AddBlendSpacePlayerToOutput` wiring). Re-run Steps 2–4 until the pose is non-static AND the agent sees a walking character. Stop the scenario (`StopScenario`).

- [ ] **Step 6: Upgrade the stub gate** — replace `FVSPlayerMovementPlayableTest`'s stub body with a call into `RunScenario` + an `EvaluatePose` assertion (`is_static == false` after walk input). Build, run via `/pof/test/run-automation`, confirm it now FAILS on a T-pose and PASSES on a fixed walk.

```bash
git add Source/PoF/Test/Character/VSPlayerMovementTest.cpp
git commit -m "feat(observation): real T3/T4 playable gate via RunScenario + EvaluatePose (loop closed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Docs

### Task 14: Document the Observation Spine

**Files:**
- Modify: `docs/architecture/ui-shell.md` (or a new `docs/architecture/llm-ue-interface.md`) — add a "§ Observation Spine" section
- Modify: `docs/README.md` — doc-map entry

- [ ] **Step 1: Write the section** — the 5 verbs + the `Observation`/`Verdict` contract + the Tiers-of-Truth vocabulary + how to run a scenario + the "agent Reads the PNG = T4 authority" pattern. Cross-link the design spec.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture docs/README.md
git commit -m "docs(observation): Observation Spine + Tiers-of-Truth reference

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §2 verbs (EvaluatePose/CaptureFrame/RunScenario/GetState/ApiGroundingProbe) → Tasks 7, 8, 11+12, 5, 4. ✓
- §3 contracts (Observation/Verdict/Scenario) → Tasks 1, 2 (Scenario is the `FPoFTimedInput[]`+map in Task 11). ✓ (`Transaction`/rollback belongs to SP3 — out of SP1 scope, correctly deferred.)
- §4 T-pose vertical slice → Task 6 (diagnose) + Task 13 (close the loop). ✓
- Tiers of Truth + "no done without observation" → enforced concretely in Task 13; the *contract enforcement layer* (refusing symbol-only completion globally) is SP2, correctly deferred. ✓
- Recording to `pipeline_artifacts` → Task 10. ✓
- Editor-lifecycle hardening → Task 3. ✓
- Dogfood testing → Tasks 6, 13. ✓

**Placeholder scan:** No TBD/TODO. Where UE Python API names are uncertain (`get_num_keys`, `get_bone_pose_for_time`), the plan provides concrete code AND an explicit ApiGroundingProbe confirmation step (Tasks 4/6/7 Step 4) — this is the dogfooding, not a placeholder.

**Type consistency:** `make_observation(kind, data, scenario_id?)` used identically across all Python verbs; `Observation`/`Verdict` TS shapes (Task 1) mirror the Python envelope (Task 2); `observe(verb, args)` (Task 9) maps `verb → observation.<verb>`; `FPoFTimedInput` fields (Task 11) match the dict keys built in `run_scenario.py` (Task 12).

**Known dependency:** Tasks 7 (`mode=pie`), 13 depend on Task 11's C++ build + editor restart. Tasks 1–10 need no rebuild (Tasks 4–8 need only the editor running). Sequencing honors this — immediate value (diagnose the T-pose) lands by Task 6.
