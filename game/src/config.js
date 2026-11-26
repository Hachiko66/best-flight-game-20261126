// Cakrawala Courier — shared tuning constants for the whole game.
// One place for every number a designer would want to tune: speeds, fuel,
// damage, the camera and the size of the world the plane flies over.
export const STEP = 1 / 60;
export const BEST_KEY = 'cakrawala-courier-best';

// Flight model (speeds in knots, altitudes in feet, distances in metres).
export const SPEED_MIN_KT = 45;
export const SPEED_MAX_KT = 185;
export const KT_TO_MS = 0.514444;
export const PITCH_MAX_DEG = 22;
export const PITCH_MIN_DEG = -14;
export const BANK_MAX_DEG = 50;
export const TURN_RATE = 0.72; // heading radians per second at full bank
export const CLIMB_FACTOR = 0.9;
export const THROTTLE_RATE = 0.6; // per second while the key is held
export const FUEL_BURN_BASE = 0.06; // % per second at idle
export const FUEL_BURN_FULL = 0.30; // extra % per second at full throttle
export const FUEL_START = 100;
export const DAMAGE_HARD_LANDING = 45;
export const DAMAGE_GROUND_STRIKE = 100;
export const LANDING_MAX_VS_MS = -7; // vertical speed m/s: gentler is a landing
export const LANDING_MAX_SPEED_KT = 95;
export const LANDING_MAX_BANK_DEG = 18;

// World layout (metres, x east, z south; the runway runs north-south).
export const RUNWAY = { x: 0, halfWidth: 24, zMin: -320, zMax: 520 };
export const RIVER_HALF_WIDTH = 26;
export const ROAD_HALF_WIDTH = 7;
export const CITY = { xMin: 620, xMax: 1120, zMin: -820, zMax: -220 };
export const WORLD_LIMIT = 2600; // flying past this turns the plane back

// Scoring.
export const SCORE_RING = 150;
export const SCORE_CHECKPOINT = 200;
export const SCORE_LANDING = 500;
export const SCORE_TIME_BONUS_PER_SEC = 4;
export const SCORE_FUEL_BONUS_PER_PCT = 3;

// Renderer (low-res offscreen canvas, scaled up for a soft retro look).
export const VIEW_W = 320;
export const VIEW_H = 200;
export const FOCAL = 150; // mode-7 projection focal length, low-res pixels
export const SKY_TOP = '#2f6fb4';
export const SKY_HORIZON = '#bfe0f2';

// Screenshot staging.
export const SHOT_NAMES = ['1', '2', '3', '4'];
