/**
 * Procedural dungeon layout generation using BSP (Binary Space Partitioning).
 */

/** Cell types in the dungeon grid */
export type CellType = 'empty' | 'floor' | 'wall' | 'door' | 'corridor';

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  id: number;
}

export interface DungeonConfig {
  /** Grid width */
  width: number;
  /** Grid height */
  height: number;
  /** Minimum room dimension */
  minRoomSize: number;
  /** Maximum room dimension */
  maxRoomSize: number;
  /** Number of BSP split iterations */
  iterations: number;
  /** Corridor width (1-3) */
  corridorWidth: number;
  /** Random seed */
  seed: number;
}

export interface DungeonResult {
  grid: CellType[][];
  rooms: Room[];
  width: number;
  height: number;
}

export const DEFAULT_DUNGEON_CONFIG: DungeonConfig = {
  width: 64,
  height: 64,
  minRoomSize: 5,
  maxRoomSize: 12,
  iterations: 5,
  corridorWidth: 2,
  seed: 42,
};

/** Seeded RNG */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BSPNode {
  x: number;
  y: number;
  w: number;
  h: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

function splitBSP(node: BSPNode, minSize: number, rng: () => number, depth: number): void {
  if (depth <= 0 || (node.w <= minSize * 2 && node.h <= minSize * 2)) return;

  const splitH = node.w < node.h ? true : node.h < node.w ? false : rng() > 0.5;

  if (splitH) {
    if (node.h < minSize * 2) return;
    const split = Math.floor(minSize + rng() * (node.h - minSize * 2));
    node.left = { x: node.x, y: node.y, w: node.w, h: split };
    node.right = { x: node.x, y: node.y + split, w: node.w, h: node.h - split };
  } else {
    if (node.w < minSize * 2) return;
    const split = Math.floor(minSize + rng() * (node.w - minSize * 2));
    node.left = { x: node.x, y: node.y, w: split, h: node.h };
    node.right = { x: node.x + split, y: node.y, w: node.w - split, h: node.h };
  }

  splitBSP(node.left, minSize, rng, depth - 1);
  splitBSP(node.right, minSize, rng, depth - 1);
}

function placeRooms(node: BSPNode, config: DungeonConfig, rng: () => number, rooms: Room[], nextId: { value: number }): void {
  if (node.left && node.right) {
    placeRooms(node.left, config, rng, rooms, nextId);
    placeRooms(node.right, config, rng, rooms, nextId);
    return;
  }

  const maxW = Math.min(config.maxRoomSize, node.w - 2);
  const maxH = Math.min(config.maxRoomSize, node.h - 2);
  if (maxW < config.minRoomSize || maxH < config.minRoomSize) return;

  const roomW = Math.floor(config.minRoomSize + rng() * (maxW - config.minRoomSize + 1));
  const roomH = Math.floor(config.minRoomSize + rng() * (maxH - config.minRoomSize + 1));
  const roomX = node.x + 1 + Math.floor(rng() * (node.w - roomW - 2));
  const roomY = node.y + 1 + Math.floor(rng() * (node.h - roomH - 2));

  const room: Room = { x: roomX, y: roomY, width: roomW, height: roomH, id: nextId.value++ };
  node.room = room;
  rooms.push(room);
}

function getRoomCenter(room: Room): [number, number] {
  return [
    Math.floor(room.x + room.width / 2),
    Math.floor(room.y + room.height / 2),
  ];
}

function getLeafRoom(node: BSPNode, rng: () => number): Room | undefined {
  if (node.room) return node.room;
  if (node.left && node.right) {
    return rng() > 0.5 ? getLeafRoom(node.left, rng) : getLeafRoom(node.right, rng);
  }
  if (node.left) return getLeafRoom(node.left, rng);
  if (node.right) return getLeafRoom(node.right, rng);
  return undefined;
}

function connectNodes(
  grid: CellType[][],
  node: BSPNode,
  corridorWidth: number,
  rng: () => number,
  width: number,
  height: number,
): void {
  if (!node.left || !node.right) return;

  connectNodes(grid, node.left, corridorWidth, rng, width, height);
  connectNodes(grid, node.right, corridorWidth, rng, width, height);

  const roomA = getLeafRoom(node.left, rng);
  const roomB = getLeafRoom(node.right, rng);
  if (!roomA || !roomB) return;

  const [ax, ay] = getRoomCenter(roomA);
  const [bx, by] = getRoomCenter(roomB);

  // L-shaped corridor
  const halfW = Math.floor(corridorWidth / 2);
  for (let w = -halfW; w <= halfW; w++) {
    // Horizontal segment
    const startX = Math.min(ax, bx);
    const endX = Math.max(ax, bx);
    for (let x = startX; x <= endX; x++) {
      const cy = ay + w;
      if (cy >= 0 && cy < height && x >= 0 && x < width) {
        if (grid[cy][x] === 'empty') grid[cy][x] = 'corridor';
      }
    }

    // Vertical segment
    const startY = Math.min(ay, by);
    const endY = Math.max(ay, by);
    for (let y = startY; y <= endY; y++) {
      const cx = bx + w;
      if (y >= 0 && y < height && cx >= 0 && cx < width) {
        if (grid[y][cx] === 'empty') grid[y][cx] = 'corridor';
      }
    }
  }
}

/**
 * Generate a dungeon layout using BSP algorithm.
 */
export function generateDungeon(config: DungeonConfig): DungeonResult {
  const { width, height, seed, corridorWidth } = config;
  const rng = mulberry32(seed);

  // Initialize grid
  const grid: CellType[][] = Array.from({ length: height }, () =>
    new Array(width).fill('empty' as CellType),
  );

  // BSP tree
  const root: BSPNode = { x: 0, y: 0, w: width, h: height };
  splitBSP(root, config.minRoomSize + 2, rng, config.iterations);

  // Place rooms
  const rooms: Room[] = [];
  placeRooms(root, config, rng, rooms, { value: 0 });

  // Draw rooms on grid
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (y >= 0 && y < height && x >= 0 && x < width) {
          grid[y][x] = 'floor';
        }
      }
    }
  }

  // Connect rooms via corridors
  connectNodes(grid, root, corridorWidth, rng, width, height);

  // Add walls around floor and corridor cells
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] !== 'empty') continue;
      // Check 8 neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            if (grid[ny][nx] === 'floor' || grid[ny][nx] === 'corridor') {
              grid[y][x] = 'wall';
            }
          }
        }
      }
    }
  }

  return { grid, rooms, width, height };
}
