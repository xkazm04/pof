'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Palette, Play, Pause, RotateCcw, Download, Copy, Check } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';

// ── Types ──────────────────────────────────────────────────────────────────

interface RGBA { r: number; g: number; b: number; a: number }

interface HudTheme {
  // Health bar
  healthyColor: RGBA;
  dangerColor: RGBA;
  manaColor: RGBA;
  lowHealthThreshold: number;   // 0-1
  lowHealthPulseSpeed: number;  // Hz
  barInterpSpeed: number;       // units/s

  // Damage numbers
  elementColors: Record<string, RGBA>;
  normalFontSize: number;       // pt
  critFontSize: number;         // pt
  floatDistance: number;         // px
  horizontalSpread: number;     // px
  damageLifetime: number;       // seconds

  // Enemy health bar
  fadeInDuration: number;       // seconds
  fadeOutDuration: number;      // seconds
  fadeOutDelay: number;         // seconds
  enemyBarColor: RGBA;
}

// ── Defaults (matching C++ UPROPERTYs) ─────────────────────────────────────

const DEFAULT_THEME: HudTheme = {
  healthyColor:       { r: 0.1, g: 0.8, b: 0.1, a: 1.0 },
  dangerColor:        { r: 0.9, g: 0.1, b: 0.1, a: 1.0 },
  manaColor:          { r: 0.2, g: 0.3, b: 1.0, a: 1.0 },
  lowHealthThreshold: 0.25,
  lowHealthPulseSpeed: 2.0,
  barInterpSpeed:     10.0,

  elementColors: {
    Physical:  { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    Fire:      { r: 1.0, g: 0.3, b: 0.1, a: 1.0 },
    Ice:       { r: 0.3, g: 0.6, b: 1.0, a: 1.0 },
    Lightning: { r: 1.0, g: 1.0, b: 0.2, a: 1.0 },
    Heal:      { r: 0.2, g: 1.0, b: 0.3, a: 1.0 },
  },
  normalFontSize:    18,
  critFontSize:      26,
  floatDistance:      80,
  horizontalSpread:  30,
  damageLifetime:    1.0,

  fadeInDuration:    0.2,
  fadeOutDuration:   0.5,
  fadeOutDelay:      3.0,
  enemyBarColor:     { r: 0.8, g: 0.1, b: 0.1, a: 1.0 },
};

// ── Utility ────────────────────────────────────────────────────────────────

function rgbaToCSS(c: RGBA): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
}

function rgbaToHex(c: RGBA): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function hexToRGBA(hex: string): RGBA {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b, a: 1.0 };
}

function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function fmtLinearColor(c: RGBA): string {
  return `FLinearColor(${c.r.toFixed(2)}f, ${c.g.toFixed(2)}f, ${c.b.toFixed(2)}f, ${c.a.toFixed(2)}f)`;
}

// ── Animation hook ─────────────────────────────────────────────────────────

