import { describe, it, expect } from 'vitest';
import { UE_GOTCHAS, formatGotchas } from '@/lib/knowledge/ue-gotchas';
import type { PromptKind } from '@/lib/knowledge/types';

const VALID_KINDS: PromptKind[] = ['ue-cpp', 'ue-python', 'packaging', 'web'];

describe('UE_GOTCHAS data integrity', () => {
  it('has at least the seven seeded gotchas', () => {
    expect(UE_GOTCHAS.length).toBeGreaterThanOrEqual(7);
  });

  it('every gotcha has non-empty fields and a valid appliesTo', () => {
    for (const g of UE_GOTCHAS) {
      expect(g.id, 'id').toBeTruthy();
      expect(g.summary, `summary for ${g.id}`).toBeTruthy();
      expect(g.detail, `detail for ${g.id}`).toBeTruthy();
      expect(g.source, `source for ${g.id}`).toBeTruthy();
      expect(g.appliesTo.length, `appliesTo for ${g.id}`).toBeGreaterThan(0);
      for (const k of g.appliesTo) expect(VALID_KINDS).toContain(k);
    }
  });

  it('has unique ids', () => {
    const ids = UE_GOTCHAS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formatGotchas', () => {
  it('renders a Known UE Pitfalls block for ue-cpp including the cpp gotchas', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toContain('## Known UE Pitfalls');
    expect(out).toContain('RebuildWidget');
    expect(out).toContain('WITH_EDITOR');
  });

  it('includes the debug-text overlay pitfall for ue-cpp', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toContain('AddOnScreenDebugMessage');
    expect(out).toMatch(/DisableAllScreenMessages/);
  });

  it('carries GAS attribute/effect pitfalls for ue-cpp', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/meta attribute|PostGameplayEffectExecute/i);
    expect(out).toMatch(/REPNOTIFY|GameplayEffect/);
  });

  it('excludes python-only gotchas from the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toContain('Constant3Vector');
  });

  it('includes python gotchas for ue-python', () => {
    expect(formatGotchas('ue-python')).toContain('Constant3Vector');
  });

  it('tells ue-python sessions to introspect the API before guessing names', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/introspect|lookup_class|dir\(unreal/i);
  });

  it('keeps the introspect-first guidance out of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/dir\(unreal/);
  });

  it('carries Lumen lighting best-practice pitfalls for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/Lumen/);
    expect(out).toMatch(/distance field|surface cache|hit lighting/i);
  });

  it('carries modular-character accessory/optimization guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/accessor|modular/i);
    expect(out).toMatch(/occlud|covered|single bone|one bone/i);
  });

  it('tells ue-python sessions to segment a fused AI mesh into named parts before rigging', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/segment/i);
    expect(out).toMatch(/named part|into.*parts|riggable/i);
    expect(out).toMatch(/Tripo|Rodin|CubePart/);
  });

  it('tells ue-python import sessions that AI meshes arrive unit-normalised and need a per-asset ImportUniformScale', () => {
    const out = formatGotchas('ue-python', 'models');
    expect(out).toContain('normalised to a ~1 m box');
    expect(out).toMatch(/1 m/);
    expect(out).toMatch(/ImportUniformScale|import_uniform_scale/);
    expect(out).toMatch(/Mannequin/);
    // Complements, never replaces, the metre-unit gotcha.
    expect(out).toContain('import_uniform_scale = 1.0');
  });

  it('keeps the unit-normalised mesh gotcha out of ue-cpp and out of a UI module', () => {
    expect(formatGotchas('ue-cpp')).not.toContain('normalised to a ~1 m box');
    expect(formatGotchas('ue-python', 'arpg-ui')).not.toContain('normalised to a ~1 m box');
  });

  it('tells ue-python world sessions to compose arenas from primitives + tiles + kit placement, not one generated mesh', () => {
    const out = formatGotchas('ue-python', 'level-design');
    expect(out).toContain('never the whole space as one AI mesh');
    expect(out).toMatch(/tile|tiling/i);
    expect(out).toMatch(/spline|array|PCG/);
    expect(out).toMatch(/texel|blurr/i);
    expect(formatGotchas('ue-python', 'arpg-ui')).not.toContain('never the whole space as one AI mesh');
  });

  it('tells world sessions to cut a kit out of ONE concept image, not prompt each prop alone', () => {
    const out = formatGotchas('ue-python', 'level-design');
    expect(out).toMatch(/one concept|single concept/i);
    expect(out).toMatch(/crop|region|circle/i);
    // The failure the rule prevents: independently-prompted props that do not match.
    expect(out).toMatch(/drift|consisten|match/i);
    expect(formatGotchas('ue-python', 'arpg-ui')).not.toMatch(/one concept image/i);
  });

  it('carries MetaHuman conform INPUT-PREP guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/MetaHuman/);
    expect(out).toMatch(/conform/i);
    expect(out).toMatch(/A-pose|separate.*finger|armpit/i);
    expect(out).toMatch(/remove.*(hair|lashes)|hair.*remov/i);
  });

  it('carries MetaHuman conform TEXTURE/RIG-EXPORT pitfalls for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/DNA/);
    expect(out).toMatch(/UDIM/i);
    expect(out).toMatch(/leaf bone/i);
    expect(out).toMatch(/green channel/i);
  });

  it('keeps MetaHuman conform UDIM/leaf-bone guidance out of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/UDIM/);
  });

  it('carries MetaHuman Animator headless memory/windowing guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/MetaHuman (Animator|Performance)/);
    expect(out).toMatch(/set_processing_range/);
    expect(out).toMatch(/memory|RAM/i);
  });

  it('carries MetaHuman Animator multi-window root-drift stitch guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/start_pipeline|MetaHumanPerformance/);
    expect(out).toMatch(/root|pelvis/i);
    expect(out).toMatch(/stitch|re-?anchor|offset|independent/i);
  });

  it('carries AI motion-generator (text→motion) UE-ingestion guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/ARDY|motion generat/i);
    expect(out).toMatch(/\.npz|joint data/i);
    expect(out).toMatch(/IK Retargeter/);
    expect(out).toMatch(/Blender/);
    expect(out).toMatch(/bind.?pose|axis/i);
  });

  it('keeps the motion-generator ingestion guidance out of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/\.npz/);
  });

  it('warns that the automated FBX reimport path silently skips AnimSequence creation', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/reimport/i);
    expect(out).toMatch(/AnimSequence/);
    expect(out).toMatch(/fresh (destination )?folder|rm -rf|filesystem/i);
    expect(out).toMatch(/replace_existing|task\.save/);
  });

  it('warns that asset-swap-at-path does not re-point referencers (rename follows)', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/rename_asset/);
    expect(out).toMatch(/referencer/i);
    expect(out).toMatch(/set_editor_property|CDO/);
    expect(out).toMatch(/montage_name|runtime/i);
    expect(out).toMatch(/AlwaysTickPoseAndRefreshBones/);
  });

  it('carries the UE 5.8 Chaos Cloth Asset (Dataflow) authoring workflow for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/Chaos Cloth|Cloth Asset/i);
    expect(out).toMatch(/preset/i);
    expect(out).toMatch(/transfer skin weights|skin.?weight/i);
    expect(out).toMatch(/physics asset|collider/i);
    expect(out).toMatch(/penetrat|Transform Position/i);
  });

  it('keeps the Chaos Cloth Asset guidance out of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/Transfer Skin Weights node/);
  });

  it('tells sessions to rig garments by transferring skin weights from the conformed MetaHuman body', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/transfer(ring)?\s+(skin\s+)?weights|weight transfer/i);
    expect(out).toMatch(/MetaHuman body|conform(ed)? body/i);
    expect(out).toMatch(/AccuRig|Mixamo/);
    expect(out).toMatch(/garment/i);
  });

  it('carries neutral-facial-expression conform input prep for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/neutral (facial )?expression|neutral face/i);
    expect(out).toMatch(/after the conform|head.?sculpt|post.?conform/i);
  });

  it('warns that AI low-poly/UV generation is not final — high-poly → retopo → bake is the quality path', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/high.?poly/i);
    expect(out).toMatch(/retopo/i);
    expect(out).toMatch(/bake|baking/i);
    expect(out).toMatch(/80.?90\s?%|dice|never final|not final/i);
  });

  it('teaches the 5.8 Dataflow rig-transfer chain for reusing a rig on a new mesh', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/TransferMeshAttributes/);
    expect(out).toMatch(/MeshToSkeletalMeshTerminal/);
    expect(out).toMatch(/skin weights/i);
    expect(out).toMatch(/location|Vector2D/);
  });

  it('describes Control Rig Dynamics as the runtime secondary-motion path for generated characters', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/Control Rig Dynamics/i);
    expect(out).toMatch(/jiggle|ponytail|secondary motion/i);
    expect(out).toMatch(/SpawnDynamicsChains/);
    expect(out).toMatch(/bone/i);
  });

  it('recommends layered control-rig physics to smooth hard pops between animation clips', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/layered control rig/i);
    expect(out).toMatch(/hard pop/i);
    expect(out).toMatch(/full.?body IK/i);
    expect(out).toMatch(/warm.?up frames/i);
  });

  it('routes video footage ingest through CaptureManager, not the deprecated MetaHumanCaptureSource', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/MetaHumanCaptureSource/);
    expect(out).toMatch(/deprecat/i);
    expect(out).toMatch(/ingest_mono_video_sync/);
    expect(out).toMatch(/CaptureManagerIngestBlueprintLibrary/);
    expect(out).toMatch(/FootageCaptureData/);
    expect(out).toMatch(/MONO_FOOTAGE|mono footage/i);
  });

  it('carries Niagara optimization pitfalls', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/Niagara/);
    expect(out).toMatch(/Effect Type|significance/i);
    expect(out).toMatch(/stat named events|Insights/i);
  });

  it('carries Motion Matching pitfalls (root motion need + Phase crash)', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/Motion Matching/i);
    expect(out).toMatch(/Phase channel|root motion/i);
  });

  it('tells GAS sessions to author abilities incrementally, not one-shot the whole system', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/increment|one at a time|one coupled piece|small.*step/i);
    expect(out).toMatch(/one.?shot|whole.*(system|ability)|entire ability/i);
    expect(out).toMatch(/tag|Input Action|GameplayEffect/);
  });

  it('returns an empty string for web', () => {
    expect(formatGotchas('web')).toBe('');
  });

  it('snapshot of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).toMatchSnapshot();
  });
});

