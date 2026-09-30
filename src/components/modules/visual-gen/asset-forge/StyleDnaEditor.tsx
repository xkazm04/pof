'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Loader2, Plus, X } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import type { StyleDna } from '@/lib/visual-gen/style-dna';
import type { StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';
import { editDna, styleFragmentPreview, validateStyleDna, type DnaEdit, type StyleDnaDim } from '@/lib/visual-gen/style-dna-edit';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';

const DNA_ROWS: Array<{ key: StyleDnaDim; label: string }> = [
  { key: 'palette', label: 'Palette' },
  { key: 'materials', label: 'Materials' },
  { key: 'mood', label: 'Mood' },
  { key: 'render', label: 'Render' },
  { key: 'motifs', label: 'Motifs' },
];
const CHIP = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs border';
const SENT = 'border-[var(--visual-gen)]/40 bg-[var(--visual-gen)]/10 text-text';
const UNSENT = 'border-border text-text-muted line-through';
const ICON_BTN = 'text-text-muted hover:text-text';

/** Plain-language list of what never reaches a prompt — rendered wherever chips are shown. */
function DroppedLines({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <ul className="space-y-0.5 text-2xs text-amber-400" data-testid="style-dna-dropped">
      {lines.map((l) => <li key={l}>{l}</li>)}
    </ul>
  );
}

/** The DNA strip — the active profile's chips, with every chip the prompt never carries struck and named. */
export function DnaStrip({ dna }: { dna: StyleDna }) {
  const preview = useMemo(() => styleFragmentPreview(dna), [dna]);
  return (
    <div className="space-y-1.5" data-testid="dna-strip">
      {DNA_ROWS.filter((r) => dna[r.key].length > 0).map((row) => (
        <div key={row.key} className="flex items-baseline gap-2">
          <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-text-muted">{row.label}</span>
          <div className="flex flex-wrap gap-1">
            {dna[row.key].map((item) => {
              const unsent = preview.rows[row.key].unsent.some((u) => u.item === item);
              return (
                <span key={item} className={`${CHIP} ${unsent ? UNSENT : SENT}`} title={unsent ? 'not sent to prompts' : undefined}>
                  {item}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <DroppedLines lines={preview.dropped} />
    </div>
  );
}

interface StyleDnaEditorProps {
  profile: StyleDnaProfile;
  onSaved: (profile: StyleDnaProfile) => void;
  onCancel: () => void;
}

/**
 * Edit a profile's chips and save the result as a COPY via POST /api/visual-gen/style-dna/fork —
 * a SQLite write with no vision call. The live preview is the real fragment (styleFragmentPreview),
 * and every chip it cannot carry is named with the reason: the per-dim cap, or the char budget
 * behind a prompt of the length typed here.
 */
export function StyleDnaEditor({ profile, onSaved, onCancel }: StyleDnaEditorProps) {
  const [draft, setDraft] = useState<StyleDna>(profile.dna);
  const [adding, setAdding] = useState<Partial<Record<StyleDnaDim, string>>>({});
  const [name, setName] = useState(`${profile.name} (edited)`);
  const [promptChars, setPromptChars] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const preview = useMemo(() => styleFragmentPreview(draft, { promptChars }), [draft, promptChars]);
  const valid = useMemo(() => validateStyleDna(draft), [draft]);
  const unchanged = JSON.stringify(draft) === JSON.stringify(profile.dna);
  const edit = (e: DnaEdit) => setDraft((d) => editDna(d, e));
  const add = (dim: StyleDnaDim) => {
    edit({ op: 'add', dim, item: adding[dim] ?? '' });
    setAdding((a) => ({ ...a, [dim]: '' }));
  };

  const save = async () => {
    if (!valid.ok) return;
    setSaving(true);
    setSaveError(null);
    const res = await tryApiFetch<{ profile: StyleDnaProfile }>('/api/visual-gen/style-dna/fork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId: profile.id, name: name.trim(), dna: valid.data }),
    });
    if (!mounted.current) return;
    setSaving(false);
    if (!res.ok) { setSaveError(`Could not save the copy: ${res.error}`); return; }
    onSaved(res.data.profile);
  };

  const sentChars = preview.fragmentCharsSent;
  return (
    <div className="space-y-2.5 rounded-lg border border-[var(--visual-gen)]/30 p-2.5" data-testid="style-dna-editor">
      <p className="text-2xs text-text-muted">
        Editing a copy of “{profile.name}” — the original stays, so “Use” brings it back. No vision call is made.
      </p>
      {DNA_ROWS.map(({ key, label }) => (
        <div key={key} className="flex items-baseline gap-2">
          <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-text-muted">{label}</span>
          <div className="flex flex-wrap items-center gap-1">
            {draft[key].map((item, i) => {
              const unsent = preview.rows[key].unsent.some((u) => u.item === item);
              return (
                <span key={item} className={`${CHIP} ${unsent ? UNSENT : SENT}`}>
                  {i > 0 && (
                    <button type="button" aria-label={`Promote “${item}”`} className={ICON_BTN} onClick={() => edit({ op: 'promote', dim: key, item })}>
                      <ArrowUp size={10} />
                    </button>
                  )}
                  {item}
                  <button type="button" aria-label={`Remove “${item}”`} className={ICON_BTN} onClick={() => edit({ op: 'remove', dim: key, item })}>
                    <X size={10} />
                  </button>
                </span>
              );
            })}
            <input
              type="text"
              aria-label={`Add a ${key} chip`}
              value={adding[key] ?? ''}
              onChange={(e) => setAdding((a) => ({ ...a, [key]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') add(key); }}
              placeholder="add…"
              className="w-24 bg-surface border border-border rounded-full px-2 py-0.5 text-2xs text-text placeholder:text-text-muted focus:outline-none focus:border-[var(--visual-gen)]"
            />
            <button type="button" aria-label={`Add ${key} chip`} className={ICON_BTN} onClick={() => add(key)}>
              <Plus size={12} />
            </button>
          </div>
        </div>
      ))}

      <div className="space-y-1">
        <p className="text-2xs text-text-muted">
          Sent to prompts{preview.cut ? ` (${sentChars} of ${preview.fragmentChars} chars)` : ''}:
        </p>
        <p className="rounded bg-surface px-2 py-1 text-2xs text-text break-words" data-testid="style-dna-preview">
          {preview.fragment.slice(0, sentChars)}
          {preview.cut && <span className="text-text-muted line-through">{preview.fragment.slice(sentChars)}</span>}
        </p>
        <label className="flex items-center gap-1.5 text-2xs text-text-muted">
          Behind a prompt of
          <input
            type="number"
            min={0}
            aria-label="Prompt length"
            value={promptChars}
            onChange={(e) => setPromptChars(Math.max(0, Number(e.target.value) || 0))}
            className="w-16 bg-surface border border-border rounded px-1 py-0.5 text-2xs text-text"
          />
          chars — the whole style fits behind up to {preview.fullFitPromptChars}.
        </label>
        <DroppedLines lines={preview.dropped} />
        {!valid.ok && <p className="text-2xs text-amber-400" role="status">{valid.error}</p>}
      </div>

      {saveError && <InlineErrorRetry dense message={saveError} onRetry={() => void save()} onDismiss={() => setSaveError(null)} />}
      <div className="flex gap-2">
        <input
          type="text"
          aria-label="Copy name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-none focus:border-[var(--visual-gen)]"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid.ok || unchanged || saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save as copy
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs border border-border text-text-muted hover:text-text">
          Cancel
        </button>
      </div>
    </div>
  );
}
