/** SubsystemDef.notIntegrated had no writer; the flag and its branches stay removed. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'src/components/modules/project-setup/BridgeEndpointHealth');

describe('BridgeEndpointHealth dead subsystem flag', () => {
  it('no source in the folder mentions notIntegrated / not-integrated', () => {
    const hits: string[] = [];
    for (const f of fs.readdirSync(DIR)) {
      const lines = fs.readFileSync(path.join(DIR, f), 'utf-8').split('\n');
      lines.forEach((l, i) => { if (/notIntegrated|not-integrated/.test(l)) hits.push(`${f}:${i + 1}`); });
    }
    expect(hits).toEqual([]);
  });
});
