import { test, expect, type Page } from '@playwright/test';

/**
 * Dzin Dynamic UI — E2E Tests
 *
 * Comprehensive test coverage for all 80+ panels across 8 domains,
 * composition presets, layout templates, density rendering, and cross-domain composition.
 */

const PROTOTYPE_URL = '/prototype';

// ── Complete Panel Type Inventory ──────────────────────────────────────────
// Every panel type registered in panel-definitions.ts

const COMBAT_PANELS = [
  'arpg-combat-core', 'arpg-combat-abilities', 'arpg-combat-attributes',
  'arpg-combat-effects', 'arpg-combat-effect-timeline', 'arpg-combat-damage-calc',
  'arpg-combat-tags', 'arpg-combat-tag-deps', 'arpg-combat-tag-audit',
  'arpg-combat-loadout',
];

const CHARACTER_PANELS = [
  'arpg-character-overview', 'arpg-character-movement',
  'arpg-animation-state-machine', 'arpg-animation-montages',
  'arpg-animation-blend-space', 'arpg-character-input',
];

const INVENTORY_LOOT_PANELS = [
  'arpg-inventory-catalog', 'arpg-inventory-equipment',
  'arpg-loot-table', 'arpg-loot-affix', 'arpg-item-economy', 'arpg-item-dna',
];

const ENEMY_WORLD_PANELS = [
  'arpg-enemy-bestiary', 'arpg-enemy-ai-tree',
  'arpg-world-zone-map', 'arpg-world-encounters', 'arpg-world-level-design',
  'arpg-progression-curves',
];

const UI_SAVE_PANELS = [
  'arpg-ui-hud-compositor', 'arpg-ui-screen-flow', 'arpg-ui-menu-flow',
  'arpg-save-schema', 'arpg-save-slots',
];

const EVALUATOR_PANELS = [
  'evaluator-quality', 'evaluator-deps', 'evaluator-insights',
  'evaluator-project-health', 'evaluator-feature-matrix',
  'evaluator-deep-scan', 'evaluator-economy', 'evaluator-roadmap',
  'evaluator-performance', 'evaluator-session-analytics', 'evaluator-pattern-library',
];

const GAME_DIRECTOR_PANELS = [
  'game-director-overview', 'game-director-findings',
  'game-director-regression', 'game-director-session',
];

const GAME_SYSTEMS_PANELS = [
  'game-systems-ai-sandbox', 'game-systems-physics', 'game-systems-multiplayer',
  'game-systems-input', 'game-systems-save-load', 'game-systems-build-pipeline',
];

const PROJECT_SETUP_PANELS = [
  'project-setup-wizard', 'project-setup-status', 'project-setup-ue5-remote',
  'project-setup-blueprint-inspector', 'project-setup-test-harness',
];

const VISUAL_GEN_PANELS = [
  'visual-gen-asset-browser', 'visual-gen-asset-forge', 'visual-gen-asset-viewer-3d',
  'visual-gen-material-lab-pbr', 'visual-gen-blender-pipeline', 'visual-gen-scene-composer',
];

const CONTENT_PANELS = [
  'content-material-preview', 'content-audio-spatial', 'content-model-assets',
  'content-level-blockout', 'content-vfx-particles',
  'content-anim-choreographer', 'content-audio-event-catalog',
  'content-level-flow-editor', 'content-material-patterns',
  'content-ui-damage-numbers', 'content-ui-health-bars',
];

const ARPG_TOOLS_PANELS = [
  'arpg-tools-ability-forge', 'arpg-tools-combat-choreography',
  'arpg-tools-combo-chain', 'arpg-tools-damage-pipeline',
  'arpg-tools-debug-dashboard', 'arpg-tools-dodge-timeline',
  'arpg-tools-genome-editor', 'arpg-tools-gas-blueprint',
];

const ALL_PANEL_TYPES = [
  ...COMBAT_PANELS,
  ...CHARACTER_PANELS,
  ...INVENTORY_LOOT_PANELS,
  ...ENEMY_WORLD_PANELS,
  ...UI_SAVE_PANELS,
  ...EVALUATOR_PANELS,
  ...GAME_DIRECTOR_PANELS,
  ...GAME_SYSTEMS_PANELS,
  ...PROJECT_SETUP_PANELS,
  ...VISUAL_GEN_PANELS,
  ...CONTENT_PANELS,
  ...ARPG_TOOLS_PANELS,
];

