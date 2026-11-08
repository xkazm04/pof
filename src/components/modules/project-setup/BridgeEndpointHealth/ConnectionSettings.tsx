import { useState } from 'react';
import {
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_8,
} from '@/lib/chart-colors';

const PORT_MIN = 1024;
const PORT_MAX = 65535;

interface PortInputProps {
  id: string;
  testId: string;
  value: number;
  onCommit: (v: number) => void;
}

/** A port field that edits a draft and commits once, on blur, when the draft is a whole in-range port. */
function PortInput({ id, testId, value, onCommit }: PortInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && /^\d+$/.test(draft.trim())) {
      const v = parseInt(draft, 10);
      if (v >= PORT_MIN && v <= PORT_MAX && v !== value) onCommit(v);
    }
    setDraft(null);
  };
  return (
    <input
      id={id}
      type="number"
      min={PORT_MIN}
      max={PORT_MAX}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text focus:outline-none focus:border-[color:var(--focus-border)]"
      data-testid={testId}
    />
  );
}

interface ConnectionSettingsProps {
  host: string;
  setHost: (v: string) => void;
  pofPort: number;
  setPofPort: (v: number) => void;
  rcPort: number;
  setRcPort: (v: number) => void;
}

export function ConnectionSettings({
  host, setHost, pofPort, setPofPort, rcPort, setRcPort,
}: ConnectionSettingsProps) {
  return (
    <div className="px-4 py-3 border-b border-border/40 space-y-3" style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_8}` }} data-testid="bridge-connection-settings">
      {/* Host */}
      <div className="flex items-center gap-3">
        <label htmlFor="beh-host" className="text-xs font-bold text-text-muted uppercase tracking-wider w-20 shrink-0">Host</label>
        <input
          id="beh-host"
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="flex-1 px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text focus:outline-none focus:border-[color:var(--focus-border)]"
          placeholder="127.0.0.1"
          data-testid="bridge-host-input"
        />
      </div>

      {/* Two-port row */}
      <div className="grid grid-cols-2 gap-3">
        {/* PoF Bridge Port */}
        <div className="space-y-1" data-testid="bridge-pof-port-field">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACCENT_EMERALD }} />
            <label htmlFor="beh-pof-port" className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT_EMERALD }}>
              PoF Bridge Port
            </label>
          </div>
          <PortInput id="beh-pof-port" testId="bridge-pof-port-input" value={pofPort} onCommit={setPofPort} />
          <p className="text-2xs text-text-muted">
            PofHttpServer &mdash; serves <span className="font-mono text-text">/pof/*</span> routes (default: 30040)
          </p>
        </div>

        {/* Remote Control Port */}
        <div className="space-y-1" data-testid="bridge-rc-port-field">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACCENT_CYAN }} />
            <label htmlFor="beh-rc-port" className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT_CYAN }}>
              Remote Control Port
            </label>
          </div>
          <PortInput id="beh-rc-port" testId="bridge-rc-port-input" value={rcPort} onCommit={setRcPort} />
          <p className="text-2xs text-text-muted">
            UE5 Web Remote Control &mdash; serves <span className="font-mono text-text">/remote/*</span> routes (default: 30010)
          </p>
        </div>
      </div>
    </div>
  );
}
