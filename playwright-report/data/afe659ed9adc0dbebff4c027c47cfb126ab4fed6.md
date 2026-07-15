# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalog-pipeline-walker.spec.ts >> catalog pipeline: vendors >> walks 11 steps to config-complete acceptance + persists
- Location: e2e\catalog-pipeline-walker.spec.ts:26:9

# Error details

```
Error: vendors · Concept Brief did not persist with status pass

vendors · Concept Brief did not persist with status pass

expect(received).toBe(expected) // Object.is equality

Expected: "pass"
Received: "fail"

Call Log:
- Timeout 10000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "Skip to canvas" [ref=e3] [cursor=pointer]:
      - /url: "#lab-canvas"
    - banner [ref=e4]:
      - generic [ref=e6]:
        - text: PoF·LAB
        - generic [ref=e7]: sheet · vendors
      - generic [ref=e8]:
        - button "Catalogs" [pressed] [ref=e9] [cursor=pointer]
        - button "Matrix" [ref=e10] [cursor=pointer]
        - button "Canon" [ref=e11] [cursor=pointer]
        - button "+ One-shot" [ref=e12] [cursor=pointer]
        - button "Status" [ref=e13] [cursor=pointer]
        - button "3D Studio" [ref=e14] [cursor=pointer]
        - button "Legacy shell" [ref=e15] [cursor=pointer]
      - generic [ref=e16]:
        - status "The drain runner is idle — the UE editor lease is free." [ref=e17]: Runner · idle
        - button "Open Bridge Doctor diagnostics" [ref=e20] [cursor=pointer]:
          - status [ref=e21]:
            - generic [ref=e23]: UE bridge · disconnected
        - button "Switch to Studio Dark theme" [ref=e24] [cursor=pointer]:
          - img [ref=e25]
    - generic [ref=e27]:
      - region "Project next steps" [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: Do next
          - 'button "Review: Fireball in Spellbook — Concept Brief. local reads pass, server says fail" [ref=e31] [cursor=pointer]':
            - generic [ref=e32]: ≠
            - strong [ref=e33]: "Review:"
            - generic [ref=e34]:
              - generic [ref=e35]: Spellbook ·
              - text: Fireball
              - generic [ref=e36]: — Concept Brief
              - generic [ref=e37]: · local reads pass, server says fail
          - button "4 more" [ref=e38] [cursor=pointer]:
            - generic [ref=e39]: ▾
            - text: 4 more
      - generic [ref=e41]:
        - banner [ref=e42]:
          - generic [ref=e43]:
            - generic [ref=e44]: Vendors
            - heading "Wandering Merchant" [level=1] [ref=e45]
          - generic [ref=e46]:
            - generic [ref=e47]:
              - generic [ref=e48]: lifecycle
              - generic [ref=e49]: planned
            - generic [ref=e50]:
              - generic [ref=e51]: description
              - generic [ref=e52]: A roaming general-goods vendor.
        - generic [ref=e53]:
          - complementary [ref=e54]:
            - generic [ref=e55]: Catalogs
            - tree "Catalogs" [ref=e57]:
              - generic [ref=e58]:
                - button "Game Assets" [expanded] [ref=e59] [cursor=pointer]: ▾ Game Assets
                - treeitem "Spellbook 0/70" [ref=e61] [cursor=pointer]:
                  - generic [ref=e62]: Spellbook
                  - generic [ref=e63]: 0/70
                - treeitem "Characters 0/1" [ref=e65] [cursor=pointer]:
                  - generic [ref=e66]: Characters
                  - generic [ref=e67]: 0/1
                - treeitem "Props 0/1" [ref=e69] [cursor=pointer]:
                  - generic [ref=e70]: Props
                  - generic [ref=e71]: 0/1
                - treeitem "Status Effects 0/2" [ref=e73] [cursor=pointer]:
                  - generic [ref=e74]: Status Effects
                  - generic [ref=e75]: 0/2
                - treeitem "Player Movement 0/1" [ref=e77] [cursor=pointer]:
                  - generic [ref=e78]: Player Movement
                  - generic [ref=e79]: 0/1
                - treeitem "Character Pipeline 0/1" [ref=e81] [cursor=pointer]:
                  - generic [ref=e82]: Character Pipeline
                  - generic [ref=e83]: 0/1
              - button "Core / Existing" [ref=e85] [cursor=pointer]: ▸ Core / Existing
              - generic [ref=e86]:
                - button "Audio & FX" [expanded] [ref=e87] [cursor=pointer]: ▾ Audio & FX
                - treeitem "Audio 0/0" [ref=e89] [cursor=pointer]:
                  - generic [ref=e90]: Audio
                  - generic [ref=e91]: 0/0
                - treeitem "Music 0/1" [ref=e93] [cursor=pointer]:
                  - generic [ref=e94]: Music
                  - generic [ref=e95]: 0/1
                - treeitem "Ambient 0/1" [ref=e97] [cursor=pointer]:
                  - generic [ref=e98]: Ambient
                  - generic [ref=e99]: 0/1
                - treeitem "VFX Assets 0/1" [ref=e101] [cursor=pointer]:
                  - generic [ref=e102]: VFX Assets
                  - generic [ref=e103]: 0/1
              - generic [ref=e104]:
                - button "Quests & Narrative" [expanded] [ref=e105] [cursor=pointer]: ▾ Quests & Narrative
                - treeitem "Quests 0/1" [ref=e107] [cursor=pointer]:
                  - generic [ref=e108]: Quests
                  - generic [ref=e109]: 0/1
                - treeitem "Dialog Trees 0/1" [ref=e111] [cursor=pointer]:
                  - generic [ref=e112]: Dialog Trees
                  - generic [ref=e113]: 0/1
                - treeitem "Cutscenes 0/1" [ref=e115] [cursor=pointer]:
                  - generic [ref=e116]: Cutscenes
                  - generic [ref=e117]: 0/1
                - treeitem "Codex 0/1" [ref=e119] [cursor=pointer]:
                  - generic [ref=e120]: Codex
                  - generic [ref=e121]: 0/1
                - treeitem "Factions 0/1" [ref=e123] [cursor=pointer]:
                  - generic [ref=e124]: Factions
                  - generic [ref=e125]: 0/1
              - generic [ref=e126]:
                - button "Systems" [expanded] [ref=e127] [cursor=pointer]: ▾ Systems
                - treeitem "Crafting Recipes 0/1" [ref=e129] [cursor=pointer]:
                  - generic [ref=e130]: Crafting Recipes
                  - generic [ref=e131]: 0/1
                - generic [ref=e132]:
                  - treeitem "Vendors 0/1" [selected] [ref=e133] [cursor=pointer]:
                    - generic [ref=e134]: Vendors
                    - generic [ref=e135]: 0/1
                  - 'button "Wandering Merchant: pending" [ref=e137] [cursor=pointer]':
                    - generic [ref=e138]: ○
                    - generic [ref=e139]: Wandering Merchant
                - treeitem "Progression Curves 0/1" [ref=e141] [cursor=pointer]:
                  - generic [ref=e142]: Progression Curves
                  - generic [ref=e143]: 0/1
                - treeitem "Achievements 0/1" [ref=e145] [cursor=pointer]:
                  - generic [ref=e146]: Achievements
                  - generic [ref=e147]: 0/1
                - treeitem "Save / Checkpoint 0/1" [ref=e149] [cursor=pointer]:
                  - generic [ref=e150]: Save / Checkpoint
                  - generic [ref=e151]: 0/1
              - generic [ref=e152]:
                - button "UI" [expanded] [ref=e153] [cursor=pointer]: ▾ UI
                - treeitem "HUD Elements 0/1" [ref=e155] [cursor=pointer]:
                  - generic [ref=e156]: HUD Elements
                  - generic [ref=e157]: 0/1
                - treeitem "Icon Sets 0/1" [ref=e159] [cursor=pointer]:
                  - generic [ref=e160]: Icon Sets
                  - generic [ref=e161]: 0/1
              - generic [ref=e162]:
                - button "Input & Platform" [expanded] [ref=e163] [cursor=pointer]: ▾ Input & Platform
                - treeitem "Input Schemes 0/1" [ref=e165] [cursor=pointer]:
                  - generic [ref=e166]: Input Schemes
                  - generic [ref=e167]: 0/1
              - generic [ref=e168]:
                - button "Onboarding" [expanded] [ref=e169] [cursor=pointer]: ▾ Onboarding
                - treeitem "Tutorial Beats 0/1" [ref=e171] [cursor=pointer]:
                  - generic [ref=e172]: Tutorial Beats
                  - generic [ref=e173]: 0/1
              - generic [ref=e174]:
                - button "Economy / Meta" [expanded] [ref=e175] [cursor=pointer]: ▾ Economy / Meta
                - treeitem "Currencies 0/1" [ref=e177] [cursor=pointer]:
                  - generic [ref=e178]: Currencies
                  - generic [ref=e179]: 0/1
          - complementary [ref=e180]:
            - generic [ref=e181]: Pipeline · 11/11
            - list "Pipeline steps" [ref=e183]:
              - 'button "Concept Brief: passed, tier L0" [ref=e186] [cursor=pointer]':
                - generic [ref=e188]: ✓
                - generic [ref=e189]:
                  - generic [ref=e190]: "01"
                  - text: Concept Brief
                  - generic "Server verdict differs" [ref=e191]: ≠
              - 'button "Inventory Pool: passed, tier L0" [ref=e193] [cursor=pointer]':
                - generic [ref=e195]: ✓
                - generic [ref=e196]:
                  - generic [ref=e197]: "02"
                  - text: Inventory Pool
                  - generic "Server verdict differs" [ref=e198]: ≠
              - 'button "Pricing & Restock: passed, tier L0" [ref=e200] [cursor=pointer]':
                - generic [ref=e202]: ✓
                - generic [ref=e203]:
                  - generic [ref=e204]: "03"
                  - text: Pricing & Restock
                  - generic "Server verdict differs" [ref=e205]: ≠
              - 'button "Reputation Modifiers: passed, tier L0" [ref=e207] [cursor=pointer]':
                - generic [ref=e209]: ✓
                - generic [ref=e210]:
                  - generic [ref=e211]: "04"
                  - text: Reputation Modifiers
                  - generic "Server verdict differs" [ref=e212]: ≠
              - 'button "Buy/Sell/Repair: passed, tier L0" [ref=e214] [cursor=pointer]':
                - generic [ref=e216]: ✓
                - generic [ref=e217]:
                  - generic [ref=e218]: "05"
                  - text: Buy/Sell/Repair
                  - generic "Server verdict differs" [ref=e219]: ≠
              - 'button "Economy Sim: passed, tier L0" [ref=e221] [cursor=pointer]':
                - generic [ref=e223]: ✓
                - generic [ref=e224]:
                  - generic [ref=e225]: "06"
                  - text: Economy Sim
                  - generic "Server verdict differs" [ref=e226]: ≠
              - 'button "Shop UI: passed, tier L0" [ref=e228] [cursor=pointer]':
                - generic [ref=e230]: ✓
                - generic [ref=e231]:
                  - generic [ref=e232]: "07"
                  - text: Shop UI
                  - generic "Server verdict differs" [ref=e233]: ≠
              - 'button "Icon 2D Art: passed, tier L1" [ref=e235] [cursor=pointer]':
                - generic [ref=e237]: ✓
                - generic [ref=e238]:
                  - generic [ref=e239]: "08"
                  - text: Icon 2D Art
              - 'button "Localization: passed, tier L0" [ref=e241] [cursor=pointer]':
                - generic [ref=e243]: ✓
                - generic [ref=e244]:
                  - generic [ref=e245]: "09"
                  - text: Localization
                  - generic "Server verdict differs" [ref=e246]: ≠
              - 'button "Test Gate: deferred, tier L3" [ref=e248] [cursor=pointer]':
                - generic [ref=e250]: ⋯
                - generic [ref=e251]:
                  - generic [ref=e252]: "10"
                  - text: Test Gate
              - 'button "UE Packaging: passed, tier L0" [ref=e254] [cursor=pointer]':
                - generic [ref=e256]: ✓
                - generic [ref=e257]:
                  - generic [ref=e258]: "11"
                  - text: UE Packaging
          - main [ref=e259]:
            - status [ref=e260]:
              - generic [ref=e261]:
                - generic [ref=e262]: What to do next
                - 'generic "Run live test: Test Gate — live-UE runner not yet run: VSVendorTransactionTest" [ref=e263]':
                  - strong [ref=e264]: "Run live test:"
                  - text: Test Gate
                  - generic [ref=e265]: "— live-UE runner not yet run: VSVendorTransactionTest"
                - button "Run 1 deferred gate" [ref=e266] [cursor=pointer]
                - button "Show details" [ref=e267] [cursor=pointer]:
                  - generic [ref=e268]: ▾
                  - text: more
            - generic [ref=e269]: Step 01 / 11 · complete
            - heading "Concept Brief" [level=2] [ref=e270]
            - status [ref=e271]:
              - generic [ref=e272]: ⚠
              - generic [ref=e273]:
                - text: Server truth differs for this step — local reads
                - strong [ref=e274]: ✓ passed
                - text: ", server has"
                - strong [ref=e275]: ✕ failed
                - text: .
              - button "Adopt server truth" [ref=e277] [cursor=pointer]
            - generic [ref=e278]:
              - generic [ref=e279]:
                - generic [ref=e280]:
                  - generic [ref=e281]: Acceptance
                  - generic [ref=e282]: Brief ≥ 300 characters
                  - generic [ref=e283]:
                    - generic [ref=e284]: 1149 / 300 chars
                    - 'img "Brief ≥ 300 characters: passed, tier L0" [ref=e285]':
                      - generic [ref=e286]: ✓
                      - text: PASS · L0
                - generic [ref=e287]:
                  - generic [ref=e288]:
                    - generic [ref=e289]: Provenance
                    - generic [ref=e290]: "engine: Claude"
                    - generic [ref=e291]: "judge: llm-panel"
                    - generic "Warning" [ref=e292]:
                      - img [ref=e293]
                      - text: "CHECKER: SHAPE-ONLY"
                  - group [ref=e295]:
                    - generic "Why this grade?" [ref=e296] [cursor=pointer]
              - generic [ref=e297]:
                - generic [ref=e298]:
                  - generic [ref=e299]: View
                  - generic [ref=e300]: "Wandering Merchant is a stationary NPC merchant embedded in PoF's grounded post-Sundering economy — selling gear, consumables, and utility items to players who have earned enough gold or standing with the Ashen Order. The shop cycle runs on a 12-hour restock interval, refreshing a randomised subset of the inventory pool while preserving a core set of reliable stock. Price is never negotiated in a vacuum: the base sell price is set at a 30% markup over the theoretical item cost (within ±20% — i.e. 24–36% markup band), and the vendor buys back player-sold items at 50% of the sell price (the standard buyback floor per canon vendor-laws). Reputation with the Ashen Order provides a linear discount: Neutral (0%), Friendly (5%), Honored (10%), Revered (15%), Exalted (20%) — no custom curves, strictly linear off repTier per canon. The vendor settles all transactions exclusively in currency-gold; orb crafting currencies may appear as descriptive stock items but are priced in gold per the trade economy. Repair services are always available regardless of reputation tier. The widget is WBP_VendorShop, a 5-column grid anchored to center-screen."
                - generic [ref=e301]:
                  - generic [ref=e302]: Produce
                  - generic [ref=e303]:
                    - generic [ref=e304]: Direction (your input)
                    - textbox "Steer this step — tone, constraints, references…" [ref=e305]
                    - generic [ref=e306]:
                      - button "⚡ Produce Concept Brief" [ref=e307] [cursor=pointer]
                      - button "view prompt" [ref=e308] [cursor=pointer]
                    - generic [ref=e309]: Records this step's config + the exact prompt that drives Acceptance. The asset itself is produced by a CLI session or the gate drain — not in this panel.
                    - generic [ref=e310]: ✓ Recorded · step config + prompt saved to the pipeline.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e316] [cursor=pointer]:
    - img [ref=e317]
  - alert [ref=e320]
```

