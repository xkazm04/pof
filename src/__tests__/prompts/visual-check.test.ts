import { describe, it, expect, afterEach } from 'vitest';
import { buildVisualCheckSection, buildTextureCheckSection } from '@/lib/prompts/visual-check';

const base = {
  projectPath: 'C:\\Users\\me\\UE\\PoF',
  appOrigin: 'http://localhost:3000',
  moduleId: 'arpg-ui' as const,
  itemId: 'au-1',
};

afterEach(() => {
  delete process.env.POF_UE_EDITOR;
  delete process.env.POF_VERIFY_MAP;
});

describe('buildVisualCheckSection', () => {
  it('emits an advisory Visual Verification heading', () => {
    const out = buildVisualCheckSection(base);
    expect(out).toContain('## Visual Verification');
    expect(out.toLowerCase()).toContain('advisory');
  });

  it('includes the launch command (editor + HighResShot) and the screenshot dir derived from projectPath', () => {
    const out = buildVisualCheckSection(base);
    expect(out).toContain('HighResShot');
    expect(out).toContain('UnrealEditor.exe');
    expect(out).toContain('C:\\Users\\me\\UE\\PoF\\Saved\\Screenshots\\WindowsEditor');
  });

  it('instructs a POST to /api/verify/visual with moduleId and itemId', () => {
    const out = buildVisualCheckSection(base);
    expect(out).toContain('http://localhost:3000/api/verify/visual');
    expect(out).toContain('arpg-ui');
    expect(out).toContain('au-1');
  });

  it('honours POF_UE_EDITOR and POF_VERIFY_MAP env overrides', () => {
    process.env.POF_UE_EDITOR = 'D:\\Engine\\UnrealEditor.exe';
    process.env.POF_VERIFY_MAP = '/Game/Maps/Test';
    const out = buildVisualCheckSection(base);
    expect(out).toContain('D:\\Engine\\UnrealEditor.exe');
    expect(out).toContain('/Game/Maps/Test');
  });
});

describe('buildTextureCheckSection', () => {
  const tbase = {
    appOrigin: 'http://localhost:3000',
    moduleId: 'materials' as const,
    itemId: 'tm-floor',
    texturePath: 'C:\\textures\\T_floor_albedo.png',
  };

  it('emits an advisory Texture Quality heading', () => {
    const out = buildTextureCheckSection(tbase);
    expect(out).toContain('## Texture Quality');
    expect(out.toLowerCase()).toContain('advisory');
  });

  it('asks the seamless/tileable question (seam / baked lighting)', () => {
    const out = buildTextureCheckSection(tbase).toLowerCase();
    expect(out).toContain('seamless');
    expect(out).toContain('tileable');
    expect(out).toMatch(/seam|baked|lighting/);
  });

  it('instructs a POST to /api/verify/visual in texture mode with the PNG path', () => {
    const out = buildTextureCheckSection(tbase);
    expect(out).toContain('http://localhost:3000/api/verify/visual');
    expect(out).toContain('"mode": "texture"');
    expect(out).toContain('materials');
    expect(out).toContain('tm-floor');
    expect(out).toContain('C:\\textures\\T_floor_albedo.png');
  });

  it('works without a known texturePath (instructs finding the generated PNG)', () => {
    const out = buildTextureCheckSection({ ...tbase, texturePath: undefined });
    expect(out).toContain('## Texture Quality');
    expect(out.toLowerCase()).toMatch(/generated .*png|\.png/);
  });
});

describe('buildVisualCheckSection lighting mode (folder-05 §5)', () => {
  const lbase = { ...base, mode: 'lighting' as const };

  it('emits an advisory Lighting Verification heading', () => {
    const out = buildVisualCheckSection(lbase);
    expect(out).toContain('## Lighting Verification');
    expect(out.toLowerCase()).toContain('advisory');
  });

  it('reuses the standard screenshot step (launch + HighResShot + screenshot dir)', () => {
    const out = buildVisualCheckSection(lbase);
    expect(out).toContain('HighResShot');
    expect(out).toContain('UnrealEditor.exe');
    expect(out).toContain('C:\\Users\\me\\UE\\PoF\\Saved\\Screenshots\\WindowsEditor');
  });

  it('POSTs to /api/verify/visual in lighting mode', () => {
    const out = buildVisualCheckSection(lbase);
    expect(out).toContain('http://localhost:3000/api/verify/visual');
    expect(out).toContain('"mode": "lighting"');
  });

  it('asks the lit / not-black / shadowed question', () => {
    const out = buildVisualCheckSection(lbase).toLowerCase();
    expect(out).toContain('lit');
    expect(out).toMatch(/black|un-lit|unlit/);
    expect(out).toMatch(/shadow|flat/);
  });

  it('default mode is hud — keeps the Visual Verification heading and adds no mode field', () => {
    const out = buildVisualCheckSection(base);
    expect(out).toContain('## Visual Verification');
    expect(out).not.toContain('"mode"');
  });
});

describe('buildVisualCheckSection character mode (folder-02 §6)', () => {
  const cbase = { ...base, mode: 'character' as const };

  it('emits an advisory Character Verification heading', () => {
    const out = buildVisualCheckSection(cbase);
    expect(out).toContain('## Character Verification');
    expect(out.toLowerCase()).toContain('advisory');
  });

  it('reuses the standard screenshot step (launch + HighResShot + screenshot dir)', () => {
    const out = buildVisualCheckSection(cbase);
    expect(out).toContain('HighResShot');
    expect(out).toContain('UnrealEditor.exe');
    expect(out).toContain('C:\\Users\\me\\UE\\PoF\\Saved\\Screenshots\\WindowsEditor');
  });

  it('POSTs to /api/verify/visual in character mode', () => {
    const out = buildVisualCheckSection(cbase);
    expect(out).toContain('http://localhost:3000/api/verify/visual');
    expect(out).toContain('"mode": "character"');
  });

  it('asks the humanoid / natural-pose / not-T-posed question', () => {
    const out = buildVisualCheckSection(cbase).toLowerCase();
    expect(out).toContain('humanoid');
    expect(out).toMatch(/t-pose|t-posed|natural pose/);
  });
});
