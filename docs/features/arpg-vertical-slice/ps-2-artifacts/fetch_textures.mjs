// Fetch 3 PolyHaven texture sets (floor, wall, pillar) into ./textures/.
// PolyHaven is CC0 / keyless. Node 18+ (global fetch).
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'textures');
// slot -> a PolyHaven texture category to search
const WANT = { floor: 'floor', wall: 'wall', pillar: 'concrete' };
const RES = '1k', FMT = 'jpg';

async function listTextures(category) {
  const r = await fetch(`https://api.polyhaven.com/assets?t=textures&categories=${category}`);
  if (!r.ok) throw new Error(`assets list ${category}: ${r.status}`);
  return Object.keys(await r.json()); // asset ids
}
async function filesFor(id) {
  const r = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!r.ok) throw new Error(`files ${id}: ${r.status}`);
  return r.json();
}
function pickUrl(files, mapKeys) {
  for (const k of mapKeys) {
    const m = files[k];
    if (m && m[RES] && m[RES][FMT] && m[RES][FMT].url) return m[RES][FMT].url;
  }
  return null;
}
async function dl(url, path) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url}: ${r.status}`);
  await writeFile(path, Buffer.from(await r.arrayBuffer()));
}

await mkdir(OUT, { recursive: true });
for (const [slot, category] of Object.entries(WANT)) {
  const ids = await listTextures(category);
  let done = false;
  for (const id of ids.slice(0, 8)) {
    const files = await filesFor(id);
    const albedo = pickUrl(files, ['Diffuse', 'diff', 'albedo', 'col_01', 'diffuse']);
    if (!albedo) continue;
    const normal = pickUrl(files, ['nor_gl', 'nor_dx', 'Normal']);
    const rough  = pickUrl(files, ['Rough', 'rough', 'arm']);
    await dl(albedo, join(OUT, `${slot}_albedo.${FMT}`));
    if (normal) await dl(normal, join(OUT, `${slot}_normal.${FMT}`));
    if (rough)  await dl(rough,  join(OUT, `${slot}_rough.${FMT}`));
    console.log(`TEXTURE_OK ${slot} <- polyhaven:${id} (albedo${normal?'+normal':''}${rough?'+rough':''})`);
    done = true;
    break;
  }
  if (!done) throw new Error(`no usable texture found for slot '${slot}' in category '${category}'`);
}
console.log('TEXTURES_DONE');
