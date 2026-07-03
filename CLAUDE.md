# Merlion Defense — agent notes

Kingdom Rush–inspired tower defense set in real Singapore neighbourhoods.
Pure HTML5 Canvas + vanilla JS. **No build step, no framework, no npm deps.**
Plain `<script>` tags in `web/index.html` define load order; everything is
global (`'use strict'` per file, no modules).

## Run / test

```bash
cd web && python3 -m http.server 8080     # dev server (or: docker compose up)
node test/sim.js                          # balance sim, campaign mode (~1 min)
node test/sim.js --all-modes              # + heroic & iron (~5 min) — run before shipping balance changes
```

`test/sim.js` loads the game headless in a `vm` context with stubbed
DOM/Audio. It validates wave data for all 3 modes, checks every layout has
≥10 build pads, then plays every level with a baseline AI. **Contract:**
campaign must be WON outright; heroic/iron must finish with ≤6 leaks
(`LEAK_TOLERANCE`) since they're 1-life modes and real players retry.
If a change makes a run fail, tune wave budgets (see Balance below).

Dev URL params (handled at bottom of `web/js/main.js`):
- `?autostart=LEVEL,MODE` — jump straight into a level (0-based; mode = campaign|heroic|iron), muted
- `?dev3stars=N` — grant ★★★ up to level N (unlocks challenges)
- `?showmodes=N` — open the mode picker for level N

Headless screenshot for visual checks:
```bash
google-chrome --headless=new --no-sandbox --window-size=1100,720 --hide-scrollbars \
  --screenshot=/tmp/shot.png --virtual-time-budget=9000 \
  "http://localhost:8080/?autostart=0,campaign"
```

## Architecture (script load order matters)

```
web/js/util.js         clamp/lerp/dist, makeRng (mulberry32, deterministic),
                       buildPath/pointAt/distToPath (waypoint path math)
web/js/sprites.js      pixel-art sprites from ASCII grids (Sprites.def/draw)
web/js/audio.js        WebAudio SFX (Sound.*)
web/js/data/enemies.js ENEMY_TYPES (folklore creatures; armor=physical resist,
                       resist=magic resist, flying, boss, lives cost)
web/js/data/towers.js  TOWER_TYPES (cell/durian/temple/camp), 3 levels each
web/js/data/geo.js     ★ AUTO-GENERATED — do not hand-edit (see Maps below)
web/js/data/levels.js  LAYOUTS (view over GEO), LEVELS (30), ACTS, MODES,
                       ironTowers(), genWaves(li, mode) + heroic/iron variants
web/js/render.js       Renderer: buildBackground() bakes static map to offscreen
                       canvas; draw() per frame; MRT train animation
                       (initTrains/updateTrains/drawTrains)
web/js/game.js         Game (state machine, combat, waves) + Progress (localStorage)
web/js/ui.js           UI: screens, level select w/ mode picker, popups, HUD
web/js/main.js         rAF loop + dev URL params
```

Canvas is fixed 960×600 logical px. `Game.speed` (1/2/3×) = number of
`update(dt)` substeps per frame.

## Maps are real geography (the big invariant)

Every level's map is **real OpenStreetMap data** for the actual Singapore
neighbourhood: road network, building footprints (HDBs, malls), rail viaducts,
rivers/reservoirs, coastline-derived sea, parks. Enemy paths are routed along
real streets. MRT trains animate on real viaducts.

- `tools/fetch-geo.js` — build-time baker. Per-level `SPECS[]` at the top:
  centre lat/lon, bbox height `h` (degrees; width = h×1.6), path
  `from/via/to` endpoints (real coords), landmark anchors (`match` regex
  snaps to a named OSM building), `seaSeed` (enables coastline sea fill),
  `allowMinor`/`footpaths` (let routing use service roads / park paths).
- It queries Overpass (2 mirrors, 429s happen — just rerun; responses cached
  in `tools/cache/L<i>.json`, ~19MB, so re-runs are offline), routes paths
  via Dijkstra over the road graph (largest connected component only),
  simplifies geometry, **generates build pads** (`generateSpots`: seated near
  the enemy path, clear of roads/buildings/water/rail, with progressive
  relaxation for dense districts), and writes `web/js/data/geo.js`.
- Regenerate: `node tools/fetch-geo.js [--level N] [--preview]`.
  `--preview` writes SVGs to `tools/preview/` — ALWAYS eyeball these
  (convert to png) after changing SPECS: check path length (≥ ~450px),
  path plausibility, sea on the correct side, pad count ≥10.
- GEO entry shape: `{ paths, roads:{c,p,b}, rail, water, sea:[x,y,w,h] rects,
  parks, buildings:{p,n,h,lm}, landmarks, spots }`. Road class `c`: 0=motorway
  … 4=service; widths in `render.js` `ROAD_W`.
- OSM coastline convention: land is LEFT of way direction → sea is where
  cross-product > 0 in canvas coords (y-down). Implemented in `rasterSea`.
- Attribution: © OpenStreetMap contributors, ODbL — keep the header comment
  in geo.js and the README note.

## Game modes (Kingdom Rush style)

- **campaign** — story mode, ★–★★★ by lives ratio (≥0.9→3, ≥0.55→2).
- **heroic** — unlocked by ★★★ campaign; 6 elite waves (`genHeroicWaves`,
  pool previews li+3 enemies), 1 life, +1 bonus star.
- **iron** — unlocked by ★★★ campaign; ONE mega-wave (`genIronWaves`),
  1 life, restricted tower set (`ironTowers(li)`, deterministic), +1 star.
  **Invariant:** levels ≥9 face flying magic-resistant krasue, so late combos
  (`IRON_COMBOS_LATE`) must always include `cell`. sim.js asserts anti-air.
- Total 5★/level = 150. `Progress` keys: `stars{}`, `heroic{}`, `iron{}` in
  localStorage `merlion-defense-v1`.
- `Game.allowedTowers` (null = all) gates builds + build menu.

## Balance knobs

All wave gen is deterministic via `makeRng(seed)` — same level+mode always
produces identical waves. In `levels.js`:
- Campaign: `budget = (50 + li*5.5) * (1 + progress*1.7) * scale`
- Heroic:   `(38 + li*2.6) * (0.9 + progress*1.1) * scale`, boss hpMul ×0.55
- Iron:     `(28 + li*1.8) * (0.85 + progress*0.9) * scale`, group delay
  10–16s apart, boss hpMul ×0.55
- `scale = DIFF_SCALE[diff] / (1 + (nPaths-1)*K)` — multi-entrance discount;
  K=0.18 campaign, **0.45 for 1-life modes** (split defense hurts much more).
- Challenge starting gold bonus: iron +220, heroic +120 (in `Game.start`).
These numbers were tuned against sim.js — if you touch them, re-run
`--all-modes` and re-tune until green.

## Gotchas

- `layout index == level index` (30 levels, 30 GEO entries). Adding a level
  means adding a SPEC + refetch + a LEVELS row.
- `enemyPool(li)` unlocks enemy types progressively; unitCost formula
  `bounty*1.6 + hp/22` controls pack sizes.
- sim.js stubs `Renderer.buildBackground` AND `Renderer.initTrains` — if you
  add more canvas-touching calls to `Game.start`, stub them there too.
- Popups (`build-menu`, `tower-menu`) are positioned in scaled screen px via
  `UI.placePopup`; canvas coords must go through `UI.canvasPos`.
- `pi-session-*.html` in repo root is a session log artifact, not app code.
- Sprites: `Sprites.def(name, palette, rows)` ASCII art; enemy render falls
  back to 'toyol' if a sprite name is missing.
