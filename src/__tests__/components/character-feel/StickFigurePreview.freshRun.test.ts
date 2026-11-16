import { describe, it, expect } from 'vitest';
import {
  freshRun, stepPreview, type PreviewParams,
} from '@/components/modules/core-engine/sub_character/playground/StickFigurePreview';

const PARAMS: PreviewParams = { targetSpeed: 70, accelRate: 60, dodgeDist: 80, dodgeDur: 0.4, width: 400 };
const MID = () => 0.5;
const DT = 1 / 60;

/* The preview clock accumulates across runs. A fresh run scheduled its first dodge at
 * an absolute 2-4 s, so after any earlier play it was already in the past and the figure
 * dodged on frame 1, skipping the acceleration ramp the user had just tuned. */
describe('StickFigurePreview — a fresh run keeps its acceleration ramp', () => {
  it('a run started at clock t=10 does not dodge in its first 1.9 s', () => {
    let state = freshRun(10, MID);
    expect(state.nextDodgeAt).toBeGreaterThanOrEqual(12);
    let t = 10;
    while (t < 11.9) {
      t += DT;
      state = stepPreview(state, t, DT, PARAMS, MID);
      expect(state.isDodging).toBe(false);
    }
    expect(state.currentSpeed).toBeGreaterThan(0);
  });

  it('still dodges once the scheduled time passes', () => {
    let state = freshRun(10, MID);
    let t = 10;
    let dodged = false;
    while (t < 14 && !dodged) {
      t += DT;
      state = stepPreview(state, t, DT, PARAMS, MID);
      dodged = state.isDodging;
    }
    expect(dodged).toBe(true);
  });
});
