import { MODULE_COLORS, ACCENT_CYAN } from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.core;

/* ── Canvas drawing helpers for StickFigurePreview ─────────────────────────── */

/** Draw the dashed ground line across the canvas */
export function drawGroundLine(ctx: CanvasRenderingContext2D, W: number, groundY: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Draw the animated stick figure at (x, y) with leg phase and optional dodge glow */
export function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  legPhase: number,
  isDodgeFrame: boolean,
) {
  const headR = 6;
  const bodyH = 20;
  const legLen = 16;
  const armLen = 14;

  ctx.save();
  ctx.translate(x, y);

  if (isDodgeFrame) {
    ctx.translate(0, -4);
    ctx.rotate(0.3);
  }

  const glowColor = isDodgeFrame ? ACCENT_CYAN : ACCENT;

  // Head
  ctx.beginPath();
  ctx.arc(0, -bodyH - headR, headR, 0, Math.PI * 2);
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isDodgeFrame ? 12 : 6;
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(0, -bodyH);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // Arms (swing with movement)
  const armSwing = Math.sin(legPhase) * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -bodyH + 4);
  ctx.lineTo(-armLen * Math.cos(armSwing), -bodyH + 4 + armLen * Math.sin(armSwing + 0.5));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -bodyH + 4);
  ctx.lineTo(armLen * Math.cos(-armSwing), -bodyH + 4 + armLen * Math.sin(-armSwing + 0.5));
  ctx.stroke();

  // Legs (walking animation)
  const legSwing = Math.sin(legPhase) * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(legLen * Math.sin(legSwing), legLen * Math.cos(legSwing));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(legLen * Math.sin(-legSwing), legLen * Math.cos(-legSwing));
  ctx.stroke();

  // I-frame glow during dodge
  if (isDodgeFrame) {
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2, 18, 0, Math.PI * 2);
    ctx.fillStyle = `${ACCENT_CYAN}20`;
    ctx.fill();
  }

  ctx.restore();
}

/** Draw the speed HUD bar and label */
export function drawSpeedHUD(
  ctx: CanvasRenderingContext2D,
  currentSpeed: number,
  targetSpeed: number,
  isDodging: boolean,
  posX: number,
  groundY: number,
) {
  const speedPct = currentSpeed / targetSpeed;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(10, 8, 80, 6);
  ctx.fillStyle = isDodging ? ACCENT_CYAN : ACCENT;
  ctx.shadowColor = isDodging ? ACCENT_CYAN : ACCENT;
  ctx.shadowBlur = 4;
  ctx.fillRect(10, 8, 80 * speedPct, 6);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px monospace';
  ctx.fillText(`${Math.round(currentSpeed)}/${Math.round(targetSpeed)} cm/s`, 10, 22);

  if (isDodging) {
    ctx.fillStyle = ACCENT_CYAN;
    ctx.font = 'bold 9px monospace';
    ctx.fillText('DODGE', posX - 15, groundY - 55);
  }
}
