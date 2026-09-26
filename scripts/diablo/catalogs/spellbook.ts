import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTsv } from '@/lib/catalog/ingest/tsv';
import { referenceCaster } from '@/lib/catalog/reference/spellLaw';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { arg } from './args';
import type { CatalogHandler } from './types';

export const spellbookHandler: CatalogHandler = {
  catalogId: 'spellbook',
  seed: (ctx) => {
    let caster;
    if (ctx.root) {
      const cls = arg('class') ?? 'sorcerer';
      const kv = (relativePath: string, key: string, value: string) => {
        const table = parseTsv(readFileSync(join(ctx.root!, relativePath), 'utf8'));
        if (table.refusal) throw new Error(`${relativePath}: ${table.refusal.message}`);
        return Object.fromEntries(table.rows.map((row) => [row[key], row[value]]));
      };
      const className = kv('classes/classdat.tsv', 'folderName', 'className')[cls] ?? cls;
      caster = referenceCaster({
        className,
        attributes: kv(`classes/${cls}/attributes.tsv`, 'Attribute', 'Value'),
        animations: kv(`classes/${cls}/animations.tsv`, 'Variable', 'Value'),
      });
      ctx.print(`reference caster: ${caster.basis} — Magic ${caster.magic}, to-hit ${caster.magicToHit}, cast ${caster.castingFrames} frames (release ${caster.castingActionFrame}), mana ${caster.maxMana}`);
    }
    const wrappers = listWrappers(ctx.db, { sourceId: ctx.sourceId, catalogId: 'spellbook' })
      .filter((wrapper) => !ctx.ids || ctx.ids.includes(wrapper.entity.id));
    ctx.generic(wrappers, caster);
  },
};
