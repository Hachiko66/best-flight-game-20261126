// Cakrawala Courier — input: keyboard for flying, mouse for menus and for
// steering by dragging. Actions are consumed once per frame by the loop.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let pointerDown = false;
  let pointerX = 0;
  let pointerBank = 0;

  function codeOf(event) {
    return event.code;
  }

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    pointerDown = true;
    pointerX = event.clientX;
    actions |= ACTION_CONFIRM;
  }

  function onPointerMove(event) {
    if (!pointerDown) return;
    const dx = event.clientX - pointerX;
    pointerBank = Math.max(-1, Math.min(1, dx / 160));
  }

  function onPointerUp() {
    pointerDown = false;
    pointerBank = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    /** Bitmask of one-shot actions since the last call; clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Continuous flight controls for this frame, each -1..1 or boolean. */
    readFlight() {
      let pitch = 0;
      if (keys.has('ArrowUp')) pitch += 1;
      if (keys.has('ArrowDown')) pitch -= 1;
      let bank = 0;
      if (keys.has('ArrowLeft')) bank -= 1;
      if (keys.has('ArrowRight')) bank += 1;
      if (pointerDown && pointerBank !== 0) bank = pointerBank;
      return {
        pitch,
        bank: Math.max(-1, Math.min(1, bank)),
        throttleUp: keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight'),
        throttleDown: keys.has('KeyS') || keys.has('ControlLeft') || keys.has('ControlRight'),
        brake: keys.has('Space'),
      };
    },
  };
}
