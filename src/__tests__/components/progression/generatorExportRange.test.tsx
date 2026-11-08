import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { DRCodeGenerator } from '@/components/modules/core-engine/sub_progression/_internals/DRCodeGenerator';
import { XpTableGenerator } from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator';
import { DR_CONFIGS, type DRConfig } from '@/components/modules/core-engine/sub_progression/_shared/diminishingReturns';

afterEach(cleanup);

function DRHarness() {
  const [configs, setConfigs] = useState<DRConfig[]>(DR_CONFIGS);
  return <DRCodeGenerator configs={configs} onConfigsChange={setConfigs} />;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('generator exports hold only values inside the declared input range', () => {
  it('DR JSON keeps SoftCap an in-range integer, and the other fields in range', () => {
    render(<DRHarness />);
    type('Strength soft cap', '62.5');
    type('Strength post-cap multiplier', '7');
    type('Strength base value per point', '-3');
    fireEvent.click(screen.getByRole('button', { name: 'Data Table (.json)' }));
    const text = document.querySelector('pre')?.textContent ?? '';
    const caps = [...text.matchAll(/"SoftCap":\s*([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((c) => Number.isInteger(c) && c >= 10 && c <= 100)).toBe(true);
    const posts = [...text.matchAll(/"PostCapMultiplier":\s*([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(posts.every((p) => p >= 0.05 && p <= 1)).toBe(true);
    const bases = [...text.matchAll(/"BaseValuePerPoint":\s*([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(bases.every((b) => b >= 0.001 && b <= 100)).toBe(true);
  });

  it('XP CSV keeps per-level bonuses in range', () => {
    render(<XpTableGenerator baseXp={100} curveExp={1.5} />);
    type('HP per level', '-4');
    fireEvent.click(screen.getByRole('button', { name: 'CSV Export' }));
    const rows = (document.querySelector('pre')?.textContent ?? '').split('\n').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    const hp = rows.map((r) => Number(r.split(',')[3]));
    expect(hp.every((v) => v >= 1 && v <= 100)).toBe(true);
  });
});