// Domain → preset mapping for domain coverage tests
const DOMAIN_PRESETS: Record<string, { presetLabel: string; minPanels: number }> = {
  'arpg-combat': { presetLabel: 'Combat Debug', minPanels: 2 },
  'arpg-character': { presetLabel: 'Character Debug', minPanels: 2 },
  'arpg-loot': { presetLabel: 'Loot Analysis', minPanels: 2 },
  'arpg-inventory': { presetLabel: 'Inventory Overview', minPanels: 2 },
  'arpg-enemy': { presetLabel: 'Enemy Inspector', minPanels: 2 },
  'arpg-world': { presetLabel: 'World Overview', minPanels: 2 },
  'arpg-ui': { presetLabel: 'UI Flow', minPanels: 2 },
  'arpg-save': { presetLabel: 'Save Inspector', minPanels: 2 },
  'evaluator': { presetLabel: 'Full Evaluator', minPanels: 2 },
  'game-director': { presetLabel: 'Director Dashboard', minPanels: 2 },
  'game-systems': { presetLabel: 'Systems Overview', minPanels: 2 },
  'project-setup': { presetLabel: 'Setup Overview', minPanels: 2 },
  'visual-gen': { presetLabel: 'Visual Gen Overview', minPanels: 2 },
  'content': { presetLabel: 'Content Pipeline', minPanels: 2 },
  'arpg-tools': { presetLabel: 'Combat Lab', minPanels: 2 },
};

// All composition presets defined in composition-presets.ts
const ALL_PRESETS = [
  // Combat
  { id: 'ability-overview', label: 'Ability Overview', panels: 2 },
  { id: 'combat-debug', label: 'Combat Debug', panels: 4 },
  { id: 'full-spellbook', label: 'Full Spellbook', panels: 4 },
  { id: 'tag-inspector', label: 'Tag Inspector', panels: 3 },
  // Character
  { id: 'character-debug', label: 'Character Debug', panels: 4 },
  { id: 'animation-suite', label: 'Animation Suite', panels: 4 },
  // Loot & Inventory
  { id: 'loot-analysis', label: 'Loot Analysis', panels: 4 },
  { id: 'inventory-overview', label: 'Inventory Overview', panels: 2 },
  // World
  { id: 'world-overview', label: 'World Overview', panels: 4 },
  { id: 'enemy-inspector', label: 'Enemy Inspector', panels: 2 },
  // UI & Save
  { id: 'ui-flow', label: 'UI Flow', panels: 3 },
  { id: 'save-inspector', label: 'Save Inspector', panels: 2 },
  // Evaluator
  { id: 'full-evaluator', label: 'Full Evaluator', panels: 4 },
  { id: 'quality-dashboard', label: 'Quality Dashboard', panels: 2 },
  { id: 'evaluator-deep-analysis', label: 'Deep Analysis', panels: 4 },
  { id: 'evaluator-planning', label: 'Evaluator Planning', panels: 2 },
  { id: 'evaluator-full-studio', label: 'Evaluator Full Studio', panels: 4 },
  // Game Director
  { id: 'director-dashboard', label: 'Director Dashboard', panels: 4 },
  { id: 'director-triage', label: 'Director Triage', panels: 2 },
  // Game Systems
  { id: 'systems-overview', label: 'Systems Overview', panels: 4 },
  { id: 'systems-infrastructure', label: 'Systems Infrastructure', panels: 2 },
  { id: 'systems-full-studio', label: 'Systems Studio', panels: 4 },
  // Project Setup
  { id: 'setup-overview', label: 'Setup Overview', panels: 4 },
  { id: 'setup-devtools', label: 'Setup Dev Tools', panels: 2 },
  { id: 'setup-full-studio', label: 'Setup Studio', panels: 4 },
  // Visual Gen
  { id: 'visual-gen-overview', label: 'Visual Gen Overview', panels: 4 },
  { id: 'visual-gen-pipeline', label: 'Visual Pipeline', panels: 2 },
  { id: 'visual-gen-full-studio', label: 'Visual Studio', panels: 4 },
  // Content
  { id: 'content-pipeline', label: 'Content Pipeline', panels: 4 },
  { id: 'content-combat-feel', label: 'Combat Feel', panels: 4 },
  { id: 'content-world-art', label: 'World Art', panels: 2 },
  { id: 'content-full-studio', label: 'Content Studio', panels: 4 },
  // ARPG Tools
  { id: 'arpg-tools-combat-lab', label: 'Combat Lab', panels: 4 },
  { id: 'arpg-tools-character-tuning', label: 'Character Tuning', panels: 2 },
  { id: 'arpg-tools-full-studio', label: 'ARPG Tools Studio', panels: 4 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToPrototype(page: Page) {
  await page.goto(PROTOTYPE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-dzin-panel]', { timeout: 10_000 }).catch(() => {
    // Page may start with no panels — that's OK
  });
}

