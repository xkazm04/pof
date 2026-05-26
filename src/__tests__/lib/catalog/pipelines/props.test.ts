import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('props pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "props" with correct step labels, acceptance, wiring contracts, and cross-catalog links', async () => {
    await import('@/lib/catalog/pipelines/props');
    const p = getCatalogPipeline('props');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('props');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Interaction');
    expect(labels).toContain('3D & LODs');
    expect(labels).toContain('Collision & Physics');
    expect(labels).toContain('Material');
    expect(labels).toContain('Destruction States');
    expect(labels).toContain('Loot on Destroy');
    expect(labels).toContain('VFX / Audio');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'prop-reinforced-crate',
      name: 'Reinforced Crate',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ─────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect(String(briefOut.data!.brief).length).toBeGreaterThanOrEqual(300);

    // ── Interaction: produce → accept → pass; interactType = destructible/openable ─
    const interact = p!.steps.find((s) => s.label === 'Interaction')!;
    const interactOut = interact.produce(entity);
    expect(interact.accept(interactOut.data ?? {}).status).toBe('pass');
    const ia = interactOut.data!.interaction as Record<string, unknown>;
    expect(ia.interactType).toBe('destructible/openable');
    expect(String(ia.prompt)).toContain('Open Crate');
    // Wiring contract present
    const iaWiring = ia.wiringContract as Record<string, unknown>;
    expect(typeof iaWiring.grantedBy).toBe('string');
    expect(typeof iaWiring.activatedBy).toBe('string');
    expect(Array.isArray(iaWiring.dependencies)).toBe(true);
    expect(typeof iaWiring.verification).toBe('string');

    // ── 3D & LODs: L1 selection accepted; LOD0 tri budget ≤ 1200 ─────────────
    const mesh = p!.steps.find((s) => s.label === '3D & LODs')!;
    const meshOut = mesh.produce(entity);
    const meshResult = mesh.accept(meshOut.data ?? {});
    expect(meshResult.status).toBe('pass');
    expect(meshResult.tier).toBe('L1');
    const triBudget = meshOut.data!.triBudget as Record<string, { tris: number }>;
    expect(triBudget.LOD0.tris).toBeLessThanOrEqual(1200);

    // ── Collision & Physics: collisionPreset / massKg / chaosEnabled populated ─
    const phys = p!.steps.find((s) => s.label === 'Collision & Physics')!;
    const physOut = phys.produce(entity);
    expect(phys.accept(physOut.data ?? {}).status).toBe('pass');
    const physData = physOut.data!.physics as Record<string, unknown>;
    expect(physData.chaosEnabled).toBe(true);
    expect(typeof physData.massKg).toBe('number');
    const physWiring = physData.wiringContract as Record<string, unknown>;
    expect(physWiring.grantedBy).toBeDefined();
    expect(physWiring.activatedBy).toBeDefined();

    // ── Material: instance starts with MI_; linked to mat-weathered-stone ────
    const mat = p!.steps.find((s) => s.label === 'Material')!;
    const matOut = mat.produce(entity);
    expect(mat.accept(matOut.data ?? {}).status).toBe('pass');
    const matData = matOut.data!.material as Record<string, unknown>;
    expect(String(matData.instance)).toContain('MI_');
    expect(String(matData.parentMaterial)).toBe('/Game/Materials/M_ARPG_Surface_Master');
    const matLinks = matOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(matLinks).toBeDefined();
    expect(matLinks.some((l) => l.catalogId === 'materials' && l.entityId === 'mat-weathered-stone')).toBe(true);

    // ── Destruction States: intact / damaged / destroyed all defined; wiring ──
    const destruct = p!.steps.find((s) => s.label === 'Destruction States')!;
    const destructOut = destruct.produce(entity);
    expect(destruct.accept(destructOut.data ?? {}).status).toBe('pass');
    const ds = destructOut.data!.destructionStates as Record<string, unknown>;
    expect(ds.intact).toBeDefined();
    expect(ds.damaged).toBeDefined();
    expect(ds.destroyed).toBeDefined();
    const dsWiring = ds.wiringContract as Record<string, unknown>;
    expect(dsWiring.grantedBy).toBeDefined();
    expect(dsWiring.activatedBy).toBeDefined();
    expect(Array.isArray(dsWiring.dependencies)).toBe(true);

    // ── Loot on Destroy: lt-Brute link declared, wiring contract ─────────────
    const loot = p!.steps.find((s) => s.label === 'Loot on Destroy')!;
    const lootOut = loot.produce(entity);
    expect(loot.accept(lootOut.data ?? {}).status).toBe('pass');
    const lootLinks = lootOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(lootLinks).toBeDefined();
    expect(lootLinks.some((l) => l.catalogId === 'loot-tables' && l.entityId === 'lt-Brute')).toBe(true);
    const lootData = lootOut.data!.lootOnDestroy as Record<string, unknown>;
    expect(String(lootData.lootTable)).toBe('loot-tables::lt-Brute');
    expect(String(lootData.ilvlSource)).toContain('areaLevel');
    const lootWiring = lootData.wiringContract as Record<string, unknown>;
    expect(lootWiring.grantedBy).toBeDefined();
    expect(lootWiring.activatedBy).toBeDefined();
    expect(Array.isArray(lootWiring.dependencies)).toBe(true);
    expect(typeof lootWiring.verification).toBe('string');

    // ── VFX / Audio: vfx-fire-impact link declared; fields populated ──────────
    const vfx = p!.steps.find((s) => s.label === 'VFX / Audio')!;
    const vfxOut = vfx.produce(entity);
    expect(vfx.accept(vfxOut.data ?? {}).status).toBe('pass');
    const vfxLinks = vfxOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(vfxLinks.some((l) => l.catalogId === 'vfx' && l.entityId === 'vfx-fire-impact')).toBe(true);

    // ── Icon 2D Art: L1 selection; iconset-abilities link ────────────────────
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = icon.produce(entity);
    const iconResult = icon.accept(iconOut.data ?? {});
    expect(iconResult.status).toBe('pass');
    expect(iconResult.tier).toBe('L1');
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Test Gate: always deferred L3 (VSPropInteractTest in UE) ─────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥4 assets; SM_ + GC_ + BP_ present; wiring contract ───
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = pkg.produce(entity);
    expect(pkg.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(4);
    expect(assets.some((a) => a.startsWith('SM_'))).toBe(true);
    expect(assets.some((a) => a.startsWith('GC_'))).toBe(true);
    expect(assets.some((a) => a.startsWith('BP_'))).toBe(true);
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');
    // Packaging top-level links cover all four cross-catalog deps
    const pkgLinks = pkgOut.links as Array<{ catalogId: string; entityId: string }>;
    expect(pkgLinks.some((l) => l.catalogId === 'loot-tables')).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'materials')).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'vfx')).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'icon-sets')).toBe(true);
  });
});
