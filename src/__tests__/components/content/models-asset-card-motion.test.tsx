/**
 * AssetCard under prefers-reduced-motion (models-asset-inventory, night 2026-11-08).
 *
 * The sibling AssetPipelineDiagram reads useReducedMotion() and drops its hover
 * lift / uses motionSafe(); every AssetCard in the inventory grid still sprang in
 * (scale 0.9 -> 1, y 10 -> 0) and lifted + scaled on hover regardless.
 * motion.div is replaced with a probe that records the motion props it got.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { forwardRef, type ReactNode } from 'react';

afterEach(cleanup);

const reduced = vi.hoisted(() => ({ value: true }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const Probe = forwardRef<HTMLDivElement, Record<string, unknown> & { children?: ReactNode }>(
    function Probe({ children, whileHover, initial, transition, className }, ref) {
      return (
        <div
          ref={ref}
          className={className as string}
          data-while-hover={JSON.stringify(whileHover ?? null)}
          data-initial={JSON.stringify(initial ?? null)}
          data-transition={JSON.stringify(transition ?? null)}
        >
          {children as ReactNode}
        </div>
      );
    },
  );
  return { ...actual, useReducedMotion: () => reduced.value, motion: { ...actual.motion, div: Probe } };
});

import { AssetCard } from '@/components/modules/content/models/AssetInventory/AssetCard';
import { scanned } from '@/__tests__/lib/asset-inventory/design-doc-fixture';

const MESH = scanned('Meshes/SM_Rock.uasset', 'mesh');

function outer(container: HTMLElement) {
  return container.querySelector('[data-while-hover]') as HTMLElement;
}

function renderCard() {
  return render(
    <AssetCard asset={MESH} isExpanded={false} edgeCount={{}} allAssets={[MESH]} dependencies={[]} ueListed={null} setExpandedAsset={() => {}} />,
  );
}

describe('AssetCard motion', () => {
  it('reduced motion: no hover lift/scale, no scale-in, no spring', () => {
    reduced.value = true;
    const el = outer(renderCard().container);
    expect(JSON.parse(el.dataset.whileHover!)).toBeNull();
    const initial = JSON.parse(el.dataset.initial!);
    expect(initial === false || initial === null || (initial.scale === undefined && initial.y === undefined)).toBe(true);
    expect(JSON.parse(el.dataset.transition!)?.type).not.toBe('spring');
  });

  it('[guard] full motion keeps the hover lift', () => {
    reduced.value = false;
    const el = outer(renderCard().container);
    expect(JSON.parse(el.dataset.whileHover!)).toEqual({ y: -5, scale: 1.02 });
  });
});
