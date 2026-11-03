'use client';

/**
 * What a direction is written FOR: the line's class (an authored story line played once in its beat, or
 * a reactive bark fired by its `when` tags) and the beat's scene. Both come from the quest package
 * (registry `game-dialogue-voice-pipeline`: the line has a class, recorded per line).
 */
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { QueueLine } from '@/lib/voice/types';

const CLASS_NOTE = {
  story: 'story line: plays in the flow of its beat',
  bark: 'bark: fires on its when-tags; if a tag recurs in play, judge the take for the repeat hearing too',
} as const;

export function VoiceLineContext({ t, line }: { t: LabTheme; line: Pick<QueueLine, 'lineClass' | 'when' | 'beatId' | 'beatTitle' | 'beatSummary'> }) {
  return (
    <div data-testid="voice-line-context" data-class={line.lineClass} style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
      <MicroLabel mono tone="muted">
        {CLASS_NOTE[line.lineClass]}{line.when.length > 0 ? ` · when: ${line.when.join(', ')}` : ''}
      </MicroLabel>
      {line.beatId && (
        <details data-testid="voice-line-beat">
          <summary style={{ cursor: 'pointer', fontSize: 'var(--lab-fs-sm)', color: t.text }}>
            Scene: {line.beatTitle ?? line.beatId}
          </summary>
          {line.beatSummary && <p style={{ margin: 'var(--lab-s1) 0 0', fontSize: 'var(--lab-fs-xs)', color: t.text, lineHeight: 1.5 }}>{line.beatSummary}</p>}
        </details>
      )}
    </div>
  );
}
