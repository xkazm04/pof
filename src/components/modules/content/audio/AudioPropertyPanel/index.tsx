// ── Audio property panels ──
//
// Split out of one 250-line file when the panels stopped writing per keystroke:
// each panel now owns a `useRecordCommit` buffer (local edit now, one write per
// commit boundary through the THROWING commit path) plus its own save-error
// surface, and the emitter panel additionally binds to a generated asset set.

export { AssetSetPicker } from './AssetSetPicker';
export { ZonePropertyPanel } from './ZonePropertyPanel';
export { EmitterPropertyPanel } from './EmitterPropertyPanel';
export { useRecordCommit } from './useRecordCommit';
export type { RecordCommit } from './useRecordCommit';
