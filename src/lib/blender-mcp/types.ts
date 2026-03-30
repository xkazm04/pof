// ─── Connection ─────────────────────────────────────────────────────────────

export interface BlenderConnection {
  host: string;
  port: number;
  connected: boolean;
  blenderVersion?: string;
}

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