describe('formatGotchas module scoping', () => {
  it('no module → the full superset for the kind (unchanged behavior)', () => {
    const superset = formatGotchas('ue-cpp');
    expect(superset).toMatch(/GameplayEffect/);
    expect(superset).toMatch(/Niagara/);
    expect(superset).toMatch(/Motion Matching/);
  });

  it('a materials cpp task SHRINKS — no GAS / Niagara / Motion Matching', () => {
    const out = formatGotchas('ue-cpp', 'materials');
    expect(out).not.toMatch(/GameplayEffect/);
    expect(out).not.toMatch(/Niagara/);
    expect(out).not.toMatch(/Motion Matching/);
    // universal gotchas still ride along
    expect(out).toMatch(/WITH_EDITOR/);
  });

  it('a GAS cpp task retains full GAS coverage', () => {
    const out = formatGotchas('ue-cpp', 'arpg-gas');
    expect(out).toMatch(/meta attribute|PostGameplayEffectExecute/i);
    expect(out).toMatch(/REPNOTIFY/);
    expect(out).toMatch(/one coupled piece|one at a time/i);
    // but not the unrelated animation/vfx pitfalls
    expect(out).not.toMatch(/Motion Matching/);
    expect(out).not.toMatch(/Niagara/);
  });

  it('an UNKNOWN module falls back to the conservative superset (never silently none)', () => {
    const unknown = formatGotchas('ue-cpp', 'totally-made-up-module');
    expect(unknown).toBe(formatGotchas('ue-cpp'));
  });

  it('a python world task carries the prop-placement + headless-physics pitfalls', () => {
    const out = formatGotchas('ue-python', 'arpg-world');
    expect(out).toMatch(/place_floor/);
    expect(out).toMatch(/max_stack/);
    expect(out).toMatch(/largest[- ]first/i);
    expect(out).toMatch(/editor_play_simulate/);
    expect(out).toMatch(/is_simulating_physics/);
    // scoped away from unrelated domains
    expect(out).not.toMatch(/Motion Matching/);
  });

  it('does not haul the world-dressing pitfalls into an animation task', () => {
    const out = formatGotchas('ue-python', 'arpg-animation');
    expect(out).not.toMatch(/place_surface/);
    expect(out).not.toMatch(/editor_play_simulate/);
  });

  it('a python animation task carries the Interchange FBX + motion-matching pitfalls but not materials-only ones', () => {
    const out = formatGotchas('ue-python', 'arpg-animation');
    expect(out).toMatch(/Interchange FBX/);
    expect(out).toMatch(/Motion Matching/);
    expect(out).not.toMatch(/Constant3Vector/); // materials-only
  });
});

