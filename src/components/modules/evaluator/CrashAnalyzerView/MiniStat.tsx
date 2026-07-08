'use client';

import { SurfaceCard } from '@/components/ui/SurfaceCard';

export function MiniStat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <SurfaceCard level={2}>
      <p className="text-2xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold ${accent ? '' : 'text-text'}`} style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </SurfaceCard>
  );
}
