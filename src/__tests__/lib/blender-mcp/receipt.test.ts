/**
 * One receipt envelope for every Blender script PoF sends.
 *
 * Before this, two scripts grew their own machine-readable marker
 * (export-scene's POF_EXPORT_FINISHED=, composition-blockout's
 * POF_BLOCKOUT_PLACED=), each with a hand-written reader, and the rest printed
 * prose nobody parsed — so a caller claimed success on a transport OK. Now a
 * generator appends `pyReceipt(kind, fields)`, `service.executeCode` parses the
 * receipts ONCE at the edge, and a caller asks `readReceipt(…, kind, expect)`
 * for confirmed / unconfirmed / mismatch. Only `confirmed` may render as success.
 *
 * Never connects to a real Blender: the service case runs against the mock addon.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  RECEIPT_MARKER,
  parseReceipts,
  pyReceipt,
  readReceipt,
} from '@/lib/blender-mcp/receipt';
import { createArmatureScript } from '@/lib/blender-mcp/scripts/create-armature';
import { exportSceneScript } from '@/lib/blender-mcp/scripts/export-scene';
import { describeArmatureOutcome, presetToBones } from '@/components/modules/visual-gen/auto-rig/AutoRigView/helpers';
import { RIG_PRESETS } from '@/lib/visual-gen/rig-presets';
import { createMockBlenderServer, SCENE_OK, type MockBlenderServer } from './mockBlenderServer';
import { printedReceipt } from './printedReceipt';

describe('pyReceipt', () => {
  it('emits one json.dumps line tagged with its kind; field values are Python expressions', () => {
    const line = pyReceipt('blockout', { placed: 'n' });
    expect(line).toBe(`print('POF_RESULT=' + __import__("json").dumps({"kind": "blockout", "placed": n}))`);
  });

  it('escapes kind and field names so a quote cannot break out of the literal', () => {
    const line = pyReceipt('ex"port', { 'pa"th': '"C:/a"' });
    expect(line).toContain('"kind": "ex\\"port"');
    expect(line).toContain('"pa\\"th": "C:/a"');
  });
});

describe('readReceipt', () => {
  it('confirms a kind-tagged receipt surrounded by prose when it carries what was expected', () => {
    expect(
      readReceipt('noise\nPOF_RESULT={"kind":"armature","bones":11}\n', 'armature', { bones: 11 }),
    ).toEqual({ state: 'confirmed', data: { kind: 'armature', bones: 11 } });
  });

  it('prose with no receipt is unconfirmed and names the missing kind — never a success', () => {
    const r = readReceipt('Created armature: A with 11 bones', 'armature');
    expect(r.state).toBe('unconfirmed');
    if (r.state !== 'unconfirmed') throw new Error('unreachable');
    expect(r.reason).toContain("'armature'");
  });

  it('a receipt of another kind does not confirm this one', () => {
    expect(readReceipt('POF_RESULT={"kind":"export","path":"C:/a"}', 'armature').state).toBe('unconfirmed');
  });

  it('a short count is a mismatch that names both numbers', () => {
    const r = readReceipt('POF_RESULT={"kind":"blockout","placed":3}', 'blockout', { placed: 4 });
    expect(r.state).toBe('mismatch');
    if (r.state !== 'mismatch') throw new Error('unreachable');
    expect(r.reason).toMatch(/3 of 4/);
  });

  it('prefers the receipts the service parsed, and falls back to the output', () => {
    const receipts = [{ kind: 'export', path: 'C:/a.fbx' }];
    expect(readReceipt({ output: '', receipts }, 'export').state).toBe('confirmed');
    expect(readReceipt({ output: 'POF_RESULT={"kind":"export","path":"C:/a.fbx"}' }, 'export').state).toBe('confirmed');
  });

  it('reads a receipt that arrived quote-escaped inside a stringified addon reply', () => {
    // What executeCode used to hand back for the real addon's {executed, result} answer.
    const escaped = JSON.stringify({ executed: true, result: 'POF_RESULT={"kind":"export","path":"C:/a.fbx"}\n' });
    expect(parseReceipts(escaped)).toEqual([{ kind: 'export', path: 'C:/a.fbx' }]);
  });

  it('skips a malformed or kind-less receipt line instead of throwing', () => {
    expect(parseReceipts('POF_RESULT={not json\nPOF_RESULT={"placed":3}\nPOF_RESULT=[1]')).toEqual([]);
  });
});

describe('generators end in exactly one receipt', () => {
  const bones = presetToBones(RIG_PRESETS[0]).slice(0, 2);

  it('create-armature reports the bones Blender actually built, from len(amt.bones)', () => {
    const code = createArmatureScript({ armatureName: 'A', bones });
    expect(code.split(RECEIPT_MARKER)).toHaveLength(2);
    expect(code).toContain('__import__("json").dumps(');
    const out = printedReceipt(code, { 'armature_obj.name': 'A', 'len(amt.bones)': 2 });
    expect(readReceipt(out, 'armature', { bones: 2 })).toEqual({
      state: 'confirmed',
      data: { kind: 'armature', name: 'A', bones: 2 },
    });
  });

  it('create-armature no longer interpolates the name into an f-string (a brace would break it)', () => {
    const code = createArmatureScript({ armatureName: 'A{0}', bones });
    expect(code).not.toMatch(/print\(f"/);
  });

  it('export-scene carries the path, and only AFTER the FINISHED raise', () => {
    const code = exportSceneScript({ outputPath: 'C:/x.fbx', format: 'fbx' });
    expect(code.split(RECEIPT_MARKER)).toHaveLength(2);
    expect(code).toContain('__import__("json").dumps(');
    expect(code.indexOf(RECEIPT_MARKER)).toBeGreaterThan(code.indexOf('raise RuntimeError'));
    const out = printedReceipt(code);
    expect(readReceipt(out, 'export', { path: 'C:/x.fbx' })).toMatchObject({ state: 'confirmed' });
    expect(code).not.toContain('POF_EXPORT_FINISHED=');
  });
});

describe('service.executeCode parses receipts once, at the edge', () => {
  let mock: MockBlenderServer | null = null;

  afterEach(async () => {
    const { getService, resetService } = await import('@/lib/blender-mcp/service');
    getService().disconnect();
    resetService();
    if (mock) await mock.close();
    mock = null;
  });

  async function run(executeReply: unknown) {
    mock = await createMockBlenderServer((data) => {
      const cmd = JSON.parse(data);
      if (cmd.type === 'get_scene_info') return SCENE_OK;
      return JSON.stringify({ status: 'success', result: executeReply });
    });
    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    await svc.connect('127.0.0.1', mock.port);
    return svc.executeCode('print(1)');
  }

  it("unwraps the real addon's {executed, result} reply so a receipt is not quote-escaped", async () => {
    const printed = 'POF_RESULT={"kind":"export","path":"C:/a.fbx"}\n';
    const result = await run({ executed: true, result: printed });
    expect(result).toEqual({
      ok: true,
      data: { output: printed, receipts: [{ kind: 'export', path: 'C:/a.fbx' }] },
    });
  });

  it('[guard] keeps an {output} reply as it was, with no receipts', async () => {
    const result = await run({ output: 'Created cube' });
    expect(result).toEqual({ ok: true, data: { output: 'Created cube', receipts: [] } });
  });
});

describe('Auto-Rig reports the armature Blender built, not the preset it was named after', () => {
  const mannequin = RIG_PRESETS.find((p) => p.id === 'ue5-mannequin')!;

  it('a confirmed 11-bone build names the 11 AND the preset’s declared 67', () => {
    const read = readReceipt('POF_RESULT={"kind":"armature","name":"UE5_Mannequin","bones":11}', 'armature', { bones: 11 });
    const outcome = describeArmatureOutcome(read, 11, mannequin.boneCount);
    expect(outcome.status).toBe('success');
    expect(outcome.message).toMatch(/\b11\b/);
    expect(outcome.message).toMatch(/\b67\b/);
  });

  it('an unconfirmed build is not a success and carries the reason', () => {
    const read = readReceipt('Created armature: UE5_Mannequin with 11 bones', 'armature', { bones: 11 });
    if (read.state !== 'unconfirmed') throw new Error('expected unconfirmed');
    const outcome = describeArmatureOutcome(read, 11, mannequin.boneCount);
    expect(outcome.status).not.toBe('success');
    expect(outcome.message).toContain(read.reason);
  });

  it('a short build is a mismatch, not a success', () => {
    const read = readReceipt('POF_RESULT={"kind":"armature","bones":9}', 'armature', { bones: 11 });
    const outcome = describeArmatureOutcome(read, 11, mannequin.boneCount);
    expect(outcome.status).not.toBe('success');
    expect(outcome.message).toMatch(/9 of 11/);
  });
});
