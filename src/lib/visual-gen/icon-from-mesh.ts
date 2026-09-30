/**
 * Render an item icon FROM the asset, instead of illustrating it a second time.
 *
 * PoF's 2D icon library (`generated-icons.ts`, `generated/icons/`) is filled by
 * `scripts/gap-loop/power-icon.mjs`: a Leonardo text→image generation, Qwen-gated,
 * named for the artifact it was generated FOR. That art is real and it is addressable —
 * and it is drawn from a PROMPT, never from the mesh. So an entity can ship a GLB and an
 * icon that depict different objects, with nothing anywhere able to notice: the icon
 * matches its step by filename, and a filename cannot disagree with a mesh.
 *
 * The renderer that closes this already exists. `mesh-views.ts` orbits a `.glb` in
 * headless Blender and writes a PNG per yaw — built for the vision gate, and equally a
 * camera. Pointing it at the entity's own mesh and keeping one frame gives an icon that
 * DEPICTS the shipped asset by construction, for zero provider credits, and re-renders
 * for free whenever the mesh changes. The idea is the sprite-sheet-from-a-3D-object
 * workflow (Stefan 3D AI, `8MUk-tQTiwE` [13:01]) reduced to the single frame PoF needs.
 *
 * Three decisions.
 *
 * 1. **It writes under `iconFileBase`, the name every consumer already matches on.** The
 *    same rule `power-icon.mjs` had to learn: art written under an invented name is
 *    structurally unreachable, and three such files sit preserved in
 *    `generated/icons/_unaddressable/`. A rendered icon is a first-class member of the
 *    same library, resolved by the same precedence, served on the same url.
 * 2. **It commits through the icon library's door, with its provenance.** Once a render
 *    sits in the icon directory it is indistinguishable from generated art, and "this
 *    icon depicts the actual asset" is exactly the kind of claim this project refuses to
 *    make without evidence. `commitLibraryIcon` (`icon-library.ts`) records a
 *    `mesh-render` origin naming the mesh and the yaw in `<name>.prov.json`, BOUND to the
 *    bytes' size + mtime — so when any other writer later overwrites the file, the claim
 *    reads `unrecorded` instead of outliving the render it described.
 * 3. **The default hero yaw is 45°, and the default view count is chosen so that yaw
 *    EXISTS.** `pof_mesh_views.py` renders `360 * i / N`, so a 4-view orbit has no 45 and
 *    would silently hand back a flat front elevation. Eight views put the three-quarter
 *    view on the grid; it is also inside the lit band of that script's fixed three-point
 *    rig, whose rear yaws come back shadowed (its own header measures the palette swing).
 *    An off-grid request still renders — from the nearest yaw, saying that it did.
 */
