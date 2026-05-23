import { describe, it, expect, afterEach } from 'vitest';
import { buildVisualCheckSection } from '@/lib/prompts/visual-check';

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