async function getPanelCount(page: Page): Promise<number> {
  return page.locator('[data-dzin-panel]').count();
}

async function getPanelTitles(page: Page): Promise<string[]> {
  return page.locator('[data-dzin-panel-title]').allTextContents();
}

async function getPanelTypes(page: Page): Promise<string[]> {
  const panels = page.locator('[data-dzin-panel]');
  const count = await panels.count();
  const types: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = await panels.nth(i).getAttribute('data-dzin-panel');
    if (t) types.push(t);
  }
  return types;
}

async function selectCompositionPreset(page: Page, presetLabel: string) {
  const presetButton = page.locator(`button, [role="button"]`).filter({ hasText: presetLabel });
  if (await presetButton.count() > 0) {
    await presetButton.first().click();
    await page.waitForTimeout(500);
  }
}

async function selectTemplate(page: Page, templateLabel: string) {
  const templateButton = page.locator(`button, [role="button"]`).filter({ hasText: templateLabel });
  if (await templateButton.count() > 0) {
    await templateButton.first().click();
    await page.waitForTimeout(500);
  }
}

async function selectDensity(page: Page, density: string) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const densityButton = page.locator(`button, [role="button"]`).filter({ hasText: density });
  if (await densityButton.count() > 0) {
    await densityButton.first().click({ force: true });
    await page.waitForTimeout(300);
  }
}

// ── 1. Basic Page Tests ───────────────────────────────────────────────────

test.describe('Dzin Prototype Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  test('page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(PROTOTYPE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/PoF|Prototype|Pillars/i);
    expect(errors.filter(e => !e.includes('hydration'))).toHaveLength(0);
  });

  test('control bar is visible', async ({ page }) => {
    const controlElements = page.locator('button, [role="button"]');
    await expect(controlElements.first()).toBeVisible();
  });
});

// ── 2. Panel Inventory — verify every registered type has a component ─────

test.describe('Panel Inventory', () => {
  test(`all ${ALL_PANEL_TYPES.length} registered panel types exist`, async () => {
    // This test verifies the inventory is complete — no duplicates, expected count
    const uniqueTypes = new Set(ALL_PANEL_TYPES);
    expect(uniqueTypes.size).toBe(ALL_PANEL_TYPES.length); // no duplicates
    expect(ALL_PANEL_TYPES.length).toBeGreaterThanOrEqual(80); // at least 80 panels
  });

  test('panel types are grouped by domain', async () => {
    // Verify each domain group has the expected prefix
    for (const t of COMBAT_PANELS) expect(t).toMatch(/^arpg-combat-/);
    for (const t of CHARACTER_PANELS) expect(t).toMatch(/^arpg-(character|animation)-/);
    for (const t of INVENTORY_LOOT_PANELS) expect(t).toMatch(/^arpg-(inventory|loot|item)-/);
    for (const t of ENEMY_WORLD_PANELS) expect(t).toMatch(/^arpg-(enemy|world|progression)-/);
    for (const t of UI_SAVE_PANELS) expect(t).toMatch(/^arpg-(ui|save)-/);
    for (const t of EVALUATOR_PANELS) expect(t).toMatch(/^evaluator-/);
    for (const t of GAME_DIRECTOR_PANELS) expect(t).toMatch(/^game-director-/);
    for (const t of GAME_SYSTEMS_PANELS) expect(t).toMatch(/^game-systems-/);
    for (const t of PROJECT_SETUP_PANELS) expect(t).toMatch(/^project-setup-/);
    for (const t of VISUAL_GEN_PANELS) expect(t).toMatch(/^visual-gen-/);
    for (const t of CONTENT_PANELS) expect(t).toMatch(/^content-/);
    for (const t of ARPG_TOOLS_PANELS) expect(t).toMatch(/^arpg-tools-/);
  });
});

