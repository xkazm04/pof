// ─── Connection ─────────────────────────────────────────────────────────────

export interface BlenderConnection {
  host: string;
  port: number;
  /**
   * Whether the bridge answered the LAST liveness probe. This is not a cached
   * flag: `BlenderMCPService.probe()` round-trips a real `get_scene_info` before
   * this value is reported, so `true` means bytes came back, not "we once
   * dialled successfully". See `lastProbeAt` / `lastProbeError`.
   */
  connected: boolean;
  /** Epoch ms of the last probe that actually put bytes on the wire. */
  lastProbeAt?: number;
  /**
   * Why the last probe failed, in the addon's / socket's own words. Set whenever
   * a probe flips `connected` to false so the UI can say WHY the bridge went
   * away instead of only that it did. Cleared by a successful probe.
   */
  lastProbeError?: string;
}
// NOTE: there is deliberately no `blenderVersion` here. It was rendered by the
// connection bar and the setup wizard for months while NOTHING in the service
// ever wrote it — the only values in the tree were test fixtures. Neither the
// health check (`get_scene_info`) nor any other command on this bridge carries a
// Blender version, so the field could only ever have been a fabrication. The
// separate `useBlenderStore.blenderVersion` is unrelated and IS real: it comes
// from `/api/visual-gen/blender/detect` running the local Blender executable.

export const DEFAULT_BLENDER_HOST = 'localhost';
export const DEFAULT_BLENDER_PORT = 9876;

// ─── TCP Protocol ───────────────────────────────────────────────────────────
// Wire format for Blender MCP addon (ahujasid/blender-mcp addon.py).
// Raw JSON over TCP, try-parse framing (no delimiter, no length prefix).

export interface BlenderCommand {
  type: string;
  params?: Record<string, unknown>;
}

export interface BlenderSuccessResponse {
  status: 'success';
  result: unknown;
}

export interface BlenderErrorResponse {
  status: 'error';
  message: string;
}

export type BlenderResponse = BlenderSuccessResponse | BlenderErrorResponse;

// ─── Scene ──────────────────────────────────────────────────────────────────

export interface ObjectSummary {
  name: string;
  type: string;
  location: [number, number, number];
  visible: boolean;
}

export interface ObjectInfo extends ObjectSummary {
  rotation: [number, number, number];
  scale: [number, number, number];
  modifiers: string[];
  materials: string[];
}

export interface SceneInfo {
  objects: ObjectSummary[];
  activeObject?: string;
  collections: string[];
  frameRange: [number, number];
}

// ─── Execution ──────────────────────────────────────────────────────────────

export interface ExecuteOutput {
  output: string;
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export type AssetSource = 'polyhaven' | 'sketchfab';

export interface AssetResult {
  id: string;
  name: string;
  source: AssetSource;
  category: string;
  thumbnailUrl?: string;
}

export interface ImportedObject {
  objectName: string;
}

// ─── Generation ─────────────────────────────────────────────────────────────

export type GenerationProvider = 'hyper3d' | 'hunyuan3d';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobResult {
  jobId: string;
  status: 'pending' | 'processing';
}

export interface JobStatusResult {
  jobId: string;
  status: JobStatus;
  progress: number;
  resultUrl?: string;
}
