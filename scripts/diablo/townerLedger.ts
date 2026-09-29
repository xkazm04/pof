/* eslint-disable no-console -- CLI report; stdout is its interface. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOWNER_LEDGER_DATA, townerLedger } from '@/lib/catalog/reference/townerLedger';

function tsvRows(path: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(resolve(path), 'utf8').trimEnd().split(/\r?\n/);
  const columns = header.split('\t');
  return lines.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [columns[index], value])));
}

const questRows = new Map(tsvRows('.reference/devilutionX/assets/txtdata/towners/quest_dialog.tsv')
  .map((row) => [row.towner_type, row]));
const townerRows = new Map(tsvRows('.reference/devilutionX/assets/txtdata/towners/towners.tsv')
  .map((row) => [row.type, row]));
const ledgers = TOWNER_LEDGER_DATA.map((entry) => {
  const questRow = questRows.get(entry.towner) ?? {};
  const townerRow = townerRows.get(entry.towner);
  return townerLedger(entry.towner, {
    gossipLineIds: townerRow?.gossipTexts ? townerRow.gossipTexts.split(',').filter(Boolean) : [],
    topics: Object.entries(questRow)
      .filter(([quest, line]) => quest.startsWith('Q_') && line && line !== 'TEXT_NONE')
      .map(([quest, line]) => ({ quest, line })),
  });
});
console.log(JSON.stringify(ledgers, null, 2));
