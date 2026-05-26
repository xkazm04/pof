import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('save-points pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "save-points" with correct step labels, acceptance, and Test Gate deferred', async () => {
    await import('@/lib/catalog/pipelines/save-points');
    const p = getCatalogPipeline('save-points');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('save-points');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('State Schema');
    expect(labels).toContain('Versioning & Migration');
    expect(labels).toContain('Save Triggers');
    expect(labels).toContain('Cloud / Local Storage');
    expect(labels).toContain('Conflict Resolution');
    expect(labels).toContain('Corruption Recovery');
    expect(labels).toContain('Slots UI');
    expect(labels).toContain('Load-Time Budget');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Seeded starter entity from new-catalogs.ts
    const entity = {
      id: 'save-bonfire',
      name: 'Bonfire',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: ≥ 300 chars → pass ────────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect(String(briefOut.data!.brief).length).toBeGreaterThanOrEqual(300);
    // Must mention discrete-vs-ephemeral invariant (per state-graph-fsm-wiring canon)
    expect(String(briefOut.data!.brief)).toMatch(/ephemeral/i);
    expect(String(briefOut.data!.brief)).toMatch(/persist/i);

    // ── State Schema: persisted / ephemeral / schemaVersion / fieldsNote → pass ─
    const stateSchema = p!.steps.find((s) => s.label === 'State Schema')!;
    const schemaOut = stateSchema.produce(entity);
    expect(stateSchema.accept(schemaOut.data ?? {}).status).toBe('pass');
    const schema = schemaOut.data!.stateSchema as Record<string, unknown>;
    expect(schema.persisted).toBeDefined();
    expect(schema.ephemeral).toBeDefined();
    expect(schema.schemaVersion).toBe(1);
    // Persisted fields must include player attributes + inventory (discrete mutations)
    const persisted = schema.persisted as Record<string, unknown>;
    expect(Array.isArray(persisted.fields)).toBe(true);
    expect((persisted.fields as string[]).some((f) => /inventory/i.test(f))).toBe(true);
    expect((persisted.fields as string[]).some((f) => /level/i.test(f))).toBe(true);
    // Ephemeral must include AI / GAS / combat (never persisted per canon state-graph-fsm-wiring)
    const ephemeral = schema.ephemeral as Record<string, unknown>;
    expect(Array.isArray(ephemeral.fields)).toBe(true);
    expect((ephemeral.fields as string[]).some((f) => /AI/i.test(f))).toBe(true);
    expect((ephemeral.fields as string[]).some((f) => /GAS|GE|effect/i.test(f))).toBe(true);
    // Wiring contract declared
    const schemaWiring = schema.wiringContract as Record<string, unknown>;
    expect(typeof schemaWiring.grantedBy).toBe('string');
    expect(typeof schemaWiring.activatedBy).toBe('string');
    expect(Array.isArray(schemaWiring.dependencies)).toBe(true);
    expect(typeof schemaWiring.verification).toBe('string');

    // ── Versioning & Migration: fields populated → pass ───────────────────────
    const versioning = p!.steps.find((s) => s.label === 'Versioning & Migration')!;
    const verOut = versioning.produce(entity);
    expect(versioning.accept(verOut.data ?? {}).status).toBe('pass');
    const v = verOut.data!.versioning as Record<string, unknown>;
    expect(v.currentVersion).toBe(1);
    expect(Array.isArray(v.upgradeRules)).toBe(true);

    // ── Save Triggers: fields populated → pass ────────────────────────────────
    const triggers = p!.steps.find((s) => s.label === 'Save Triggers')!;
    const trigOut = triggers.produce(entity);
    expect(triggers.accept(trigOut.data ?? {}).status).toBe('pass');
    const t = trigOut.data!.triggers as Record<string, unknown>;
    expect(t.manualTrigger).toBeDefined();
    expect(Array.isArray(t.autosaveTriggers)).toBe(true);
    // Autosave on zone transition + quest stage; death must NOT be a save trigger
    const autosave = t.autosaveTriggers as Array<Record<string, unknown>>;
    expect(autosave.some((a) => /zone/i.test(String(a.event)))).toBe(true);
    expect(autosave.some((a) => /quest/i.test(String(a.event)))).toBe(true);
    const deathEntry = autosave.find((a) => /death/i.test(String(a.event)));
    expect(deathEntry).toBeDefined();
    // Death entry must NOT commit a save
    expect(String(deathEntry!.slotRule)).toMatch(/DOES NOT save/i);
    // Triggers wiring contract
    const trigWiring = t.wiringContract as Record<string, unknown>;
    expect(trigWiring.grantedBy).toBeDefined();
    expect(trigWiring.activatedBy).toBeDefined();

    // ── Cloud / Local Storage: fields populated → pass ────────────────────────
    const storage = p!.steps.find((s) => s.label === 'Cloud / Local Storage')!;
    const storeOut = storage.produce(entity);
    expect(storage.accept(storeOut.data ?? {}).status).toBe('pass');
    const s2 = storeOut.data!.storage as Record<string, unknown>;
    expect(s2.slotCount).toBe(3);

    // ── Conflict Resolution: policy = last-write / newest-wins ───────────────
    const conflict = p!.steps.find((s) => s.label === 'Conflict Resolution')!;
    const confOut = conflict.produce(entity);
    expect(conflict.accept(confOut.data ?? {}).status).toBe('pass');
    const c = confOut.data!.conflict as Record<string, unknown>;
    expect(String(c.policy)).toMatch(/last-write|newest-wins/i);

    // ── Corruption Recovery: detection + recovery path + backup ─────────────
    const corruption = p!.steps.find((s) => s.label === 'Corruption Recovery')!;
    const corrOut = corruption.produce(entity);
    expect(corruption.accept(corrOut.data ?? {}).status).toBe('pass');
    const cr = corrOut.data!.corruption as Record<string, unknown>;
    expect(typeof cr.detectionMethod).toBe('string');
    expect(Array.isArray(cr.recoveryPath)).toBe(true);
    // Recovery path must mention backup slot
    expect((cr.recoveryPath as string[]).some((step) => /backup/i.test(step))).toBe(true);

    // ── Slots UI: widget + format + position + hudBinding → pass ─────────────
    const slotsUI = p!.steps.find((s) => s.label === 'Slots UI')!;
    const slotsOut = slotsUI.produce(entity);
    expect(slotsUI.accept(slotsOut.data ?? {}).status).toBe('pass');
    const ui = slotsOut.data!.slotsUI as Record<string, unknown>;
    expect(ui.widget).toBe('WBP_SaveSlots');
    expect(typeof ui.hudBinding).toBe('string');
    expect(slotsOut.ueAssets).toBeDefined();
    expect(slotsOut.ueAssets!.some((a) => a.includes('WBP_SaveSlots'))).toBe(true);

    // ── Load-Time Budget: measuredMs ≤ 45 ms (within 50% of 30 ms) → pass ────
    const loadBudget = p!.steps.find((s) => s.label === 'Load-Time Budget')!;
    const budgetOut = loadBudget.produce(entity);
    expect(loadBudget.accept(budgetOut.data ?? {}).status).toBe('pass');
    const lb = budgetOut.data!.loadBudget as Record<string, unknown>;
    expect(Number(lb.measuredMs)).toBeLessThanOrEqual(45);
    expect(Number(lb.targetMs)).toBe(30);

    // ── Icon 2D Art: selected L1 → pass; icon-sets link present ──────────────
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.links).toBeDefined();
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Test Gate: always L3 deferred (VSSaveLoadTest) ────────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['all done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥4 assets, core symbols listed, wiring contract ─────────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(4);
    expect(assets.some((a) => a.includes('UARPGSaveGame'))).toBe(true);
    expect(assets.some((a) => a.includes('AARPGInteractableBase') || a.includes('BP_Bonfire'))).toBe(true);
    // Wiring contract
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(typeof pkgWiring.grantedBy).toBe('string');
    expect(typeof pkgWiring.activatedBy).toBe('string');
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');

    // ── L2 static checks: UARPGSaveGame symbol (fixture Rows.h doesn't have it → deferred ok) ─
    const ueRoot = join(process.cwd(), 'src/__tests__/fixtures/ue');
    const stateSchemaChecks = stateSchema.staticChecks!(entity);
    expect(stateSchemaChecks).toHaveLength(1);
    const l2Result = stateSchemaChecks[0](ueRoot);
    expect(l2Result.tier).toBe('L2');
    // Symbol is not in the fixture → deferred (not fail) is the correct L2 result
    expect(['pass', 'deferred']).toContain(l2Result.status);
  });
});
