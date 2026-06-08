'use client';

import type { ReactNode } from 'react';
import type { LabTheme } from '../theme';

export function Lbl({ t, children }: { t: LabTheme; children: ReactNode }) {
  return <span className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted }}>{children}</span>;
}

export function LabButton({ t, children, onClick, disabled, testId }: { t: LabTheme; children: ReactNode; onClick?: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} data-testid={testId} className={t.fontMono}
      style={{ padding: '10px 16px', fontSize: 14, letterSpacing: '0.03em', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, background: t.glass ? t.accentBg : t.ink, color: t.glass ? t.ink : t.onAccent, border: `1px solid ${t.ink}`, borderRadius: t.glass ? 8 : 0, fontWeight: 600 }}>
      {children}
    </button>
  );
}

export function LabTextarea({ t, value, onChange, rows = 6, placeholder }: { t: LabTheme; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={t.fontBody}
      style={{ width: '100%', resize: 'vertical', background: t.bg, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0, padding: '10px 12px', fontSize: 15, lineHeight: 1.55, outline: 'none' }} />
  );
}

export function LabInput({ t, value, onChange, type = 'text', placeholder }: { t: LabTheme; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={t.fontBody}
      style={{ width: '100%', background: t.bg, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0, padding: '9px 12px', fontSize: 15, outline: 'none' }} />
  );
}
