'use client';

import { Swords } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_INFO, OPACITY_10 } from '@/lib/chart-colors';

// ── Exact RGBA from DamageNumberWidget.h ────────────────────────────────────

interface ElementColor {
  name: string;
  tag: string;
  rgba: [number, number, number, number];
}

const ELEMENT_COLORS: ElementColor[] = [
  { name: 'Physical', tag: '(default)',           rgba: [1.0, 1.0, 1.0, 1.0] },
  { name: 'Fire',     tag: 'Damage.Fire',         rgba: [1.0, 0.3, 0.1, 1.0] },
  { name: 'Ice',      tag: 'Damage.Ice',          rgba: [0.3, 0.6, 1.0, 1.0] },
  { name: 'Lightning',tag: 'Damage.Lightning',    rgba: [1.0, 1.0, 0.2, 1.0] },
  { name: 'Heal',     tag: 'bIsHeal',             rgba: [0.2, 1.0, 0.3, 1.0] },
];

const NORMAL_FONT_SIZE = 18;
const CRIT_FONT_SIZE = 26;

function toCSS([r, g, b, a]: [number, number, number, number]): string {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}

function toHex([r, g, b]: [number, number, number, number]): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

// ── Component ───────────────────────────────────────────────────────────────

export function DamageNumberPalette() {
  return (
    <div className="space-y-4" data-testid="damage-number-palette-panel">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="p-1.5 rounded-lg relative overflow-hidden"
          style={{ backgroundColor: `${STATUS_INFO}${OPACITY_10}` }}
        >
          <Swords className="w-4 h-4" style={{ color: STATUS_INFO }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text">Damage Number Palette</h3>
          <p className="text-2xs text-text-muted">UDamageNumberWidget element colors &amp; text styling</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ── Left: Element color swatches ── */}
        <SurfaceCard level={2} className="p-4 space-y-3">
          <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Element Colors</div>

          <div className="space-y-1.5">
            {ELEMENT_COLORS.map((el) => {
              const css = toCSS(el.rgba);
              const hex = toHex(el.rgba);
              return (
                <div
                  key={el.name}
                  className="flex items-center gap-3 p-2 rounded-md bg-black/30 border border-border/40 group"
                  data-testid={`swatch-${el.name.toLowerCase()}`}
                >
                  {/* Swatch circle */}
                  <div
                    className="w-7 h-7 rounded-md shrink-0 border border-white/10"
                    style={{
                      backgroundColor: css,
                      boxShadow: `0 0 10px ${css}, inset 0 0 4px rgba(255,255,255,0.15)`,
                    }}
                  />

                  {/* Name + tag */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-text">{el.name}</div>
                    <div className="text-2xs font-mono text-text-muted truncate">{el.tag}</div>
                  </div>

                  {/* RGBA + Hex values */}
                  <div className="text-right shrink-0">
                    <div className="text-2xs font-mono text-text-muted">
                      ({el.rgba.join(', ')})
                    </div>
                    <div className="text-2xs font-mono" style={{ color: css }}>
                      {hex}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* C++ reference */}
          <div className="text-2xs text-text-muted font-mono leading-relaxed">
            FLinearColor(R, G, B, A) &middot; DamageNumberWidget.h
          </div>
        </SurfaceCard>

        {/* ── Right: Font size comparison + format strings ── */}
        <SurfaceCard level={2} className="p-4 space-y-4">
          {/* Font size comparison */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Font Size Comparison</div>

            <div className="flex items-end gap-6 p-3 rounded-md bg-black/40 border border-border/40">
              {/* Normal */}
              <div className="text-center">
                <div
                  className="font-bold text-white leading-none"
                  style={{ fontSize: `${NORMAL_FONT_SIZE}px` }}
                >
                  247
                </div>
                <div className="text-2xs text-text-muted mt-1.5 font-mono">Normal ({NORMAL_FONT_SIZE}pt)</div>
              </div>

              {/* vs divider */}
              <div className="text-2xs text-text-muted pb-3">vs</div>

              {/* Crit */}
              <div className="text-center">
                <div
                  className="font-bold leading-none"
                  style={{ fontSize: `${CRIT_FONT_SIZE}px`, color: toCSS(ELEMENT_COLORS[1].rgba) }}
                >
                  CRIT! 892
                </div>
                <div className="text-2xs text-text-muted mt-1.5 font-mono">Crit ({CRIT_FONT_SIZE}pt)</div>
              </div>
            </div>

            {/* Scale ratio */}
            <div className="flex items-center gap-2 text-2xs text-text-muted">
              <div className="h-px flex-1 bg-border/40" />
              <span className="font-mono">{CRIT_FONT_SIZE}/{NORMAL_FONT_SIZE} = {(CRIT_FONT_SIZE / NORMAL_FONT_SIZE).toFixed(2)}x scale</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
          </div>

          {/* Display format strings */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Display Formats</div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 rounded-md bg-black/30 border border-border/40">
                <div className="text-xs font-bold text-white w-24">Normal</div>
                <code className="text-2xs font-mono text-text-muted">{'"%.0f"'}</code>
                <span className="ml-auto text-xs font-bold text-white">247</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-black/30 border border-border/40">
                <div className="text-xs font-bold" style={{ color: toCSS(ELEMENT_COLORS[1].rgba) }}>Crit</div>
                <code className="text-2xs font-mono text-text-muted w-24 shrink-0">{'"CRIT! %.0f"'}</code>
                <span className="ml-auto text-xs font-bold" style={{ color: toCSS(ELEMENT_COLORS[1].rgba) }}>CRIT! 892</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-black/30 border border-border/40">
                <div className="text-xs font-bold" style={{ color: toCSS(ELEMENT_COLORS[4].rgba) }}>Heal</div>
                <code className="text-2xs font-mono text-text-muted w-24 shrink-0">{'"+ %.0f"'}</code>
                <span className="ml-auto text-xs font-bold" style={{ color: toCSS(ELEMENT_COLORS[4].rgba) }}>+156</span>
              </div>
            </div>
          </div>

          {/* Animation properties */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Animation</div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
                <div className="text-xs font-bold text-text">1.0s</div>
                <div className="text-2xs text-text-muted">Lifetime</div>
              </div>
              <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
                <div className="text-xs font-bold text-text">80px</div>
                <div className="text-2xs text-text-muted">Float Dist</div>
              </div>
              <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
                <div className="text-xs font-bold text-text">&plusmn;30px</div>
                <div className="text-2xs text-text-muted">H-Spread</div>
              </div>
            </div>

            <div className="text-2xs text-text-muted font-mono leading-relaxed">
              Fade: 100% for 0–40%, then linear to 0% at 100%
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
