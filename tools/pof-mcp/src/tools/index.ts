import type { ToolDef } from './shared.js';
import { PIPELINE_TOOLS } from './pipeline.js';
import { HARNESS_TOOLS } from './harness.js';
import { SIM_TOOLS } from './sims.js';
import { UE_TOOLS } from './ue.js';
import { DESIGN_TOOLS } from './design.js';

export type { ToolDef } from './shared.js';

/** The full pof-mcp tool surface, in family order. */
export const TOOLS: ToolDef[] = [
  ...PIPELINE_TOOLS,
  ...HARNESS_TOOLS,
  ...SIM_TOOLS,
  ...UE_TOOLS,
  ...DESIGN_TOOLS,
];
