/**
 * Chaos Cloth attach — the CLIENT-SAFE contract.
 *
 * `chaos-cloth.ts` imports the UE experiment runner (`node:child_process`), so a client
 * component that imports anything from it drags the runner into the browser bundle and
 * Turbopack refuses to build the root page ("the chunking context does not support
 * external modules (request: node:child_process)" — caught by the wave-29 walker on
 * 2026-09-05). The panel and the route share these names through THIS file; the seam
 * re-exports them so server callers keep one import.
 */

/**
 * The one phrase every surface uses for "nothing was observed". Lives here, beside the
 * `notRun` field it describes, so the route, the panel and their tests cannot drift into
 * three different ways of saying the editor never started.
 */
export const CHAOS_CLOTH_NOT_RUN = 'not run — no UE editor/runner available';

/** Engine plugins this seam needs (beyond PythonScriptPlugin), enabled per-run. */
export const CHAOS_CLOTH_PLUGINS = ['ChaosClothAsset', 'ChaosClothAssetEditor', 'ChaosClothAssetDataflowNodes'];

export interface ClothResult {
  ok: boolean;
  /** /Game path of the created ChaosClothAsset. */
  clothAssetPath?: string;
  /** /Game path of the authored Dataflow asset. */
  dataflowPath?: string;
  /** /Game path of the garment static mesh used. */
  garmentMeshPath?: string;
  /** How many of the 4 cloth Dataflow nodes were added. */
  nodesAdded: number;
  /** Whether the full chain connected (incl. the terminal). */
  connected: boolean;
  /** Whether `regenerate_asset_from_dataflow` rebuilt the ClothAsset. */
  regenerated: boolean;
  /** Whether the graph evaluated — the skin-weight transfer bound (a fitted-garment signal). */
  bound: boolean;
  /**
   * The attach NEVER RAN — no editor was booted and nothing was observed. Either a
   * precondition refused it (a live editor holds the machine, or the gate drain holds the
   * editor lease) or there is no runner at all (`POF_UE_UPROJECT` unset / editor binary
   * missing). It is deliberately distinct from `ok: false`: a failed run condemns the
   * garment, a not-run reports the machine — and a surface that showed them alike would
   * let "no UE on this box" read as "this cape does not work".
   */
  notRun: boolean;
  error?: string;
  logs: string[];
}
