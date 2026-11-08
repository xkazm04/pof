import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { sanitizeItemGenome } from '@/lib/item-dna/defaults';
import { CodePreview } from '@/components/modules/core-engine/sub_inventory/dna-genome/CodePreview';

/**
 * scan-sweep inventory-genome-economy: the UE5 struct preview interpolates the genome
 * name and version into a `//` comment. The editor's <input type=text> cannot hold a
 * newline, but an imported build code / pasted JSON can, and sanitizeItemGenome only
 * trims - so a name with a line break escaped the comment and became C++ source.
 */

afterEach(cleanup);

function previewLines(name: string, version = '1.0.0'): string[] {
  const res = sanitizeItemGenome({ name, version, color: ACCENT_VIOLET });
  if ('error' in res) throw new Error(res.error);
  const { container } = render(<CodePreview selected={res.genome} />);
  return (container.querySelector('pre')?.textContent ?? '').split('\n');
}

describe('CodePreview header comment', () => {
  it('an imported multi-line name stays inside the // comment', () => {
    const lines = previewLines('Blade\r\n#include "Evil.h"\nUCLASS()');
    expect(lines.some((l) => l.trim().startsWith('#include'))).toBe(false);
    expect(lines.some((l) => l.trim() === 'UCLASS()')).toBe(false);
    const header = lines.find((l) => l.startsWith('// Genome:'));
    expect(header).toContain('Blade');
    expect(header).toContain('UCLASS()');
  });

  it('an imported multi-line version stays inside the // comment', () => {
    const lines = previewLines('Blade', '2\nint32 Pwned = 1;');
    expect(lines.some((l) => l.trim().startsWith('int32 Pwned'))).toBe(false);
  });

  it('a plain name renders unchanged', () => {
    const lines = previewLines('Warrior Blade', '1.2.0');
    expect(lines).toContain('// Genome: Warrior Blade v1.2.0');
  });
});
