// Cakrawala Courier — the three sorties of one flight, in order.
// Each mission names its goal, its targets in the world and how it is scored,
// so the world can step through them without knowing what a ring looks like.
import { RUNWAY } from './config.js';

export const MISSION_RINGS = 'rings';
export const MISSION_RIVER = 'river';
export const MISSION_LANDING = 'landing';

/** A glowing ring to fly through: centre (x, altitude in feet, z) and radius. */
export function buildRingCourse() {
  return [
    { x: -40, altFt: 420, z: 240, r: 26, label: 'RING 1' },
    { x: -260, altFt: 520, z: -120, r: 26, label: 'RING 2' },
    { x: -60, altFt: 380, z: -520, r: 24, label: 'RING 3' },
    { x: 260, altFt: 480, z: -760, r: 26, label: 'RING 4' },
    { x: 420, altFt: 360, z: -420, r: 24, label: 'RING 5' },
  ];
}

/** Checkpoints along the river: fly within range of each, below the ceiling. */
export function buildRiverCheckpoints() {
  return [
    { x: 330, altFt: 700, z: -300, r: 70, label: 'DROP 1' },
    { x: 210, altFt: 700, z: -900, r: 70, label: 'DROP 2' },
    { x: 420, altFt: 700, z: -1500, r: 70, label: 'DROP 3' },
  ];
}

/** Where the sortie starts: on the runway threshold, lined up for take-off. */
export function startPose() {
  return {
    x: RUNWAY.x,
    z: RUNWAY.zMax - 40,
    altFt: 0,
    heading: 0, // 0 = due north, towards the far end of the runway
    speedKt: 0,
    throttle: 0,
    pitchDeg: 0,
    bankDeg: 0,
  };
}

export function missionTitle(kind) {
  if (kind === MISSION_RINGS) return 'SORTIE 1 — RING RUN';
  if (kind === MISSION_RIVER) return 'SORTIE 2 — RIVER COURIER';
  return 'SORTIE 3 — HOME RUNWAY';
}

export function missionBrief(kind) {
  if (kind === MISSION_RINGS) return 'Fly through all 5 rings in order. Mind your speed in the turns.';
  if (kind === MISSION_RIVER) return 'Follow the river south and pass each drop point below 700 ft.';
  return 'Come home: land on the runway, slow and level. Fuel is precious now.';
}
