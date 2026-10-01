'use client';

import { useId, type ReactNode } from 'react';
import { Input, Textarea } from '@/components/layout-lab/ui/Field';
import type { LabTheme } from '../theme';

/**
 * The lab's themed controls — the kit the Shared Component Manifest sends every step author to.
 * LabInput / LabTextarea ride `ui/Field`'s Input / Textarea (which carry `focus-ring-inset`), so
 * the keyboard focus ring is never killed, and a control cannot be rendered without a NAME:
 * `label` renders an associated `<label htmlFor>` in Lbl's style; `ariaLabel` names a control
 * whose caption lives elsewhere. A placeholder is not a name. `Lbl` stays for headings that
 * name no control.
 */
export type ControlName = { label: string; ariaLabel?: never } | { ariaLabel: string; label?: never };

const lblStyle = (t: LabTheme) => ({ fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted }) as const;
/** Themed look over ui/Field's base. `fontFamily: undefined` lets the theme's font class win. */
const controlStyle = (t: LabTheme) => ({ fontFamily: undefined, background: t.bg, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0, fontSize: 15 });

export function Lbl({ t, children }: { t: LabTheme; children: ReactNode }) {
  return <span className={t.fontMono} style={lblStyle(t)}>{children}</span>;
}

function ControlLabel({ t, htmlFor, label }: { t: LabTheme; htmlFor: string; label?: string }) {
  return label ? <label htmlFor={htmlFor} className={t.fontMono} style={lblStyle(t)}>{label}</label> : null;
}

export function LabButton({ t, children, onClick, disabled, testId }: { t: LabTheme; children: ReactNode; onClick?: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className={`focus-ring ${t.fontMono}`}
      style={{ padding: '10px 16px', fontSize: 14, letterSpacing: '0.03em', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, background: t.glass ? t.accentBg : t.ink, color: t.glass ? t.ink : t.onAccent, border: `1px solid ${t.ink}`, borderRadius: t.glass ? 8 : 0, fontWeight: 600 }}>
      {children}
    </button>
  );
}

export function LabTextarea({ t, value, onChange, rows = 6, placeholder, testId, label, ariaLabel }: { t: LabTheme; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; testId?: string } & ControlName) {
  const id = useId();
  return (
    <>
      <ControlLabel t={t} htmlFor={id} label={label} />
      <Textarea id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} data-testid={testId} className={t.fontBody}
        style={{ ...controlStyle(t), padding: '10px 12px', lineHeight: 1.55 }} />
    </>
  );
}

/**
 * Themed on/off switch in the lab's own visual language (mono label + hairline border,
 * ≥14px). `tone: 'warn'` paints the ON state in the theme's warn ink — for a switch whose
 * ON state has a real consequence (e.g. live CLI produce spends model budget).
 */
export function LabToggle({ t, checked, onChange, label, hint, tone, testId }: {
  t: LabTheme; checked: boolean; onChange: (v: boolean) => void;
  label: string; hint?: string; tone?: 'warn'; testId?: string;
}) {
  const accent = tone === 'warn' ? t.warn : t.ink;
  return (
    <label data-testid={testId} data-checked={checked ? 'true' : 'false'} className={t.fontMono}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14,
        padding: '6px 10px', border: `1px solid ${checked ? accent : t.line}`, borderRadius: t.glass ? 8 : 0 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        data-testid={testId ? `${testId}-input` : undefined}
        style={{ width: 14, height: 14, margin: 0, accentColor: accent }} />
      <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, color: checked ? accent : t.muted }}>{label}</span>
      {hint && <span style={{ color: t.muted }}>{hint}</span>}
    </label>
  );
}

export function LabInput({ t, value, onChange, type = 'text', placeholder, label, ariaLabel }: { t: LabTheme; value: string; onChange: (v: string) => void; type?: string; placeholder?: string } & ControlName) {
  const id = useId();
  return (
    <>
      <ControlLabel t={t} htmlFor={id} label={label} />
      <Input id={id} aria-label={ariaLabel} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={t.fontBody}
        style={{ ...controlStyle(t), padding: '9px 12px' }} />
    </>
  );
}
