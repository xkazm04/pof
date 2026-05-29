import type { ReactNode, HTMLAttributes } from 'react';

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad';
}

const TONE: Record<NonNullable<ChipProps['tone']>, string> = {
  neutral: 'var(--lab-muted)', accent: 'var(--lab-accent)',
  ok: 'var(--lab-ok)', warn: 'var(--lab-warn)', bad: 'var(--lab-bad)',
};

export function Chip({ children, tone = 'neutral', style, ...rest }: ChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s1)',
        fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)',
        padding: 'var(--lab-s1) var(--lab-s2)', border: `1px solid var(--lab-line)`,
        borderRadius: 'var(--lab-r-sm)', color: TONE[tone], whiteSpace: 'nowrap', ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
