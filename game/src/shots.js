// Cakrawala Courier — the screenshot scenes behind ?shot=1..4. Each one plays
// the real flight model forward from a fixed pose, steered by a small autopilot
// (bank towards the target bearing, pitch towards the target altitude, throttle
// to hold speed), so the frame is what a real flight looks like and the same
// shot always gives the same frame.
import { RUNWAY, STEP } from './config.js';
import { currentTarget } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const DEG = Math.PI / 180;
const FT_TO_M = 0.3048;

/** Steer towards `target` (x, altFt, z): returns the input the world expects. */
function autopilot(state, target, speedKt = 120) {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const wantHeading = Math.atan2(dx, -dz);
  let diff = wantHeading - state.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const bank = Math.max(-1, Math.min(1, diff * 2.2));
  const altError = target.altFt - state.altFt;
  const pitch = Math.max(-1, Math.min(1, altError / 220));
  return {
    pitch,
    bank,
    throttleUp: state.speedKt < speedKt - 4,
    throttleDown: state.speedKt > speedKt + 4,
    brake: false,
  };
}

function flyFor(world, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state.over) break;
    world.step(STEP, steer(world.state));
  }
}

/**
 * Stage `name` ('1'..'4') in `world` and return the screen to draw over it.
 * 1 = cover: mid-flight chase view, ring ahead, runway behind, full HUD.
 * 2 = threading a ring, close up. 3 = final approach to the runway.
 * 4 = title screen over a live demo sky.
 */
export function stageShot(name, world) {
  const s = world.state;
  if (name === '2') {
    // Park the plane 210 m short of ring 2, level with it, already lined up.
    const ring = world.rings[1];
    const fwdX = Math.sin(0.55), fwdZ = -Math.cos(0.55);
    s.x = ring.x - fwdX * 210;
    s.z = ring.z - fwdZ * 210;
    s.altFt = ring.altFt;
    s.heading = 0.55;
    s.speedKt = 118;
    s.throttle = 0.62;
    s.pitchDeg = 0;
    s.bankDeg = 0;
    s.fuel = 88;
    s.ringIndex = 1;
    flyFor(world, 1.1, (st) => autopilot(st, world.rings[1], 118));
    return { screen: SCREEN_PLAY, best: 450 };
  }
  if (name === '3') {
    // Final approach: 200 m south of the threshold, 100 ft, slowing, on centreline,
    // close enough that the runway fills the frame ahead of the plane.
    s.x = 4;
    s.z = RUNWAY.zMax + 200;
    s.altFt = 100;
    s.heading = 0;
    s.speedKt = 78;
    s.throttle = 0.26;
    s.pitchDeg = -3;
    s.bankDeg = 0;
    s.fuel = 34;
    s.mission = 'landing';
    s.ringIndex = 5;
    s.checkpointIndex = 3;
    s.score = 1450;
    s.time = 212;
    flyFor(world, 1.2, (st) => autopilot(st, { x: 0, altFt: 30, z: 100 }, 76));
    s.message = 'FINAL APPROACH — RUNWAY 27';
    s.messageT = 99;
    return { screen: SCREEN_PLAY, best: 1450 };
  }
  if (name === '4') {
    world.reset();
    flyFor(world, 14, (st) => autopilot(st, currentTarget(st, world.rings, world.checkpoints), 120));
    return { screen: SCREEN_TITLE, best: 1450 };
  }
  // Shot 1 (default): chase view on the climb-out, first ring dead ahead and
  // the runway still visible behind. Parked on a real flight path, then flown
  // forward a moment so the frame is a live one, not a still.
  world.reset();
  const ring1 = world.rings[0];
  s.x = 60;
  s.z = 540;
  s.altFt = 430;
  s.heading = -0.34;
  s.speedKt = 125;
  s.throttle = 0.62;
  s.pitchDeg = 2;
  s.bankDeg = -4;
  s.fuel = 92;
  s.ringIndex = 0;
  s.time = 34;
  flyFor(world, 1.2, (st) => autopilot(st, ring1, 125));
  s.score = 300;
  return { screen: SCREEN_PLAY, best: 1450 };
}
