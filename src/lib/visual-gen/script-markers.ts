/**
 * The declared stdout-marker contract of the LOCALLY SPAWNED generator / mesh scripts
 * (`scripts/visual-gen/pof_*.py`, run through `runLocalProcess`). Each script prints
 * `POF_<P>_<KEY>=<value>` lines; this file is the one declaration of which keys each
 * script prints, and every parser reads through {@link readMarkerBlock}.
 *
 * Both sides used to be kept by hand, and they drifted: 11 printed keys had no reader.
 * The worst was `BAKE_<MAP>_ERROR`, the only report of a failed bake, so a run whose AO
 * bake threw came back ok with the AO path simply absent. `script-markers.test.ts` reads
 * each script's source and fails when a key is printed but undeclared or declared but
 * never printed; {@link MarkerBlock.get} throws on an undeclared key, so a reader cannot
 * name a key the script does not print.
 *
 * NOT the Blender-MCP receipt envelope (`src/lib/blender-mcp/receipt.ts`, `POF_RESULT=`
 * JSON), which covers code sent to the operator's LIVE Blender. This is the per-script
 * `KEY=value` vocabulary of subprocesses PoF spawns itself. Pure, client-safe.
 */

/**
 * - `result`: the success marker (DONE).
 * - `error`: the fatal error marker; the run failed.
 * - `metric`: a measured number or a reported setting, projected into a typed field.
 * - `path`: a file the script says it wrote (the caller confirms it on disk).
 * - `reason`: a stated refusal / fallback / per-item failure, projected into a typed field.
 * - `diagnostic`: a non-fatal note; always surfaced verbatim in `diagnostics`.
 * - `repeat`: may appear on several lines (read with `all` / `slots`).
 */
export type MarkerKind = 'result' | 'error' | 'metric' | 'path' | 'reason' | 'diagnostic' | 'repeat';

export interface ScriptMarkerContract {
  /** Basename under `scripts/visual-gen/`. */
  script: string;
  /** Line prefix every marker carries, e.g. `POF_T2_`. */
  prefix: string;
  keys: Readonly<Record<string, MarkerKind>>;
  /** Keys with a slot: `{n}` is digits, any other `{name}` is an upper-case token. */
  templates?: Readonly<Record<string, MarkerKind>>;
}

export const SCRIPT_MARKERS = {
  triposr: {
    script: 'pof_triposr.py',
    prefix: 'POF_TRIPOSR_',
    keys: {
      DONE: 'result', ERROR: 'error', DEVICE: 'metric', VERTS: 'metric', FACES: 'metric',
      CLIP_MAX: 'metric', CLIP_MEAN: 'metric', PREVIEW: 'path', CLIP_ERROR: 'diagnostic',
    },
  },
  hunyuan: {
    script: 'pof_hunyuan.py',
    prefix: 'POF_HY3D_',
    keys: {
      DONE: 'result', ERROR: 'error', VERTS: 'metric', FACES: 'metric', VRAM_GB: 'metric',
      PREVIEW: 'path', PREVIEW_ERROR: 'diagnostic', LOAD_S: 'diagnostic', GEN_S: 'diagnostic',
    },
  },
  trellis: {
    script: 'pof_trellis.py',
    prefix: 'POF_T2_',
    keys: {
      DONE: 'result', ERROR: 'error', VERTS: 'metric', FACES: 'metric', VRAM_GB: 'metric',
      BAKE_S: 'metric', PREVIEW: 'path', PREVIEW_PBR_ERROR: 'diagnostic',
      PREVIEW_ERROR: 'diagnostic', LOAD_S: 'diagnostic', GEN_S: 'diagnostic',
    },
  },
  meshFinish: {
    script: 'pof_mesh_finish.py',
    prefix: 'POF_MESHFINISH_',
    keys: {
      DONE: 'result', ERROR: 'error', MIRROR: 'metric', FACES_IN: 'metric', FACES_OUT: 'metric',
      FACES_CULLED: 'metric', CULL_UNEVALUATED_SHELLS: 'metric', CULL_REFUSED: 'reason',
      RETOPO: 'metric', RETOPO_FALLBACK: 'reason', QUADS_AUTHORED: 'metric',
      SHADING: 'metric', SHADING_SKIPPED: 'reason', UV: 'metric', UV_MODE: 'metric',
      UV_MODE_FALLBACK: 'reason', UV_STRETCH_P95: 'metric', UV_STRETCH_BAD_FRAC: 'metric',
      UV_STRETCH_DEGENERATE: 'metric', UV_STRETCH_UNMEASURED: 'reason', SIZE_MB: 'metric',
    },
    templates: { 'BAKE_{map}': 'path', 'BAKE_{map}_ERROR': 'reason' },
  },
  meshSplit: {
    script: 'pof_mesh_split.py',
    prefix: 'POF_MESHSPLIT_',
    keys: {
      DONE: 'result', ERROR: 'error', FACES_IN: 'metric', COMPONENTS: 'metric',
      COVERAGE: 'metric', PART: 'repeat', DISCARDED: 'metric', DISCARDED_FACES: 'metric',
      CAPPED: 'metric',
    },
  },
  meshViews: {
    script: 'pof_mesh_views.py',
    prefix: 'POF_VIEWS_',
    keys: { DONE: 'result', ERROR: 'error', PALETTE_SKIPPED: 'diagnostic' },
    templates: { '{n}': 'repeat' },
  },
} as const satisfies Record<string, ScriptMarkerContract>;

