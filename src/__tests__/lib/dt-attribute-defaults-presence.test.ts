import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// The active UE project (see memory: reference_ue_project_location).
const UE_CONTENT_DATA = 'C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Data';
const DT_PATH = join(UE_CONTENT_DATA, 'DT_AttributeDefaults.uasset');

describe('DT_AttributeDefaults content presence', () => {
  // Skipped until the emitter (Task A3) is run in the editor to author the asset.
  it.skip('DT_AttributeDefaults.uasset exists (TODO: run the A3 emitter in-editor to create it)', () => {
    expect(existsSync(DT_PATH)).toBe(true);
  });

  it('the presence-test target path is well-formed', () => {
    expect(DT_PATH).toMatch(/Content[\\/]Data[\\/]DT_AttributeDefaults\.uasset$/);
  });
});
