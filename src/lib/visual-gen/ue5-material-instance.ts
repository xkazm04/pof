/**
 * UE5 Material Instance emitter for the Material Lab.
 *
 * The Material Lab's headline promise — its module description, its "Export to
 * UE5" quick action and the `mat-ue5` checklist item — had no implementation:
 * the only export path was the Blender MCP bridge. The knowledge existed one
 * module over, but only as LLM *prompt text* in `prompts/material-configurator.ts`
 * (the `M_ARPG_Surface_Master` convention at :147 and the Constant3Vector
 * empty-pin gotcha at :143). This turns that prose into code.
 *
 * WHY UE PYTHON rather than C++: a `MaterialInstanceConstant` is an editor
 * asset, and only the editor's Python/asset-tools API can author one. C++ can
 * spawn a `UMaterialInstanceDynamic` at runtime but cannot produce the asset the
 * checklist asks for. Python is also deterministic text, so the whole emitter is
 * assertable with **no UE running** — generation is the deliverable, execution
 * is not.
 *
 * Everything here is PURE: same input, same bytes out. No clock, no randomness.
 */

/** The lab's PBR scalars. Structurally the component-side `PBRParams`. */
export interface UE5MaterialParams {
  /** Hex string, e.g. "#c0c0c0". */
  baseColor: string;
  metallic: number;
  roughness: number;
  normalStrength: number;
  aoStrength: number;
}

export type UE5TextureChannel = 'albedo' | 'normal' | 'metallic' | 'roughness' | 'ao';

export interface UE5MaterialInstanceInput {
  /** Desired asset name; sanitised and prefixed with `MI_` if it is not already. */
  name: string;
  params: UE5MaterialParams;
  /** Texture slots as the lab holds them — only `/Game/...` asset paths can travel. */
  textures?: Partial<Record<UE5TextureChannel, string | null>>;
  /** Content-browser folder for the instance (default `/Game/PoF/Materials`). */
  packagePath?: string;
  /** Parent master material (default the shared `M_ARPG_Surface_Master`). */
  parentMaterial?: string;
}

export interface UE5Parameter {
  name: string;
  kind: 'scalar' | 'vector' | 'texture';
  /** Rendered value, exactly as it appears in the script. */
  value: string;
}

export interface UE5Dropped {
  label: string;
  reason: string;
}

export interface UE5MaterialInstance {
  /** `/Game/PoF/Materials/MI_Foo` — where the script will write the asset. */
  assetPath: string;
  assetName: string;
  packagePath: string;
  parentMaterial: string;
  /** Suggested filename for the generated script. */
  fileName: string;
  /** The deterministic UE Python. */
  script: string;
  /** Every parameter the script sets. */
  parameters: UE5Parameter[];
  /** Everything the lab holds that cannot make the trip, each with its reason. */
  notExported: UE5Dropped[];
}

/** The convention lifted from `prompts/material-configurator.ts:147`. */
export const DEFAULT_PARENT_MATERIAL = '/Game/PoF/Materials/M_ARPG_Surface_Master';
export const DEFAULT_PACKAGE_PATH = '/Game/PoF/Materials';

const TEXTURE_PARAMETER: Record<UE5TextureChannel, string> = {
  albedo: 'Albedo',
  normal: 'Normal',
  metallic: 'Metallic',
  roughness: 'Roughness',
  ao: 'AO',
};

/** UE asset names accept letters, digits and underscore. */
export function sanitizeAssetName(raw: string): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const base = cleaned || 'LabMaterial';
  const named = /^[0-9]/.test(base) ? `M${base}` : base;
  return named.startsWith('MI_') ? named : `MI_${named}`;
}

/** Hex "#rrggbb" → linear-ish 0-1 triple, rounded so the output is byte-stable. */
export function hexToLinearColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0').slice(0, 6);
  const channel = (offset: number) => {
    const value = parseInt(h.substring(offset, offset + 2), 16);
    return Number.isNaN(value) ? 0 : Math.round((value / 255) * 1e6) / 1e6;
  };
  return [channel(0), channel(2), channel(4)];
}

