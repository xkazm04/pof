import type { ReactNode } from 'react';

interface RailProps { title: ReactNode; children: ReactNode; }

/** A bordered left column with an uppercase mono header. The body scrolls. */
export function Rail({ title, children }: RailProps) {
  return (
    <aside style={{ borderRight: '1px solid var(--lab-line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--lab-ink)', padding: 'var(--lab-s4) var(--lab-s4) var(--lab-s2)' }}>{title}</div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{children}</div>
    </aside>
  );
}
