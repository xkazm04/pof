import type { WiringAsset } from '@/lib/feature-definitions';
import { STATUS_WARNING, STATUS_NEUTRAL, statusBg, statusBorder } from '@/lib/chart-colors';

/** Kinds that cannot be authored from code — flagged in warning color. */
const BINARY_KINDS: WiringAsset['kind'][] = ['WidgetBlueprint', 'AnimBlueprint', 'BehaviorTree'];

/**
 * Lists a module's editor-authored wiring dependencies. Binary-only kinds
 * (Widget/Animation Blueprint, Behavior Tree) are flagged in the warning color.
 * Renders nothing when there are no assets.
 */
export function WiringAssetsPanel({ assets }: { assets: WiringAsset[] }) {
  if (assets.length === 0) return null;
  return (
    <div
      className="rounded-md border p-2 space-y-1"
      style={{ borderColor: statusBorder(STATUS_NEUTRAL) }}
      data-testid="wiring-assets-panel"
    >
      {assets.map((a) => {
        const color = BINARY_KINDS.includes(a.kind) ? STATUS_WARNING : STATUS_NEUTRAL;
        return (
          <div key={a.name} className="flex items-start gap-2 text-2xs">
            <span
              className="px-1.5 py-0.5 rounded font-medium flex-shrink-0"
              style={{ backgroundColor: statusBg(color), color, border: `1px solid ${statusBorder(color)}` }}
            >
              {a.kind}
            </span>
            <span className="font-mono text-text-secondary flex-shrink-0">{a.name}</span>
            <span className="text-text-muted">{a.note}</span>
          </div>
        );
      })}
    </div>
  );
}