/** A texture only travels if it is already an imported UE asset path. */
function resolveTexture(url: string): { assetPath: string } | { reason: string } {
  if (url.startsWith('/Game/')) return { assetPath: url };
  if (url.startsWith('blob:')) {
    return { reason: 'held only in the browser (blob: URL). Save the map, import it into UE, then set this texture parameter on the instance.' };
  }
  return { reason: `"${url}" is not a UE asset path. Import the map into the Content Browser and re-export, or set the parameter by hand.` };
}

function pythonFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

/**
 * The static half of the script: helpers whose only job is to make the two known
 * failure modes LOUD instead of silent.
 */
const HELPERS = `
def _color_pin(expression):
    """Output pin name for a colour-producing expression.

    THE GOTCHA: a Constant3Vector's colour output pin is "" — the EMPTY STRING —
    not "RGB". connect_material_property(node, "RGB", ...) returns False WITHOUT
    raising and the material compiles black. A VectorParameter's output IS "RGB".
    Never hardcode one of the two; ask.
    """
    if isinstance(expression, unreal.MaterialExpressionConstant3Vector):
        return ""
    if isinstance(expression, unreal.MaterialExpressionVectorParameter):
        return "RGB"
    return ""


def _connect(expression, prop):
    """Wire an expression to a material property, refusing a silent False."""
    pin = _color_pin(expression)
    if not unreal.MaterialEditingLibrary.connect_material_property(expression, pin, prop):
        raise RuntimeError(
            "connect_material_property returned False for pin %r -> %s. "
            "This is the empty-pin trap: check _color_pin." % (pin, prop)
        )


def _ensure_parent():
    """Load the shared master, authoring a minimal stand-in if the project has none."""
    if unreal.EditorAssetLibrary.does_asset_exist(PARENT_MATERIAL):
        return unreal.EditorAssetLibrary.load_asset(PARENT_MATERIAL)

    unreal.log_warning(
        "%s not found - authoring a minimal stand-in. Replace it with the real "
        "shared master when you have one." % PARENT_MATERIAL
    )
    folder, name = PARENT_MATERIAL.rsplit("/", 1)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    master = tools.create_asset(name, folder, unreal.Material, unreal.MaterialFactoryNew())
    lib = unreal.MaterialEditingLibrary

    tint = lib.create_material_expression(master, unreal.MaterialExpressionVectorParameter, -400, 0)
    tint.set_editor_property("parameter_name", "BaseColorTint")
    _connect(tint, unreal.MaterialProperty.MP_BASE_COLOR)

    for pname, prop, y, default in (
        ("Metallic", unreal.MaterialProperty.MP_METALLIC, 200, 0.0),
        ("Roughness", unreal.MaterialProperty.MP_ROUGHNESS, 400, 0.5),
    ):
        node = lib.create_material_expression(master, unreal.MaterialExpressionScalarParameter, -400, y)
        node.set_editor_property("parameter_name", pname)
        node.set_editor_property("default_value", default)
        _connect(node, prop)

    lib.recompile_material(master)
    unreal.EditorAssetLibrary.save_asset(PARENT_MATERIAL)
    return master
`.trim();

/**
 * Emit a deterministic UE Python script that creates (or updates) a
 * `MaterialInstanceConstant` of the shared master and applies the lab's values.
 *
 * The script reports every parameter the parent master does NOT expose rather
 * than letting UE's `set_material_instance_*_parameter_value` return False into
 * the void — a parameter that could not survive the round trip is named, not
 * dropped.
 */
