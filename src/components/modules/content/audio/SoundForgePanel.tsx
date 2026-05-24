'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { LicenseBadge } from './LicenseBadge';
import { AUDIO_PROVIDERS } from '@/lib/audio-gen/registry';
import { MODULE_COLORS } from '@/lib/constants';
import type { AudioKind } from '@/lib/audio-gen/types';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

export function SoundForgePanel({ onAssetCreated }: { onAssetCreated?: () => void }) {
  const [providerId, setProviderId] = useState('elevenlabs');
  const [kind, setKind] = useState<AudioKind>('sfx');
  const [prompt, setPrompt] = useState('footstep on stone, short, dry, no reverb');
  const [duration, setDuration] = useState(1.5);
  const [variations, setVariations] = useState(3);
  const [setName, setSetName] = useState('footstep-stone');
  const [eventKey, setEventKey] = useState('footstep');
  const [surface, setSurface] = useState('stone');
  const [loop, setLoop] = useState(false);
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState<Array<{ asset: AudioAsset; set: AudioSet }>>([]);
  const [error, setError] = useState<string | null>(null);

  const provider = AUDIO_PROVIDERS[providerId];
  const license = provider?.commercialLicense[kind] ?? 'non-commercial';

  async function handleGenerate() {
    setRunning(true);
    setError(null);
    setGenerated([]);
    let setId: string | undefined;
    try {
      for (let i = 0; i < variations; i++) {
        const res = await apiFetch<{ asset: AudioAsset; set: AudioSet }>('/api/audio-gen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: providerId, kind, prompt: `${prompt} (variation ${i + 1})`,
            durationSeconds: duration > 0 ? duration : undefined,
            loop, setId, setName, eventKey, surface,
          }),
        });
        setId = res.set.id;
        setGenerated((g) => [...g, res]);
      }
      onAssetCreated?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      logger.warn('sound-forge generate failed', { msg });
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4 p-5 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold text-text">Sound Forge</h3>
        <LicenseBadge license={license} kind={kind} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Provider">
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text">
            {Object.values(AUDIO_PROVIDERS).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value as AudioKind)}
                  className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text">
            {(['sfx', 'ambient'] as AudioKind[]).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Prompt">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                  className="w-full px-3 py-2 bg-surface-deep border border-border rounded text-xs text-text" />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Duration (s, 0=auto)">
          <input type="number" step={0.5} min={0} max={22} value={duration}
                 onChange={(e) => setDuration(Number(e.target.value))}
                 className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text" />
        </Field>
        <Field label="Variations">
          <input type="number" min={1} max={6} value={variations}
                 onChange={(e) => setVariations(Math.max(1, Math.min(6, Number(e.target.value))))}
                 className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text" />
        </Field>
        <Field label="Loopable (ambient)">
          <label className="flex items-center gap-2 text-xs text-text-muted-hover py-1.5">
            <input type="checkbox" checked={loop} disabled={kind !== 'ambient'} onChange={(e) => setLoop(e.target.checked)} /> loop
          </label>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Set name"><input value={setName} onChange={(e) => setSetName(e.target.value)} className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text" /></Field>
        <Field label="Event key"><input value={eventKey} onChange={(e) => setEventKey(e.target.value)} className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text" /></Field>
        <Field label="Surface"><input value={surface} onChange={(e) => setSurface(e.target.value)} className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text" /></Field>
      </div>

      <button onClick={handleGenerate} disabled={running || !prompt || !setName}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ backgroundColor: `${MODULE_COLORS.content}15`, color: MODULE_COLORS.content, border: `1px solid ${MODULE_COLORS.content}30` }}>
        {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
        {running ? `Generating ${generated.length + 1}/${variations}…` : `Generate ${variations} variation(s)`}
      </button>

      {error && <div className="text-2xs text-red-400">{error}</div>}

      {generated.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-2xs text-text-muted">Generated into set &quot;{generated[0]?.set.name}&quot; ({generated[0]?.set.id.slice(0, 8)})</p>
          {generated.map(({ asset }) => (
            <div key={asset.id} className="flex items-center gap-3 p-2 rounded bg-surface-deep border border-border">
              <span className="text-2xs text-text-muted truncate">{asset.filename}</span>
              <audio controls src={`/api/audio-asset?relPath=${encodeURIComponent(asset.relPath)}`} className="ml-auto h-7" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-2xs uppercase tracking-wider text-text-muted mb-1 font-semibold">{label}</label>
      {children}
    </div>
  );
}
