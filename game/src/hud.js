// Cakrawala Courier — the HUD: altitude, speed and heading on top, fuel and
// damage and throttle at the bottom, a compass strip, an artificial horizon
// and the mission banner. Everything a pilot needs, nothing she does not.
import { missionTitleOf } from './world.js';

const DEG = Math.PI / 180;

function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

function pad3(n) {
  return String(((Math.round(n) % 360) + 360) % 360).padStart(3, '0');
}

function fmtTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function bar(ctx, x, y, w, h, fraction, colour, label) {
  ctx.fillStyle = 'rgba(6, 18, 30, 0.62)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
  ctx.fillStyle = colour;
  const inner = Math.max(0, Math.min(1, fraction));
  ctx.beginPath(); ctx.roundRect(x + 2, y + 2, (w - 4) * inner, h - 4, 4); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 6, y + h / 2 + 4);
}

export function drawHud(ctx, state, world, screen, best, w, h) {
  const s = w / 1280;
  const topH = 58 * (h / 800);
  ctx.fillStyle = 'rgba(6, 18, 30, 0.55)';
  ctx.fillRect(0, 0, w, topH);

  // Primary instruments, left: altitude, speed, heading.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8fd0ff';
  ctx.font = `bold ${Math.round(11 * s + 4)}px system-ui, sans-serif`;
  ctx.fillText('ALTITUDE', 16, 18);
  ctx.fillText('SPEED', 150 * s + 60, 18);
  ctx.fillText('HEADING', 300 * s + 90, 18);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(24 * s + 6)}px system-ui, sans-serif`;
  ctx.fillText(`${fmt(state.altFt)} FT`, 16, 46);
  ctx.fillText(`${Math.round(state.speedKt)} KT`, 150 * s + 60, 46);
  ctx.fillText(`${pad3(state.heading / DEG)}°`, 300 * s + 90, 46);

  // Mission and score, right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb400';
  ctx.font = `bold ${Math.round(13 * s + 5)}px system-ui, sans-serif`;
  ctx.fillText(missionTitleOf(state), w - 16, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(20 * s + 5)}px system-ui, sans-serif`;
  const progress = state.mission === 'rings'
    ? `RING ${Math.min(state.ringIndex + 1, 5)}/5`
    : state.mission === 'river' ? `DROP ${Math.min(state.checkpointIndex + 1, 3)}/3` : 'LAND NOW';
  ctx.fillText(`${progress}   SCORE ${fmt(state.score)}   ${fmtTime(state.time)}`, w - 16, 46);

  // Compass strip under the top bar.
  const cy = topH + 14;
  const headingDeg = ((state.heading / DEG) % 360 + 360) % 360;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, topH, w, 26); ctx.clip();
  ctx.fillStyle = 'rgba(6, 18, 30, 0.4)';
  ctx.fillRect(0, topH, w, 26);
  const pxPerDeg = 3.2 * s;
  const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  for (let d = -180; d <= 540; d += 15) {
    const rel = ((d - headingDeg + 540) % 360) - 180;
    const x = w / 2 + rel * pxPerDeg;
    if (x < -20 || x > w + 20) continue;
    const isCard = labels.some(([deg]) => deg === ((d % 360) + 360) % 360);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.moveTo(x, cy - 4); ctx.lineTo(x, cy + (isCard ? 8 : 3)); ctx.stroke();
    if (isCard) {
      const lab = labels.find(([deg]) => deg === ((d % 360) + 360) % 360)[1];
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(11 * s + 3)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(lab, x, cy + 22);
    }
  }
  ctx.restore();
  // Centre lubber line.
  ctx.fillStyle = '#ffb400';
  ctx.beginPath(); ctx.moveTo(w / 2, topH + 2); ctx.lineTo(w / 2 - 6, topH + 12); ctx.lineTo(w / 2 + 6, topH + 12); ctx.closePath(); ctx.fill();

  // Artificial horizon, bottom-left: bank rolls it, pitch slides it.
  const gx = 62, gy = h - 62, gr = 44;
  ctx.save();
  ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.clip();
  ctx.translate(gx, gy);
  ctx.rotate(-state.bankDeg * DEG);
  ctx.translate(0, state.pitchDeg * 1.1);
  ctx.fillStyle = '#3f7fc4'; ctx.fillRect(-gr - 4, -gr - 4, gr * 2 + 8, gr + 4);
  ctx.fillStyle = '#8a6f4d'; ctx.fillRect(-gr - 4, 0, gr * 2 + 8, gr + 4);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-gr - 4, -1.5, gr * 2 + 8, 3);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffb400';
  ctx.beginPath(); ctx.moveTo(gx - 8, gy); ctx.lineTo(gx + 8, gy); ctx.lineTo(gx, gy + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', gx, gy + gr + 14);

  // Fuel and damage, bottom-left beside the gauge.
  const fuelColour = state.fuel > 50 ? '#34d17b' : state.fuel > 20 ? '#ffb400' : '#ff5a4e';
  bar(ctx, 126, h - 84, 170, 20, state.fuel / 100, fuelColour, `FUEL ${Math.round(state.fuel)}%`);
  const dmgColour = state.damage < 30 ? '#34d17b' : state.damage < 70 ? '#ffb400' : '#ff5a4e';
  bar(ctx, 126, h - 58, 170, 20, state.damage / 100, dmgColour, `DAMAGE ${Math.round(state.damage)}%`);

  // Throttle, bottom-right.
  const thrColour = state.engineOn ? '#12a19e' : '#888888';
  bar(ctx, w - 216, h - 84, 200, 20, state.throttle, thrColour, `THR ${Math.round(state.throttle * 100)}%`);
  ctx.fillStyle = state.engineOn ? '#ffffff' : '#ff5a4e';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(state.engineOn ? 'ENGINE ON' : 'ENGINE OUT — GLIDING', w - 16, h - 44);

  // Centre message banner.
  if (state.messageT > 0 && state.message) {
    const alpha = Math.min(1, state.messageT);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(26 * s + 6)}px system-ui, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.message, w / 2, h * 0.30);
    ctx.restore();
  }
  if (state.outOfBounds && !state.over) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.time * 6);
    ctx.fillStyle = '#ff5a4e';
    ctx.font = `bold ${Math.round(16 * s + 5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('OFF THE CHART — TURN BACK HOME', w / 2, h * 0.36);
    ctx.restore();
  }
  if (state.fuel < 20 && state.fuel > 0 && !state.over) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.time * 6);
    ctx.fillStyle = '#ffb400';
    ctx.font = `bold ${Math.round(16 * s + 5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', w / 2, h * 0.40);
    ctx.restore();
  }
  // Quiet hint, bottom centre.
  if (screen === 'play') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${Math.round(12 * s + 3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ pitch · ←→ bank · W/S throttle · SPACE brake · P pause', w / 2, h - 12);
  }
}
