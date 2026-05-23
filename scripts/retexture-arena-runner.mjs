// Drives the Leonardo 3D-texture endpoint via the PoF route, downloads PBR maps.
// Usage: node scripts/retexture-arena-runner.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const UE = 'C:/Users/kazda/Documents/Unreal Projects/PoF';
const OBJ = join(UE, 'Content/ArenaBuild/Arena.obj');
const OUT = join(UE, 'Content/ArenaBuild/textures_3d');
const ROUTE = process.env.POF_ORIGIN ?? 'http://localhost:3000';
const PROMPT = 'dark fantasy dungeon stone, weathered cobblestone and carved pillars, PBR, coherent across the mesh';

async function downloadMap(url, name) {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${name} failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const path = join(OUT, name);
  await writeFile(path, bytes);
  console.log(`wrote ${path} (${bytes.length} bytes)`);
  return path;
}

async function main() {
  const objBase64 = (await readFile(OBJ)).toString('base64');
  const res = await fetch(`${ROUTE}/api/leonardo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'texture3d', objBase64, prompt: PROMPT }),
  });
  const json = await res.json();
  if (!json.success) {
    console.log('ENDPOINT_UNUSABLE: ' + json.error);
    return; // exit 0 -> fallback path
  }
  await mkdir(OUT, { recursive: true });
  await downloadMap(json.data.albedoUrl, 'arena3d_albedo.png');
  await downloadMap(json.data.normalUrl, 'arena3d_normal.png');
  await downloadMap(json.data.roughnessUrl, 'arena3d_rough.png');
  console.log('PBR_MAPS_READY');
}

main().catch((e) => { console.log('ENDPOINT_UNUSABLE: ' + e.message); });
