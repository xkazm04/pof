'use client';

import { useRef, useEffect } from 'react';
import type { CellType } from '@/lib/visual-gen/generators/dungeon';
import { CELL_COLORS } from './constants';

export function TerrainPreview({ heightmap }: { heightmap: number[][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = heightmap.length;
    canvas.width = size;
    canvas.height = size;

    const imageData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = Math.floor(heightmap[y][x] * 255);
        const idx = (y * size + x) * 4;
        // Green-brown terrain coloring
        imageData.data[idx] = Math.floor(v * 0.4);
        imageData.data[idx + 1] = Math.floor(v * 0.7 + 50);
        imageData.data[idx + 2] = Math.floor(v * 0.2);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [heightmap]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[512px] aspect-square rounded-lg border border-border"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export function DungeonPreview({ grid, width, height }: { grid: CellType[][]; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = CELL_COLORS[grid[y][x]];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [grid, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[512px] aspect-square rounded-lg border border-border"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export function VegetationPreview({ points, width, height, species }: {
  points: Array<{ x: number; y: number; speciesId: string; scale: number }>;
  width: number;
  height: number;
  species: Array<{ id: string; color: string; radius: number }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 4;
    canvas.width = width * scale;
    canvas.height = height * scale;

    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const speciesMap = new Map(species.map((s) => [s.id, s]));

    for (const point of points) {
      const sp = speciesMap.get(point.speciesId);
      if (!sp) continue;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(point.x * scale, point.y * scale, sp.radius * scale * 0.3 * point.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points, width, height, species]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[512px] aspect-square rounded-lg border border-border"
    />
  );
}
