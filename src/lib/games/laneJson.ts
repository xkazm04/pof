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
  try {
    return JSON.parse(text);
  } catch (err) {
    const fixed = escapeWindowsPaths(text);
    if (fixed !== text) {
      try { return JSON.parse(fixed); } catch { /* the repair did not help: report the original problem */ }
    }
    throw err;
  }
}

/**
 * A lane that writes "C:\Users\x\a.png" with single backslashes produces text no JSON parser accepts (\U and \k are
 * not escapes), which would hide a design question from the owner. Retry once with the backslashes of every
 * drive-letter path run doubled (already-doubled ones stay doubled). Only a failed parse gets here, and only text
 * that starts with a drive letter and colon is touched, so a legitimate newline escape in a sentence is never rewritten.
 */
function escapeWindowsPaths(text: string): string {
  return text.replace(/[A-Za-z]:\\[^"\r\n]*/g, (run) => run.replace(/\\\\|\\/g, '\\\\'));
}

export function readLaneJsonFile(file: string): unknown {
  return decodeLaneJson(fs.readFileSync(file));
}
