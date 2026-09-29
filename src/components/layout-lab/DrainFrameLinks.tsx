'use client';

import { drainFrameLabel, drainFrameUrl } from '@/lib/test-gate-runner/frameUrl';
import type { LabTheme } from '@/components/layout-lab/theme';

interface Props {
  t: LabTheme;
  /** Absolute frame paths from `DrainSummary.screenshots`, verbatim. */
  frames: readonly string[];
  /** Test-id prefix: `<prefix>-frames` on the block, `<prefix>-frame-link` on each link. */
  testIdPrefix: string;
}

/**
 * The captured L4 frames of a drain, as openable thumbnails. The runner hoists these so a
 * human LOOKS at them; both drain scopes (the Matrix batch drain and the per-entity coach
 * drain) render them through this one component. Renders nothing when there are no frames.
 */
export function DrainFrameLinks({ t, frames, testIdPrefix }: Props) {
  if (frames.length === 0) return null;
  return (
    <div data-testid={`${testIdPrefix}-frames`} style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: t.muted }}>
        {frames.length} captured frame{frames.length > 1 ? 's' : ''} — open one and judge the render yourself:
      </span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {frames.map((shot) => {
          const label = drainFrameLabel(shot);
          return (
            <li key={shot}>
              <a href={drainFrameUrl(shot)} target="_blank" rel="noreferrer"
                data-testid={`${testIdPrefix}-frame-link`} title={shot}
                className="focus-ring"
                style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: t.ink, textDecoration: 'none' }}>
                <img src={drainFrameUrl(shot)} alt={`Captured gate frame ${label}`}
                  loading="lazy" width={128} height={72}
                  style={{ width: 128, height: 72, objectFit: 'cover', border: `1px solid ${t.line}`, borderRadius: t.glass ? 4 : 0, background: t.panel }} />
                <span style={{ maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