import { copyFile as fsCopyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { runMeshViews, type MeshViewsResult, type MeshViewsSpec, type RenderedView } from './mesh-views';
import { iconFileBase } from './generated-icons';
import { commitLibraryIcon, type CommitLibraryIcon } from './icon-library';

/** The three-quarter angle an item icon is conventionally drawn at. */
export const DEFAULT_HERO_YAW = 45;

/**
 * Yaws rendered for an icon. Chosen so `360 * i / N` lands EXACTLY on
 * {@link DEFAULT_HERO_YAW} — a count that misses it yields a silently off-angle icon.
 * The extra frames cost Blender time only; no vision call is made here.
 */
export const ICON_VIEWS = 8;

/** Square icon resolution. */
export const DEFAULT_ICON_RES = 512;

export interface PickedHeroView {
  view?: RenderedView;
  /** True when a rendered yaw matched the requested hero yaw exactly. */
  exact: boolean;
  /** Always set — names the yaw served, or why none was. */
  reason: string;
}

/** Circular angular distance between two yaws, in degrees (0-180). Pure. */
function yawDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/**
 * The rendered view closest to the requested hero yaw. Pure.
 *
 * Reports whether the match was exact, because an off-angle icon is a real defect that
 * looks like a design choice — the caller must be able to see that it asked for 45 and
 * got 0.
 */
export function pickHeroView(views: RenderedView[], heroYaw: number): PickedHeroView {
  const candidates = (views ?? []).filter((v) => Number.isFinite(v.yawDeg));
  if (candidates.length === 0) {
    return { exact: false, reason: 'no views were rendered, so there is no frame to use as an icon' };
  }
  const best = candidates.reduce((a, b) =>
    yawDistance(b.yawDeg, heroYaw) < yawDistance(a.yawDeg, heroYaw) ? b : a,
  );
  const exact = yawDistance(best.yawDeg, heroYaw) === 0;
  return {
    view: best,
    exact,
    reason: exact
      ? `rendered the icon from yaw ${best.yawDeg}°`
      : `no view was rendered at the requested hero yaw ${heroYaw}° — used the nearest, yaw ${best.yawDeg}°`,
  };
}

export interface IconFromMeshSpec {
  /** The `.glb` to photograph. */
  meshPath: string;
  /** Catalog the icon belongs to — half of the name every consumer matches on. */
  catalogId: string;
  /** Step label the icon is for. */
  step: string;
  /** Entity id, when the icon is for one entity rather than the whole step. */
  entityId?: string;
  /** Camera yaw for the kept frame (default {@link DEFAULT_HERO_YAW}). */
  heroYaw?: number;
  resolution?: number;
  blenderPath?: string;
  timeoutMs?: number;
  /** Root of the icon library; defaults to `generated/icons`. */
  iconDir?: string;
  /** Where the orbit's frames land before one is kept; defaults to `generated/icon-renders`. */
  workDir?: string;
}

export interface IconFromMeshResult {
  ok: boolean;
  /** Basename written into the icon library. Present even on a failure to name the target. */
  name: string;
  /** Served url, present only on success. */
  url?: string;
  /** Absolute path of the written icon. */
  iconPath?: string;
  /** Yaw the kept frame was rendered at. */
  yawDeg?: number;
  /** False when the hero yaw had to be approximated. */
  exactYaw?: boolean;
  /** Why this frame — or why none. */
  reason: string;
  error?: string;
  durationMs?: number;
}

export interface IconFromMeshDeps {
  render?: (spec: MeshViewsSpec) => Promise<MeshViewsResult>;
  copyFile?: (from: string, to: string) => Promise<void>;
  /** The icon library's door (default `commitLibraryIcon`); the copy is its `write`. */
  commit?: CommitLibraryIcon;
  ensureDir?: (dir: string) => Promise<void>;
  now?: () => number;
}

/**
 * Render one frame of a mesh into the icon library.
 *
 * The door writes the provenance only AFTER the icon lands: a record beside a file that
 * does not exist is worse than no record, because it is a checkable claim that checks
 * out wrong.
 */
export async function renderIconFromMesh(
  spec: IconFromMeshSpec,
  deps: IconFromMeshDeps = {},
): Promise<IconFromMeshResult> {
  const render = deps.render ?? ((s: MeshViewsSpec) => runMeshViews(s));
  const copyFile = deps.copyFile ?? ((from: string, to: string) => fsCopyFile(from, to));
  const commit = deps.commit ?? ((dir, file, write, origin) => commitLibraryIcon(dir, file, write, origin));
  const ensureDir = deps.ensureDir ?? (async (dir: string) => { await mkdir(dir, { recursive: true }); });
  const now = deps.now ?? (() => Date.now());

  const base = iconFileBase(spec.catalogId, spec.step, spec.entityId);
  const name = `${base}.png`;
  const heroYaw = Number.isFinite(spec.heroYaw) ? (spec.heroYaw as number) : DEFAULT_HERO_YAW;
  const iconDir = (spec.iconDir ?? join(process.cwd(), 'generated', 'icons')).replace(/\\/g, '/');
  const workDir = (spec.workDir ?? join(process.cwd(), 'generated', 'icon-renders')).replace(/\\/g, '/');

  const started = now();
  const result = await render({
    meshPath: spec.meshPath,
    outDir: `${workDir}/${base}`,
    views: ICON_VIEWS,
    resolution: spec.resolution ?? DEFAULT_ICON_RES,
    ...(spec.blenderPath ? { blenderPath: spec.blenderPath } : {}),
    ...(spec.timeoutMs ? { timeoutMs: spec.timeoutMs } : {}),
  });

  if (!result.ok) {
    return {
      ok: false,
      name,
      reason: 'the mesh could not be rendered, so no icon was written',
      error: result.error ?? 'render failed without a reason',
      durationMs: now() - started,
    };
  }

  const picked = pickHeroView(result.views, heroYaw);
  if (!picked.view) {
    return { ok: false, name, reason: picked.reason, error: picked.reason, durationMs: now() - started };
  }

  const iconPath = `${iconDir}/${name}`;
  try {
    const frame = picked.view;
    await ensureDir(iconDir);
    await commit(iconDir, name, (to) => copyFile(frame.imagePath, to), {
      kind: 'mesh-render',
      renderedFrom: spec.meshPath,
      yawDeg: frame.yawDeg,
    });
  } catch (e) {
    return {
      ok: false,
      name,
      reason: picked.reason,
      error: e instanceof Error ? e.message : String(e),
      durationMs: now() - started,
    };
  }

  return {
    ok: true,
    name,
    url: `/api/visual-gen/icon/${encodeURIComponent(name)}`,
    iconPath,
    yawDeg: picked.view.yawDeg,
    exactYaw: picked.exact,
    reason: picked.reason,
    durationMs: now() - started,
  };
}
