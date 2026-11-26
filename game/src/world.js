// Cakrawala Courier — the world: procedural terrain, the flight model and the
// three sorties. Pure logic, no DOM: the renderer draws what this builds and
// the shot stager can drive it from Node as well as from the browser.
import {
  BANK_MAX_DEG, CLIMB_FACTOR, DAMAGE_GROUND_STRIKE, DAMAGE_HARD_LANDING,
  FUEL_BURN_BASE, FUEL_BURN_FULL, FUEL_START, KT_TO_MS, LANDING_MAX_BANK_DEG,
  LANDING_MAX_SPEED_KT, LANDING_MAX_VS_MS, PITCH_MAX_DEG, PITCH_MIN_DEG,
  RIVER_HALF_WIDTH, ROAD_HALF_WIDTH, RUNWAY, CITY, SCORE_CHECKPOINT,
  SCORE_FUEL_BONUS_PER_PCT, SCORE_LANDING, SCORE_RING, SCORE_TIME_BONUS_PER_SEC,
  SPEED_MAX_KT, SPEED_MIN_KT, TURN_RATE, THROTTLE_RATE, WORLD_LIMIT,
} from './config.js';
import { hash2 } from './random.js';
import {
  MISSION_LANDING, MISSION_RINGS, MISSION_RIVER, buildRingCourse,
  buildRiverCheckpoints, missionTitle, startPose,
} from './missions.js';

export const EVENT_RING = 1;
export const EVENT_CHECKPOINT = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASH = 8;
export const EVENT_WIN = 16;
export const EVENT_DAMAGE = 32;
export const EVENT_FUEL_EMPTY = 64;
export const EVENT_MISSION = 128;
export const EVENT_BOUNCE = 256;

const DEG = Math.PI / 180;
const FT_TO_M = 0.3048;

// --- Terrain -----------------------------------------------------------------

/** Centre line of the river as a function of z (metres east of the runway). */
export function riverX(z) {
  return 320 * Math.sin(z * 0.0009) + 140 * Math.sin(z * 0.0021 + 1.7);
}

function fieldColour(x, z) {
  const cell = hash2(Math.floor(x / 240), Math.floor(z / 240));
  const grain = hash2(Math.floor(x / 55), Math.floor(z / 55));
  const shade = 0.92 + grain * 0.16;
  let r, g, b;
  if (cell < 0.34) { r = 106; g = 168; b = 79; }        // meadow green
  else if (cell < 0.55) { r = 91; g = 140; b = 90; }   // deep pasture
  else if (cell < 0.72) { r = 163; g = 184; b = 107; } // young wheat
  else if (cell < 0.86) { r = 217; g = 194; b = 122; } // ripe wheat
  else { r = 138; g = 111; b = 77; }                   // ploughed earth
  return ((r * shade) | 0) << 16 | ((g * shade) | 0) << 8 | ((b * shade) | 0);
}

/**
 * Packed RGB colour of the ground at (x, z). Runway, river, roads and the city
 * are drawn over the field patchwork, in that order.
 */
export function terrainColour(x, z) {
  // Runway: asphalt, white centre dashes, threshold bars, edge lines.
  if (Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth && z > RUNWAY.zMin && z < RUNWAY.zMax) {
    const along = z - RUNWAY.zMin;
    const total = RUNWAY.zMax - RUNWAY.zMin;
    if ((along < 26 || along > total - 26) && Math.abs(x) < 14 && ((Math.abs(x) + 4) % 9) < 4.5) return 0xe8e8e2;
    if (Math.abs(x) < 1.4 && ((z % 44) + 44) % 44 < 24) return 0xe8e8e2;
    if (Math.abs(x) > 15.2 && Math.abs(x) < 16.6) return 0xd8d8d2;
    return 0x3c3f45;
  }
  // River with a sandy bank and a light ripple stripe.
  const rx = riverX(z);
  const rd = Math.abs(x - rx);
  if (rd < RIVER_HALF_WIDTH) {
    return (((z * 0.5 + x) % 30 + 30) % 30) < 3 ? 0x6fb2e0 : 0x3f7fc4;
  }
  if (rd < RIVER_HALF_WIDTH + 7) return 0xcbb37a;
  // Roads: one north-south, one east-west, both with a dashed centre line.
  if (Math.abs(x - 250) < ROAD_HALF_WIDTH || Math.abs(z + 600) < ROAD_HALF_WIDTH) {
    const onDash = Math.abs(x - 250) < ROAD_HALF_WIDTH
      ? ((z % 30) + 30) % 30 < 15 : ((x % 30) + 30) % 30 < 15;
    if (Math.abs(x - 250) < 1.2 && onDash) return 0xd8d8d2;
    if (Math.abs(z + 600) < 1.2 && onDash) return 0xd8d8d2;
    return 0x4a4a4e;
  }
  // The city: blocks of rooftops in grey and brick, streets between them.
  if (x > CITY.xMin && x < CITY.xMax && z > CITY.zMin && z < CITY.zMax) {
    const lx = (x - CITY.xMin) % 70;
    const lz = (z - CITY.zMin) % 70;
    if (lx < 13 || lz < 13) return 0x55565c;
    const h = hash2(Math.floor((x - CITY.xMin) / 70), Math.floor((z - CITY.zMin) / 70));
    if (h < 0.4) return 0x8a8d94;
    if (h < 0.7) return 0x7a7d85;
    return 0x9a938a;
  }
  return fieldColour(x, z);
}

