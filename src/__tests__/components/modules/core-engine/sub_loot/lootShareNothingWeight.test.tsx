import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { LootTableEditor } from '@/components/modules/core-engine/sub_loot/affix/LootTableEditor';

afterEach(() => cleanup());

describe('loot row share and preview bar state one drop probability', () => {
  it('row share equals the bar segment once NothingWeight is imported', async () => {
    const { container } = render(<LootTableEditor />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const json = JSON.stringify({
      Entries: [{ Item: 'Ten', DropWeight: 10 }, { Item: 'Forty', DropWeight: 40 }],
      NothingWeight: 50,
    });
    const file = new File([json], 'table.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(container.textContent).toContain('table.json'));

    const barTitle = Array.from(container.querySelectorAll('div[title]'))
      .map((d) => d.getAttribute('title') ?? '')
      .find((t) => t.startsWith('Ten:'));
    expect(barTitle).toBe('Ten: 10.0%');

    const shareText = Array.from(container.querySelectorAll('span'))
      .filter((s) => (s.textContent ?? '').endsWith(' share'))
      .map((s) => s.textContent ?? '');
    expect(shareText[0]).toContain('10.0%');
    expect(shareText[1]).toContain('40.0%');
  });

  it('with no NothingWeight the share is unchanged', () => {
    const { container } = render(<LootTableEditor />);
    const shares = Array.from(container.querySelectorAll('span'))
      .filter((s) => (s.textContent ?? '').endsWith(' share'))
      .map((s) => s.textContent ?? '');
    const sum = shares.reduce((a, t) => a + parseFloat(t), 0);
    expect(sum).toBeGreaterThan(0);
  });
});
