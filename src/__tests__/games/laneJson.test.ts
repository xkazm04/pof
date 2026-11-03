import { describe, it, expect } from 'vitest';
import { decodeLaneJson, readLaneJsonFile } from '@/lib/games/laneJson';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const doc = '{ "answers": [ { "id": "a-1", "note": "é — ok" } ] }';

describe('decodeLaneJson: a lane on Windows may write JSON with a BOM or as UTF-16', () => {
  it('reads plain UTF-8', () => { expect(decodeLaneJson(Buffer.from(doc, 'utf8'))).toEqual(JSON.parse(doc)); });
  it('reads UTF-8 with a BOM', () => {
    expect(decodeLaneJson(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(doc, 'utf8')]))).toEqual(JSON.parse(doc));
  });
  it('reads UTF-16 LE with a BOM (PowerShell Out-File)', () => {
    expect(decodeLaneJson(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(doc, 'utf16le')]))).toEqual(JSON.parse(doc));
  });
  it('reads UTF-16 BE with a BOM', () => {
    const le = Buffer.from(doc, 'utf16le'); le.swap16();
    expect(decodeLaneJson(Buffer.concat([Buffer.from([0xfe, 0xff]), le]))).toEqual(JSON.parse(doc));
  });
  it('repairs drive-letter paths written with single backslashes (a lane forgot to escape them)', () => {
    const bad = '{ "q": "line one\\nline two", "frames": ["C:\\Users\\kazda\\kiro\\road-width.png", "C:\\\\ok\\\\x.png"] }';
    expect(decodeLaneJson(Buffer.from(bad, 'utf8'))).toEqual({
      q: 'line one\nline two',
      frames: ['C:\\Users\\kazda\\kiro\\road-width.png', 'C:\\ok\\x.png'],
    });
  });
  it('does not repair other broken text', () => {
    expect(() => decodeLaneJson(Buffer.from('{ "a": "bad \\q escape" }', 'utf8'))).toThrow();
  });
  it('still rejects text that is not JSON', () => { expect(() => decodeLaneJson(Buffer.from('nope'))).toThrow(); });
  it('readLaneJsonFile reads a BOM file from disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lanejson-'));
    const f = path.join(dir, 'x.json');
    fs.writeFileSync(f, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(doc)]));
    expect(readLaneJsonFile(f)).toEqual(JSON.parse(doc));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
