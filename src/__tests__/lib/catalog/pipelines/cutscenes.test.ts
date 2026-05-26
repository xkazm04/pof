import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('cutscenes pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "cutscenes" with correct step labels, Beat Sheet acceptance, and wiring', async () => {
    await import('@/lib/catalog/pipelines/cutscenes');
    const p = getCatalogPipeline('cutscenes');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);

    // All required steps present
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Beat Sheet & Shot List');
    expect(labels).toContain('Blocking / Body Anim');
    expect(labels).toContain('Facial / Lipsync');
    expect(labels).toContain('Lighting');
    expect(labels).toContain('VFX');
    expect(labels).toContain('Music & SFX');
    expect(labels).toContain('VO');
    expect(labels).toContain('Subtitles & Loc');
    expect(labels).toContain('Skip / Replay Rules');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Synthetic entity matching the seeded starter
    const entity = {
      id: 'cutscene-prologue',
      name: 'Prologue: The Fall',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass ────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // ── Beat Sheet & Shot List ────────────────────────────────────────────────
    const beatSheet = p!.steps.find((s) => s.label === 'Beat Sheet & Shot List')!;
    const beatOutput = beatSheet.produce(entity);

    // archetype and view
    expect(beatSheet.archetype).toBe('rules');
    expect((beatSheet.view as { kind: string }).kind).toBe('table');

    // acceptance passes (minCount on beats)
    const beatResult = beatSheet.accept(beatOutput.data ?? {});
    expect(beatResult.status).toBe('pass');

    // beats array has ≥1 entry and each has required fields
    const beats = ((beatOutput.data ?? {}).beats) as Array<{
      index: number;
      tcIn: number;
      tcOut: number;
      description: string;
      shot: string;
      event: string;
    }>;
    expect(beats.length).toBeGreaterThanOrEqual(1);
    expect(typeof beats[0].tcIn).toBe('number');
    expect(typeof beats[0].tcOut).toBe('number');
    expect(typeof beats[0].description).toBe('string');
    expect(typeof beats[0].shot).toBe('string');
    expect(typeof beats[0].event).toBe('string');

    // top-level cross-catalog links: char-captain-vael + music-combat-a
    const beatLinks = beatOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(beatLinks).toBeDefined();
    expect(beatLinks.some((l) => l.catalogId === 'characters' && l.entityId === 'char-captain-vael')).toBe(true);
    expect(beatLinks.some((l) => l.catalogId === 'music'      && l.entityId === 'music-combat-a')).toBe(true);

    // ── Blocking / Body Anim: produce → accept → pass ─────────────────────────
    const blocking = p!.steps.find((s) => s.label === 'Blocking / Body Anim')!;
    expect(blocking.accept(blocking.produce(entity).data ?? {}).status).toBe('pass');

    // ── Facial / Lipsync: produce → accept → pass ─────────────────────────────
    const facial = p!.steps.find((s) => s.label === 'Facial / Lipsync')!;
    expect(facial.accept(facial.produce(entity).data ?? {}).status).toBe('pass');

    // ── Lighting: produce → accept → pass ─────────────────────────────────────
    const lighting = p!.steps.find((s) => s.label === 'Lighting')!;
    expect(lighting.accept(lighting.produce(entity).data ?? {}).status).toBe('pass');

    // ── VFX: produce → accept → pass ──────────────────────────────────────────
    const vfxStep = p!.steps.find((s) => s.label === 'VFX')!;
    const vfxOutput = vfxStep.produce(entity);
    expect(vfxStep.accept(vfxOutput.data ?? {}).status).toBe('pass');
    // vfx::vfx-fire-impact link present
    const vfxLinks = vfxOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(vfxLinks.some((l) => l.catalogId === 'vfx' && l.entityId === 'vfx-fire-impact')).toBe(true);

    // ── Music & SFX: produce → accept → pass ──────────────────────────────────
    const musicStep = p!.steps.find((s) => s.label === 'Music & SFX')!;
    const musicOutput = musicStep.produce(entity);
    expect(musicStep.accept(musicOutput.data ?? {}).status).toBe('pass');
    const musicLinks = musicOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(musicLinks.some((l) => l.catalogId === 'music' && l.entityId === 'music-combat-a')).toBe(true);

    // ── VO: produce → accept → pass ───────────────────────────────────────────
    const vo = p!.steps.find((s) => s.label === 'VO')!;
    expect(vo.accept(vo.produce(entity).data ?? {}).status).toBe('pass');

    // ── Subtitles & Loc: produce → accept → pass ──────────────────────────────
    const sub = p!.steps.find((s) => s.label === 'Subtitles & Loc')!;
    expect(sub.accept(sub.produce(entity).data ?? {}).status).toBe('pass');

    // ── Skip / Replay Rules: produce → accept → pass ──────────────────────────
    const skip = p!.steps.find((s) => s.label === 'Skip / Replay Rules')!;
    const skipOutput = skip.produce(entity);
    expect(skip.accept(skipOutput.data ?? {}).status).toBe('pass');
    // confirm skip grace window is declared
    const skipReplay = (skipOutput.data ?? {}).skipReplay as { skipGraceWindowSecs: number };
    expect(typeof skipReplay.skipGraceWindowSecs).toBe('number');

    // ── Icon 2D Art: links iconset-abilities ──────────────────────────────────
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOutput = icon.produce(entity);
    const iconLinks = iconOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks).toBeDefined();
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── UE Packaging: produce → accept → pass ─────────────────────────────────
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOutput = pkg.produce(entity);
    expect(pkg.accept(pkgOutput.data ?? {}).status).toBe('pass');
    // primary asset class must be LevelSequence
    const pkgData = (pkgOutput.data ?? {}) as { primaryAssetClass: string };
    expect(pkgData.primaryAssetClass).toBe('LevelSequence');

    // ── Test Gate: deferred L3 ────────────────────────────────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
