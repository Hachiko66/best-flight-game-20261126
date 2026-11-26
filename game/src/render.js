// Cakrawala Courier — the renderer: a mode-7 pseudo-3D chase view painted on a
// low-res offscreen canvas and scaled up, plus the aircraft, the rings, the sky
// and every screen (title, pause, crash, win) around it.
import { FOCAL, RUNWAY, SKY_HORIZON, SKY_TOP, VIEW_H, VIEW_W } from './config.js';
import { currentTarget, terrainColour } from './world.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const DEG = Math.PI / 180;
const FT_TO_M = 0.3048;
const MAIN_FOCAL = 640; // pinhole focal length for rings/markers, main-canvas px

function hexLerp(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const SKY_TOP_RGB = 0x2f6fb4;
const SKY_HOR_RGB = 0xbfe0f2;
const HAZE_RGB = 0xa8c8dc;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  off.width = VIEW_W;
  off.height = VIEW_H;
  const offCtx = off.getContext('2d');
  const image = offCtx.createImageData(VIEW_W, VIEW_H);
  const data = image.data;

  // Clouds drift with heading so the sky never looks painted on.
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    clouds.push({ angle: i * 0.73, y: 26 + (i % 4) * 26, scale: 0.7 + (i % 3) * 0.35, speed: 0.02 + (i % 3) * 0.008 });
  }

  function horizonY(state) {
    return 96 + state.pitchDeg * 1.7;
  }

  /** Project a world point into main-canvas pixels; null when behind the plane. */
  function project(x, altFt, z, state, w, h) {
    const dx = x - state.x;
    const dz = z - state.z;
    const fwdX = Math.sin(state.heading);
    const fwdZ = -Math.cos(state.heading);
    const rightX = Math.cos(state.heading);
    const rightZ = Math.sin(state.heading);
    const fwd = dx * fwdX + dz * fwdZ;
    if (fwd < 6) return null;
    const right = dx * rightX + dz * rightZ;
    const up = (altFt - state.altFt) * FT_TO_M;
    const hy = horizonY(state) * (h / VIEW_H);
    const sx = w / 2 + (right / fwd) * MAIN_FOCAL * (w / 1280);
    const sy = hy - (up / fwd) * MAIN_FOCAL * (w / 1280);
    const roll = state.bankDeg * DEG;
    const cx = w / 2, cy = h * 0.45;
    const ox = sx - cx, oy = sy - cy;
    return {
      x: cx + ox * Math.cos(roll) - oy * Math.sin(roll),
      y: cy + ox * Math.sin(roll) + oy * Math.cos(roll),
      dist: fwd,
      size: MAIN_FOCAL * (w / 1280) / fwd,
    };
  }

  function paintTerrain(state) {
    const w = VIEW_W, h = VIEW_H;
    const hy = horizonY(state);
    const roll = state.bankDeg * DEG * 0.55; // the world rolls a little less than the plane
    const cosR = Math.cos(roll), sinR = Math.sin(roll);
    const altM = Math.max(state.altFt * FT_TO_M, 2.5);
    const fwdX = Math.sin(state.heading), fwdZ = -Math.cos(state.heading);
    const rightX = Math.cos(state.heading), rightZ = Math.sin(state.heading);
    const cx = w / 2, cy = h / 2;
    for (let sy = 0; sy < h; sy += 1) {
      for (let sx = 0; sx < w; sx += 1) {
        const idx = (sy * w + sx) * 4;
        const dx = sx - cx, dy = sy - cy;
        const rx = dx * cosR - dy * sinR;
        const ry = dx * sinR + dy * cosR + cy;
        if (ry < hy) {
          // Sky: a vertical gradient from deep blue to pale horizon.
          const t = Math.max(0, Math.min(1, (hy - ry) / 90));
          const c = hexLerp(SKY_HOR_RGB, SKY_TOP_RGB, Math.min(1, t * 1.15));
          data[idx] = (c >> 16) & 255; data[idx + 1] = (c >> 8) & 255; data[idx + 2] = c & 255;
          data[idx + 3] = 255;
          continue;
        }
        const depth = ry - hy;
        if (depth < 1.5) {
          data[idx] = 0xa8; data[idx + 1] = 0xc8; data[idx + 2] = 0xdc; data[idx + 3] = 255;
          continue;
        }
        const dist = (altM * FOCAL) / depth;
        const lateral = (rx / (w / 2)) * dist * 0.85;
        const wx = state.x + fwdX * dist + rightX * lateral;
        const wz = state.z + fwdZ * dist + rightZ * lateral;
        let c = terrainColour(wx, wz);
        if (dist > 1400) {
          const t = Math.min(1, (dist - 1400) / 1800);
          c = hexLerp(c, HAZE_RGB, t * 0.75);
        }
        data[idx] = (c >> 16) & 255; data[idx + 1] = (c >> 8) & 255; data[idx + 2] = c & 255;
        data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(image, 0, 0);
  }

  function drawSunAndClouds(state, w, h) {
    const hy = horizonY(state) * (h / VIEW_H);
    // Sun sits to the west; it swings across the sky as the heading turns.
    let bearing = -2.1 - state.heading;
    while (bearing > Math.PI) bearing -= Math.PI * 2;
    while (bearing < -Math.PI) bearing += Math.PI * 2;
    if (Math.abs(bearing) < 1.35) {
      const sx = w / 2 + bearing * w * 0.75;
      const sy = Math.max(30, hy - h * 0.22);
      const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
      glow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 214, 110, 0.55)');
      glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx, sy, 90, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffedb0';
      ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();
    }
    // Soft clouds, wrapped so they stream past forever.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const cloud of clouds) {
      let rel = cloud.angle - state.heading;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      const cxp = w / 2 + rel * w * 0.9;
      if (cxp < -220 || cxp > w + 220) continue;
      const cy = cloud.y * (h / VIEW_H);
      const s = cloud.scale * (w / 1280);
      ctx.beginPath();
      ctx.ellipse(cxp, cy, 92 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cxp - 48 * s, cy + 5 * s, 55 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cxp + 52 * s, cy + 4 * s, 58 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRing(ctx2, ring, state, w, h, active) {
    const p = project(ring.x, ring.altFt, ring.z, state, w, h);
    if (!p || p.dist > 2600) return;
    const radius = Math.max(4, ring.r * p.size * 0.9);
    ctx2.save();
    ctx2.translate(p.x, p.y);
    ctx2.globalAlpha = active ? 1 : 0.35;
    ctx2.shadowColor = active ? '#ffb400' : '#888888';
    ctx2.shadowBlur = active ? 18 : 4;
    ctx2.strokeStyle = active ? '#ffb400' : '#bbbbbb';
    ctx2.lineWidth = Math.max(3, radius * 0.12);
    ctx2.beginPath();
    ctx2.ellipse(0, 0, radius, radius * 0.94, 0, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.shadowBlur = 0;
    ctx2.fillStyle = active ? 'rgba(255, 180, 0, 0.10)' : 'rgba(255,255,255,0.04)';
    ctx2.fill();
    ctx2.restore();
    // The target arrow at the top of the screen already names this ring and
    // its distance, so the ring itself stays unlabelled and clean.
  }

  function drawDropMarker(ctx2, point, state, w, h) {
    const ground = project(point.x, 0, point.z, state, w, h);
    if (!ground || ground.dist > 2600) return;
    const r = Math.max(5, point.r * ground.size * 0.55);
    ctx2.save();
    ctx2.translate(ground.x, ground.y);
    ctx2.strokeStyle = 'rgba(120, 220, 255, 0.95)';
    ctx2.lineWidth = 3;
    ctx2.setLineDash([8, 6]);
    ctx2.beginPath(); ctx2.ellipse(0, 0, r, r * 0.36, 0, 0, Math.PI * 2); ctx2.stroke();
    ctx2.setLineDash([]);
    ctx2.restore();
    const top = project(point.x, 90, point.z, state, w, h);
    if (top) {
      ctx2.save();
      ctx2.translate(top.x, top.y);
      ctx2.rotate(Math.PI / 4);
      ctx2.fillStyle = '#78dcff';
      ctx2.shadowColor = '#78dcff';
      ctx2.shadowBlur = 12;
      ctx2.fillRect(-7, -7, 14, 14);
      ctx2.restore();
      ctx2.fillStyle = '#ffffff';
      ctx2.font = `bold ${Math.max(12, Math.round(15 * (w / 1280)))}px system-ui, sans-serif`;
      ctx2.textAlign = 'center';
      ctx2.fillText(`${point.label}  ·  ${Math.round(top.dist)} m`, top.x, top.y - 22);
    }
  }

  /** The courier herself: a little teal-and-orange prop plane, seen from behind. */
  function drawPlane(state, w, h) {
    const px = w / 2;
    const py = h * 0.66;
    const s = w / 1280;
    const bank = state.bankDeg * DEG * 0.85;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(bank);
    ctx.scale(s, s);
    // Propeller disc: a slim, faint blur with a spinner hub, not a balloon.
    ctx.fillStyle = 'rgba(225, 232, 240, 0.16)';
    ctx.beginPath(); ctx.ellipse(0, -118, 13, 92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200, 210, 225, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -118, 13, 92, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#274b5e';
    ctx.beginPath(); ctx.arc(0, -118, 7, 0, Math.PI * 2); ctx.fill();
    // Wings: swept, orange tips, teal roots.
    ctx.fillStyle = '#0e7c7b';
    ctx.beginPath();
    ctx.moveTo(-14, -58); ctx.lineTo(-236, 8); ctx.lineTo(-214, 34); ctx.lineTo(-14, -18);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -58); ctx.lineTo(236, 8); ctx.lineTo(214, 34); ctx.lineTo(14, -18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath(); ctx.moveTo(-236, 8); ctx.lineTo(-214, 34); ctx.lineTo(-188, 28); ctx.lineTo(-204, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(236, 8); ctx.lineTo(214, 34); ctx.lineTo(188, 28); ctx.lineTo(204, 2); ctx.closePath(); ctx.fill();
    // Tailplane and fin.
    ctx.fillStyle = '#0b5f5e';
    ctx.beginPath(); ctx.moveTo(-16, 96); ctx.lineTo(-96, 128); ctx.lineTo(-88, 146); ctx.lineTo(-12, 122); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, 96); ctx.lineTo(96, 128); ctx.lineTo(88, 146); ctx.lineTo(12, 122); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 92); ctx.lineTo(-14, 148); ctx.lineTo(14, 148); ctx.closePath(); ctx.fill();
    // Fuselage: a rounded teal body with a cream stripe.
    const body = ctx.createLinearGradient(-26, 0, 26, 0);
    body.addColorStop(0, '#0a5a59');
    body.addColorStop(0.5, '#12a19e');
    body.addColorStop(1, '#0a5a59');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.quadraticCurveTo(24, -120, 26, -40);
    ctx.quadraticCurveTo(28, 40, 20, 118);
    ctx.quadraticCurveTo(12, 152, 0, 152);
    ctx.quadraticCurveTo(-12, 152, -20, 118);
    ctx.quadraticCurveTo(-28, 40, -26, -40);
    ctx.quadraticCurveTo(-24, -120, 0, -150);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe9b8';
    ctx.fillRect(-26, -58, 52, 10);
    // Canopy: the pilot's window, lit from the sun.
    ctx.fillStyle = '#bfe6ff';
    ctx.beginPath(); ctx.ellipse(0, -96, 13, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(-4, -108, 4, 12, 0, 0, Math.PI * 2); ctx.fill();
    // Navigation lights.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(-232, 16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#34d17b';
    ctx.beginPath(); ctx.arc(232, 16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTargetArrow(state, world, w, h) {
    const target = currentTarget(state, world.rings, world.checkpoints);
    if (state.over) return;
    let bearing;
    let label;
    let dist;
    if (target.kind === 'runway') {
      const dx = RUNWAY.x - state.x;
      const dz = (RUNWAY.zMin + RUNWAY.zMax) / 2 - state.z;
      bearing = Math.atan2(dx, -dz) - state.heading;
      dist = Math.hypot(dx, dz);
      label = 'RUNWAY';
    } else {
      const dx = target.x - state.x;
      const dz = target.z - state.z;
      bearing = Math.atan2(dx, -dz) - state.heading;
      dist = Math.hypot(dx, dz, (target.altFt - state.altFt) * FT_TO_M);
      label = target.label;
    }
    while (bearing > Math.PI) bearing -= Math.PI * 2;
    while (bearing < -Math.PI) bearing += Math.PI * 2;
    const cx = w / 2;
    const cy = 96 * (h / 800);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(8, 20, 34, 0.55)';
    ctx.beginPath(); ctx.roundRect(-118, -20, 236, 40, 10); ctx.fill();
    ctx.rotate(Math.max(-1.2, Math.min(1.2, bearing * 0.9)));
    ctx.fillStyle = '#ffb400';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 8); ctx.lineTo(0, 4); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(15 * (w / 1280))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${label}  ${Math.round(dist)} m`, cx, cy + 34);
  }

  function panel(ctx2, x, y, w, h, title) {
    ctx2.fillStyle = 'rgba(6, 18, 30, 0.62)';
    ctx2.beginPath(); ctx2.roundRect(x, y, w, h, 8); ctx2.fill();
    ctx2.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx2.lineWidth = 1;
    ctx2.stroke();
    ctx2.fillStyle = '#ffb400';
    ctx2.font = `bold ${Math.round(13 * (w / 1280) + 6)}px system-ui, sans-serif`;
    ctx2.textAlign = 'center';
    ctx2.fillText(title, x + w / 2, y + 22);
  }

  function drawTitle(state, best, w, h) {
    ctx.fillStyle = 'rgba(4, 16, 28, 0.45)';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb400';
    ctx.font = `bold ${Math.round(54 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText('CAKRAWALA COURIER', cx, h * 0.24);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(21 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText('A little prop plane, three sorties, one ridge of sky.', cx, h * 0.24 + 36);
    ctx.font = `${Math.round(17 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillStyle = '#cfe8ff';
    const lines = [
      '1 · RING RUN — thread five rings over the valley',
      '2 · RIVER COURIER — drop three parcels along the river',
      '3 · HOME RUNWAY — land her slow, level and whole',
    ];
    lines.forEach((line, i) => ctx.fillText(line, cx, h * 0.42 + i * 30));
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(20 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText('↑↓ pitch    ←→ bank    W / S throttle    SPACE brake', cx, h * 0.60);
    ctx.fillText('P pause    M sound    Click or press SPACE to fly', cx, h * 0.60 + 32);
    if (best > 0) {
      ctx.fillStyle = '#ffb400';
      ctx.font = `bold ${Math.round(18 * (w / 1280))}px system-ui, sans-serif`;
      ctx.fillText(`BEST SCORE  ${best}`, cx, h * 0.60 + 70);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(14 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText('Fuel burns. The airframe remembers hard landings. Fly like it matters.', cx, h - 28);
  }

  function drawPaused(w, h) {
    ctx.fillStyle = 'rgba(4, 16, 28, 0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(40 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText('PAUSED', w / 2, h * 0.44);
    ctx.font = `${Math.round(18 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText('Press P or click to keep flying', w / 2, h * 0.44 + 36);
  }

  function drawOver(state, best, w, h) {
    ctx.fillStyle = state.win ? 'rgba(6, 40, 22, 0.5)' : 'rgba(40, 8, 8, 0.55)';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = state.win ? '#7dffb0' : '#ff7a6b';
    ctx.font = `bold ${Math.round(44 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText(state.win ? 'ALL SORTIES COMPLETE' : state.crashed ? 'CRASHED' : 'SORTIE OVER', cx, h * 0.36);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(20 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText(state.message || '', cx, h * 0.36 + 40);
    ctx.font = `bold ${Math.round(24 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText(`SCORE  ${state.score}    ·    RINGS ${state.ringsCleared}/5    ·    DROPS ${state.dropsCleared}/3`, cx, h * 0.52);
    ctx.fillStyle = '#ffb400';
    ctx.font = `bold ${Math.round(18 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText(`BEST  ${Math.max(best, state.score)}`, cx, h * 0.52 + 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(18 * (w / 1280))}px system-ui, sans-serif`;
    ctx.fillText('Press R or SPACE to fly again', cx, h * 0.66);
  }

  return {
    draw(state, world, screen, best) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      paintTerrain(state);
      ctx.drawImage(off, 0, 0, w, h);
      drawSunAndClouds(state, w, h);
      if (screen !== SCREEN_TITLE) {
        // The runway's far end glows faintly so home is always findable.
        if (state.mission === 'landing') {
          const p = project(RUNWAY.x, 4, RUNWAY.zMin, state, w, h);
          if (p && p.dist < 2600) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.fillStyle = 'rgba(255, 180, 0, 0.9)';
            ctx.shadowColor = '#ffb400'; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        }
        for (const ring of world.rings) {
          const index = world.rings.indexOf(ring);
          // Only the next ring is drawn: the others would float in the sky
          // like bubbles and read as clutter, not as a course.
          if (state.mission === 'rings' && index === state.ringIndex) drawRing(ctx, ring, state, w, h, true);
        }
        for (const point of world.checkpoints) {
          const index = world.checkpoints.indexOf(point);
          if (state.mission === 'river' && index >= state.checkpointIndex) drawDropMarker(ctx, point, state, w, h);
        }
        drawTargetArrow(state, world, w, h);
        drawPlane(state, w, h);
        drawHud(ctx, state, world, screen, best, w, h);
      }
      if (screen === SCREEN_TITLE) {
        // Title flies over a live demo sky, then the panel goes on top.
        drawPlane(state, w, h);
        drawTitle(state, best, w, h);
      } else if (screen === SCREEN_PAUSED) {
        drawPaused(w, h);
      } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
        drawOver(state, best, w, h);
      }
    },
  };
}
