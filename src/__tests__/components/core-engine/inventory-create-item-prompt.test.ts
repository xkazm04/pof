import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildCreateItemPrompt } from '@/components/modules/core-engine/sub_inventory/catalog/createItemPrompt';

/**
 * The Catalog "Create with AI Image" CLI prompt must describe the /api/leonardo
 * contract as it actually is: an absolute URL (the CLI is not a browser), the
 * { success, data } envelope, and bytes delivered as data.imageBase64 — the
 * generation (and with it imageUrl) is deleted server-side right after download.
 */

const ORIGIN = 'http://localhost:3001';
const base = { name: 'Frost "Bite" Blade', type: 'Weapon', rarity: 'Rare', description: 'Says "hi"\nand freezes.' };

function bodyOf(prompt: string): Record<string, unknown> {
  const line = prompt.split('\n').find((l) => l.trim().startsWith('{'));
  expect(line, 'prompt carries a JSON request body line').toBeDefined();
  return JSON.parse(line!.trim()) as Record<string, unknown>;
}

describe('buildCreateItemPrompt', () => {
  it('targets the absolute /api/leonardo URL', () => {
    const p = buildCreateItemPrompt(base, 'frost-bite-blade', ORIGIN);
    expect(p).toContain(`POST ${ORIGIN}/api/leonardo`);
  });

  it('reads the bytes from data.imageBase64, never from the deleted imageUrl', () => {
    const p = buildCreateItemPrompt(base, 'frost-bite-blade', ORIGIN);
    expect(p).toContain('data.imageBase64');
    expect(p).not.toMatch(/download the image from imageUrl/i);
    expect(p).toContain('public/items/frost-bite-blade.webp');
  });

  it('embeds a request body that stays valid JSON when the item text has quotes/newlines', () => {
    const body = bodyOf(buildCreateItemPrompt(base, 'frost-bite-blade', ORIGIN));
    expect(body.mode).toBe('image');
    expect(String(body.prompt)).toContain('Frost "Bite" Blade');
    expect(String(body.prompt).length).toBeLessThanOrEqual(1500);
  });

  it('CatalogGearTab builds its prompt through the helper (no inline copy left)', () => {
    const src = fs.readFileSync(path.join(process.cwd(),
      'src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).toContain('buildCreateItemPrompt(');
    expect(src).not.toContain('Call POST /api/leonardo');
  });
});
