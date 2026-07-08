import type { SeamCheckResult } from '@/lib/visual-gen/seam-check';

export interface ScenarioResult { albedoUrl?: string; normalUrl?: string; roughnessUrl?: string; seam?: SeamCheckResult | null }
export interface ImageResult { imageUrl?: string; generationId?: string }

export type PbrUrlKey = 'albedoUrl' | 'normalUrl' | 'roughnessUrl';