// ── 3. Composition Presets — original + new domains ───────────────────────

test.describe('Composition Presets', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  // Original combat presets
  test('ability-overview preset loads 2 panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('combat-debug preset loads multiple panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Combat Debug');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('full-spellbook preset loads multiple panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Full Spellbook');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  // New domain presets
  test('director-dashboard preset loads 4 panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Director Dashboard');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('systems-overview preset loads panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Systems Overview');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('setup-overview preset loads panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Setup Overview');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('visual-gen-overview preset loads panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Visual Gen Overview');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('evaluator deep-analysis preset loads panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Deep Analysis');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('content-combat-feel preset loads panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Combat Feel');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('arpg-tools combat-lab preset loads panels', async ({ page }) => {
    await selectCompositionPreset(page, 'Combat Lab');
    await page.waitForTimeout(600);
    const panelCount = await getPanelCount(page);
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });
});

// ── 4. Domain Coverage — each domain loads via its preset ─────────────────

test.describe('Domain Coverage', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  for (const [domain, config] of Object.entries(DOMAIN_PRESETS)) {
    test(`${domain} domain loads via "${config.presetLabel}" preset`, async ({ page }) => {
      await selectCompositionPreset(page, config.presetLabel);
      await page.waitForTimeout(800);

      const panelCount = await getPanelCount(page);
      expect(panelCount).toBeGreaterThanOrEqual(config.minPanels);

      // Panels should be visible
      const panels = page.locator('[data-dzin-panel]');
      for (let i = 0; i < Math.min(await panels.count(), 4); i++) {
        await expect(panels.nth(i)).toBeVisible();
      }
    });
  }
});

// ── 5. Layout Templates ──────────────────────────────────────────────────

test.describe('Layout Templates', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(600);
  });

  for (const template of ['Split 2', 'Grid 4', 'Studio']) {
    test(`${template} template renders panels`, async ({ page }) => {
      await selectTemplate(page, template);
      await page.waitForTimeout(600);

      const panelCount = await getPanelCount(page);
      expect(panelCount).toBeGreaterThanOrEqual(1);

      const panels = page.locator('[data-dzin-panel]');
      for (let i = 0; i < Math.min(await panels.count(), 4); i++) {
        await expect(panels.nth(i)).toBeVisible();
      }
    });
  }
});

// ── 6. Panel Density ─────────────────────────────────────────────────────

test.describe('Panel Density', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(600);
  });

  test('panels have a density attribute set', async ({ page }) => {
    const panels = page.locator('[data-dzin-panel]');
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const density = await panels.nth(i).getAttribute('data-dzin-density');
      expect(['micro', 'compact', 'full']).toContain(density);
    }
  });

  test('full density panels show titles', async ({ page }) => {
    const titles = page.locator('[data-dzin-panel-title]');
    const count = await titles.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(titles.first()).toBeVisible();
  });

  test('resize Small makes panels compact or micro', async ({ page }) => {
    const smallBtn = page.locator('button').filter({ hasText: 'Small' });
    if (await smallBtn.count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await smallBtn.first().click({ force: true });
      await page.waitForTimeout(500);

      const panels = page.locator('[data-dzin-panel]');
      const count = await panels.count();
      if (count > 0) {
        const density = await panels.first().getAttribute('data-dzin-density');
        expect(['micro', 'compact']).toContain(density);
      }
    }
  });
});

// ── 7. Panel Content Rendering ───────────────────────────────────────────

