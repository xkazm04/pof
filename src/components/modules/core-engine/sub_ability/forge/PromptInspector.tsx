'use client';

/**
 * The prompt inspector is the SHARED component now — one audit-chip +
 * collapsible-prompt surface for both the forge (post-run) and the daily
 * checklist run path (pre-dispatch, via shared/TaskPromptInspector). This
 * re-export preserves the historical forge import path.
 */
export { PromptInspector } from '@/components/modules/shared/PromptInspector';
