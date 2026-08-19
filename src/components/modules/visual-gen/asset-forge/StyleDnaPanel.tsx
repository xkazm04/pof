'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Dna, ImagePlus, Loader2, X } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { formatBytes } from '@/lib/format';
import type { StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';
import { STYLE_DNA_REACH, type StyleDna } from '@/lib/visual-gen/style-dna';
import { InlineErrorRetry } from '../../shared/InlineErrorRetry';
import { useForgeStore } from './useForgeStore';

/** Hard caps on the mood-board intake, exported so the test asserts the SAME numbers the UI states. */
export const MAX_BOARD_IMAGES = 6;
export const MAX_BOARD_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * What a failed action should re-run when the user clicks Retry.
 *
 * This exists because the retry used to be hardwired to `distill`: a failed *activation*
 * (a PATCH) offered a Retry button that fired a PAID VLM distillation of whatever
 * happened to be on the board. A retry may only ever repeat the action that failed.
 */
type RetryTarget = { kind: 'load' } | { kind: 'distill' } | { kind: 'activate'; id: string };

const DNA_ROWS: Array<{ key: keyof StyleDna; label: string }> = [
  { key: 'palette', label: 'Palette' },
  { key: 'materials', label: 'Materials' },
  { key: 'mood', label: 'Mood' },
  { key: 'render', label: 'Render' },
  { key: 'motifs', label: 'Motifs' },
];

/** The DNA strip — the active profile's style genome as labeled chip clusters. */
function DnaStrip({ dna }: { dna: StyleDna }) {
  return (
    <div className="space-y-1.5" data-testid="dna-strip">
      {DNA_ROWS.filter((r) => dna[r.key].length > 0).map((row) => (
        <div key={row.key} className="flex items-baseline gap-2">
          <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-text-muted">{row.label}</span>
          <div className="flex flex-wrap gap-1">
            {dna[row.key].map((item) => (
              <span
                key={item}
                className="px-2 py-0.5 rounded-full text-2xs border border-[var(--visual-gen)]/40 bg-[var(--visual-gen)]/10 text-text"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Project style — distill a mood board once into a Style DNA profile, then apply it
 * to every generation prompt. The forge-side face of /api/visual-gen/style-dna.
 */
export function StyleDnaPanel() {
  const activeStyleDna = useForgeStore((s) => s.activeStyleDna);
  const applyStyleDna = useForgeStore((s) => s.applyStyleDna);
  const setActiveProfile = useForgeStore((s) => s.setActiveStyleDnaProfile);
  const setApplyStyleDna = useForgeStore((s) => s.setApplyStyleDna);

  const [profiles, setProfiles] = useState<StyleDnaProfile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [board, setBoard] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [distilling, setDistilling] = useState(false);
  const [error, setError] = useState<{ message: string; target: RetryTarget } | null>(null);
  /** Intake refusals (unreadable / oversize / over-cap files). No retry — nothing to repeat. */
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Async settlers (fetches, FileReader callbacks) must not touch state after unmount. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = async () => {
    const res = await tryApiFetch<{ active: StyleDnaProfile | null; profiles: StyleDnaProfile[] }>(
      '/api/visual-gen/style-dna',
    );
    if (!mounted.current) return;
    if (!res.ok) {
      // A 500 used to return silently here, leaving "none yet — distill one from a mood
      // board" indistinguishable from "the server could not tell us". Say which it is,
      // and expand so the message is actually on screen.
      setError({ message: `Could not load saved styles: ${res.error}`, target: { kind: 'load' } });
      setExpanded(true);
      return;
    }
    setProfiles(res.data.profiles);
    setActiveProfile(res.data.active);
    if (!res.data.active) setExpanded(true); // empty state invites a first board
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  useEffect(() => { void load(); }, []);

  const addImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const room = MAX_BOARD_IMAGES - board.length;
    if (room <= 0) {
      setNotice(`Mood board is full at ${MAX_BOARD_IMAGES} images — remove one to add another.`);
      return;
    }
    const refused: string[] = [];
    if (incoming.length > room) {
      refused.push(`${incoming.length - room} file(s) skipped — the board caps at ${MAX_BOARD_IMAGES} images.`);
    }
    for (const file of incoming.slice(0, room)) {
      if (file.size > MAX_BOARD_IMAGE_BYTES) {
        refused.push(
          `“${file.name}” is ${formatBytes(file.size)} — over the ${formatBytes(MAX_BOARD_IMAGE_BYTES)} per-image cap.`,
        );
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (!mounted.current) return;
        if (typeof reader.result === 'string') {
          const src = reader.result;
          setBoard((b) => (b.length >= MAX_BOARD_IMAGES ? b : [...b, src]));
        } else {
          setNotice(`Could not read “${file.name}” — the browser returned no image data.`);
        }
      };
      // Without this an unreadable image simply never appeared, with nothing said.
      reader.onerror = () => {
        if (!mounted.current) return;
        setNotice(`Could not read “${file.name}”: ${reader.error?.message ?? 'the file could not be read'}.`);
      };
      reader.readAsDataURL(file);
    }
    setNotice(refused.length ? refused.join(' ') : null);
  };

  const distill = async () => {
    setDistilling(true);
    setError(null);
    const res = await tryApiFetch<{ profile: StyleDnaProfile }>('/api/visual-gen/style-dna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: board, name: name.trim() || undefined }),
    });
    if (!mounted.current) return;
    setDistilling(false);
    if (!res.ok) { setError({ message: res.error, target: { kind: 'distill' } }); return; }
    setBoard([]);
    setName('');
    setActiveProfile(res.data.profile);
    setProfiles((p) => [res.data.profile, ...p.map((x) => ({ ...x, active: false }))]);
  };

  const activate = async (id: string) => {
    setError(null);
    const res = await tryApiFetch<{ active: StyleDnaProfile | null }>('/api/visual-gen/style-dna', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!mounted.current) return;
    // The retry target is THIS activation — never the paid distillation.
    if (!res.ok) { setError({ message: res.error, target: { kind: 'activate', id } }); return; }
    setActiveProfile(res.data.active);
    setProfiles((p) => p.map((x) => ({ ...x, active: x.id === id })));
  };

  /** Re-run exactly the action that failed. */
  const retry = () => {
    const target = error?.target;
    setError(null);
    if (!target) return;
    if (target.kind === 'load') void load();
    else if (target.kind === 'distill') void distill();
    else void activate(target.id);
  };

  return (
    <section className="rounded-lg border border-border bg-surface/60" data-testid="style-dna-panel">
      {/* Header row: identity + apply toggle + expand */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 flex-1 text-left"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
          <Dna size={14} className="text-[var(--visual-gen)]" />
          <span className="text-xs font-medium text-text">Project style</span>
          <span className="text-2xs text-text-muted truncate">
            {activeStyleDna ? activeStyleDna.name : 'none yet — distill one from a mood board'}
          </span>
        </button>
        {activeStyleDna && (
          <button
            type="button"
            aria-pressed={applyStyleDna}
            onClick={() => setApplyStyleDna(!applyStyleDna)}
            title={STYLE_DNA_REACH.note}
            data-testid="style-dna-toggle"
            className={`px-2.5 py-1 rounded-full text-2xs border transition-colors ${
              applyStyleDna
                ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/15 text-[var(--visual-gen)]'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {/* The label NAMES the path — the switch used to say "prompts" while reaching
                only the 3D submit. See STYLE_DNA_REACH. */}
            {applyStyleDna ? 'Applied to' : 'Apply to'} {STYLE_DNA_REACH.label}
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {error && (
            <InlineErrorRetry
              dense
              message={error.message}
              onRetry={retry}
              onDismiss={() => setError(null)}
            />
          )}

          {notice && (
            <div
              role="status"
              data-testid="style-dna-notice"
              className="flex items-start gap-1.5 rounded px-2 py-1.5 text-2xs text-amber-400 bg-amber-400/10 border border-amber-400/20"
            >
              <AlertTriangle size={12} className="mt-px shrink-0" />
              <span className="min-w-0">{notice}</span>
              <button
                type="button"
                aria-label="Dismiss notice"
                onClick={() => setNotice(null)}
                className="ml-auto shrink-0 text-text-muted hover:text-text"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {activeStyleDna && <DnaStrip dna={activeStyleDna.dna} />}

          {/* Reach, stated. The toggle is opt-in style injection into ONE path; saying which
              is the difference between a promise and a claim. */}
          <p className="text-2xs text-text-muted" data-testid="style-dna-reach">
            {STYLE_DNA_REACH.note}
          </p>

          {/* Other saved profiles */}
          {profiles.filter((p) => !p.active).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-text-muted">Other styles:</span>
              {profiles.filter((p) => !p.active).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void activate(p.id)}
                  className="px-2 py-0.5 rounded-full text-2xs border border-border text-text-muted hover:text-text hover:border-text-muted transition-colors"
                >
                  Use “{p.name}”
                </button>
              ))}
            </div>
          )}

          {/* Mood board intake */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">
              {activeStyleDna ? 'New style from a mood board' : 'Drop 2–6 images that share the look you want'}
            </label>
            <div className="flex flex-wrap gap-2">
              {board.map((src, i) => (
                <span key={src.slice(-24) + i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
                  <img src={src} alt={`mood board image ${i + 1}`} className="h-14 w-14 object-cover rounded-md border border-border" />
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() => setBoard((b) => b.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-surface border border-border p-0.5 text-text-muted hover:text-text"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-14 w-14 flex items-center justify-center rounded-md border-2 border-dashed border-border text-text-muted hover:border-[var(--visual-gen)] hover:text-text transition-colors"
                aria-label="Add mood board images"
              >
                <ImagePlus size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => { addImages(e.target.files); e.target.value = ''; }}
                className="hidden"
                data-testid="mood-board-input"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this style (e.g. Alice gothic)"
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-[var(--visual-gen)]"
            />
            <button
              type="button"
              onClick={() => void distill()}
              disabled={board.length === 0 || distilling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {distilling ? <Loader2 size={12} className="animate-spin" /> : <Dna size={12} />}
              {distilling ? 'Distilling…' : `Distill style${board.length ? ` from ${board.length} image${board.length > 1 ? 's' : ''}` : ''}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
