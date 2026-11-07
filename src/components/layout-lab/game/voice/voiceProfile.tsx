'use client';

/**
 * A CAST voice's take profile (its render recipe: model, pace, stability, style). Set here by the owner's click
 * (gated with the page token, like Cast); Generate and `voice.mjs takes` default to it, and an approval is bound
 * to it: changing it un-proves the lines whose approved take was rendered with the old recipe.
 */
import { useState } from 'react';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { TakeProfile, VoiceRow } from '@/lib/voice/types';
import { postVoice, TAKE_MODELS } from './voiceRoomData';

const FIELD = { speed: [0.7, 1.2, 0.05], stability: [0, 1, 0.05], style: [0, 1, 0.05] } as const;
const DEFAULTS: TakeProfile = { model: 'eleven_v3', speed: 1, stability: 0.5, style: 0 };

export function VoiceProfile({ t, v, gate, onChanged }: { t: LabTheme; v: VoiceRow; gate: string | null; onChanged: () => void }) {
  const [p, setP] = useState<TakeProfile>(v.takeProfile ?? DEFAULTS);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (profile: TakeProfile | null) => {
    setMsg(null);
    const r = await postVoice<{ unproven: number }>('/voices/profile', { voiceId: v.id, profile }, gate);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `${profile ? 'Profile saved' : 'Profile cleared'}${r.data.unproven ? `: ${r.data.unproven} line${r.data.unproven === 1 ? '' : 's'} un-proved (approved in the old recipe)` : ''}` });
    onChanged();
  };
  const box = { fontSize: 'var(--lab-fs-sm)', padding: '4px 6px', border: `1px solid ${t.line}`, borderRadius: 4, background: t.panel, color: t.text, width: 76 } as const;
  return (
    <div data-testid="voice-profile" style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
      <MicroLabel mono uppercase tone="muted">Take profile {v.takeProfile ? '' : '(none: provider defaults)'}</MicroLabel>
      <div style={{ display: 'flex', gap: 'var(--lab-s2)', flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 2, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Model
          <select data-testid="voice-profile-model" value={p.model} onChange={(e) => setP({ ...p, model: e.target.value })} style={{ ...box, width: 'auto' }}>
            {TAKE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
          </select>
        </label>
        {(['speed', 'stability', 'style'] as const).map((k) => (
          <label key={k} style={{ display: 'grid', gap: 2, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{k}
            <input data-testid={`voice-profile-${k}`} type="number" min={FIELD[k][0]} max={FIELD[k][1]} step={FIELD[k][2]} value={p[k]}
              onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} style={box} />
          </label>
        ))}
        <LabButton t={t} testId="voice-profile-save" disabled={!gate} onClick={() => void save(p)}>Save profile</LabButton>
        {v.takeProfile && <LabButton t={t} testId="voice-profile-clear" disabled={!gate} onClick={() => void save(null)}>Clear</LabButton>}
      </div>
      {msg && <span role={msg.ok ? 'status' : 'alert'} style={{ fontSize: 'var(--lab-fs-xs)', color: msg.ok ? t.ok : t.bad }}>{msg.text}</span>}
    </div>
  );
}
