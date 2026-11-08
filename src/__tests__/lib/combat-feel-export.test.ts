import { describe, it, expect } from 'vitest';
import { buildCombatFeelPython } from '@/components/modules/core-engine/sub_combat/polish/combat-feel-export';
import { FEEDBACK_PARAMS } from '@/components/modules/core-engine/sub_combat/_shared/data';

describe('combat-feel Python emitter', () => {
  const values = { shakeScale: 1.2, hitstopDuration: 0.08, screenFlashAlpha: 0.2, vfxScale: 2, sfxVolume: 0.7, sfxPitch: 1, shakeDecay: 0.5, hitstopEase: 0.5 };

  it('sets the C2 melee-ability feel properties by their exact C++ names', () => {
    const py = buildCombatFeelPython(values);
    expect(py).toContain('import unreal');
    expect(py).toContain('hit_stop_duration');     // HitStopDuration -> snake
    expect(py).toContain('hit_camera_shake_scale'); // HitCameraShakeScale -> snake
    expect(py).toContain('0.08');
    expect(py).toContain('1.2');
    expect(py).toContain('GA_MeleeAttack');
  });

  it('documents the unmapped tuner knobs as comments (no silent drop)', () => {
    const py = buildCombatFeelPython(values);
    expect(py).toContain('screen_flash'); // surfaced even if no C++ home yet
  });
});

describe('combat-feel emitter is derived from the tuner param table', () => {
  const snake = (id: string) => id.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
  const COMMENT_NAME: Record<string, string> = {
    hitstopDuration: 'hit_stop_duration', shakeScale: 'hit_camera_shake_scale', hitstopTimeDilation: 'hit_stop_time_dilation',
  };

  it('surfaces every FEEDBACK_PARAMS knob (mapped or commented), none silently dropped', () => {
    const py = buildCombatFeelPython({});
    const missing = FEEDBACK_PARAMS.filter(p => !py.includes(COMMENT_NAME[p.id] ?? snake(p.id))).map(p => p.id);
    expect(missing).toEqual([]);
  });

  it('falls back to each param own defaultValue, not a second hand-kept default', () => {
    const py = buildCombatFeelPython({});
    const wrong = FEEDBACK_PARAMS.filter(p => {
      const name = COMMENT_NAME[p.id] ?? snake(p.id);
      const mapped = py.includes(`set_editor_property("${name}", ${p.defaultValue})`);
      const commented = py.includes(`${name} = ${p.defaultValue}`);
      return !mapped && !commented;
    }).map(p => p.id);
    expect(wrong).toEqual([]);
  });
});

describe('every GA_MeleeAttack feel UPROPERTY is reachable from the tuner', () => {
  // GA_MeleeAttack.h: HitStopDuration, HitStopTimeDilation, HitCameraShakeScale.
  const PROPS = ['hit_stop_duration', 'hit_stop_time_dilation', 'hit_camera_shake_scale'];

  it('the tuner has a hitstop time-dilation knob defaulting to the C++ 0.1', () => {
    const row = FEEDBACK_PARAMS.find(p => p.id === 'hitstopTimeDilation');
    expect(row?.category).toBe('Hitstop');
    expect(row?.defaultValue).toBe(0.1);
    expect(row!.min).toBeLessThan(row!.max);
  });

  it('the script sets all three properties, hit_stop_time_dilation from the tuner value', () => {
    const py = buildCombatFeelPython({ hitstopTimeDilation: 0.35 });
    const unset = PROPS.filter(n => !py.includes(`cdo.set_editor_property("${n}", `));
    expect(unset).toEqual([]);
    expect(py).toContain('cdo.set_editor_property("hit_stop_time_dilation", 0.35)');
  });
});
