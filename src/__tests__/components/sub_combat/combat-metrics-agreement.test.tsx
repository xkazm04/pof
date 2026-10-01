import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { renderCombatMetric } from '@/components/modules/core-engine/sub_combat/metrics';
import { StatInfluencePanel } from '@/components/modules/core-engine/sub_combat/metrics/StatInfluencePanel';
import { MetricsTab } from '@/components/modules/core-engine/sub_combat/metrics/MetricsTab';

// One weapon, one DPS on every surface: the Feature Map tiles, the DPS chart, the
// STR/DEX panel and the compare rows all read weapon-throughput (scan-sweep
// --challenge combat-metrics/A). No hand-typed strategy table, no private formula.

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
afterEach(() => cleanup());

const ROOT = process.cwd();
const METRICS_DIR = path.join(ROOT, 'src', 'components', 'modules', 'core-engine', 'sub_combat', 'metrics');

describe('combat metrics agree on one weapon-DPS law', () => {
  it('Feature Map tiles read the weapon roster, not a hand-typed table', () => {
    const eff = render(<>{renderCombatMetric('effectiveness')}</>);
    expect(eff.container.textContent).toContain('Soulreaper');
    expect(eff.container.textContent).toContain('38 DPS');
    cleanup();

    const stats = render(<>{renderCombatMetric('stats')}</>);
    expect(stats.container.textContent).toContain('16');
    expect(stats.container.textContent).toContain('avg DPS');
    expect(stats.container.textContent).not.toContain('227');
    cleanup();

    const dps = render(<>{renderCombatMetric('dps')}</>);
    const titled = Array.from(dps.container.querySelectorAll('[title]')).map(el => el.getAttribute('title') ?? '');
    expect(titled).toHaveLength(3);
    expect(titled[0].startsWith('Soulreaper')).toBe(true);
    expect(titled[1].startsWith('Shadowfang')).toBe(true);
    expect(titled[2].startsWith('Dawnbreaker')).toBe(true);
    expect(dps.container.textContent ?? '').not.toContain('CancelIntoAbility');
  });

  it('StatInfluencePanel and MetricsTab compare rows show the same figure per weapon', () => {
    render(<StatInfluencePanel moduleId="combat-action-map" />);
    const panel = screen.getByTestId('stat-influence-panel');
    const soulRow = within(panel).getByTitle('Soulreaper').parentElement;
    expect(soulRow?.textContent).toContain('38');
    cleanup();

    render(<MetricsTab />);
    fireEvent.click(screen.getByRole('button', { name: /Soulreaper/ }));
    fireEvent.click(screen.getByRole('button', { name: /Iron Longsword/ }));
    const compare = screen.getByTestId('weapon-compare-rows');
    const rows = Array.from(compare.children).map(r => r.textContent ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Soulreaper');
    expect(rows[0]).toContain('38 DPS');
    expect(rows[1]).toContain('Iron Longsword');
    expect(rows[1]).toContain('8 DPS');
  });

  it('source guard: no private DPS formula under metrics/, no hand-typed table, model on canon computeHit', () => {
    const files = fs.readdirSync(METRICS_DIR).filter(f => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = fs.readFileSync(path.join(METRICS_DIR, f), 'utf8');
      for (const banned of ['parseDamageMidpoint(', 'parseFloat(', 'parseInt(', 'function weaponDps', 'function computeDps']) {
        expect(src.includes(banned), `${f} contains ${banned}`).toBe(false);
      }
    }
    const data = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'modules', 'core-engine', 'sub_combat', '_shared', 'data-metrics.ts'), 'utf8');
    expect(data).not.toMatch(/export const DPS_STRATEGIES\b/);
    expect(data).not.toMatch(/export const DPS_MAX\b/);
    const model = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'combat', 'weapon-throughput.ts'), 'utf8');
    expect(model).toMatch(/import\s*\{[^}]*\bcomputeHit\b[^}]*\}\s*from\s*'@\/lib\/combat\/canon-kernel'/);
  });
});
