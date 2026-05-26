import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseRowStructs } from '@/lib/catalog/ue-schema';

describe('parseRowStructs', () => {
  it('extracts struct name + UPROPERTY field names from a header', () => {
    const out = parseRowStructs(join(process.cwd(), 'src/__tests__/fixtures/ue/Source/PoF/Rows.h'));
    expect(out.FARPGCurrencyDef).toEqual(['DisplayName', 'Cap']);
  });
});