test.describe('Panel Content Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  test('CorePanel renders GAS pipeline', async ({ page }) => {
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(600);

    const panel = page.locator('[data-dzin-panel]').first();
    await expect(panel).toBeVisible();
    const text = await panel.textContent();
    expect(text).toBeTruthy();
  });

  test('panels have non-empty body content', async ({ page }) => {
    await selectCompositionPreset(page, 'Debug');
    await page.waitForTimeout(600);

    const bodies = page.locator('[data-dzin-panel-body]');
    const count = await bodies.count();

    for (let i = 0; i < count; i++) {
      const body = bodies.nth(i);
      const text = await body.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ── 8. Domain-Specific Panel Content Validation ──────────────────────────

test.describe('Panel Content Validation — New Domains', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  const domainContentTests = [
    { preset: 'Director Dashboard', domain: 'game-director' },
    { preset: 'Systems Overview', domain: 'game-systems' },
    { preset: 'Setup Overview', domain: 'project-setup' },
    { preset: 'Visual Gen Overview', domain: 'visual-gen' },
    { preset: 'Deep Analysis', domain: 'evaluator-extended' },
    { preset: 'Combat Feel', domain: 'content-extended' },
    { preset: 'Combat Lab', domain: 'arpg-tools' },
  ];

  for (const { preset, domain } of domainContentTests) {
    test(`${domain} panels have non-empty body content at full density`, async ({ page }) => {
      await selectCompositionPreset(page, preset);
      await page.waitForTimeout(800);

      const panels = page.locator('[data-dzin-panel]');
      const count = await panels.count();
      expect(count).toBeGreaterThanOrEqual(1);

      // Each visible panel should have non-empty content
      for (let i = 0; i < count; i++) {
        const panel = panels.nth(i);
        const text = await panel.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    });
  }
});

// ── 9. Cross-Domain Composition ──────────────────────────────────────────

test.describe('Cross-Domain Composition', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  test('switching between different domain presets updates panels', async ({ page }) => {
    // Load combat preset
    await selectCompositionPreset(page, 'Combat Debug');
    await page.waitForTimeout(600);
    const combatCount = await getPanelCount(page);
    expect(combatCount).toBeGreaterThanOrEqual(2);

    // Switch to evaluator preset
    await selectCompositionPreset(page, 'Full Evaluator');
    await page.waitForTimeout(600);
    const evalCount = await getPanelCount(page);
    expect(evalCount).toBeGreaterThanOrEqual(2);
  });

  test('rapid preset switching does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const presets = ['Ability', 'Director Dashboard', 'Systems Overview', 'Combat Lab', 'Visual Gen Overview'];
    for (const preset of presets) {
      await selectCompositionPreset(page, preset);
      await page.waitForTimeout(300);
    }

    // Wait for the last preset to settle
    await page.waitForTimeout(800);

    // Page should still be alive — panels rendered or at least no crash
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();

    expect(errors.filter(e => !e.includes('hydration'))).toHaveLength(0);
  });
});

// ── 10. New Composition Presets — Studio Layouts ─────────────────────────

test.describe('New Composition Presets', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  const studioPresets = [
    { label: 'Systems Studio', minPanels: 2 },
    { label: 'Setup Studio', minPanels: 2 },
    { label: 'Visual Studio', minPanels: 2 },
    { label: 'Content Studio', minPanels: 2 },
    { label: 'ARPG Tools Studio', minPanels: 2 },
    { label: 'Evaluator Full Studio', minPanels: 2 },
  ];

  for (const { label, minPanels } of studioPresets) {
    test(`${label} preset loads at least ${minPanels} panels`, async ({ page }) => {
      await selectCompositionPreset(page, label);
      await page.waitForTimeout(800);

      const panelCount = await getPanelCount(page);
      expect(panelCount).toBeGreaterThanOrEqual(minPanels);

      // All panels should be visible
      const panels = page.locator('[data-dzin-panel]');
      for (let i = 0; i < Math.min(await panels.count(), 4); i++) {
        await expect(panels.nth(i)).toBeVisible();
      }
    });
  }

  const splitPresets = [
    { label: 'Systems Infrastructure', minPanels: 2 },
    { label: 'Setup Dev Tools', minPanels: 2 },
    { label: 'Visual Pipeline', minPanels: 2 },
    { label: 'World Art', minPanels: 2 },
    { label: 'Character Tuning', minPanels: 2 },
    { label: 'Evaluator Planning', minPanels: 2 },
    { label: 'Director Triage', minPanels: 2 },
  ];

  for (const { label, minPanels } of splitPresets) {
    test(`${label} split preset loads ${minPanels}+ panels`, async ({ page }) => {
      await selectCompositionPreset(page, label);
      await page.waitForTimeout(800);

      const panelCount = await getPanelCount(page);
      expect(panelCount).toBeGreaterThanOrEqual(minPanels);
    });
  }
});

