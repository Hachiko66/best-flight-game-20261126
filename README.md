[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Hachiko66/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Hachiko66/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Cakrawala Courier ✈️

A little prop-plane flight game, built for make.fun's
["Make the best flight game"](https://make.fun/bounty/best-flight-game-20261126-0057)
bounty ($500 in USDC).

You are a courier pilot over a green valley. One flight, three sorties: thread
five glowing rings over the fields, follow the river south to drop three
parcels, then bring her home and land on the runway — slow, level and whole.
Fuel burns with the throttle, the airframe remembers hard landings, and the
runway is only ever where you left it.

Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## The flight

- **Sortie 1 — Ring Run.** Five rings in order, 150 points each. Bank early,
  mind your speed in the turns.
- **Sortie 2 — River Courier.** Three drop points along the river, below
  700 ft, 200 points each.
- **Sortie 3 — Home Runway.** Land on the runway: under 95 kt, gentle sink,
  wings level. Landing pays 500 plus time and fuel bonuses.

Crash, run dry over the fields, or break the airframe and the sortie ends.

## How to play

- **↑ / ↓** — pitch. **← / →** — bank and turn. **W / S** (or Shift / Ctrl)
  — throttle up / down. **Space** — brake.
- **Mouse** — click to start, drag to steer. **P** — pause. **M** — mute.
  **R** — fly again after a crash or a landing.
- **HUD** — altitude, speed and heading on top, a compass strip, an
  artificial horizon, fuel and damage gauges, throttle, and an arrow that
  always points at your next target with its distance.

## How it is built

A pseudo-3D mode-7 chase view on a 2D canvas: the terrain (fields, wheat,
river, roads, a little city, the runway) is drawn procedurally from a seeded
world, with a hand-drawn prop plane, sun, drifting clouds and haze. No
libraries, no network requests, no build step — static files under `game/`
only. Sound is synthesised with WebAudio (engine hum, ring chime, thud,
crash).

- `game/src/world.js` — procedural terrain, the flight model, missions, fuel and damage
- `game/src/render.js` — mode-7 renderer, aircraft, rings, sky and screens
- `game/src/hud.js` — altitude / speed / heading, compass, attitude, gauges
- `game/src/missions.js` — the three sorties: rings, river drops, landing
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised engine, chimes and crash
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=1..4`)
- `game/src/config.js` — every tuning number in one place
- `game/src/random.js` — the seeded generator behind the terrain

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are deterministic: `?shot=1` is the cover (chase view, ring
ahead), `?shot=2` threads a ring, `?shot=3` is the final approach,
`?shot=4` is the title screen.