describe('warning-vs-error policy gotcha (T. Cain code standards)', () => {
  it('every ue-cpp task carries the failure-severity policy', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/cosmetic/i);
    expect(out).toMatch(/hard-fail|gameplay-invariant/i);
    expect(out).toMatch(/fabricat/i);
  });
});

// ── GameEngineBench failure taxonomy (research 2026-09-07) ────────────────────
// 110 real UE5 C++ tasks, built and Play-in-Editor verified. The best agent
// configuration reached 55.5% pass@1 and 31 tasks went unsolved by EVERY model;
// the failures were structural, not syntactic, and clustered into these classes.
// They are UNIVERSAL for generated UE C++ (no `modules` tag), so every ue-cpp
// prompt carries them regardless of module domain.
describe('generated-C++ structural failure classes', () => {
  it('warns that an OnRep hook is useless without the replicated source state', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/OnRep/);
    expect(out).toMatch(/DOREPLIFETIME|replicated source|GetLifetimeReplicatedProps/i);
  });

  it('warns that controller-local state needs an IsLocalController guard', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/IsLocalController|IsLocallyControlled/);
  });

  it('warns about constructor-vs-BeginPlay ordering and teardown symmetry', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/EndPlay|teardown/i);
    expect(out).toMatch(/constructor/i);
  });

  it('reaches the multiplayer module, whose domain tag list is empty', () => {
    // MODULE_GOTCHA_DOMAINS['multiplayer'] is [], so a `modules`-tagged gotcha
    // could never match it. These must stay universal to arrive at all.
    const out = formatGotchas('ue-cpp', 'multiplayer');
    expect(out).toMatch(/IsLocalController|IsLocallyControlled/);
  });
});

