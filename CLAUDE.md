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
web/js/data/towers.js  TOWER_TYPES (cell/durian/temple/camp + mata/wok/
                       power/ice), 3 levels each; TOWER_SPRITE name map
web/js/data/heroes.js  HERO_TYPES (10 local-legend heroes), heroSlots(li)
                       (1 hero acts 1-2, 2 heroes acts 3-4), HERO_RESPAWN
web/js/data/geo.js     ★ AUTO-GENERATED — do not hand-edit (see Maps below)
web/js/data/levels.js  LAYOUTS (view over GEO), LEVELS (30), ACTS, MODES,
                       ironTowers(), genWaves(li, mode) + heroic/iron variants
web/js/render.js       Renderer: buildBackground() bakes static map to offscreen
                       canvas; draw() per frame; MRT train animation
                       (initTrains/updateTrains/drawTrains)
web/js/game.js         Game (state machine, combat, waves) + Progress (localStorage)
web/js/ui.js           UI: screens, level select w/ mode picker, popups, HUD;
                       injects pixel-art button icons (Sprites 'ui_*')
web/js/menubg.js       MenuBG: animated pixel Singapore skyline behind the
                       light-themed menu/armory/help screens (own rAF, only
                       animates when a non-game screen is active)
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
  (`IRON_COMBOS_LATE`) must always include a PHYSICAL anti-air tower
  (`cell` or `mata`). sim.js asserts anti-air for every combo.
- Total 5★/level = 150. `Progress` keys: `stars{}`, `heroic{}`, `iron{}`,
  `merits`, `heroes{}`, `towersU{}`, `loadout[]` in localStorage
  `merlion-defense-v1`. `Progress.normalize()` migrates old saves.
- `Game.allowedTowers` (null = armory-gated) gates builds + build menu;
  in iron mode it overrides the armory unlocks entirely.

## Heroes / merits / armory

- Heroes spawn near the exit of path 0 (`Game.spawnHeroes`), controlled by
  tap-hero-then-tap-ground (`UI.onCanvasTap` → `Game.orderHero`). Melee
  heroes block like soldiers (share `e.blockedBy`); ranged fire 'hero'
  projectiles. Specials: aoe/crit/stun/splash/pierce/slow/evade/heal/block.
- Merit economy: first campaign clear +20, +10 per newly earned star,
  +25 per challenge clear (`Progress.complete/completeChallenge` return the
  amount). Armory (`UI.renderArmory`, `#screen-armory`) sells durian/temple
  towers (`TOWER_MERIT_COST`) and heroes (`HERO_TYPES[k].cost`); cell/camp
  and Sang Nila Utama are free. Loadout max 2 heroes.
- Save backup: `Progress.exportJSON()/importJSON()` wired to EXPORT/LOAD
  SAVE buttons on the main menu (JSON file download / file picker).
- Dev param: `?showarmory=1&merits=200` opens the Armory with merits.
- Hero specials roll `Math.random`; sim.js pins `Math.random = makeRng(...)`
  for reproducible balance runs, and unlocks all towers/heroes for the AI
  (loadout: utama early, badang+boseng from L16).
- Sprites are auto-refined at load: `Sprites.def` bakes ASCII art through
  pad → EPX×2 → EPX×2 → rim-shade (canvas `_f = 4`); `draw()` divides by
  `_f`, so `scale` is still in original art pixels.

## Balance knobs

All wave gen is deterministic via `makeRng(seed)` — same level+mode always
produces identical waves. In `levels.js`:
- Campaign: `budget = (54 + li*6.0) * (1 + progress*1.7) * scale`,
  boss hpMul ×0.72
- Heroic:   `(40 + li*2.8) * (0.9 + progress*1.1) * scale`, boss hpMul ×0.55
- Iron:     `(30 + li*1.9) * (0.85 + progress*0.9) * scale`, group delay
  10–16s apart, boss hpMul ×0.38 (restricted towers can't burst a boss)
- `scale = DIFF_SCALE[diff] / (1 + (nPaths-1)*K)` — multi-entrance discount;
  K=0.26 campaign, **0.45 for 1-life modes** (split defense hurts much more).
- Build pads are capped at `MAX_PADS = 12` (`trimSpots` in levels.js evenly
  samples the baked geo spots, which are stored in path order).
- Challenge starting gold bonus: iron +220, heroic +120 (in `Game.start`).
These numbers were tuned against sim.js — if you touch them, re-run
`--all-modes` and re-tune until green.

## Gotchas

- `layout index == level index` (30 levels, 30 GEO entries). Adding a level
  means adding a SPEC + refetch + a LEVELS row.
- Every LEVELS row has a `tod` (morning/day/evening/night). `TIMES_OF_DAY`
  in render.js bakes a tint (+street lamps at dusk/night) into the
  background and adds a live overlay each frame.
- The defended objective at path exits is the Temporary Operations Command
  (`Renderer.opsCommand`, sprite `command_post`) — replaced the old MRT
  station, which looked wrong in parks/dams.
- `enemyPool(li)` unlocks enemy types progressively; unitCost formula
  `bounty*1.6 + hp/22` controls pack sizes.
- sim.js stubs `Renderer.buildBackground` AND `Renderer.initTrains` — if you
  add more canvas-touching calls to `Game.start`, stub them there too.
- Popups (`build-menu`, `tower-menu`) are positioned in scaled screen px via
  `UI.placePopup`; canvas coords must go through `UI.canvasPos`.
- `pi-session-*.html` in repo root is a session log artifact, not app code.
- Sprites: `Sprites.def(name, palette, rows)` ASCII art; enemy render falls
  back to 'toyol' if a sprite name is missing.