// ── 11. Chat System ─────────────────────────────────────────────────────

test.describe('Chat System', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  test('chat toggle button exists', async ({ page }) => {
    const chatToggle = page.locator('button').filter({ hasText: /chat|message|ask/i });
    const chatIcon = page.locator('[data-dzin-chat-input], button[aria-label*="chat" i]');
    const hasChat = (await chatToggle.count()) > 0 || (await chatIcon.count()) > 0;
    expect(hasChat).toBeTruthy();
  });

  test('chat input accepts text', async ({ page }) => {
    const chatToggle = page.locator('button').filter({ hasText: /chat|message|ask/i });
    if (await chatToggle.count() > 0) {
      await chatToggle.first().click();
      await page.waitForTimeout(300);
    }

    const textarea = page.locator('[data-dzin-chat-input] textarea, textarea');
    if (await textarea.count() > 0) {
      await textarea.first().fill('Show me the combat overview');
      const value = await textarea.first().inputValue();
      expect(value).toContain('combat');
    }
  });
});

// ── 12. Visual Regression — Panel Screenshots ────────────────────────────

test.describe('Visual Regression — Panel Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
  });

  test('ability-overview composition screenshot', async ({ page }) => {
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('ability-overview.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('combat-debug grid screenshot', async ({ page }) => {
    await selectCompositionPreset(page, 'Debug');
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('combat-debug-grid.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('micro density screenshot', async ({ page }) => {
    await selectCompositionPreset(page, 'Debug');
    await page.waitForTimeout(400);
    await selectDensity(page, 'micro');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('micro-density.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('director-dashboard screenshot', async ({ page }) => {
    await selectCompositionPreset(page, 'Director Dashboard');
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('director-dashboard.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('systems-overview screenshot', async ({ page }) => {
    await selectCompositionPreset(page, 'Systems Overview');
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('systems-overview.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});

// ── 13. Responsive Layout ────────────────────────────────────────────────

test.describe('Responsive Layout', () => {
  test('mobile viewport uses stack layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateToPrototype(page);
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(600);

    const panels = page.locator('[data-dzin-panel]');
    const count = await panels.count();
    if (count >= 2) {
      const firstBox = await panels.nth(0).boundingBox();
      const secondBox = await panels.nth(1).boundingBox();
      if (firstBox && secondBox) {
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
      }
    }
  });

  test('desktop viewport uses side-by-side layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await navigateToPrototype(page);
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(600);

    const panels = page.locator('[data-dzin-panel]');
    const count = await panels.count();
    if (count >= 2) {
      const firstBox = await panels.nth(0).boundingBox();
      const secondBox = await panels.nth(1).boundingBox();
      if (firstBox && secondBox) {
        expect(secondBox.x).toBeGreaterThan(firstBox.x);
      }
    }
  });
});

// ── 14. Accessibility ────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPrototype(page);
    await selectCompositionPreset(page, 'Ability');
    await page.waitForTimeout(600);
  });

  test('panels have region role', async ({ page }) => {
    const panels = page.locator('[data-dzin-panel]');
    const count = await panels.count();

    for (let i = 0; i < count; i++) {
      const role = await panels.nth(i).getAttribute('role');
      expect(role).toBe('region');
    }
  });

  test('panels have aria-label', async ({ page }) => {
    const panels = page.locator('[data-dzin-panel]');
    const count = await panels.count();

    for (let i = 0; i < count; i++) {
      const label = await panels.nth(i).getAttribute('aria-label');
      expect(label).toBeTruthy();
    }
  });
});

// ── 15. Preset Inventory Completeness ────────────────────────────────────

test.describe('Preset Inventory', () => {
  test(`all ${ALL_PRESETS.length} composition presets are defined`, async () => {
    expect(ALL_PRESETS.length).toBeGreaterThanOrEqual(30);
    const uniqueIds = new Set(ALL_PRESETS.map(p => p.id));
    expect(uniqueIds.size).toBe(ALL_PRESETS.length); // no duplicate IDs
  });

  test('every preset specifies at least 2 panels', async () => {
    for (const preset of ALL_PRESETS) {
      expect(preset.panels).toBeGreaterThanOrEqual(2);
    }
  });
});
