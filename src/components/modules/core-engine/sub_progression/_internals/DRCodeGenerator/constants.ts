/* ── DR Config & Code Generation ───────────────────────────────────────────── */

export interface DRConfig {
  attribute: string;
  softCap: number;
  baseValuePerPoint: number;
  postCapMultiplier: number;
  curveTableName: string;
}

export const DR_CONFIGS: DRConfig[] = [
  { attribute: 'Strength', softCap: 60, baseValuePerPoint: 2.0, postCapMultiplier: 0.4, curveTableName: 'CT_STR_Scaling' },
  { attribute: 'Dexterity', softCap: 50, baseValuePerPoint: 0.005, postCapMultiplier: 0.35, curveTableName: 'CT_DEX_Scaling' },
  { attribute: 'Intelligence', softCap: 70, baseValuePerPoint: 5.0, postCapMultiplier: 0.5, curveTableName: 'CT_INT_Scaling' },
];
