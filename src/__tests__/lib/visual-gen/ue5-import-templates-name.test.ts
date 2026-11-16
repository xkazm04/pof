import { describe, it, expect } from 'vitest';
import { generateImportScript, generateDataAsset, DEFAULT_IMPORT_CONFIG } from '@/lib/visual-gen/ue5-import-templates';

const cfg = (assetName: string) => ({ ...DEFAULT_IMPORT_CONFIG, format: 'fbx' as const, assetName });

describe('the free-text asset name becomes a legal C++ identifier', () => {
  it('drops characters a class name cannot hold', () => {
    const out = generateImportScript(cfg('Rusty Sword-2'));
    expect(out).toContain('class URustySword2Importer');
    expect(out).not.toContain('Rusty Sword');
  });
  it('cannot start with a digit', () => {
    expect(generateDataAsset(cfg('2Handed'))).toContain('class UA2HandedData');
  });
  it('falls back when nothing legal is left', () => {
    expect(generateImportScript(cfg('***'))).toContain('class UImportedAssetImporter');
  });
  it('leaves a legal name byte-identical', () => {
    expect(generateImportScript(cfg('WarriorSword'))).toContain('class UWarriorSwordImporter');
  });
});
