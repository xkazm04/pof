import { describe, it, expect } from 'vitest';
import { statusToColor, STATUS_ERROR, STATUS_MUTED, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';

describe('statusToColor', () => {
  it('maps the three known statuses', () => {
    expect(statusToColor('ok')).toMatchObject({ text: STATUS_SUCCESS, label: 'OK' });
    expect(statusToColor('warn')).toMatchObject({ text: STATUS_WARNING, label: 'WARN' });
    expect(statusToColor('error')).toMatchObject({ text: STATUS_ERROR, label: 'FAIL' });
  });

  it('reads an unrecognised status as unknown, never as a failure', () => {
    for (const s of ['', 'degraded', 'eror', 'OK']) {
      const r = statusToColor(s);
      expect(r.label).toBe('UNKNOWN');
      expect(r.text).toBe(STATUS_MUTED);
      expect(r.text).not.toBe(STATUS_ERROR);
    }
  });
});
