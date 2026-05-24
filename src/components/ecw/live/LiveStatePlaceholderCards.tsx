'use client';

import { Eye, AlertOctagon, Map, History } from 'lucide-react';

interface PlaceholderCardSpec {
  Icon: typeof Eye;
  title: string;
  phase: string;
  body: string;
}

const CARDS: PlaceholderCardSpec[] = [
  {
    Icon: Eye,
    title: 'Live UObject Inspector',
    phase: 'Phase 6b',
    body: 'Pick an actor in running PIE → show its live UProperties via the bridge.',
  },
  {
    Icon: AlertOctagon,
    title: 'Crash Watchtower',
    phase: 'Phase 6b',
    body: 'Auto-ingest UE crash dumps + regression matching against known patterns.',
  },
  {
    Icon: Map,
    title: '3D Zone Twin',
    phase: 'Phase 10',
    body: 'Live WebGL preview of the selected zone, synced with the editor viewport.',
  },
  {
    Icon: History,
    title: 'Time-travel Replay',
    phase: 'Phase 10',
    body: 'Scrub UE editor sessions through past snapshots.',
  },
];

/**
 * Grid of placeholder cards announcing the Phase 6b / Phase 10 enhancements
 * that will fill out Live State. Each maps to a specific KEEP-CORE backlog
 * idea (53d018a8, fff73bb0/a23c6e6d/15defbed, 4328916d, 34b53407 respectively).
 */
export function LiveStatePlaceholderCards() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {CARDS.map(({ Icon, title, phase, body }) => (
        <section
          key={title}
          className="rounded-lg border border-dashed border-border/40 bg-surface-deep/40 p-4"
        >
          <header className="flex items-center gap-2 mb-2">
            <Icon className="w-4 h-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text">{title}</h3>
            <span className="ml-auto text-2xs font-mono uppercase tracking-wider text-text-muted/70">
              {phase}
            </span>
          </header>
          <p className="text-xs text-text-muted/70">{body}</p>
        </section>
      ))}
    </div>
  );
}
