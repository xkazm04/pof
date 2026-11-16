import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { detectGodotProjects, parseGodotProjectName } from '@/lib/project-setup/godotProjects';

const GODOT = '[application]\n\nconfig/name="RTAI: Uprising"\nconfig/features=PackedStringArray("4.7")\n';
const ROOT = path.join('X', 'gtai');

describe('parseGodotProjectName', () => {
  it('reads config/name', () => {
    expect(parseGodotProjectName(GODOT)).toBe('RTAI: Uprising');
    expect(parseGodotProjectName('config/name="A \\"B\\""')).toBe('A "B"');
  });
  it('is null when absent or empty', () => {
    expect(parseGodotProjectName('[application]\n')).toBeNull();
    expect(parseGodotProjectName('config/name=""')).toBeNull();
  });
});

describe('detectGodotProjects', () => {
  const rootFor = (id: string) => (id === 'gtai' ? ROOT : null);

  it('lists RTAI from <root>/project/project.godot, named by the project file', () => {
    const files = new Map([[path.join(ROOT, 'project', 'project.godot'), GODOT]]);
    const found = detectGodotProjects({ rootFor, readFile: (p) => files.get(p) ?? null });
    expect(found).toEqual([{
      gameId: 'gtai', name: 'RTAI: Uprising', path: path.join(ROOT, 'project'),
      root: ROOT, engineVersion: '4.7.2', validated: true,
    }]);
  });

  it('falls back to the root itself and to the game title when the name is missing', () => {
    const files = new Map([[path.join(ROOT, 'project.godot'), '[application]\n']]);
    const found = detectGodotProjects({ rootFor, readFile: (p) => files.get(p) ?? null });
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe(ROOT);
    expect(found[0].name).toBe('GTAI: Uprising');
  });

  it('omits an unbound root and a root with no project.godot; UE games never appear', () => {
    expect(detectGodotProjects({ rootFor: () => null, readFile: () => GODOT })).toEqual([]);
    expect(detectGodotProjects({ rootFor, readFile: () => null })).toEqual([]);
  });
});
