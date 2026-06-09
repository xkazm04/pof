/**
 * Pure, deterministic 2D grid generators for the live procgen preview. Each
 * mirrors the structure the UE C++ codegen targets for a given algorithm, and
 * draws all randomness from {@link FRandomStream} so the same seed reproduces
 * the same layout the engine would. Returns a `CellType` grid + explicit rooms
 * (empty for the organic/noise generators, whose "rooms" emerge as regions).
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { FRandomStream } from './frandom-stream';

export interface PreviewRoom {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlgoParams {
  roomCountMin: number;
  roomCountMax: number;
  corridorWidth: number;
}

export interface GridResult {
  grid: CellType[][];
  rooms: PreviewRoom[];
}

function emptyGrid(w: number, h: number): CellType[][] {
  return Array.from({ length: h }, () => new Array<CellType>(w).fill('empty'));
}

/** Wrap every `empty` cell adjacent to a floor/corridor/door with a `wall`. */
function addWalls(grid: CellType[][], w: number, h: number): void {
  const solid = (c: CellType) => c === 'floor' || c === 'corridor' || c === 'door';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== 'empty') continue;
      for (let dy = -1; dy <= 1 && grid[y][x] === 'empty'; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && solid(grid[ny][nx])) {
            grid[y][x] = 'wall';
            break;
          }
        }
      }
    }
  }
}

// ── BSP (rooms + corridors) ────────────────────────────────────────────────

interface BSPNode {
  x: number; y: number; w: number; h: number;
  left?: BSPNode; right?: BSPNode; room?: PreviewRoom;
}

function splitBSP(node: BSPNode, minSize: number, rng: FRandomStream, depth: number): void {
  if (depth <= 0 || (node.w <= minSize * 2 && node.h <= minSize * 2)) return;
  const splitH = node.w < node.h ? true : node.h < node.w ? false : rng.getFraction() > 0.5;
  if (splitH) {
    if (node.h < minSize * 2) return;
    const s = Math.floor(minSize + rng.getFraction() * (node.h - minSize * 2));
    node.left = { x: node.x, y: node.y, w: node.w, h: s };
    node.right = { x: node.x, y: node.y + s, w: node.w, h: node.h - s };
  } else {
    if (node.w < minSize * 2) return;
    const s = Math.floor(minSize + rng.getFraction() * (node.w - minSize * 2));
    node.left = { x: node.x, y: node.y, w: s, h: node.h };
    node.right = { x: node.x + s, y: node.y, w: node.w - s, h: node.h };
  }
  splitBSP(node.left, minSize, rng, depth - 1);
  splitBSP(node.right, minSize, rng, depth - 1);
}

function placeRooms(node: BSPNode, min: number, max: number, rng: FRandomStream, rooms: PreviewRoom[]): void {
  if (node.left && node.right) {
    placeRooms(node.left, min, max, rng, rooms);
    placeRooms(node.right, min, max, rng, rooms);
    return;
  }
  const maxW = Math.min(max, node.w - 2);
  const maxH = Math.min(max, node.h - 2);
  if (maxW < min || maxH < min) return;
  const rw = Math.floor(min + rng.getFraction() * (maxW - min + 1));
  const rh = Math.floor(min + rng.getFraction() * (maxH - min + 1));
  const rx = node.x + 1 + Math.floor(rng.getFraction() * (node.w - rw - 2));
  const ry = node.y + 1 + Math.floor(rng.getFraction() * (node.h - rh - 2));
  node.room = { id: rooms.length, x: rx, y: ry, width: rw, height: rh };
  rooms.push(node.room);
}

function leafRoom(node: BSPNode, rng: FRandomStream): PreviewRoom | undefined {
  if (node.room) return node.room;
  if (node.left && node.right) return rng.getFraction() > 0.5 ? leafRoom(node.left, rng) : leafRoom(node.right, rng);
  return node.left ? leafRoom(node.left, rng) : node.right ? leafRoom(node.right, rng) : undefined;
}

function carveCorridor(grid: CellType[][], a: PreviewRoom, b: PreviewRoom, cw: number, w: number, h: number): void {
  const ax = Math.floor(a.x + a.width / 2), ay = Math.floor(a.y + a.height / 2);
  const bx = Math.floor(b.x + b.width / 2), by = Math.floor(b.y + b.height / 2);
  const half = Math.floor(cw / 2);
  for (let o = -half; o <= half; o++) {
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
      const cy = ay + o;
      if (cy >= 0 && cy < h && x >= 0 && x < w && grid[cy][x] === 'empty') grid[cy][x] = 'corridor';
    }
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      const cx = bx + o;
      if (y >= 0 && y < h && cx >= 0 && cx < w && grid[y][cx] === 'empty') grid[y][cx] = 'corridor';
    }
  }
}

function connect(grid: CellType[][], node: BSPNode, cw: number, rng: FRandomStream, w: number, h: number): void {
  if (!node.left || !node.right) return;
  connect(grid, node.left, cw, rng, w, h);
  connect(grid, node.right, cw, rng, w, h);
  const a = leafRoom(node.left, rng), b = leafRoom(node.right, rng);
  if (a && b) carveCorridor(grid, a, b, cw, w, h);
}

