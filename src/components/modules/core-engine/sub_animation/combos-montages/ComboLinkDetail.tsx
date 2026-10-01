'use client';

import { useState } from 'react';
import { Wrench, X } from 'lucide-react';
import { withOpacity, OPACITY_8, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { buildComboLinkFixPrompt, type ComboLink } from '@/lib/animation/combo-links';
import { ACCENT } from '../_shared/data';
import { VERDICT_COLOR } from './useComboChains';

const sec = (v: number | undefined) => (v === undefined ? '—' : `${v.toFixed(2)}s`);

/**
 * One selected combo link: its verdict, the seconds it was derived from, the
 * target, the source asset — and, for a defective link, 'Fix in UE', which
 * dispatches one prompt only when clicked. The manifest refresh after the run
 * re-derives the link, so a fixed link turns 'chains' without a reload.
 */
export function ComboLinkDetail({ link, onClose }: { link: ComboLink; onClose: () => void }) {
  const cli = useModuleCLI({
    moduleId: 'arpg-animation',
    sessionKey: 'anim-combo-links',
    label: 'Combo link fix',
    accentColor: ACCENT,
  });
  const [sentFor, setSentFor] = useState<string | null>(null);
  const prompt = buildComboLinkFixPrompt(link);
  const color = VERDICT_COLOR[link.verdict];

  const rows: [string, string][] = [
    ['Window opens', sec(link.windowOpenSec)],
    ['Window closes', sec(link.windowCloseSec)],
    ['Window', sec(link.windowSec)],
    ['Hit', sec(link.hitSec)],
    ['Target', sec(link.targetSec)],
  ];

  return (
    <div
      data-testid="combo-link-detail"
      className="mt-3 rounded-lg border p-3 text-xs font-mono space-y-2"
      style={{ borderColor: withOpacity(color, OPACITY_30), backgroundColor: withOpacity(color, OPACITY_8) }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-bold text-sm text-text">{link.from} → {link.to}</span>
          <span className="ml-2 px-1.5 py-0.5 rounded border font-bold" style={{ color, borderColor: withOpacity(color, OPACITY_30) }}>
            {link.verdict}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close link detail" className="text-text-muted hover:text-text cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-text">{link.reason}</p>
      <dl className="grid grid-cols-5 gap-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-text-muted">{k}</dt>
            <dd className="font-bold text-text">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-text-muted break-all">
        Source: <span className="text-text">{link.montagePath}</span>
        {link.attribution === 'by-order' && <> · section window attributed by order (the manifest carries no section times)</>}
      </p>
      {prompt && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={cli.isRunning}
            onClick={() => { cli.sendPrompt(prompt, { taskType: 'combo-link-fix', label: `Fix ${link.from} → ${link.to}` }); setSentFor(link.id); }}
            className="flex items-center gap-1 px-2 py-1 rounded border font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT, backgroundColor: withOpacity(ACCENT, OPACITY_20) }}
          >
            <Wrench className="w-3 h-3" />
            {cli.isRunning ? 'Fixing…' : 'Fix in UE'}
          </button>
          {sentFor === link.id && (
            <span className="text-text-muted">Sent — this link re-derives when the manifest refreshes.</span>
          )}
        </div>
      )}
    </div>
  );
}
