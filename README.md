# 🦁 Merlion Defense

A Kingdom Rush–inspired tower defense game set in **Singapore**, where you defend
real neighbourhoods — Ang Mo Kio Central, Changi Village, Tiong Bahru, Merlion Park
and more — against mysterious creatures from South East Asian, South Asian and
East Asian folklore.

Pure HTML5 Canvas + vanilla JS. No build step, no external assets, no backend.

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
Real Singapore neighbourhoods across 4 difficulty tiers:

| Tier | Levels | Examples |
|---|---|---|
| Easy | 1–6 | Ang Mo Kio Central, Changi Village, Tiong Bahru |
| Normal | 7–15 | Kampong Glam, Boat Quay (Naga boss), Little India |
| Hard | 16–25 | Haw Par Villa (Rangda boss), Marina Barrage |
| Heroic | 26–30 | Orchard Road, Sentosa, Merlion Park (Ox-Head Warden boss) |

Levels unlock sequentially; earn up to ★★★ per level based on lives kept.
Progress is saved in your browser (localStorage).

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
