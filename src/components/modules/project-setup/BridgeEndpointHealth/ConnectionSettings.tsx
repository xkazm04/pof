import {
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_8,
} from '@/lib/chart-colors';

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
          <input
            id="beh-pof-port"
            type="number"
            min={1024}
            max={65535}
            value={pofPort}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 65535) setPofPort(v);
            }}
            className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text focus:outline-none focus:border-[color:var(--focus-border)]"
            data-testid="bridge-pof-port-input"
          />
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
          <input
            id="beh-rc-port"
            type="number"
            min={1024}
            max={65535}
            value={rcPort}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 65535) setRcPort(v);
            }}
            className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text focus:outline-none focus:border-[color:var(--focus-border)]"
            data-testid="bridge-rc-port-input"
          />
          <p className="text-2xs text-text-muted">
            UE5 Web Remote Control &mdash; serves <span className="font-mono text-text">/remote/*</span> routes (default: 30010)
          </p>
        </div>
      </div>
    </div>
  );
}