function useAnimationLoop(active: boolean): number {
  const [time, setTime] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      setTime((now - startRef.current) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return time;
}

// ── Damage number data for the combat sim ──────────────────────────────────

interface DamageEvent {
  id: number;
  amount: number;
  element: string;
  isCrit: boolean;
  isHeal: boolean;
  spawnTime: number;
  offsetX: number; // random horizontal offset
}

// Scripted combat sequence — repeats every CYCLE_DURATION seconds
const CYCLE_DURATION = 8.0;

function getCombatEvents(time: number, theme: HudTheme): {
  playerHealth: number;
  enemyHealth: number;
  damageEvents: DamageEvent[];
} {
  const t = time % CYCLE_DURATION;
  const events: DamageEvent[] = [];
  let nextId = Math.floor(time / CYCLE_DURATION) * 100;

  // Player health timeline: starts 100%, takes damage, heals, takes more
  let playerHealth: number;
  if (t < 1.0) playerHealth = 1.0;
  else if (t < 2.0) playerHealth = lerpNum(1.0, 0.6, (t - 1.0));
  else if (t < 3.0) playerHealth = 0.6;
  else if (t < 4.0) playerHealth = lerpNum(0.6, 0.15, (t - 3.0));
  else if (t < 5.5) playerHealth = 0.15; // low-health pulse zone
  else if (t < 6.5) playerHealth = lerpNum(0.15, 0.7, (t - 5.5));
  else playerHealth = 0.7;

  // Enemy health timeline: takes hits from player
  let enemyHealth: number;
  if (t < 0.5) enemyHealth = 1.0;
  else if (t < 1.5) enemyHealth = lerpNum(1.0, 0.75, (t - 0.5));
  else if (t < 3.0) enemyHealth = lerpNum(0.75, 0.4, (t - 1.5) / 1.5);
  else if (t < 5.0) enemyHealth = lerpNum(0.4, 0.1, (t - 3.0) / 2.0);
  else if (t < 6.0) enemyHealth = lerpNum(0.1, 0.0, (t - 5.0));
  else enemyHealth = 0;

  // Spawn damage numbers at scripted times
  const hitTimes: Array<{ time: number; amount: number; element: string; isCrit: boolean; isHeal: boolean }> = [
    { time: 0.5, amount: 247, element: 'Physical', isCrit: false, isHeal: false },
    { time: 1.2, amount: 892, element: 'Fire',     isCrit: true,  isHeal: false },
    { time: 2.0, amount: 156, element: 'Ice',      isCrit: false, isHeal: false },
    { time: 2.8, amount: 1203, element: 'Lightning', isCrit: true, isHeal: false },
    { time: 3.5, amount: 310, element: 'Physical', isCrit: false, isHeal: false },
    { time: 4.2, amount: 567, element: 'Fire',     isCrit: false, isHeal: false },
    { time: 5.0, amount: 728, element: 'Ice',      isCrit: true,  isHeal: false },
    { time: 5.6, amount: 200, element: 'Heal',     isCrit: false, isHeal: true },
    { time: 6.2, amount: 350, element: 'Heal',     isCrit: false, isHeal: true },
  ];

  // Seeded pseudo-random for consistent offsets
  const seededRand = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (const hit of hitTimes) {
    const age = t - hit.time;
    if (age >= 0 && age < theme.damageLifetime) {
      events.push({
        id: nextId++,
        amount: hit.amount,
        element: hit.element,
        isCrit: hit.isCrit,
        isHeal: hit.isHeal,
        spawnTime: hit.time,
        offsetX: (seededRand(hit.time * 7.1) - 0.5) * 2 * theme.horizontalSpread,
      });
    }
  }

  return { playerHealth, enemyHealth, damageEvents: events };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ColorPickerField({ label, value, onChange }: {
  label: string;
  value: RGBA;
  onChange: (c: RGBA) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={rgbaToHex(value)}
        onChange={(e) => onChange(hexToRGBA(e.target.value))}
        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent shrink-0"
      />
      <span className="text-2xs text-text-muted flex-1 truncate">{label}</span>
      <span className="text-2xs font-mono text-text-muted shrink-0">{rgbaToHex(value).toUpperCase()}</span>
    </div>
  );
}

function SliderField({ label, value, min, max, step, unit, onChange, color }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-text-muted">{label}</span>
        <span className="text-2xs font-mono font-bold" style={{ color: color || 'var(--text)' }}>
          {Number.isInteger(step) || step >= 1 ? value : value.toFixed(1)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-border cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer"
        style={{ accentColor: color || ACCENT_CYAN }}
      />
    </div>
  );
}

// ── Live preview scene ─────────────────────────────────────────────────────

function LivePreviewScene({ theme, time }: { theme: HudTheme; time: number }) {
  const { playerHealth, enemyHealth, damageEvents } = getCombatEvents(time, theme);

  const isLow = playerHealth < theme.lowHealthThreshold && playerHealth > 0;
  const pulseAlpha = isLow
    ? (Math.sin(time * theme.lowHealthPulseSpeed * 2 * Math.PI) + 1) * 0.5
    : 1;
  const healthBarColor = isLow
    ? lerpColor(theme.dangerColor, theme.healthyColor, pulseAlpha)
    : theme.healthyColor;

  // Enemy bar fade state
  const cycleT = time % CYCLE_DURATION;
  // Enemy bar visible after first hit (t=0.5) and stays until enemy dies
  const enemyBarVisible = cycleT >= 0.5 && cycleT < 6.0 + theme.fadeOutDuration;
  const enemyFadeIn = cycleT >= 0.5 && cycleT < 0.5 + theme.fadeInDuration;
  const enemyFadeOut = cycleT >= 6.0 && cycleT < 6.0 + theme.fadeOutDuration;
  let enemyBarAlpha = 1;
  if (enemyFadeIn) enemyBarAlpha = clamp((cycleT - 0.5) / theme.fadeInDuration, 0, 1);
  else if (enemyFadeOut) enemyBarAlpha = clamp(1 - (cycleT - 6.0) / theme.fadeOutDuration, 0, 1);
  else if (!enemyBarVisible) enemyBarAlpha = 0;

  const healthCSS = rgbaToCSS(healthBarColor);
  const manaCSS = rgbaToCSS(theme.manaColor);
  const enemyCSS = rgbaToCSS(theme.enemyBarColor);

  return (
    <div className="relative w-full h-[240px] bg-black/60 rounded-lg border border-border/40 overflow-hidden select-none">
      {/* Background grid to suggest a game viewport */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* ── Player HUD (bottom-left) ── */}
      <div className="absolute bottom-4 left-4 right-4 space-y-1.5">
        {/* Health bar */}
        <div className="flex items-center gap-2">
          <span className="text-2xs font-bold text-text-muted w-7 shrink-0">HP</span>
          <div className="relative flex-1 h-5 rounded bg-black/70 border border-border/50 overflow-hidden">
            <div
              className="h-full rounded transition-[width] duration-150"
              style={{
                width: `${playerHealth * 100}%`,
                backgroundColor: healthCSS,
                boxShadow: isLow ? `0 0 10px ${healthCSS}, inset 0 0 6px ${healthCSS}` : 'none',
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {Math.round(playerHealth * 100)}%
            </span>
          </div>
        </div>

        {/* Mana bar */}
        <div className="flex items-center gap-2">
          <span className="text-2xs font-bold text-text-muted w-7 shrink-0">MP</span>
          <div className="relative flex-1 h-3.5 rounded bg-black/70 border border-border/50 overflow-hidden">
            <div
              className="h-full rounded"
              style={{
                width: '72%',
                backgroundColor: manaCSS,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Low-health vignette overlay ── */}
      {isLow && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            boxShadow: `inset 0 0 60px ${rgbaToCSS({ ...theme.dangerColor, a: 0.3 * (1 - pulseAlpha) })}`,
          }}
        />
      )}

      {/* ── Enemy health bar (top-center) ── */}
      {enemyBarAlpha > 0 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 w-40 space-y-0.5"
          style={{ opacity: enemyBarAlpha }}
        >
          <div className="text-center text-[11px] font-bold text-text-muted uppercase tracking-wider">
            Enemy Target
          </div>
          <div className="relative h-3 rounded bg-black/70 border border-border/50 overflow-hidden">
            <div
              className="h-full rounded transition-[width] duration-200"
              style={{
                width: `${Math.max(0, enemyHealth) * 100}%`,
                backgroundColor: enemyCSS,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Floating damage numbers ── */}
      {damageEvents.map((evt) => {
        const age = (time % CYCLE_DURATION) - evt.spawnTime;
        const progress = clamp(age / theme.damageLifetime, 0, 1);
        const floatY = progress * theme.floatDistance;
        // Fade: 100% for first 40%, then linear to 0%
        const fadeAlpha = progress < 0.4 ? 1 : clamp(1 - (progress - 0.4) / 0.6, 0, 1);
        const scale = evt.isCrit ? 1.15 : 1.0;

        const elemColor = theme.elementColors[evt.element] || theme.elementColors.Physical;
        const fontSize = evt.isCrit ? theme.critFontSize : theme.normalFontSize;
        const text = evt.isHeal
          ? `+${evt.amount}`
          : evt.isCrit
            ? `CRIT! ${evt.amount}`
            : `${evt.amount}`;

        return (
          <div
            key={evt.id}
            className="absolute font-bold pointer-events-none whitespace-nowrap"
            style={{
              left: `calc(50% + ${evt.offsetX}px)`,
              top: `calc(40% - ${floatY}px)`,
              transform: `translateX(-50%) scale(${scale})`,
              opacity: fadeAlpha,
              fontSize: `${fontSize}px`,
              color: rgbaToCSS(elemColor),
              textShadow: `0 1px 4px rgba(0,0,0,0.8), 0 0 8px ${rgbaToCSS({ ...elemColor, a: 0.4 })}`,
              lineHeight: 1,
            }}
          >
            {text}
          </div>
        );
      })}

      {/* ── Time indicator ── */}
      <div className="absolute top-2 right-2 text-[11px] font-mono text-text-muted/50">
        {(time % CYCLE_DURATION).toFixed(1)}s / {CYCLE_DURATION}s
      </div>
    </div>
  );
}

// ── UE5 Export generator ───────────────────────────────────────────────────

function generateUE5Config(theme: HudTheme): string {
  const lines: string[] = [];
  lines.push('// ══════════════════════════════════════════════════════════════════════');
  lines.push('// UMG HUD Theme Configuration — generated by PoF HUD Theme Editor');
  lines.push('// Copy these values into your UE5 C++ UPROPERTY defaults or Blueprint.');
  lines.push('// ══════════════════════════════════════════════════════════════════════');
  lines.push('');

  lines.push('// ── ARPGHUDWidget — Player Health Bar ──────────────────────────────');
  lines.push(`UPROPERTY(EditAnywhere, Category = "HUD|Health")`);
  lines.push(`FLinearColor HealthBarColor = ${fmtLinearColor(theme.healthyColor)};`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "HUD|Health")`);
  lines.push(`FLinearColor LowHealthColor = ${fmtLinearColor(theme.dangerColor)};`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "HUD|Health")`);
  lines.push(`float LowHealthThreshold = ${theme.lowHealthThreshold.toFixed(2)}f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "HUD|Health")`);
  lines.push(`float LowHealthPulseSpeed = ${theme.lowHealthPulseSpeed.toFixed(1)}f;`);
  lines.push('');

  lines.push('// ── ARPGHUDWidget — Mana Bar ──────────────────────────────────────');
  lines.push(`UPROPERTY(EditAnywhere, Category = "HUD|Mana")`);
  lines.push(`FLinearColor ManaBarColor = ${fmtLinearColor(theme.manaColor)};`);
  lines.push('');

  lines.push('// ── EnemyHealthBarWidget — Enemy HP Bar ────────────────────────────');
  lines.push(`UPROPERTY(EditAnywhere, Category = "EnemyHP")`);
  lines.push(`FLinearColor BarColor = ${fmtLinearColor(theme.enemyBarColor)};`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "EnemyHP")`);
  lines.push(`float BarInterpSpeed = ${theme.barInterpSpeed.toFixed(1)}f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "EnemyHP|Fade")`);
  lines.push(`float FadeInDuration = ${theme.fadeInDuration.toFixed(2)}f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "EnemyHP|Fade")`);
  lines.push(`float FadeOutDuration = ${theme.fadeOutDuration.toFixed(2)}f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "EnemyHP|Fade")`);
  lines.push(`float FadeOutDelay = ${theme.fadeOutDelay.toFixed(1)}f;`);
  lines.push('');

  lines.push('// ── DamageNumberWidget — Floating Damage Numbers ───────────────────');
  for (const [name, color] of Object.entries(theme.elementColors)) {
    lines.push(`UPROPERTY(EditAnywhere, Category = "DamageNumbers|Colors")`);
    lines.push(`FLinearColor ${name}Color = ${fmtLinearColor(color)};`);
    lines.push('');
  }
  lines.push(`UPROPERTY(EditAnywhere, Category = "DamageNumbers|Font")`);
  lines.push(`float NormalFontSize = ${theme.normalFontSize.toFixed(0)}.0f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "DamageNumbers|Font")`);
  lines.push(`float CritFontSize = ${theme.critFontSize.toFixed(0)}.0f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "DamageNumbers|Animation")`);
  lines.push(`float FloatDistance = ${theme.floatDistance.toFixed(0)}.0f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "DamageNumbers|Animation")`);
  lines.push(`float HorizontalSpread = ${theme.horizontalSpread.toFixed(0)}.0f;`);
  lines.push('');
  lines.push(`UPROPERTY(EditAnywhere, Category = "DamageNumbers|Animation")`);
  lines.push(`float DamageLifetime = ${theme.damageLifetime.toFixed(2)}f;`);

  return lines.join('\n');
}

// ── Main component ─────────────────────────────────────────────────────────

export function HudThemeEditor() {
  const [theme, setTheme] = useState<HudTheme>(() => structuredClone(DEFAULT_THEME));
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<'health' | 'damage' | 'enemy'>('health');

  const time = useAnimationLoop(playing);

  const update = useCallback(<K extends keyof HudTheme>(key: K, value: HudTheme[K]) => {
    setTheme(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateElementColor = useCallback((element: string, color: RGBA) => {
    setTheme(prev => ({
      ...prev,
      elementColors: { ...prev.elementColors, [element]: color },
    }));
  }, []);

  const handleReset = useCallback(() => {
    setTheme(structuredClone(DEFAULT_THEME));
  }, []);

  const exportConfig = useMemo(() => generateUE5Config(theme), [theme]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(exportConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportConfig]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([exportConfig], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HUDThemeConfig.h';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportConfig]);

  // Section config tabs
  const sections = [
    { id: 'health' as const, label: 'Health & Mana',  color: STATUS_SUCCESS },
    { id: 'damage' as const, label: 'Damage Numbers', color: STATUS_WARNING },
    { id: 'enemy' as const,  label: 'Enemy HP Bar',   color: STATUS_ERROR },
  ];

  return (
    <div className="space-y-3" data-testid="hud-theme-editor">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg relative overflow-hidden"
            style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}
          >
            <Palette className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">HUD Theme Editor</h3>
            <p className="text-2xs text-text-muted">Visual tuning for all HUD UPROPERTYs with live preview</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlaying(!playing)}
            className="p-1.5 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            title={playing ? 'Pause preview' : 'Play preview'}
          >
            {playing ? (
              <Pause className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <Play className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            title="Reset to C++ defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
          Live Combat Preview
        </div>
        <LivePreviewScene theme={theme} time={time} />
      </SurfaceCard>

      {/* Editor panels */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
        {/* ── Left: Parameter Editor ── */}
        <SurfaceCard level={2} className="p-3 space-y-3">
          {/* Section tabs */}
          <div className="flex gap-1">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="flex-1 px-2 py-1.5 text-2xs font-bold rounded-md border transition-colors"
                style={{
                  borderColor: activeSection === s.id ? s.color : 'var(--border)',
                  backgroundColor: activeSection === s.id ? `${s.color}${OPACITY_10}` : 'transparent',
                  color: activeSection === s.id ? s.color : 'var(--text-muted)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Health & Mana section */}
          {activeSection === 'health' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
                ARPGHUDWidget Colors
              </div>
              <ColorPickerField
                label="Healthy Color"
                value={theme.healthyColor}
                onChange={(c) => update('healthyColor', c)}
              />
              <ColorPickerField
                label="Danger Color"
                value={theme.dangerColor}
                onChange={(c) => update('dangerColor', c)}
              />
              <ColorPickerField
                label="Mana Color"
                value={theme.manaColor}
                onChange={(c) => update('manaColor', c)}
              />
              <div className="h-px bg-border/40" />
              <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
                Low-Health Pulse
              </div>
              <SliderField
                label="LowHealthThreshold"
                value={Math.round(theme.lowHealthThreshold * 100)}
                min={5} max={75} step={1} unit="%"
                onChange={(v) => update('lowHealthThreshold', v / 100)}
                color={STATUS_WARNING}
              />
              <SliderField
                label="LowHealthPulseSpeed"
                value={theme.lowHealthPulseSpeed}
                min={0.5} max={6} step={0.1} unit=" Hz"
                onChange={(v) => update('lowHealthPulseSpeed', v)}
                color={STATUS_SUCCESS}
              />
              <SliderField
                label="BarInterpSpeed"
                value={theme.barInterpSpeed}
                min={1} max={30} step={0.5} unit="/s"
                onChange={(v) => update('barInterpSpeed', v)}
                color={ACCENT_CYAN}
              />
            </div>
          )}

          {/* Damage Numbers section */}
          {activeSection === 'damage' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
                Element Colors
              </div>
              {Object.entries(theme.elementColors).map(([name, color]) => (
                <ColorPickerField
                  key={name}
                  label={name}
                  value={color}
                  onChange={(c) => updateElementColor(name, c)}
                />
              ))}
              <div className="h-px bg-border/40" />
              <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
                Font & Animation
              </div>
              <SliderField
                label="Normal Font Size"
                value={theme.normalFontSize}
                min={10} max={32} step={1} unit="pt"
                onChange={(v) => update('normalFontSize', v)}
                color={STATUS_INFO}
              />
              <SliderField
                label="Crit Font Size"
                value={theme.critFontSize}
                min={16} max={48} step={1} unit="pt"
                onChange={(v) => update('critFontSize', v)}
                color={STATUS_WARNING}
              />
              <SliderField
                label="Float Distance"
                value={theme.floatDistance}
                min={20} max={200} step={5} unit="px"
                onChange={(v) => update('floatDistance', v)}
              />
              <SliderField
                label="Horizontal Spread"
                value={theme.horizontalSpread}
                min={0} max={80} step={5} unit="px"
                onChange={(v) => update('horizontalSpread', v)}
              />
              <SliderField
                label="Damage Lifetime"
                value={theme.damageLifetime}
                min={0.3} max={3.0} step={0.1} unit="s"
                onChange={(v) => update('damageLifetime', v)}
                color={ACCENT_VIOLET}
              />
            </div>
          )}

          {/* Enemy HP Bar section */}
          {activeSection === 'enemy' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
                EnemyHealthBarWidget
              </div>
              <ColorPickerField
                label="Enemy Bar Color"
                value={theme.enemyBarColor}
                onChange={(c) => update('enemyBarColor', c)}
              />
              <div className="h-px bg-border/40" />
              <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
                Fade Timing
              </div>
              <SliderField
                label="FadeInDuration"
                value={theme.fadeInDuration}
                min={0.05} max={1.0} step={0.05} unit="s"
                onChange={(v) => update('fadeInDuration', v)}
                color={STATUS_SUCCESS}
              />
              <SliderField
                label="FadeOutDuration"
                value={theme.fadeOutDuration}
                min={0.1} max={2.0} step={0.05} unit="s"
                onChange={(v) => update('fadeOutDuration', v)}
                color={ACCENT_VIOLET}
              />
              <SliderField
                label="FadeOutDelay"
                value={theme.fadeOutDelay}
                min={0.5} max={10} step={0.5} unit="s"
                onChange={(v) => update('fadeOutDelay', v)}
                color={STATUS_WARNING}
              />
              <SliderField
                label="BarInterpSpeed"
                value={theme.barInterpSpeed}
                min={1} max={30} step={0.5} unit="/s"
                onChange={(v) => update('barInterpSpeed', v)}
                color={ACCENT_CYAN}
              />

              {/* Fade timeline visualization */}
              <div className="text-xs font-bold text-text-muted uppercase tracking-widest mt-2">
                Fade Timeline
              </div>
              <div className="relative h-10 rounded bg-black/40 border border-border/40 overflow-hidden">
                <FadeTimeline theme={theme} />
              </div>
            </div>
          )}
        </SurfaceCard>

        {/* ── Right: UE5 Export ── */}
        <SurfaceCard level={2} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
              UE5 UMG Configuration
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-2xs font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
                ) : (
                  <Copy className="w-3 h-3 text-text-muted" />
                )}
                <span className="text-text-muted">{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-1 text-2xs font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
                title="Download .h file"
              >
                <Download className="w-3 h-3 text-text-muted" />
                <span className="text-text-muted">.h</span>
              </button>
            </div>
          </div>

          <div className="relative rounded-md bg-black/50 border border-border/40 overflow-hidden">
            <pre className="p-3 text-xs font-mono text-text-muted leading-relaxed overflow-auto max-h-[400px] whitespace-pre">
              {exportConfig}
            </pre>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
              <div className="text-xs font-bold text-text">20+</div>
              <div className="text-2xs text-text-muted">UPROPERTYs</div>
            </div>
            <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
              <div className="text-xs font-bold text-text">4</div>
              <div className="text-2xs text-text-muted">Widget Classes</div>
            </div>
            <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
              <div className="text-xs font-bold text-text">5</div>
              <div className="text-2xs text-text-muted">Elements</div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

// ── Fade Timeline sub-component ────────────────────────────────────────────

function FadeTimeline({ theme }: { theme: HudTheme }) {
  const totalDuration = theme.fadeInDuration + theme.fadeOutDelay + theme.fadeOutDuration;
  const fadeInEnd = (theme.fadeInDuration / totalDuration) * 100;
  const visibleEnd = ((theme.fadeInDuration + theme.fadeOutDelay) / totalDuration) * 100;

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
      {/* Fade-in ramp */}
      <polygon
        points={`0,40 ${fadeInEnd},0 ${fadeInEnd},40`}
        fill={`${STATUS_SUCCESS}30`}
        stroke={STATUS_SUCCESS}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Visible plateau */}
      <rect
        x={fadeInEnd}
        y={0}
        width={visibleEnd - fadeInEnd}
        height={40}
        fill={`${ACCENT_CYAN}20`}
        stroke={ACCENT_CYAN}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Fade-out ramp */}
      <polygon
        points={`${visibleEnd},0 ${visibleEnd},40 100,40`}
        fill={`${ACCENT_VIOLET}30`}
        stroke={ACCENT_VIOLET}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Labels */}
      <text x={fadeInEnd / 2} y={25} textAnchor="middle" fontSize="5" fill={STATUS_SUCCESS} fontFamily="monospace">
        {theme.fadeInDuration.toFixed(2)}s
      </text>
      <text x={(fadeInEnd + visibleEnd) / 2} y={25} textAnchor="middle" fontSize="5" fill={ACCENT_CYAN} fontFamily="monospace">
        {theme.fadeOutDelay.toFixed(1)}s
      </text>
      <text x={(visibleEnd + 100) / 2} y={25} textAnchor="middle" fontSize="5" fill={ACCENT_VIOLET} fontFamily="monospace">
        {theme.fadeOutDuration.toFixed(2)}s
      </text>
    </svg>
  );
}