export type ScriptId = keyof typeof SCRIPT_MARKERS;

export interface MarkerBlock {
  /** First value of a declared key (trimmed); throws on a key the script does not declare. */
  get(key: string): string | undefined;
  /** {@link get} as a number; undefined when absent. */
  num(key: string): number | undefined;
  /** Every value of a declared key, in output order. */
  all(key: string): string[];
  /** Every line matching a declared template, with the slot it filled, in output order. */
  slots(template: string): Array<{ slot: string; value: string }>;
  /** Present `diagnostic` keys plus any undeclared key, verbatim; absent when none. */
  diagnostics?: Record<string, string>;
  /** Keys printed with this prefix that the declaration does not know. */
  undeclared: string[];
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function templateRe(template: string): RegExp {
  const src = template
    .split(/(\{[^}]*\})/)
    .map((part) => (part === '{n}' ? '(\\d+)' : part.startsWith('{') ? '([A-Z][A-Z0-9]*)' : part.replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${src}$`);
}

/** Read one script's marker block out of its merged stdout. Pure. */
export function readMarkerBlock(id: ScriptId, stdout: string): MarkerBlock {
  const c: ScriptMarkerContract = SCRIPT_MARKERS[id];
  const templates = Object.entries(c.templates ?? {}).map(([t, kind]) => ({ t, kind, re: templateRe(t) }));
  const lines: Array<{ key: string; value: string }> = [];
  const undeclared: string[] = [];
  const diagnostics: Record<string, string> = {};
  const lineRe = new RegExp(`^${c.prefix}([A-Za-z0-9_]+)=(.*)$`);

  for (const raw of stdout.split(/\r?\n/)) {
    const m = lineRe.exec(raw);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    lines.push({ key, value });
    const kind: MarkerKind | undefined = own(c.keys, key) ? c.keys[key] : templates.find((x) => x.re.test(key))?.kind;
    if (kind === undefined) {
      if (!undeclared.includes(key)) undeclared.push(key);
      if (!own(diagnostics, key)) diagnostics[key] = value;
    } else if (kind === 'diagnostic' && !own(diagnostics, key)) {
      diagnostics[key] = value;
    }
  }

  const declared = (key: string) => {
    if (!own(c.keys, key)) throw new Error(`marker ${c.prefix}${key} is not declared for ${c.script} (script-markers.ts)`);
  };
  const all = (key: string) => { declared(key); return lines.filter((l) => l.key === key).map((l) => l.value); };
  const get = (key: string) => all(key)[0];
  return {
    get,
    num: (key) => { const v = get(key); return v === undefined ? undefined : Number(v); },
    all,
    slots: (template) => {
      const t = templates.find((x) => x.t === template);
      if (!t) throw new Error(`marker template ${c.prefix}${template} is not declared for ${c.script} (script-markers.ts)`);
      return lines.flatMap((l) => {
        const m = t.re.exec(l.key);
        return m && !own(c.keys, l.key) ? [{ slot: m[1], value: l.value }] : [];
      });
    },
    ...(Object.keys(diagnostics).length ? { diagnostics } : {}),
    undeclared,
  };
}

/** Read a `KEY=value` stdout marker line by its full key (a script with no declared
 *  contract yet, e.g. ARDY / SkinTokens). Pure. */
export function readMarker(stdout: string, key: string): string | undefined {
  const m = stdout.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
}