describe('generated-mesh collision delivery', () => {
  it('tells a python session a generated GLB arrives with no collision', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/collision/i);
    // UCX_ is an FBX-importer convention; the executing pipeline writes GLB.
    expect(out).toMatch(/UCX_/);
    expect(out).toMatch(/body_setup|add_simple_collisions|convex_decomposition/i);
  });
});

// ── glTF import shape (live UE 5.8 run, 2026-09-07) ──────────────────────────
// Two defects found by actually running an import, neither visible to any fixture.
describe('glTF import returns many assets', () => {
  it('warns that imported_object_paths is not mesh-first', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/imported_object_paths/);
    expect(out).toMatch(/Texture2D/);
    expect(out).toMatch(/isinstance|StaticMesh/);
  });

  it('warns that suppressing task.save requires saving every imported asset', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/task\.save/);
    expect(out).toMatch(/save_loaded_asset/);
  });
});

// ── construct-vs-generate (Stefan 3D AI, `8MUk-tQTiwE`) ──────────────────────
// The two shipped hard-surface rules (`arena-kit-composition`,
// `hard-surface-and-garment-part-split`) both end in "ask a generator" — for a
// whole space, or for one sub-assembly at a time. Neither names the option an
// agent that can script Blender actually has: build the thing out of primitives
// and never spend a generation on it at all.
describe('construct-vs-generate routing', () => {
  const entry = () => UE_GOTCHAS.find((g) => g.id === 'construct-hard-surface-dont-generate');

  it('is registered for python sessions', () => {
    expect(entry()?.appliesTo).toContain('ue-python');
  });

  it('names the legible-text discriminator that separates constructed from generated geometry', () => {
    const out = formatGotchas('ue-python');
    // Lettering/numerals are the cheapest observable test of which path produced a
    // surface: a generator smears them, constructed geometry and projected text do not.
    expect(out).toMatch(/gibberish|legible|lettering/i);
  });

  it('states where constructing LOSES, so the rule cannot be applied to characters', () => {
    const d = entry()?.detail ?? '';
    expect(d).toMatch(/organic/i);
    expect(d).toMatch(/character|creature/i);
  });

  it('reaches a 3D-domain module and a world-domain module', () => {
    // MODULE_GOTCHA_DOMAINS: models -> ['3d', ...], level-design -> ['world', ...].
    // A rule tagged for neither would be invisible to the two modules that build assets.
    for (const mod of ['models', 'level-design']) {
      expect(formatGotchas('ue-python', mod)).toMatch(/gibberish|legible|lettering/i);
    }
  });

  // Registry render proof, 2026-09-14: four independent agents scripted the same two
  // briefs. Unbriefed construction interpenetrated (33-235 shells) at invented sizes;
  // the commissioning contract produced one closed shell at the commissioned size.
  it('states that construction alone does not buy clean topology - the constructing agent needs the numbers', () => {
    const d = entry()?.detail ?? '';
    expect(d).toMatch(/interpenetrat/i);
    expect(d).toMatch(/target extent/i);
    expect(d).toMatch(/TRIANGLE/);
    expect(d).toMatch(/closed surface|boolean-union/i);
    expect(d).toMatch(/structural only/i);
  });
});

