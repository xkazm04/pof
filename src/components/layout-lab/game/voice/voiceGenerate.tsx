'use client';

/**
 * "Generate k takes": a delivery direction, k (1-5), the voice (default: cast, else newest candidate)
 * and the model. eleven_v3 sends the direction as audio tags; multilingual_v2 records it but delivers
 * through the voice settings only. Generation adds pending takes; it never sets a verdict.
 */
import { useState } from 'react';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton, LabTextarea } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { VoiceRow } from '@/lib/voice/types';
import { postVoice, type LineKey } from './voiceRoomData';

const MODELS = [
  { id: 'eleven_v3', label: 'eleven_v3 (direction as audio tags)' },
  { id: 'eleven_multilingual_v2', label: 'eleven_multilingual_v2 (settings only)' },
] as const;

const selectStyle = (t: LabTheme) => ({ fontSize: 'var(--lab-fs-sm)', padding: '4px 6px', border: `1px solid ${t.line}`, borderRadius: 4, background: t.panel, color: t.text });

export function VoiceGenerate({ t, line, voices, onGenerated }: {
  t: LabTheme; line: LineKey; voices: VoiceRow[]; onGenerated: () => void;
}) {
  const [direction, setDirection] = useState('');
  const [k, setK] = useState(3);
  const [voiceId, setVoiceId] = useState('');
  const [model, setModel] = useState<string>('eleven_v3');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    const r = await postVoice<{ takes: unknown[]; chars: number }>('/takes', {
      ...line, n: k, direction, voiceId: voiceId || undefined, settings: { model },
    });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `${r.data.takes.length} takes generated · ${r.data.chars} chars` });
    onGenerated();
  };

  return (
    <div data-testid="voice-generate" style={{ display: 'grid', gap: 'var(--lab-s2)', padding: 'var(--lab-s3)', border: `1px dashed ${t.line}`, borderRadius: 6 }}>
      <MicroLabel mono uppercase tone="muted">Generate takes</MicroLabel>
      <LabTextarea t={t} rows={2} value={direction} onChange={setDirection} label="Delivery direction" placeholder="whispered, panicking, fast" testId="voice-direction" />
      <div style={{ display: 'flex', gap: 'var(--lab-s3)', flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 2, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
          Takes
          <select data-testid="voice-k" value={k} onChange={(e) => setK(Number(e.target.value))} style={selectStyle(t)}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 2, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
          Voice
          <select data-testid="voice-voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} style={selectStyle(t)}>
            <option value="">cast, else newest candidate</option>
            {voices.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.source}, {v.status})</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 2, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
          Model
          <select data-testid="voice-model" value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle(t)}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <LabButton t={t} testId="voice-generate-run" disabled={busy || voices.length === 0} onClick={() => void run()}>
          {busy ? 'Generating…' : `Generate ${k} takes`}
        </LabButton>
      </div>
      {voices.length === 0 && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>No voice for this speaker yet: design one in Cast first.</span>}
      {msg && <span role={msg.ok ? 'status' : 'alert'} style={{ fontSize: 'var(--lab-fs-xs)', color: msg.ok ? t.ok : t.bad }}>{msg.text}</span>}
    </div>
  );
}
