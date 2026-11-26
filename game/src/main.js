// Cakrawala Courier — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between five screens: title, play, paused, over and win.
//
// ?shot=1..4 (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CHECKPOINT, EVENT_CRASH, EVENT_DAMAGE, EVENT_FUEL_EMPTY, EVENT_LANDED, EVENT_RING, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');

// The canvas must hold real device pixels: the renderer and the HUD both lay
// out from canvas.width/height, and CSS alone would only stretch a 300x150 box.
function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (shot) {
    // Screenshots must fill the whole 1280x800 frame, not the window chrome.
    canvas.width = 1280;
    canvas.height = 800;
    canvas.style.width = '1280px';
    canvas.style.height = '800px';
  }
}
fitCanvas();
window.addEventListener('resize', fitCanvas);
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit only.
  }
}

// Any page error is written onto the document so a headless check can see it.
window.addEventListener('error', (event) => {
  document.body.dataset.error = String(event.message || event.error || 'error');
});

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Flying. Ring run first: five rings, then the river, then home.');
  }

  function endGame(win) {
    screen = win ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(win ? `All sorties complete. Score ${world.state.score}.` : `Crashed. Score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title flies a gentle demo circuit behind the panel.
      const target = { x: -200, altFt: 420, z: -200 };
      const dx = target.x - world.state.x;
      const dz = target.z - world.state.z;
      const want = Math.atan2(dx, -dz);
      let diff = want - world.state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      world.step(STEP, {
        pitch: Math.max(-1, Math.min(1, (420 - world.state.altFt) / 220)),
        bank: Math.max(-1, Math.min(1, diff * 2)),
        throttleUp: world.state.speedKt < 110,
        throttleDown: world.state.speedKt > 120,
        brake: false,
      });
      return;
    }
    const events = world.step(STEP, input.readFlight());
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_CHECKPOINT) audio.checkpoint();
    if (events & EVENT_DAMAGE) audio.thud();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_FUEL_EMPTY) announce('Fuel empty. Glide her home.');
    if (events & EVENT_LANDED) audio.thud();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_CRASH) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let guard = 0;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY) && guard < 20) {
        step();
        accumulator -= STEP;
        guard += 1;
      }
      if (guard >= 20) accumulator = 0;
    } else {
      accumulator = 0;
    }
    if (screen === SCREEN_PLAY) audio.update(world.state.throttle, world.state.speedKt, world.state.engineOn);
    renderer.draw(world.state, world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Cakrawala Courier. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
