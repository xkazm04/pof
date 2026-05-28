import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block' }}>
      <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--lab-muted)', display: 'block', marginBottom: 'var(--lab-s1)' }}>{label}</span>
      {children}
    </label>
  );
}
const fieldStyle = { width: '100%', fontFamily: 'var(--lab-font-body)', fontSize: 'var(--lab-fs-sm)', padding: 'var(--lab-s2) var(--lab-s3)', background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', color: 'var(--lab-text)' } as const;
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="focus-ring-inset" style={{ ...fieldStyle, ...props.style }} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="focus-ring-inset" style={{ ...fieldStyle, resize: 'vertical', ...props.style }} />;
}