export function isOverRunway(x, z) {
  return Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth && z > RUNWAY.zMin && z < RUNWAY.zMax;
}

// --- World state -------------------------------------------------------------

export function createWorld() {
  const rings = buildRingCourse();
  const checkpoints = buildRiverCheckpoints();
  const state = freshState();
  const world = {
    state,
    rings,
    checkpoints,
    reset() {
      Object.assign(state, freshState());
    },
    step(dt, input) {
      return stepWorld(state, rings, checkpoints, dt, input);
    },
  };
  return world;
}

function freshState() {
  const pose = startPose();
  return {
    x: pose.x, z: pose.z, altFt: pose.altFt, heading: pose.heading,
    speedKt: pose.speedKt, throttle: pose.throttle, pitchDeg: pose.pitchDeg,
    bankDeg: pose.bankDeg, fuel: FUEL_START, damage: 0, score: 0,
    mission: MISSION_RINGS, ringIndex: 0, checkpointIndex: 0,
    time: 0, missionTime: 0, sortieStartTime: 0,
    landed: false, over: false, win: false, crashed: false,
    airborne: false, // true once the plane has left the ground: only then can it hit it
    message: '', messageT: 0, outOfBounds: false, engineOn: true,
    ringsCleared: 0, dropsCleared: 0, landings: 0,
  };
}

function approach(value, target, rate, dt) {
  const delta = target - value;
  const step = rate * dt;
  if (Math.abs(delta) <= step) return target;
  return value + Math.sign(delta) * step;
}