export function buildUE5MaterialInstance(input: UE5MaterialInstanceInput): UE5MaterialInstance {
  const assetName = sanitizeAssetName(input.name);
  const packagePath = input.packagePath ?? DEFAULT_PACKAGE_PATH;
  const parentMaterial = input.parentMaterial ?? DEFAULT_PARENT_MATERIAL;
  const assetPath = `${packagePath}/${assetName}`;
  const [r, g, b] = hexToLinearColor(input.params.baseColor);

  const parameters: UE5Parameter[] = [
    { name: 'BaseColorTint', kind: 'vector', value: `(${r}, ${g}, ${b}, 1.0)` },
    { name: 'Metallic', kind: 'scalar', value: pythonFloat(input.params.metallic) },
    { name: 'Roughness', kind: 'scalar', value: pythonFloat(input.params.roughness) },
    { name: 'NormalStrength', kind: 'scalar', value: pythonFloat(input.params.normalStrength) },
    { name: 'AOStrength', kind: 'scalar', value: pythonFloat(input.params.aoStrength) },
  ];
  const notExported: UE5Dropped[] = [];

  const channels: UE5TextureChannel[] = ['albedo', 'normal', 'metallic', 'roughness', 'ao'];
  for (const channel of channels) {
    const url = input.textures?.[channel];
    if (!url) continue;
    const resolved = resolveTexture(url);
    if ('reason' in resolved) {
      notExported.push({ label: `${TEXTURE_PARAMETER[channel]} texture`, reason: resolved.reason });
      continue;
    }
    parameters.push({ name: TEXTURE_PARAMETER[channel], kind: 'texture', value: resolved.assetPath });
  }

  const scalars = parameters.filter((p) => p.kind === 'scalar');
  const vectors = parameters.filter((p) => p.kind === 'vector');
  const textures = parameters.filter((p) => p.kind === 'texture');

  const script = `
# Generated by the PoF Material Lab. Deterministic: same material, same bytes.
# Run inside the UE5 editor - Window > Developer Tools > Output Log, switch the
# console to Python, then:  py "<path to this file>"
#
# Emits a MaterialInstanceConstant of the shared master rather than authoring a
# one-off Material: instances share the compiled shader and keep the project
# consolidated.
import unreal

PARENT_MATERIAL = "${parentMaterial}"
PACKAGE_PATH = "${packagePath}"
ASSET_NAME = "${assetName}"
ASSET_PATH = "${assetPath}"

SCALARS = {
${scalars.map((p) => `    "${p.name}": ${p.value},`).join('\n')}
}
VECTORS = {
${vectors.map((p) => `    "${p.name}": ${p.value},`).join('\n')}
}
TEXTURES = {
${textures.length ? textures.map((p) => `    "${p.name}": "${p.value}",`).join('\n') : '    # no imported UE texture assets - see the export report'}
}

${HELPERS}


def build():
    parent = _ensure_parent()
    lib = unreal.MaterialEditingLibrary

    if unreal.EditorAssetLibrary.does_asset_exist(ASSET_PATH):
        instance = unreal.EditorAssetLibrary.load_asset(ASSET_PATH)
    else:
        instance = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            ASSET_NAME, PACKAGE_PATH,
            unreal.MaterialInstanceConstant,
            unreal.MaterialInstanceConstantFactoryNew(),
        )
    instance.set_editor_property("parent", parent)

    # A parameter the parent master does not expose comes back False. Collect
    # those instead of dropping them - the export must never look complete when
    # part of it did not land.
    unsupported = []
    for name, value in VECTORS.items():
        colour = unreal.LinearColor(value[0], value[1], value[2], value[3])
        if not lib.set_material_instance_vector_parameter_value(instance, name, colour):
            unsupported.append(name)
    for name, value in SCALARS.items():
        if not lib.set_material_instance_scalar_parameter_value(instance, name, value):
            unsupported.append(name)
    for name, path in TEXTURES.items():
        texture = unreal.EditorAssetLibrary.load_asset(path)
        if texture is None:
            unsupported.append("%s (asset %s not found)" % (name, path))
            continue
        if not lib.set_material_instance_texture_parameter_value(instance, name, texture):
            unsupported.append(name)

    lib.update_material_instance(instance)
    unreal.EditorAssetLibrary.save_asset(ASSET_PATH)

    if unsupported:
        unreal.log_warning(
            "%s: the parent master does not expose %s - those values did NOT land."
            % (ASSET_PATH, ", ".join(unsupported))
        )
    unreal.log("Wrote %s (parent %s)" % (ASSET_PATH, PARENT_MATERIAL))
    return instance


build()
`.trim();

  return {
    assetPath,
    assetName,
    packagePath,
    parentMaterial,
    fileName: `${assetName}.py`,
    script,
    parameters,
    notExported,
  };
}
