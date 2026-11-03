/**
 * Server-only: parse a JSON file another lane wrote. Lanes run on Windows, and PowerShell's `Set-Content` /
 * `Out-File` write UTF-8 with a BOM or UTF-16, which a bare `JSON.parse(readFileSync(f, 'utf8'))` rejects:
 * an ask would read as "unreadable" and an `answers.json` as unusable (which also blocks the answer writer).
 */
import fs from 'node:fs';

export function decodeLaneJson(buf: Buffer): unknown {
  let text: string;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.subarray(2).toString('utf16le');
  else if (buf[0] === 0xfe && buf[1] === 0xff) text = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  else text = buf.toString('utf8').replace(/^﻿/, '');
  return JSON.parse(text);
}

export function readLaneJsonFile(file: string): unknown {
  return decodeLaneJson(fs.readFileSync(file));
}
