import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/style-transfer/route';
import { buildStyleTransferPrompt } from '@/lib/prompts/style-transfer';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer';

/**
 * `analyzeFromDescription` raised `surfaceConfidence` by +0.15 on the mere presence of
 * `imageDataUrl` and emitted "Reference image provided for visual matching." / "Properties
 * estimated from reference image." — while nothing in the route (or downstream in
 * `buildStyleTransferPrompt`) ever decoded, sampled, or sent the image anywhere.
 *
 * These assertions are the standing guard: no code path may raise a confidence number on
 * the basis of a measurement that did not happen, and no copy may claim one.
 */

// A 1x1 transparent PNG — real bytes, so the test is not passing on a falsy value.
const IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function req(body: unknown): Request {
  return new Request('http://localhost/api/style-transfer', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function analyze(body: Record<string, unknown>): Promise<{ analysis: AnalyzedProperties; imageAnalyzed: boolean }> {
  const res = await POST(req({ action: 'analyze', ...body }) as never);
  const json = await res.json();
  expect(json.success).toBe(true);
  return json.data;
}

describe('style-transfer analyze — claims only what it measured', () => {
  it('an attached image does NOT raise the confidence number', async () => {
    const withText = await analyze({ description: 'rough weathered stone wall' });
    const withBoth = await analyze({ description: 'rough weathered stone wall', imageDataUrl: IMAGE });
    expect(withBoth.analysis.surfaceConfidence).toBe(withText.analysis.surfaceConfidence);
  });

  it('an image alone does not move a single reported property', async () => {
    const { analysis: a } = await analyze({ description: 'polished chrome armor' });
    const { analysis: b } = await analyze({ description: 'polished chrome armor', imageDataUrl: IMAGE });
    const numeric = (p: AnalyzedProperties) => ({
      surfaceType: p.surfaceType,
      surfaceConfidence: p.surfaceConfidence,
      roughness: p.roughness,
      metallic: p.metallic,
      emissiveIntensity: p.emissiveIntensity,
      subsurfacePresence: p.subsurfacePresence,
      parallaxDepth: p.parallaxDepth,
      opacity: p.opacity,
      colorPalette: p.colorPalette,
      features: p.features,
    });
    expect(numeric(b)).toEqual(numeric(a));
  });

  it('the prose does not claim visual matching, and says the image was not examined', async () => {
    const { analysis } = await analyze({ description: 'glowing lava rock', imageDataUrl: IMAGE });
    expect(analysis.description).not.toMatch(/visual matching/i);
    expect(analysis.description).not.toMatch(/estimated from reference image/i);
    expect(analysis.description).not.toMatch(/extracted from it/i);
    expect(analysis.description).toMatch(/NOT examined/);
  });

  it('reports machine-readably that the image was not analyzed', async () => {
    expect((await analyze({ description: 'wood', imageDataUrl: IMAGE })).imageAnalyzed).toBe(false);
    expect((await analyze({ description: 'wood' })).imageAnalyzed).toBe(false);
  });

  it('does not suggest uploading a screenshot — an upload changes nothing here', async () => {
    const { analysis } = await analyze({ description: 'rough stone' });
    expect(analysis.suggestions.join(' ')).not.toMatch(/upload a reference/i);
  });

  it('with an image, tells the user the palette is a keyword default rather than sampled', async () => {
    const { analysis } = await analyze({ description: 'rough stone', imageDataUrl: IMAGE });
    expect(analysis.suggestions.join(' ')).toMatch(/not sampled from your image/i);
  });

  it('an empty description still reports the text-only basis honestly', async () => {
    const { analysis } = await analyze({ imageDataUrl: IMAGE });
    expect(analysis.description).toMatch(/NOT examined/);
    expect(analysis.surfaceConfidence).toBe(0.4);
  });
});

describe('style-transfer prompt — the downstream note repeats no phantom analysis', () => {
  const ctx = { projectName: 'PoF', projectPath: 'C:/proj/PoF', ueVersion: '5.8' } as ProjectContext;

  it('says the image is unavailable and unanalyzed instead of "provided and analyzed"', async () => {
    const { analysis } = await analyze({ description: 'rough stone', imageDataUrl: IMAGE });
    const prompt = buildStyleTransferPrompt(
      { imageDataUrl: IMAGE, referenceDescription: 'rough stone', analysis, adjustments: {} },
      ctx,
    );
    expect(prompt).not.toMatch(/provided and analyzed/i);
    expect(prompt).not.toMatch(/properties above were extracted from it/i);
    expect(prompt).toMatch(/was NOT analyzed/);
  });
});