export function bspGrid(w: number, h: number, p: AlgoParams, rng: FRandomStream): GridResult {
  const grid = emptyGrid(w, h);
  const minRoom = Math.max(3, Math.floor(Math.min(w, h) / 12));
  const maxRoom = Math.max(minRoom + 2, Math.floor(Math.min(w, h) / 4));
  const iterations = Math.max(2, Math.min(6, Math.ceil(Math.log2(Math.max(2, p.roomCountMax)))));
  const root: BSPNode = { x: 0, y: 0, w, h };
  splitBSP(root, minRoom + 2, rng, iterations);
  const rooms: PreviewRoom[] = [];
  placeRooms(root, minRoom, maxRoom, rng, rooms);
  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.height; y++)
      for (let x = r.x; x < r.x + r.width; x++)
        if (y >= 0 && y < h && x >= 0 && x < w) grid[y][x] = 'floor';
  }
  connect(grid, root, p.corridorWidth, rng, w, h);
  addWalls(grid, w, h);
  return { grid, rooms };
}

// ── Cellular automata (organic caves) ──────────────────────────────────────

export function cellularGrid(w: number, h: number, _p: AlgoParams, rng: FRandomStream): GridResult {
  let cells: boolean[][] = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) =>
      x === 0 || y === 0 || x === w - 1 || y === h - 1 ? true : rng.chance(0.45),
    ),
  );
  const wallCount = (src: boolean[][], cx: number, cy: number) => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || src[ny][nx]) n++;
      }
    return n;
  };
  for (let step = 0; step < 5; step++) {
    const next: boolean[][] = cells.map((row) => row.slice());
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) next[y][x] = wallCount(cells, x, y) >= 5;
    cells = next;
  }
  const grid = emptyGrid(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) grid[y][x] = cells[y][x] ? 'wall' : 'floor';
  return { grid, rooms: [] };
}

// ── Wave Function Collapse (tile-adjacency rooms) ───────────────────────────

export function wfcGrid(w: number, h: number, p: AlgoParams, rng: FRandomStream): GridResult {
  const tile = Math.max(5, Math.floor(Math.min(w, h) / 8));
  const cols = Math.max(1, Math.floor(w / tile)), rowsN = Math.max(1, Math.floor(h / tile));
  // Collapse each tile to room/gap, biased toward neighbours already collapsed to rooms.
  const filled: boolean[][] = Array.from({ length: rowsN }, () => new Array<boolean>(cols).fill(false));
  const order: Array<[number, number]> = [];
  for (let r = 0; r < rowsN; r++) for (let c = 0; c < cols; c++) order.push([r, c]);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.randHelper(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const [r, c] of order) {
    let neighbours = 0;
    if (r > 0 && filled[r - 1][c]) neighbours++;
    if (r < rowsN - 1 && filled[r + 1][c]) neighbours++;
    if (c > 0 && filled[r][c - 1]) neighbours++;
    if (c < cols - 1 && filled[r][c + 1]) neighbours++;
    filled[r][c] = rng.chance(0.45 + neighbours * 0.18);
  }
  const grid = emptyGrid(w, h);
  const rooms: PreviewRoom[] = [];
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < cols; c++) {
      if (!filled[r][c]) continue;
      const rx = c * tile + 1, ry = r * tile + 1, rw = tile - 2, rh = tile - 2;
      if (rw < 2 || rh < 2) continue;
      rooms.push({ id: rooms.length, x: rx, y: ry, width: rw, height: rh });
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) grid[y][x] = 'floor';
      // Door into the right / down neighbour when both are rooms.
      const midY = ry + Math.floor(rh / 2), midX = rx + Math.floor(rw / 2);
      if (c < cols - 1 && filled[r][c + 1])
        for (let x = rx + rw; x < (c + 1) * tile + 1; x++) grid[midY][x] = x === rx + rw ? 'door' : 'corridor';
      if (r < rowsN - 1 && filled[r + 1][c])
        for (let y = ry + rh; y < (r + 1) * tile + 1; y++) grid[y][midX] = y === ry + rh ? 'door' : 'corridor';
    }
  }
  addWalls(grid, w, h);
  return { grid, rooms };
}

// ── Perlin / value noise (open-world terrain) ──────────────────────────────

export function perlinGrid(w: number, h: number, _p: AlgoParams, rng: FRandomStream): GridResult {
  const octaves = 4, persistence = 0.5;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  // Pre-roll a lattice per octave so sampling stays deterministic & pure.
  const lattices: number[][][] = [];
  for (let o = 0; o < octaves; o++) {
    const freq = 2 ** (o + 2);
    const lat: number[][] = Array.from({ length: freq + 1 }, () =>
      Array.from({ length: freq + 1 }, () => rng.getFraction()),
    );
    lattices.push(lat);
  }
  const sample = (nx: number, ny: number): number => {
    let total = 0, amp = 1, max = 0;
    for (let o = 0; o < octaves; o++) {
      const freq = 2 ** (o + 2), lat = lattices[o];
      const fx = nx * freq, fy = ny * freq;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const v00 = lat[y0][x0], v10 = lat[y0][x0 + 1], v01 = lat[y0 + 1][x0], v11 = lat[y0 + 1][x0 + 1];
      const top = v00 + (v10 - v00) * tx, bot = v01 + (v11 - v01) * tx;
      total += (top + (bot - top) * ty) * amp;
      max += amp;
      amp *= persistence;
    }
    return total / max;
  };
  const grid = emptyGrid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = sample(x / w, y / h);
      grid[y][x] = v < 0.4 ? 'empty' : v < 0.68 ? 'floor' : 'wall';
    }
  }
  return { grid, rooms: [] };
}
