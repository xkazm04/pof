// ── Pure deterministic starfield (no Math.random in render — purity rule) ─────

export function hashFloat(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function buildStars(width: number, height: number, count: number) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: hashFloat(i + 1) * width,
      y: hashFloat(i + 101) * height,
      r: 0.4 + hashFloat(i + 201) * 1.1,
      o: 0.15 + hashFloat(i + 301) * 0.4,
    });
  }
  return stars;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