function stepWorld(s, rings, checkpoints, dt, input) {
  if (s.over) return 0;
  let events = 0;
  s.time += dt;
  s.missionTime += dt;
  if (s.messageT > 0) s.messageT -= dt;

  // Throttle: hold to spool up or down; empty tanks kill the engine.
  if (input.throttleUp) s.throttle = Math.min(1, s.throttle + THROTTLE_RATE * dt);
  if (input.throttleDown) s.throttle = Math.max(0, s.throttle - THROTTLE_RATE * dt);
  if (s.fuel <= 0) {
    s.throttle = 0;
    if (s.engineOn) { s.engineOn = false; events |= EVENT_FUEL_EMPTY; s.message = 'FUEL EMPTY — GLIDE HER HOME'; s.messageT = 3; }
  }
  s.fuel = Math.max(0, s.fuel - (FUEL_BURN_BASE + FUEL_BURN_FULL * s.throttle) * dt);

  // Speed chases the throttle setting; pitch and bank chase the stick.
  const targetSpeed = SPEED_MIN_KT + s.throttle * (SPEED_MAX_KT - SPEED_MIN_KT);
  s.speedKt = approach(s.speedKt, targetSpeed, s.speedKt < targetSpeed ? 14 : 22, dt);
  const pitchTarget = input.pitch * (input.pitch >= 0 ? PITCH_MAX_DEG : -PITCH_MIN_DEG);
  s.pitchDeg = approach(s.pitchDeg, pitchTarget, 42, dt);
  s.bankDeg = approach(s.bankDeg, input.bank * BANK_MAX_DEG, 65, dt);

  // Heading follows the bank; a slow plane barely turns at all.
  const bankRad = s.bankDeg * DEG;
  s.heading += Math.sin(bankRad) * TURN_RATE * (0.25 + s.speedKt / SPEED_MAX_KT) * dt;

  // Vertical speed: pitch lifts, a slow wing sinks.
  const speedMs = s.speedKt * KT_TO_MS;
  let vsMs = speedMs * Math.sin(s.pitchDeg * DEG) * CLIMB_FACTOR;
  if (s.speedKt < 62) vsMs -= (62 - s.speedKt) * 0.16;
  if (input.brake) vsMs -= 1.5;
  s.altFt += (vsMs / FT_TO_M) * dt;
  if (s.altFt > 5) s.airborne = true;

  // Position: heading 0 is due north, -z.
  s.x += Math.sin(s.heading) * speedMs * dt;
  s.z -= Math.cos(s.heading) * speedMs * dt;

  // Past the edge of the chart the plane is turned gently back home.
  const distHome = Math.hypot(s.x, s.z);
  s.outOfBounds = distHome > WORLD_LIMIT;
  if (s.outOfBounds) {
    const homeHeading = Math.atan2(-s.x, s.z);
    let diff = homeHeading - s.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    s.heading += Math.max(-1.1 * dt, Math.min(1.1 * dt, diff));
  }

  // A plane skimming the ground settles onto it instead of hovering forever
  // a fraction of a foot above the runway.
  if (s.altFt > 0 && s.altFt < 2 && vsMs <= 0.5) s.altFt = 0;

  // Mission targets.
  if (s.mission === MISSION_RINGS) {
    const ring = rings[s.ringIndex];
    if (ring) {
      const dx = s.x - ring.x;
      const dy = s.altFt - ring.altFt;
      const dz = s.z - ring.z;
      if (Math.hypot(dx, dy * FT_TO_M, dz) < ring.r) {
        s.ringIndex += 1;
        s.ringsCleared += 1;
        s.score += SCORE_RING;
        events |= EVENT_RING;
        s.message = `RING ${s.ringIndex} OF ${rings.length} — +${SCORE_RING}`;
        s.messageT = 2.5;
        if (s.ringIndex >= rings.length) {
          s.mission = MISSION_RIVER;
          s.missionTime = 0;
          events |= EVENT_MISSION;
          s.message = 'RING RUN CLEAR — RIVER COURIER NEXT';
          s.messageT = 3.5;
        }
      }
    }
  } else if (s.mission === MISSION_RIVER) {
    const point = checkpoints[s.checkpointIndex];
    if (point) {
      const horizontal = Math.hypot(s.x - point.x, s.z - point.z);
      if (horizontal < point.r && s.altFt < point.altFt) {
        s.checkpointIndex += 1;
        s.dropsCleared += 1;
        s.score += SCORE_CHECKPOINT;
        events |= EVENT_CHECKPOINT;
        s.message = `DROP ${s.checkpointIndex} OF ${checkpoints.length} DELIVERED — +${SCORE_CHECKPOINT}`;
        s.messageT = 2.5;
        if (s.checkpointIndex >= checkpoints.length) {
          s.mission = MISSION_LANDING;
          s.missionTime = 0;
          events |= EVENT_MISSION;
          s.message = 'ALL DROPS DELIVERED — BRING HER HOME';
          s.messageT = 3.5;
        }
      }
    }
  }

  // The ground: a runway landing, a hard bounce, or a crash. A plane still on
  // its take-off roll cannot crash into the runway it is sitting on.
  if (s.altFt <= 0) {
    s.altFt = 0;
    if (!s.airborne) return events;
    const onRunway = isOverRunway(s.x, s.z);
    const gentle = vsMs >= LANDING_MAX_VS_MS;
    const slow = s.speedKt <= LANDING_MAX_SPEED_KT;
    const level = Math.abs(s.bankDeg) <= LANDING_MAX_BANK_DEG;
    if (onRunway && gentle && slow && level) {
      s.landed = true;
      events |= EVENT_LANDED;
      if (s.mission === MISSION_LANDING) {
        const timeBonus = Math.max(0, Math.round((240 - s.missionTime) * SCORE_TIME_BONUS_PER_SEC));
        const fuelBonus = Math.round(s.fuel * SCORE_FUEL_BONUS_PER_PCT);
        s.score += SCORE_LANDING + timeBonus + fuelBonus;
        s.win = true;
        s.over = true;
        events |= EVENT_WIN;
        s.message = `LANDED! +${SCORE_LANDING}  TIME +${timeBonus}  FUEL +${fuelBonus}`;
        s.messageT = 6;
      } else {
        // Touched down mid-sortie: a bounce back into the air, not a crash.
        s.altFt = 26;
        s.speedKt *= 0.7;
        s.pitchDeg = 4;
        events |= EVENT_BOUNCE;
        s.message = 'TOUCHDOWN — BACK IN THE AIR';
        s.messageT = 2;
      }
    } else if (onRunway && gentle && !slow) {
      // Fast on the runway: a hard bounce that costs the airframe.
      s.damage += DAMAGE_HARD_LANDING;
      s.altFt = 30;
      s.speedKt *= 0.65;
      events |= EVENT_DAMAGE;
      s.message = 'TOO FAST — HARD BOUNCE, AIRFRAME DAMAGE';
      s.messageT = 2.5;
      if (s.damage >= 100) {
        s.crashed = true; s.over = true; events |= EVENT_CRASH;
        s.message = 'AIRFRAME FAILED — CRASHED';
        s.messageT = 6;
      }
    } else {
      s.damage = DAMAGE_GROUND_STRIKE;
      s.crashed = true;
      s.over = true;
      events |= EVENT_CRASH;
      s.message = onRunway ? 'CRASHED ON THE RUNWAY' : 'CRASHED — TERRAIN IMPACT';
      s.messageT = 6;
    }
  }
  return events;
}

export function currentTarget(state, rings, checkpoints) {
  if (state.mission === MISSION_RINGS) return { kind: 'ring', ...rings[state.ringIndex] };
  if (state.mission === MISSION_RIVER) return { kind: 'drop', ...checkpoints[state.checkpointIndex] };
  return { kind: 'runway', x: RUNWAY.x, z: (RUNWAY.zMin + RUNWAY.zMax) / 2, altFt: 0, r: 60, label: 'RUNWAY 27' };
}

export function missionTitleOf(state) {
  return missionTitle(state.mission);
}
