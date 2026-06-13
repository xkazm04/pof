/**
 * The "growth garden" + growth-log locations for the live UE growth suite.
 *
 * The garden is the set of catalogs the live suite advances each run; the live editor
 * path (Tier 2) drains their gates. Tier 1 measures the whole connected UE project on disk
 * (no editor needed) and ratchets non-regression of its real class/asset counts.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** The connected UE project root (override with POF_UE_ROOT). */
export const UE_ROOT = process.env.POF_UE_ROOT || 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';

/** The UE C++ module name (Source/<module>/) — required by scan-project for UE5 projects. */
export const UE_MODULE = process.env.POF_UE_MODULE || 'PoF';

/** Catalogs the live growth suite advances (entity[0] resolved at runtime). */
export const GARDEN = ['items', 'currencies', 'bestiary', 'spellbook'];

const here = dirname(fileURLToPath(import.meta.url));
/** dist/.. = tools/pof-mcp */
export const PKG_ROOT = join(here, '..');
export const GROWTH_LOG = join(PKG_ROOT, 'GROWTH-LOG.md');
/** Ratchet baseline (gitignored — machine-local truth). */
export const BASELINE_FILE = join(PKG_ROOT, 'growth-baseline.json');
