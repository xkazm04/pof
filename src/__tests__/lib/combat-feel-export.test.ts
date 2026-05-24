import { describe, it, expect } from 'vitest';
import { buildCombatFeelPython } from '@/components/modules/core-engine/unique-tabs/CombatActionMap/polish/combat-feel-export';

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
