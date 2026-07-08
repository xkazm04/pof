/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Generate ONE image with Leonardo **Lucid Origin** (the model the catalog pipeline actually
 * uses) at 1024² — the quality-hardening loop's producer. The pipeline generates Lucid Origin
 * at 512 (low res), which is part of why baselines are weak; this generates at 1024 for a fair
 * test of what Lucid Origin can do with a well-composed prompt. Download-then-delete cleanup.
 *
 *   npx tsx scripts/gen-lucid.ts --prompt "<prompt>" --output out.png [--width 1024 --height 1024]
 */
import { writeFileSync } from 'node:fs';
import { generateImage, MAX_PROMPT_LENGTH } from '../src/lib/leonardo';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const prompt = arg('prompt');
  const output = arg('output');
  if (!prompt || !output) { console.error('need --prompt and --output'); process.exit(2); }
  if (prompt.length > MAX_PROMPT_LENGTH) { console.error(`POF_LUCID_ERROR=prompt ${prompt.length} > ${MAX_PROMPT_LENGTH} char limit`); process.exit(3); }
  const width = Number(arg('width') ?? 1024);
  const height = Number(arg('height') ?? 1024);

  const res = await generateImage(prompt, { width, height, cleanup: true });
  if (res.imageBase64) {
    writeFileSync(output, Buffer.from(res.imageBase64, 'base64'));
  } else {
    const buf = Buffer.from(await (await fetch(res.imageUrl)).arrayBuffer());
    writeFileSync(output, buf);
  }
  console.log(`POF_LUCID_DONE=${output} gen=${res.generationId} (${prompt.length} chars, ${width}x${height})`);
}
main().catch((e) => { console.error('POF_LUCID_ERROR', e instanceof Error ? e.message : e); process.exit(1); });
