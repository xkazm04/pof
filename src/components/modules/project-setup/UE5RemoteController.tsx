'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Radio, Plug, PlugZap, Search, Send, Eye, Edit3, Play, Trash2,
  ChevronRight, ChevronDown, Copy, Check, Clock,
  Package, Layers, Terminal, RotateCcw, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ConnectionStatusBadge } from '@/components/ui/ConnectionStatusBadge';
import { ErrorBanner } from './ErrorBanner';
import { tryApiFetch } from '@/lib/api-utils';
import type { UE5ConnectionState, UE5AssetSearchResult } from '@/types/ue5-bridge';

const ACCENT = MODULE_COLORS.setup;
const API = '/api/ue5-bridge/query';

/* ── Types ────────────────────────────────────────────────────────────────── */

type TabId = 'inspector' | 'functions' | 'assets' | 'history';

interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  request: Record<string, unknown>;
  response: unknown;
  success: boolean;
  durationMs: number;
}

interface ObjectProperty {
  name: string;
  type: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

/* ── Helper: POST to the query API ───────────────────────────────────────── */

async function queryUE5<T = unknown>(body: Record<string, unknown>): Promise<{ ok: boolean; data: T; durationMs: number }> {
  const start = performance.now();
  const result = await tryApiFetch<T>(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const durationMs = Math.round(performance.now() - start);
  if (result.ok) return { ok: true, data: result.data, durationMs };
  throw Object.assign(new Error(result.error), { durationMs });
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

// StatusBadge replaced by shared ConnectionStatusBadge

function TabButton({ label, icon: Icon, active, onClick, id, controls }: {
  label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; onClick: () => void; id?: string; controls?: string;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      id={id}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
      style={{
        backgroundColor: active ? `${ACCENT}15` : 'transparent',
        color: active ? ACCENT : 'var(--text-muted)',
        border: `1px solid ${active ? `${ACCENT}40` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

function JsonViewer({ data, maxHeight }: { data: unknown; maxHeight?: string }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [text]);

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 border"
        style={{
          borderColor: copied ? `${STATUS_SUCCESS}50` : 'rgba(255,255,255,0.1)',
          backgroundColor: copied ? `${STATUS_SUCCESS}15` : 'rgba(0,0,0,0.4)',
          color: copied ? STATUS_SUCCESS : 'var(--text-muted)',
        }}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </button>
      <pre
        className="text-xs font-mono text-text-muted leading-relaxed p-2.5 bg-surface-deep rounded-lg border border-border/30 overflow-auto custom-scrollbar whitespace-pre"
        style={{ maxHeight: maxHeight ?? '300px' }}
      >
        {text}
      </pre>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, mono, className, id: externalId }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; className?: string; id?: string;
}) {
  const inputId = externalId ?? `rc-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">{label}</label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full text-xs px-2.5 py-1.5 rounded-lg bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

/* ── Object Inspector Panel ──────────────────────────────────────────────── */

function ObjectInspectorPanel({ onAddHistory }: { onAddHistory: (e: HistoryEntry) => void }) {
  const [objectPath, setObjectPath] = useState('/Game/');
  const [propertyName, setPropertyName] = useState('');
  const [writeValue, setWriteValue] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'describe' | 'read' | 'write'>('describe');
  const [properties, setProperties] = useState<ObjectProperty[]>([]);
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());

  const execute = useCallback(async () => {
    if (!objectPath.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    const entry: Partial<HistoryEntry> = { id: crypto.randomUUID(), timestamp: Date.now() };

    try {
      if (mode === 'describe') {
        entry.action = 'describeObject';
        entry.request = { action: 'describeObject', objectPath };
        const res = await queryUE5(entry.request);
        entry.response = res.data;
        entry.success = true;
        entry.durationMs = res.durationMs;
        setResult(res.data);
        // Try to extract properties from describe response
        if (res.data && typeof res.data === 'object') {
          const d = res.data as Record<string, unknown>;
          if (Array.isArray(d.properties)) {
            setProperties(d.properties as ObjectProperty[]);
          }
        }
      } else if (mode === 'read') {
        if (!propertyName.trim()) { setError('Property name is required'); setLoading(false); return; }
        entry.action = 'getProperty';
        entry.request = { action: 'getProperty', objectPath, propertyName };
        const res = await queryUE5(entry.request);
        entry.response = res.data;
        entry.success = true;
        entry.durationMs = res.durationMs;
        setResult(res.data);
      } else {
        if (!propertyName.trim()) { setError('Property name is required'); setLoading(false); return; }
        let parsedValue: unknown = writeValue;
        try { parsedValue = JSON.parse(writeValue); } catch { /* keep as string */ }
        entry.action = 'setProperty';
        entry.request = { action: 'setProperty', objectPath, propertyName, value: parsedValue };
        const res = await queryUE5(entry.request as Record<string, unknown>);
        entry.response = res.data;
        entry.success = true;
        entry.durationMs = res.durationMs;
        setResult(res.data);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const durationMs = (e as { durationMs?: number }).durationMs ?? 0;
      entry.response = { error: msg };
      entry.success = false;
      entry.durationMs = durationMs;
      setError(msg);
    } finally {
      setLoading(false);
      onAddHistory(entry as HistoryEntry);
    }
  }, [objectPath, propertyName, writeValue, mode, onAddHistory]);

  const toggleProp = useCallback((name: string) => {
    setExpandedProps((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      <InputField label="Object Path" value={objectPath} onChange={setObjectPath} placeholder="/Game/Blueprints/BP_MyActor.BP_MyActor_C" mono />

      {/* Mode selector */}
      <div className="flex gap-1.5">
        {([
          { id: 'describe' as const, label: 'Describe', icon: Eye, color: ACCENT_CYAN },
          { id: 'read' as const, label: 'Read Property', icon: Search, color: ACCENT_EMERALD },
          { id: 'write' as const, label: 'Write Property', icon: Edit3, color: ACCENT_ORANGE },
        ]).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors"
            style={{
              borderColor: mode === m.id ? `${m.color}50` : 'rgba(255,255,255,0.08)',
              backgroundColor: mode === m.id ? `${m.color}15` : 'transparent',
              color: mode === m.id ? m.color : 'var(--text-muted)',
            }}
          >
            <m.icon className="w-3 h-3" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Property fields */}
      {(mode === 'read' || mode === 'write') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <InputField label="Property Name" value={propertyName} onChange={setPropertyName} placeholder="MaxHealth" mono />
          {mode === 'write' && (
            <InputField label="Value (JSON or string)" value={writeValue} onChange={setWriteValue} placeholder='100 or {"X":1,"Y":2}' mono />
          )}
        </div>
      )}

      {/* Execute button */}
      <button
        onClick={execute}
        disabled={loading || !objectPath.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40"
        style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}15`, color: ACCENT }}
      >
        {loading ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        {mode === 'describe' ? 'Describe Object' : mode === 'read' ? 'Read Property' : 'Write Property'}
      </button>

      {error && <ErrorBanner message={error} />}

      {/* Properties list from describe */}
      {properties.length > 0 && mode === 'describe' && (
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Properties ({properties.length})</div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
            {properties.map((p) => (
              <div key={p.name} className="rounded-lg border border-border/20 overflow-hidden">
                <button
                  onClick={() => {
                    toggleProp(p.name);
                    setPropertyName(p.name);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-surface/30 transition-colors text-left"
                >
                  {expandedProps.has(p.name) ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
                  <span className="font-mono font-bold text-text">{p.name}</span>
                  <span className="font-mono text-text-muted/60">{p.type}</span>
                </button>
                {expandedProps.has(p.name) && (
                  <div className="px-3 pb-2">
                    <JsonViewer data={p} maxHeight="120px" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result !== null && (
        <div>
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Response</div>
          <JsonViewer data={result} />
        </div>
      )}
    </div>
  );
}

/* ── Function Caller Panel ───────────────────────────────────────────────── */

function FunctionCallerPanel({ onAddHistory }: { onAddHistory: (e: HistoryEntry) => void }) {
  const [objectPath, setObjectPath] = useState('/Game/');
  const [functionName, setFunctionName] = useState('');
  const [parametersJson, setParametersJson] = useState('{}');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async () => {
    if (!objectPath.trim() || !functionName.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    let params: Record<string, unknown> = {};
    try { params = JSON.parse(parametersJson); } catch { setError('Invalid JSON parameters'); setLoading(false); return; }

    const entry: Partial<HistoryEntry> = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'callFunction',
      request: { action: 'callFunction', objectPath, functionName, parameters: params },
    };

    try {
      const res = await queryUE5(entry.request as Record<string, unknown>);
      entry.response = res.data;
      entry.success = true;
      entry.durationMs = res.durationMs;
      setResult(res.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const durationMs = (e as { durationMs?: number }).durationMs ?? 0;
      entry.response = { error: msg };
      entry.success = false;
      entry.durationMs = durationMs;
      setError(msg);
    } finally {
      setLoading(false);
      onAddHistory(entry as HistoryEntry);
    }
  }, [objectPath, functionName, parametersJson, onAddHistory]);

  // Quick presets for common UE5 functions
  const PRESETS = useMemo(() => [
    { label: 'Get Actor Location', path: '/Game/', func: 'K2_GetActorLocation', params: '{}' },
    { label: 'Set Actor Location', path: '/Game/', func: 'K2_SetActorLocation', params: '{"NewLocation":{"X":0,"Y":0,"Z":100},"bSweep":false,"bTeleport":true}' },
    { label: 'Get World', path: '/Script/Engine.Default__KismetSystemLibrary', func: 'GetEngineSubsystem', params: '{}' },
  ], []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <InputField label="Object Path" value={objectPath} onChange={setObjectPath} placeholder="/Game/Blueprints/BP_MyActor.BP_MyActor_C" mono />
        <InputField label="Function Name" value={functionName} onChange={setFunctionName} placeholder="K2_GetActorLocation" mono />
      </div>

      <div>
        <label htmlFor="rc-fn-params" className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Parameters (JSON)</label>
        <textarea
          id="rc-fn-params"
          value={parametersJson}
          onChange={(e) => setParametersJson(e.target.value)}
          className="w-full h-20 text-xs font-mono bg-surface-deep border border-border/40 rounded-lg p-2.5 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50 resize-none custom-scrollbar"
          placeholder='{"ParamName": "value"}'
        />
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-text-muted font-bold mr-1 self-center">Presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => { setObjectPath(p.path); setFunctionName(p.func); setParametersJson(p.params); }}
            className="px-2 py-1 rounded text-xs font-mono border border-border/30 text-text-muted hover:text-text hover:border-border/60 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        onClick={execute}
        disabled={loading || !objectPath.trim() || !functionName.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40"
        style={{ borderColor: `${ACCENT_VIOLET}40`, backgroundColor: `${ACCENT_VIOLET}15`, color: ACCENT_VIOLET }}
      >
        {loading ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
        Call Function
      </button>

      {error && <ErrorBanner message={error} />}

      {result !== null && (
        <div>
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Response</div>
          <JsonViewer data={result} />
        </div>
      )}
    </div>
  );
}

/* ── Asset Search Panel ──────────────────────────────────────────────────── */

function AssetSearchPanel({ onAddHistory }: { onAddHistory: (e: HistoryEntry) => void }) {
  const [query, setQuery] = useState('');
  const [className, setClassName] = useState('');
  const [results, setResults] = useState<UE5AssetSearchResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const CLASS_PRESETS = ['Blueprint', 'MaterialInstanceConstant', 'AnimSequence', 'DataTable', 'StaticMesh', 'SkeletalMesh', 'Texture2D'];

  const execute = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);

    const req: Record<string, unknown> = { action: 'searchAssets', query };
    if (className.trim()) req.className = className;

    const entry: Partial<HistoryEntry> = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'searchAssets',
      request: req,
    };

    try {
      const res = await queryUE5<UE5AssetSearchResult[]>(req);
      entry.response = res.data;
      entry.success = true;
      entry.durationMs = res.durationMs;
      setResults(res.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const durationMs = (e as { durationMs?: number }).durationMs ?? 0;
      entry.response = { error: msg };
      entry.success = false;
      entry.durationMs = durationMs;
      setError(msg);
    } finally {
      setLoading(false);
      onAddHistory(entry as HistoryEntry);
    }
  }, [query, className, onAddHistory]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <InputField label="Search Query" value={query} onChange={setQuery} placeholder="BP_Player" mono />
        <InputField label="Class Filter (optional)" value={className} onChange={setClassName} placeholder="Blueprint" mono />
      </div>

      {/* Class presets */}
      <div className="flex flex-wrap gap-1">
        {CLASS_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => setClassName(c === className ? '' : c)}
            className="px-1.5 py-0.5 rounded text-xs font-mono transition-colors"
            style={{
              backgroundColor: className === c ? `${ACCENT_CYAN}15` : 'transparent',
              color: className === c ? ACCENT_CYAN : 'var(--text-muted)',
              border: `1px solid ${className === c ? `${ACCENT_CYAN}40` : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <button
        onClick={execute}
        disabled={loading || !query.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40"
        style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}15`, color: ACCENT_EMERALD }}
      >
        {loading ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        Search Assets
      </button>

      {error && <ErrorBanner message={error} />}

      {results.length > 0 && (
        <div>
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
            Results ({results.length})
          </div>
          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-0.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/20 hover:bg-surface/30 transition-colors">
                <Package className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT_CYAN }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-bold text-text truncate">{r.assetName}</div>
                  <div className="text-xs font-mono text-text-muted/60 truncate">{r.assetPath}</div>
                </div>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border/30 text-text-muted flex-shrink-0">{r.assetClass}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── History Panel ────────────────────────────────────────────────────────── */

function HistoryPanel({ history, onClear, onReplay }: {
  history: HistoryEntry[];
  onClear: () => void;
  onReplay: (entry: HistoryEntry) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Terminal className="w-8 h-8 opacity-30 mb-2" />
        <p className="text-xs">No commands executed yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-muted">{history.length} commands</span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition-colors"
          style={{ borderColor: `${STATUS_ERROR}30`, color: STATUS_ERROR }}
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
        {history.map((entry) => {
          const isExpanded = expandedId === entry.id;
          const time = new Date(entry.timestamp);
          return (
            <div key={entry.id} className="rounded-lg border border-border/20 overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                aria-expanded={isExpanded}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-surface/30 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.success ? STATUS_SUCCESS : STATUS_ERROR }} />
                <span className="font-mono font-bold text-text">{entry.action}</span>
                <span className="font-mono text-text-muted/50 ml-auto flex-shrink-0 flex items-center gap-2">
                  <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{entry.durationMs}ms</span>
                  <span>{time.toLocaleTimeString()}</span>
                </span>
                {isExpanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-2.5 pb-2.5 space-y-2">
                      <div>
                        <div className="text-xs font-bold text-text-muted mb-1">Request</div>
                        <JsonViewer data={entry.request} maxHeight="120px" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text-muted mb-1">Response</div>
                        <JsonViewer data={entry.response} maxHeight="180px" />
                      </div>
                      <button
                        onClick={() => onReplay(entry)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition-colors"
                        style={{ borderColor: `${ACCENT_VIOLET}30`, color: ACCENT_VIOLET }}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Replay
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function UE5RemoteController() {
  const [connState, setConnState] = useState<UE5ConnectionState>({
    status: 'disconnected', info: null, error: null, lastConnected: null, reconnectAttempts: 0,
  });
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('30010');
  const [activeTab, setActiveTab] = useState<TabId>('inspector');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Connection ──

  const fetchState = useCallback(async () => {
    const res = await tryApiFetch<UE5ConnectionState>(API);
    if (res.ok) setConnState(res.data);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await tryApiFetch<UE5ConnectionState>(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', host, httpPort: parseInt(port, 10) }),
      });
      if (res.ok) setConnState(res.data);
    } finally {
      setConnecting(false);
    }
  }, [host, port]);

  const disconnect = useCallback(async () => {
    const res = await tryApiFetch<UE5ConnectionState>(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect', reason: 'User disconnected' }),
    });
    if (res.ok) setConnState(res.data);
  }, []);

  // Poll connection state periodically when connected
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchState, 5000);
  }, [fetchState]);

  // Check initial state on mount
  const initDone = useRef(false);
  if (!initDone.current) {
    initDone.current = true;
    fetchState();
  }

  // ── History ──

  const addHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const isConnected = connState.status === 'connected';

  const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'inspector', label: 'Inspector', icon: Eye },
    { id: 'functions', label: 'Functions', icon: Play },
    { id: 'assets', label: 'Assets', icon: Package },
    { id: 'history', label: `History (${history.length})`, icon: Clock },
  ];

  return (
    <SurfaceCard className="overflow-hidden" role="region" aria-label="UE5 Remote Controller">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
            <Radio className="w-4 h-4 relative z-10" style={{ color: ACCENT }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text">UE5 Remote Controller</h3>
              <ConnectionStatusBadge status={connState.status} />
            </div>
            <p className="text-xs text-text-muted">
              Read/write UObject properties, invoke UFUNCTIONs, and search project assets remotely
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg border border-border/30 text-text-muted hover:text-text transition-colors"
          >
            {showSettings ? <X className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Connection settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-end gap-2 mt-3 pt-3 border-t border-border/30">
                <InputField label="Host" value={host} onChange={setHost} placeholder="127.0.0.1" mono className="w-40" />
                <InputField label="Port" value={port} onChange={setPort} placeholder="30010" mono className="w-24" />
                {!isConnected ? (
                  <button
                    onClick={() => { connect(); startPolling(); }}
                    disabled={connecting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors mb-0.5"
                    style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}15`, color: ACCENT_EMERALD }}
                  >
                    {connecting ? <RotateCcw className="w-3 h-3 animate-spin" /> : <PlugZap className="w-3 h-3" />}
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={() => { disconnect(); if (pollRef.current) clearInterval(pollRef.current); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors mb-0.5"
                    style={{ borderColor: `${STATUS_ERROR}40`, backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR }}
                  >
                    <Plug className="w-3 h-3" />
                    Disconnect
                  </button>
                )}
              </div>
              {connState.error && <ErrorBanner message={connState.error} className="mt-2" />}
              {connState.info && (
                <div className="flex items-center gap-3 mt-2 text-xs font-mono text-text-muted">
                  <span>Server: <span className="font-bold text-text">{connState.info.serverName}</span></span>
                  <span>Version: <span className="font-bold text-text">{connState.info.version}</span></span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 px-4 py-2 border-b border-border/30 overflow-x-auto custom-scrollbar" role="tablist" aria-label="Remote controller tabs">
        {TABS.map((t) => (
          <TabButton key={t.id} label={t.label} icon={t.icon} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} id={`rc-tab-${t.id}`} controls={`rc-tabpanel-${t.id}`} />
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className="p-4" role="tabpanel" id={`rc-tabpanel-${activeTab}`} aria-labelledby={`rc-tab-${activeTab}`}>
        {!isConnected && activeTab !== 'history' ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <Plug className="w-8 h-8 opacity-30 mb-3" />
            <p className="text-xs font-medium mb-1">Not connected to UE5 Remote Control</p>
            <p className="text-xs opacity-60 mb-3">Enable the Web Remote Control plugin in UE5 Editor Preferences</p>
            <button
              onClick={() => { setShowSettings(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors"
              style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}10`, color: ACCENT }}
            >
              <Layers className="w-3 h-3" />
              Show Connection Settings
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'inspector' && <ObjectInspectorPanel onAddHistory={addHistory} />}
              {activeTab === 'functions' && <FunctionCallerPanel onAddHistory={addHistory} />}
              {activeTab === 'assets' && <AssetSearchPanel onAddHistory={addHistory} />}
              {activeTab === 'history' && <HistoryPanel history={history} onClear={clearHistory} onReplay={() => {}} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </SurfaceCard>
  );
}