// ── editor-session capture (live UE 5.8 GUI editor, 2026-09-14) ──────────────
// Found by driving a real editor session to screenshot imported assets. Each defect
// resolved cleanly at the call site and failed only in its effect.
describe('editor-session python capture', () => {
  const entry = () => UE_GOTCHAS.find((g) => g.id === 'editor-python-capture-needs-frames');

  it('is registered for python sessions', () => {
    expect(entry()?.appliesTo).toContain('ue-python');
  });

  it('warns that a high-res screenshot is asynchronous and needs frames plus a file check', () => {
    const out = formatGotchas('ue-python', 'models');
    expect(out).toMatch(/take_high_res_screenshot/);
    expect(out).toMatch(/asynchronous|later frame/i);
    expect(out).toMatch(/seconds/i);
  });

  it('warns that an asset import re-enters a post-tick callback', () => {
    const d = entry()?.detail ?? '';
    expect(d).toMatch(/register_slate_post_tick_callback/);
    expect(d).toMatch(/re-?enter/i);
    expect(d).toMatch(/guard/i);
  });

  it('warns that -ExecutePythonScript exits the editor after the script returns', () => {
    expect(entry()?.detail ?? '').toMatch(/ExecutePythonScript/);
    expect(entry()?.detail ?? '').toMatch(/init_unreal/);
  });

  it('records the capture drop rate it did NOT solve', () => {
    expect(entry()?.detail ?? '').toMatch(/7 of 16/);
  });

  it('stays out of the ue-cpp block and out of a UI module', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/take_high_res_screenshot/);
    expect(formatGotchas('ue-python', 'arpg-ui')).not.toMatch(/take_high_res_screenshot/);
  });
});
