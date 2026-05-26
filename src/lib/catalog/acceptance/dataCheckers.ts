import type { Checker } from './types';

export function minLength(field: string, label: string, n: number): Checker {
  return (data) => {
    const len = String(data[field] ?? '').length;
    return { label, tier: 'L0', status: len >= n ? 'pass' : 'pending', detail: `${len} / ${n} chars` };
  };
}

export function fieldsPopulated(field: string, label: string, keys: string[]): Checker {
  return (data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const have = keys.filter((k) => obj[k] != null).length;
    return { label, tier: 'L0', status: have === keys.length ? 'pass' : 'pending', detail: `${have} / ${keys.length} populated` };
  };
}

export function withinPercent(field: string, label: string, target: number, pct: number): Checker {
  return (data) => {
    const v = data[field];
    if (v == null) return { label, tier: 'L0', status: 'pending', detail: 'not set' };
    const n = Number(v);
    const ok = n >= target * (1 - pct / 100) && n <= target * (1 + pct / 100);
    return { label, tier: 'L0', status: ok ? 'pass' : 'fail', detail: `${n} vs ${target} ±${pct}%`, ...(ok ? {} : { reason: `${n} is outside ±${pct}% of ${target}` }) };
  };
}

export function selected(field: string, label: string): Checker {
  return (data) => {
    const v = data[field];
    const ok = typeof v === 'number' && v >= 0;
    return { label, tier: 'L1', status: ok ? 'pass' : 'pending', detail: ok ? `candidate ${v}` : 'none selected' };
  };
}

export function minCount(field: string, label: string, n: number): Checker {
  return (data) => {
    const arr = Array.isArray(data[field]) ? (data[field] as unknown[]) : [];
    return { label, tier: 'L0', status: arr.length >= n ? 'pass' : 'pending', detail: `${arr.length} / ${n}` };
  };
}