# Test source

```ts
  1  | import { expect, type Page, type APIRequestContext } from '@playwright/test';
  2  | import { seedAllCatalogs } from '@/lib/catalog/sections';
  3  | import { POF_READY_TESTID } from './pof-identity';
  4  | 
  5  | export type StepStatus = 'pass' | 'fail' | 'deferred' | 'pending';
  6  | 
  7  | /** The lab is the homepage; wait for the LayoutLab root ready marker. */
  8  | export async function gotoLab(page: Page): Promise<void> {
  9  |   await page.goto('/', { waitUntil: 'domcontentloaded' });
  10 |   await expect(page.getByTestId(POF_READY_TESTID)).toBeVisible({ timeout: 30_000 });
  11 | }
  12 | 
  13 | /** The catalog tree opens only the selected category; expand every collapsed one
  14 |  *  so any `harness-catalog-*` button is clickable. */
  15 | export async function expandAllCategories(page: Page): Promise<void> {
  16 |   const tree = page.getByRole('tree', { name: 'Catalogs' });
  17 |   for (let i = 0; i < 30; i++) {
  18 |     const collapsed = tree.locator('button[aria-expanded="false"]');
  19 |     if ((await collapsed.count()) === 0) break;
  20 |     await collapsed.first().click();
  21 |   }
  22 | }
  23 | 
  24 | /** The lab opens a catalog to `entities[0]` (the first seeded entity, since selecting a
  25 |  *  catalog clears the entity selection). We derive that entity from the same seed the
  26 |  *  store hydrates from — so we need no app-specific DOM hook to know which entity is open. */
  27 | function firstSeededEntity(catalogId: string): { id: string; name: string } {
  28 |   const e = Object.values(seedAllCatalogs()[catalogId] ?? {})[0] as { id: string; name: string } | undefined;
  29 |   return { id: e?.id ?? '', name: e?.name ?? '' };
  30 | }
  31 | 
  32 | /** Select a catalog; the lab auto-shows entities[0]. Returns that entity's id. */
  33 | export async function openCatalog(page: Page, catalogId: string): Promise<string> {
  34 |   await expandAllCategories(page);
  35 |   const { id, name } = firstSeededEntity(catalogId);
  36 |   await page.getByTestId(`harness-catalog-${catalogId}`).click();
  37 |   // Confirm the switch landed: the canvas <h1> shows the opened entity's name.
  38 |   await expect(page.getByRole('heading', { level: 1 })).toHaveText(name, { timeout: 10_000 });
  39 |   return id;
  40 | }
  41 | 
  42 | export async function selectStep(page: Page, index: number): Promise<void> {
  43 |   await page.getByTestId(`step-dot-stamp-${index}`).click();
  44 | }
  45 | 
  46 | export async function acceptanceStatus(page: Page): Promise<StepStatus> {
  47 |   const banner = page.getByTestId('acceptance-banner');
  48 |   await expect(banner).toBeVisible({ timeout: 10_000 });
  49 |   return (await banner.getAttribute('data-status')) as StepStatus;
  50 | }
  51 | 
  52 | /** Click Produce for the current step; gallery steps also select the first candidate
  53 |  *  so the `selected` field populates and acceptance can derive. */
  54 | export async function produceStep(page: Page, isGallery: boolean): Promise<void> {
  55 |   await page.getByTestId('cli-produce-run').click();
  56 |   if (isGallery) {
  57 |     await page.locator('[data-testid^="candidate-"]').first().click();
  58 |   } else {
  59 |     await expect(page.getByTestId('cli-produce-result')).toBeVisible({ timeout: 10_000 });
  60 |   }
  61 | }
  62 | 
  63 | /** Poll the server until the step's persisted status equals the in-UI status. */
  64 | export async function expectPersisted(
  65 |   request: APIRequestContext,
  66 |   catalogId: string,
  67 |   entityId: string,
  68 |   step: string,
  69 |   status: StepStatus,
  70 | ): Promise<void> {
  71 |   await expect
  72 |     .poll(
  73 |       async () => {
  74 |         const res = await request.get(
  75 |           `/api/pipeline-artifacts?catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}`,
  76 |         );
  77 |         if (!res.ok()) return null;
  78 |         const body = (await res.json()) as { data?: Array<{ step: string; status: string }> };
  79 |         return body.data?.find((a) => a.step === step)?.status ?? null;
  80 |       },
  81 |       { timeout: 10_000, message: `${catalogId} · ${step} did not persist with status ${status}` },
  82 |     )
> 83 |     .toBe(status);
     |      ^ Error: vendors · Concept Brief did not persist with status pass
  84 | }
  85 | 
```