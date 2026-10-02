import { describe, it, expect, vi } from 'vitest';

// A machine with nothing installed: every directory probe misses, so the
// detectors report every requirement as absent and no engine is found.
vi.mock('fs/promises', () => {
  const miss = () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  const api = { stat: vi.fn(miss), readdir: vi.fn(miss), readFile: vi.fn(miss), access: vi.fn(miss) };
  return { default: api, ...api };
});

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/filesystem/browse/route';
import { buildBootstrapPlan, TOOLCHAIN } from '@/lib/project-setup/toolchain';

function post(action: string): NextRequest {
  return new NextRequest('http://localhost/api/filesystem/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

describe('filesystem/browse toolchain branches derive from the table', () => {
  it('detect-tooling emits the table ids and names; generate-bootstrap is the table plan', async () => {
    const tooling = await (await POST(post('detect-tooling'))).json();
    const tools = tooling.data.tools as { id: string; name: string; ok: boolean }[];
    const tableTools = TOOLCHAIN.filter((r) => r.id !== 'engine');
    expect(tools.map((t) => [t.id, t.name])).toEqual(tableTools.map((r) => [r.id, r.name]));

    const res = await (await POST(post('generate-bootstrap'))).json();
    expect(res.success).toBe(true);
    expect(res.data).toEqual(buildBootstrapPlan(tools.map((t) => ({ ...t, detail: '' })), []));
    expect(res.data.commands).toHaveLength(3);
  });

  it('export-manifest carries an engine requirement row and only runnable install commands', async () => {
    const res = await (await POST(post('export-manifest'))).json();
    const tools = res.data.manifest.tools as { id: string; installed: boolean; installCommand?: string }[];
    expect(tools.map((t) => t.id).sort()).toEqual(['dotnet', 'engine', 'msvc', 'vs', 'wsdk']);
    for (const t of tools.filter((x) => !x.installed)) {
      expect(t.installCommand).toMatch(/^(winget|")/);
    }
  });
});
