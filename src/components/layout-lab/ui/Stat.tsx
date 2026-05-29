interface StatProps { label: string; value: string; accent?: boolean; }

export function Stat({ label, value, accent }: StatProps) {
  return (
    <div style={{ padding: 'var(--lab-s1) var(--lab-s3)', border: '1px solid var(--lab-line)', background: 'var(--lab-panel)', borderRadius: 'var(--lab-r-md)' }}>
      <div style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lab-muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-md)', fontWeight: 600, color: accent ? 'var(--lab-ink)' : 'var(--lab-ink-deep)' }}>{value}</div>
    </div>
  );
}
