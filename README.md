# 🦁 Merlion Defense

A Kingdom Rush–inspired tower defense game set in **Singapore**, where you defend
real neighbourhoods — Ang Mo Kio Central, Changi Village, Tiong Bahru, Merlion Park
and more — against mysterious creatures from South East Asian, South Asian and
East Asian folklore.

Pure HTML5 Canvas + vanilla JS. No build step, no backend.

**Real maps:** every level is drawn from actual OpenStreetMap geometry — the
real road network, HDB block footprints, shopping malls, MRT viaducts, rivers,
reservoirs and coastline of each neighbourhood, with enemy paths routed along
the real streets. MRT trains animate along the real rail viaducts.
(Map data © OpenStreetMap contributors, ODbL.)

## Run with Docker Compose

```bash
docker compose up -d --build
```

Then open **http://localhost:8080**

To stop:

```bash
docker compose down
```

## Run without Docker (dev)

Any static file server works:

```bash
cd web && python3 -m http.server 8080
```

## Game overview

### 30 Levels
Real Singapore neighbourhoods, grouped geographically — each difficulty tier is
an “act” covering one region of the island as the invasion sweeps south:

| Act / Tier | Levels | Region | Examples |
|---|---|---|---|
| Act 1 · Easy | 1–6 | Northern heartlands | Ang Mo Kio, Yishun Dam, Woodlands Causeway |
| Act 2 · Normal | 7–15 | The East | Punggol Waterway (Naga boss), Changi Village, Little India |
| Act 3 · Hard | 16–25 | Central & West | MacRitchie, Haw Par Villa (Rangda boss), Boat Quay |
| Act 4 · Heroic | 26–30 | City & the South | Orchard Road, Sentosa, Merlion Park (Ox-Head Warden boss) |

Levels unlock sequentially; earn up to ★★★ per level based on lives kept.
Progress is saved in your browser (localStorage).

### 🏆 Game modes (Kingdom Rush style)
Each level has three modes. **Campaign** is the story mode. Beat it with a
★★★ rating to unlock two extra challenges, each worth one bonus star
(5★ max per level, 150 total):

- **⚔ Campaign** — the standard waves; keep lives for up to ★★★
- **🔥 Heroic Challenge** — 6 elite waves drawn from the level's toughest
  creatures. **One life.**
- **🛡 Iron Challenge** — one long unbroken siege. **One life**, and only a
  fixed subset of towers may be built (shown before you start).

### 🗺 Regenerating the maps
The baked geometry lives in `web/js/data/geo.js`. To re-fetch from
OpenStreetMap (e.g. after tweaking a level spec):

```bash
node tools/fetch-geo.js            # all 30 levels (Overpass API, cached)
node tools/fetch-geo.js --level 4  # one level
node tools/fetch-geo.js --preview  # also writes SVG previews to tools/preview/
```

Raw Overpass responses are cached in `tools/cache/`.

### 🗼 Towers (urban Singapore)
- **📡 Cell-Base Tower** — rapid 5G zaps, hits ground & air (physical)
- **🍈 Durian Launcher** — splash damage from the king of fruits (ground only)
- **⛩ Talisman Temple** — armour-piercing magic talismans that also slow
- **🎖 NS Camp** — deploys NSmen who block enemies on the road (movable rally point)

Each tower has 3 upgrade levels; sell refunds 60%.

### 👹 Enemies (Asian folklore)
Toyol, Pocong, Pontianak, Manananggal, Jiangshi, Krasue, Orang Minyak,
Hantu Raya, Garuda hatchlings, Rakshasa, Oni… plus bosses: **Naga**,
**Rangda**, and the **Ox-Head Warden**. Armoured enemies resist physical
damage, spectral ones resist magic, and flying ones ignore roads and soldiers.

### Controls
- Click a concrete pad → build; click a tower → upgrade / sell / rally
- **Space** — call next wave (early call = bonus gold)
- **F** — cycle speed 1×/2×/3×, **P / Esc** — pause

## Project structure

```
├── docker-compose.yml
├── Dockerfile            # nginx:alpine static server
├── nginx.conf
└── web/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── util.js       # math, paths, RNG
        ├── audio.js      # WebAudio SFX (no asset files)
        ├── data/
        │   ├── enemies.js  # folklore bestiary
        │   ├── towers.js   # tower stats
        │   └── levels.js   # 30 levels, 10 map layouts, wave generator
        ├── render.js     # canvas renderer + procedural scenery
        ├── game.js       # simulation (waves, combat, economy)
        ├── ui.js         # menus, HUD, popups
        └── main.js       # game loop
```
