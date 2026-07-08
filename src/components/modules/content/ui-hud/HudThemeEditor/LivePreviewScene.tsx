'use client';

import { CYCLE_DURATION } from './constants';
import { getCombatEvents, lerpColor, clamp, rgbaToCSS } from './helpers';
import type { HudTheme } from './types';

// ── Live preview scene ─────────────────────────────────────────────────────

export function LivePreviewScene({ theme, time }: { theme: HudTheme; time: number }) {
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
