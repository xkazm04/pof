import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const sheet = JSON.parse(readFileSync(join(ROOT, '_sheet.json'), 'utf-8'));
const rows = sheet['Catalog Pipelines'].slice(1); // drop header

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// entity name → [catalogId, status]
const CATALOG = {
  'Item': ['items', 'existing'], 'Loot Table': ['loot-tables', 'existing'], 'Bestiary Entry': ['bestiary', 'existing'],
  'Combat Map': ['combat-map', 'existing'], 'Zone Map': ['zone-map', 'existing'], 'Screen Flow': ['screen-flow', 'existing'],
  'State Graph': ['state-graph', 'existing'], 'Material': ['materials', 'existing'],
  'Quest': ['quests', 'new'], 'Dialog Tree': ['dialog-trees', 'new'], 'Cutscene / Cinematic': ['cutscenes', 'new'],
  'Codex / Lore Entry': ['codex', 'new'], 'Faction / Reputation System': ['factions', 'new'],
  'Character (Hero / NPC)': ['characters', 'new'], 'Prop / Environment Asset': ['props', 'new'],
  'Skill / Ability': ['spellbook', 'existing'], 'Status Effect / Buff': ['status-effects', 'new'],
  'Crafting Recipe': ['crafting-recipes', 'new'], 'Vendor / Shop': ['vendors', 'new'],
  'Progression Curve': ['progression-curves', 'new'], 'Achievement / Trophy': ['achievements', 'new'],
  'Save / Checkpoint': ['save-points', 'new'], 'Music Track / Stinger': ['music', 'new'],
  'Ambient Soundscape': ['ambient', 'new'], 'VFX Asset': ['vfx', 'new'], 'HUD Element': ['hud-elements', 'new'],
  'Icon Set': ['icon-sets', 'new'], 'Input Scheme': ['input-schemes', 'new'], 'Tutorial Beat': ['tutorial-beats', 'new'],
  'Currency': ['currencies', 'new'],
};

// first named asset per row (matches NEW_CATALOGS starters where applicable)
const TARGET = {
  'Skill / Ability': 'Fireball', 'Item': 'Iron Longsword', 'Loot Table': 'Brute Drop Table', 'Bestiary Entry': 'Brute',
  'Combat Map': 'Arena Slice', 'Zone Map': 'Ashen Forest', 'Screen Flow': 'Main Menu Flow', 'State Graph': 'Door FSM',
  'Material': 'Weathered Stone', 'Quest': 'The Ember Pact', 'Dialog Tree': 'Gatekeeper Greeting',
  'Cutscene / Cinematic': 'Prologue: The Fall', 'Codex / Lore Entry': 'The Sundering', 'Faction / Reputation System': 'The Ashen Order',
  'Character (Hero / NPC)': 'Captain Vael', 'Prop / Environment Asset': 'Reinforced Crate', 'Status Effect / Buff': 'Burning',
  'Crafting Recipe': 'Health Potion', 'Vendor / Shop': 'Wandering Merchant', 'Progression Curve': 'Hero Level Curve',
  'Achievement / Trophy': 'First Blood', 'Save / Checkpoint': 'Bonfire Checkpoint', 'Music Track / Stinger': 'Combat Theme A',
  'Ambient Soundscape': 'Forest Day', 'VFX Asset': 'Fire Impact Burst', 'HUD Element': 'Health Bar', 'Icon Set': 'Ability Icons',
  'Input Scheme': 'Gamepad Default', 'Tutorial Beat': 'Learn to Dodge', 'Currency': 'Gold',
};

const indexRows = [];
for (const r of rows) {
  const [category, entity, description, ...steps] = r;
  const cleanSteps = steps.filter(Boolean);
  const [catalogId, status] = CATALOG[entity] ?? [slug(entity), 'new'];
  const catSlug = slug(category), entSlug = slug(entity);
  const rel = `${catSlug}/${entSlug}/plan.md`;
  const stepList = cleanSteps
    .map((s, i) => `- [ ] ${i + 1}. ${s}  \n  _agent: TBD-by-session · reuse/gap: TBD-by-session_`)
    .join('\n');
  const body = `# ${entity} — Catalog Pipeline Brief

**Category:** ${category} · **Catalog:** \`${catalogId}\` (${status}) · **Description:** ${description}

> Read [\`../../index.md\`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**${TARGET[entity] ?? entity}** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
${stepList}

## PoF integration
- **Catalog:** \`${catalogId}\` (${status === 'existing' ? 'already registered' : 'registered in Phase A'}).
- **Data schema:** design during the schema step; persist via the catalog \`data\` field.
- **Reuse / gaps:** assess against existing PoF capabilities (catalogs, recipes, dispatches, Leonardo-2D, Blender, audio-import, GAS B3 codegen, functional tests) — record in Session Findings.

## Cross-catalog dependencies
- _Identify during design (e.g. consumers/producers of other catalog rows)._

## Session Findings
_Fill this in at the end of the session._
### Cross-catalog opportunities
-
### Gaps / blockers for future sessions
-
`;
  const outPath = join(ROOT, catSlug, entSlug, 'plan.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, body, 'utf-8');
  indexRows.push(`| ${category} | [${entity}](${rel}) | \`${catalogId}\` | ${status} |`);
}

writeFileSync(join(ROOT, '_index_rows.md'), indexRows.join('\n'), 'utf-8');
console.log(`generated ${rows.length} plan.md files`);
