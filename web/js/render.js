/* ===== Canvas renderer: real Singapore geometry, pixel-art styling ===== */
'use strict';

const THEMES = {
  town:   { grass: '#6aa03c', grass2: '#5c8f33', deco: 'hdb' },
  park:   { grass: '#79b04a', grass2: '#69a03e', deco: 'trees' },
  forest: { grass: '#4c7a2c', grass2: '#3d6822', deco: 'jungle' },
  coast:  { grass: '#8cb455', grass2: '#7ca648', deco: 'coast' },
  river:  { grass: '#6aa03c', grass2: '#5c8f33', deco: 'shophouse' },
};

/* Time-of-day ambience — baked tint on the background + live overlay,
   with warm street lamps along the enemy route at dusk / night. */
const TIMES_OF_DAY = {
  morning: { icon: '🌅', name: 'Morning', bake: 'rgba(255,196,120,.13)', live: 'rgba(255,170,90,.05)' },
  day:     { icon: '☀️', name: 'Day',     bake: null,                    live: null },
  evening: { icon: '🌇', name: 'Evening', bake: 'rgba(255,116,56,.17)',  live: 'rgba(110,50,130,.10)', lamps: 'rgba(255,200,110,.28)' },
  night:   { icon: '🌙', name: 'Night',   bake: 'rgba(18,28,78,.34)',    live: 'rgba(10,18,56,.16)',   lamps: 'rgba(255,200,110,.38)' },
};

/* road stroke widths by OSM class (0 motorway/trunk … 4 service) */
const ROAD_W     = [30, 26, 20, 14, 7];
const ROAD_EDGE  = '#63686f';
const ROAD_FILL  = '#8a8f98';
const MINOR_FILL = '#9aa0a8';

const Renderer = {
  bg: null,          // cached background canvas
  tod: null,         // active time-of-day config
  railPaths: [],     // built rail polylines for the train animation
  trains: [],        // animated trains { path, d, speed, dir }

  /** Pre-render static background for a level. */
  buildBackground(level, layout, paths) {
    const theme = THEMES[level.theme] || THEMES.town;
    const geo = layout.geo;
    const c = document.createElement('canvas');
    c.width = 960; c.height = 600;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rng = makeRng(4242 + LEVELS.indexOf(level) * 101);

    // ---- grass base + chunky pixel patches ----
    g.fillStyle = theme.grass;
    g.fillRect(0, 0, 960, 600);
    // fine two-layer dither: broad tone patches + small speckle
    for (let i = 0; i < 420; i++) {
      g.fillStyle = rng() < 0.6 ? theme.grass2 : 'rgba(255,255,255,0.05)';
      const x = Math.floor(rng() * 240) * 4, y = Math.floor(rng() * 150) * 4;
      const w = (2 + Math.floor(rng() * 4)) * 4;
      g.fillRect(x, y, w, 4);
    }
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
      g.fillRect(Math.floor(rng() * 480) * 2, Math.floor(rng() * 300) * 2, 2, 2);
    }

    // ---- real parks / forests (slightly darker green) ----
    for (const p of geo.parks) {
      g.fillStyle = 'rgba(38,84,18,.30)';
      this.fillPoly(g, p);
    }

    // ---- beaches (real sand polygons) ----
    for (const p of (geo.sand || [])) {
      g.fillStyle = '#e6d49c';
      this.fillPoly(g, p);
      g.save();
      g.beginPath(); this.tracePoly(g, p); g.clip();
      const bb = this.polyBounds(p);
      g.fillStyle = 'rgba(184,158,102,.5)';
      for (let i = 0; i < (bb.w * bb.h) / 900; i++)
        g.fillRect(bb.x + Math.floor(rng() * bb.w / 3) * 3, bb.y + Math.floor(rng() * bb.h / 3) * 3, 2, 2);
      g.restore();
    }

    // ---- open-air carparks (real lots: asphalt + stall stripes + cars) ----
    for (const p of (geo.lots || [])) this.carpark(g, p, rng);

    // ---- the sea (from real coastline) ----
    if (geo.sea && geo.sea.length) {
      g.fillStyle = '#2e7bb4';
      for (const [x, y, w, h] of geo.sea) g.fillRect(x, y, w, h);
      // pixel wave flecks
      g.fillStyle = 'rgba(255,255,255,.30)';
      for (const [x, y, w, h] of geo.sea) {
        for (let i = 0; i < (w * h) / 5200; i++) {
          g.fillRect(x + Math.floor(rng() * (w / 8)) * 8, y + Math.floor(rng() * (h / 8)) * 8, 12, 3);
        }
      }
    }

    // ---- real rivers / lakes / reservoirs ----
    for (const w of geo.water) {
      g.fillStyle = '#2e7bb4';
      this.fillPoly(g, w);
      g.strokeStyle = '#3f97d4'; g.lineWidth = 2;
      this.strokePoly(g, w);
    }

    // ---- real roads, small to large so big roads sit on top ----
    const byClass = [[], [], [], [], []];
    for (const r of geo.roads) byClass[r.c].push(r);
    for (let cls = 4; cls >= 0; cls--) {
      for (const r of byClass[cls]) {
        this.strokePath(g, r.p, ROAD_W[cls] + 4, ROAD_EDGE);
      }
      for (const r of byClass[cls]) {
        this.strokePath(g, r.p, ROAD_W[cls], cls >= 3 ? MINOR_FILL : ROAD_FILL);
      }
      // lane dashes on major roads
      if (cls <= 2) {
        g.save();
        g.setLineDash([10, 12]);
        for (const r of byClass[cls]) this.strokePath(g, r.p, 2, 'rgba(255,255,255,.35)');
        g.restore();
      }
    }

    // ---- the ENEMY ROUTE: highlighted so it reads as "the path" ----
    for (const path of paths) {
      this.strokePath(g, path.points, 40, '#6d5a38');
      this.strokePath(g, path.points, 34, '#9d8663');
      this.strokePath(g, path.points, 30, '#b09878');
      // fine dirt texture: pebbles + ruts along the trail
      const bp = buildPath(path.points);
      for (let d = 6; d < bp.total; d += 7) {
        const p = pointAt(bp, d);
        const off = (rng() - 0.5) * 22;
        g.fillStyle = rng() < 0.5 ? 'rgba(255,244,214,.20)' : 'rgba(60,44,20,.18)';
        g.fillRect(Math.round(p.x - p.dy * off) - 1, Math.round(p.y + p.dx * off) - 1, 2 + (rng() < 0.3 ? 1 : 0), 2);
      }
      g.save();
      g.setLineDash([12, 10]);
      this.strokePath(g, path.points, 3, 'rgba(255,244,200,.75)');
      g.restore();
    }

    // ---- sports pitches / courts (real, with markings) ----
    for (const p of (geo.pitches || [])) this.pitch(g, p, rng);

    // ---- swimming pools (condo blues) ----
    for (const p of (geo.pools || [])) {
      g.fillStyle = '#3ec6e8';
      this.fillPoly(g, p);
      g.strokeStyle = '#e8f6fa'; g.lineWidth = 1.5;
      this.strokePoly(g, p);
      const bb = this.polyBounds(p);
      g.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < Math.max(1, (bb.w * bb.h) / 420); i++)
        g.fillRect(bb.x + 2 + rng() * (bb.w - 5), bb.y + 2 + rng() * (bb.h - 4), 4, 1.5);
    }

    // ---- real building footprints: satellite-inspired pixel rooftops ----
    for (const b of geo.buildings) this.rooftop(g, b, rng);

    // ---- HDB playgrounds (real locations — the beloved void-deck kind) ----
    for (const [px, py] of (geo.plays || [])) this.playground(g, px, py, rng);

    // ---- rail viaduct (MRT) ----
    for (const line of geo.rail) {
      this.strokePath(g, line, 14, '#4a5058');       // viaduct deck shadow
      this.strokePath(g, line, 10, '#7c848c');       // deck
      g.save();
      g.setLineDash([4, 10]);
      this.strokePath(g, line, 10, '#5a6068');       // sleepers
      g.restore();
      this.strokePath(g, line, 2, '#3c4248');        // rails
      // support piers
      const bp = buildPath(line);
      for (let d = 26; d < bp.total; d += 64) {
        const p = pointAt(bp, d);
        g.fillStyle = '#5a6068';
        g.fillRect(p.x - 3, p.y - 3, 6, 6);
      }
    }

    // ---- entrance / defended objective markers ----
    for (const path of paths) {
      const p0 = path.points[0], pn = path.points[path.points.length - 1];
      this.portal(g, p0[0], p0[1]);
      this.opsCommand(g, pn[0], pn[1]);
    }

    // ---- build pads (high contrast so they read against real buildings) ----
    for (const [x, y] of layout.spots) {
      // soft ground shadow
      g.fillStyle = 'rgba(0,0,0,.28)';
      g.beginPath(); g.ellipse(x + 2, y + 14, 24, 7, 0, 0, 7); g.fill();
      // bevelled concrete slab
      g.fillStyle = '#6d5527';                       // dark under-edge
      g.fillRect(x - 23, y - 16, 46, 32);
      g.fillStyle = '#a8894c';                       // side face
      g.fillRect(x - 23, y - 17, 46, 30);
      g.fillStyle = '#e0c37c';                       // top-lit rim
      g.fillRect(x - 21, y - 15, 42, 2);
      g.fillStyle = '#d2b264';                       // slab top
      g.fillRect(x - 21, y - 13, 42, 24);
      // fine concrete texture flecks
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.fillRect(x - 16, y - 9, 3, 2); g.fillRect(x + 6, y - 5, 4, 2);
      g.fillRect(x - 6, y + 5, 3, 2);  g.fillRect(x + 12, y + 3, 3, 2);
      g.fillStyle = 'rgba(0,0,0,.10)';
      g.fillRect(x - 10, y - 3, 4, 2); g.fillRect(x + 2, y + 7, 4, 2);
      g.fillRect(x + 14, y - 9, 3, 2);
      // hazard-stripe corner chevrons (fine 3px steps)
      g.fillStyle = '#4a3a16';
      for (const [cx, cy, dx, dy] of [[-21, -13, 1, 1], [21, -13, -1, 1], [-21, 11, 1, -1], [21, 11, -1, -1]]) {
        g.fillRect(x + cx + (dx < 0 ? -9 : 0), y + cy + (dy < 0 ? -3 : 0), 9, 3);
        g.fillRect(x + cx + (dx < 0 ? -3 : 0), y + cy + (dy < 0 ? -9 : 0), 3, 9);
      }
      g.fillStyle = '#e8b13a';
      for (const [cx, cy, dx, dy] of [[-21, -13, 1, 1], [21, -13, -1, 1], [-21, 11, 1, -1], [21, 11, -1, -1]]) {
        g.fillRect(x + cx + dx * 3 + (dx < 0 ? -3 : 0), y + cy + (dy < 0 ? -3 : 0), 3, 3);
        g.fillRect(x + cx + (dx < 0 ? -3 : 0), y + cy + dy * 3 + (dy < 0 ? -3 : 0), 3, 3);
      }
      // crane / build glyph (finer)
      g.fillStyle = '#8a6a28';
      g.fillRect(x - 7, y - 6, 14, 3);
      g.fillRect(x - 2, y - 3, 3, 9);
      g.fillRect(x - 4, y + 6, 8, 2);
      g.fillStyle = 'rgba(255,255,255,.25)';
      g.fillRect(x - 7, y - 6, 14, 1);
    }

    // ---- landmarks (real-place anchors) ----
    if (layout.landmarks) {
      for (const lm of layout.landmarks) this.landmark(g, lm, rng);
    }

    // ---- Singapore street furniture along the route ----
    this.streetFurniture(g, geo, layout, paths, rng);

    // ---- scenery decorations on open ground ----
    const decos = { hdb: 7, trees: 12, jungle: 16, coast: 8, shophouse: 6 }[theme.deco];
    let placed = 0, tries = 0;
    while (placed < decos && tries < 500) {
      tries++;
      const x = 40 + rng() * 880, y = 60 + rng() * 500;
      if (!this.openGround(geo, layout, paths, x, y)) continue;
      this.deco(g, theme.deco, x, y, rng);
      placed++;
    }

    // ---- time-of-day ambience (baked over the whole map) ----
    this.tod = TIMES_OF_DAY[level.tod || 'day'];
    if (this.tod.lamps) {
      // warm street lamps along the enemy route
      for (const path of paths) {
        const bp = buildPath(path.points);
        for (let d = 70; d < bp.total - 50; d += 150) {
          const p = pointAt(bp, d);
          const grd = g.createRadialGradient(p.x, p.y, 3, p.x, p.y, 52);
          grd.addColorStop(0, this.tod.lamps);
          grd.addColorStop(1, 'rgba(255,190,90,0)');
          g.fillStyle = grd;
          g.beginPath(); g.arc(p.x, p.y, 52, 0, 7); g.fill();
        }
      }
    }
    if (this.tod.bake) {
      g.fillStyle = this.tod.bake;
      g.fillRect(0, 0, 960, 600);
    }

    this.bg = c;
    this.initTrains(geo);
  },

  openGround(geo, layout, paths, x, y) {
    for (const path of paths) if (distToPath(path, x, y) < 46) return false;
    for (const [sx, sy] of layout.spots) if (dist(x, y, sx, sy) < 48) return false;
    for (const r of geo.roads) if (r.c <= 3 && distToLinePts(r.p, x, y) < ROAD_W[r.c] / 2 + 12) return false;
    for (const [wx, wy, ww, wh] of (geo.sea || []))
      if (x > wx - 16 && x < wx + ww + 16 && y > wy - 30 && y < wy + wh + 16) return false;
    for (const w of geo.water) if (pointInPolyR(w, x, y)) return false;
    for (const w of (geo.pools || [])) if (pointInPolyR(w, x, y)) return false;
    for (const pc of (geo.pitches || [])) if (pointInPolyR(pc.p, x, y)) return false;
    for (const lot of (geo.lots || [])) if (pointInPolyR(lot, x, y)) return false;
    for (const b of geo.buildings) if (pointInPolyR(b.p, x, y)) return false;
    for (const [px, py] of (geo.plays || [])) if (dist(x, y, px, py) < 30) return false;
    for (const lm of (layout.landmarks || [])) if (dist(x, y, lm.x, lm.y) < 60) return false;
    for (const line of geo.rail) if (distToLinePts(line, x, y) < 22) return false;
    return true;
  },

  /* ---------- MRT trains (animated on real viaducts) ---------- */

  initTrains(geo) {
    this.railPaths = geo.rail.map(line => buildPath(line));
    this.trains = [];
    for (const rp of this.railPaths) {
      if (rp.total < 200) continue;
      this.trains.push({ path: rp, d: Math.random() * rp.total, speed: 120, dir: 1, wait: 0 });
      if (rp.total > 700) {
        this.trains.push({ path: rp, d: Math.random() * rp.total, speed: 120, dir: -1, wait: 2.5 });
      }
    }
  },

  updateTrains(dt) {
    for (const t of this.trains) {
      if (t.wait > 0) { t.wait -= dt; continue; }
      t.d += t.speed * t.dir * dt;
      if (t.d > t.path.total + 90) { t.d = t.path.total + 90; t.dir = -1; t.wait = 1.5 + Math.random() * 3; }
      if (t.d < -90) { t.d = -90; t.dir = 1; t.wait = 1.5 + Math.random() * 3; }
    }
  },

  drawTrains(ctx) {
    const CAR = 26, CARS = 3;
    for (const t of this.trains) {
      for (let ci = 0; ci < CARS; ci++) {
        const dm = t.d - ci * (CAR + 3) * t.dir;
        if (dm < 6 || dm > t.path.total - 6) continue;
        const a = pointAt(t.path, Math.max(0, dm - CAR / 2));
        const b = pointAt(t.path, Math.min(t.path.total, dm + CAR / 2));
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        // body
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(-CAR / 2 + 2, -4 + 3, CAR, 9);
        ctx.fillStyle = '#e8ebee';
        ctx.fillRect(-CAR / 2, -5, CAR, 10);
        ctx.fillStyle = ci === 0 || ci === CARS - 1 ? '#c62828' : '#37474f'; // NSL red stripe
        ctx.fillRect(-CAR / 2, -5, CAR, 3);
        // windows
        ctx.fillStyle = '#4a6a88';
        for (let wx = -CAR / 2 + 3; wx < CAR / 2 - 3; wx += 6) ctx.fillRect(wx, -1, 4, 4);
        ctx.restore();
      }
    }
  },

  /* ---------- satellite-style pixel rooftops ----------
     Each footprint carries a roof-kind class (b.k) baked from its OSM
     building tag — the same signal you'd read off a satellite photo:
     0 generic flat · 1 tiled pitched · 2 HDB slab · 3 industrial ribbed ·
     4 commercial flat · 5 carpark deck · 6 worship · 7 school · 8 canopy */

  /* dominant edge angle of a footprint — aligns tiles / ribs / stalls */
  polyAngle(pts) {
    let bx = 1, by = 0, best = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      const l = dx * dx + dy * dy;
      if (l > best) { best = l; bx = dx; by = dy; }
    }
    return Math.atan2(by, bx);
  },

  /* parallel stripes across the (already clipped) footprint */
  roofStripes(g, cx, cy, R, ang, gap, w, color, phase) {
    g.save();
    g.translate(cx, cy); g.rotate(ang);
    g.fillStyle = color;
    for (let o = -R + (phase || 0); o < R; o += gap) g.fillRect(-R, o, R * 2, w);
    g.restore();
  },

  /* random points inside the footprint, away from its edge */
  roofSpots(b, bb, n, rng, margin) {
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries < n * 14) {
      tries++;
      const x = bb.x + margin + rng() * Math.max(1, bb.w - margin * 2);
      const y = bb.y + margin + rng() * Math.max(1, bb.h - margin * 2);
      if (!pointInPolyR(b.p, x, y)) continue;
      if (!pointInPolyR(b.p, x - margin, y) || !pointInPolyR(b.p, x + margin, y) ||
          !pointInPolyR(b.p, x, y - margin) || !pointInPolyR(b.p, x, y + margin)) continue;
      if (pts.some(p => dist(p[0], p[1], x, y) < margin * 1.6)) continue;
      pts.push([x, y]);
    }
    return pts;
  },

  rooftop(g, b, rng) {
    const k = b.k || 0;
    const bb = this.polyBounds(b.p);
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    const R = Math.hypot(bb.w, bb.h) / 2 + 4;
    const ang = this.polyAngle(b.p);
    const area = bb.w * bb.h;

    // drop shadow — taller buildings cast further
    const sh = 2 + Math.min(5, (b.h || 3) * 0.35);
    g.save();
    g.translate(sh, sh + 1);
    g.fillStyle = 'rgba(0,0,0,.20)';
    this.fillPoly(g, b.p);
    g.restore();

    // base roof slab
    const BASE = {
      0: ['#cfc6b0', '#d2c9ae', '#c2beac', '#c8b8a4'],
      1: ['#b0533a', '#a34c36', '#bd5f42', '#8f6f52', '#a86048'],
      2: ['#cfd3cd', '#c8ccc6', '#d6dad2'],
      3: ['#a8b8c4', '#9fb0bc', '#b2c0ca'],
      4: ['#aab0b2', '#a2a8ab', '#b3b8ba'],
      5: ['#9aa0a6', '#93999f'],
      6: ['#c8a44a'],
      7: ['#4a7fae', '#3f7099', '#4a8f8a'],
      8: ['#d8dce0'],
    }[k];
    g.fillStyle = BASE[Math.floor(rng() * BASE.length)];
    if (k === 8) g.globalAlpha = 0.8;
    this.fillPoly(g, b.p);
    g.globalAlpha = 1;

    // textured details, clipped to the footprint
    g.save();
    g.beginPath(); this.tracePoly(g, b.p); g.clip();
    switch (k) {
      case 1: {   // landed house / terrace: tile rows + sunny ridge
        this.roofStripes(g, cx, cy, R, ang, 5, 1.6, 'rgba(80,28,16,.28)');
        this.roofStripes(g, cx, cy, R, ang + Math.PI / 2, 9, 1.4, 'rgba(80,28,16,.14)');
        this.roofStripes(g, cx, cy, R, ang, 5, 1, 'rgba(255,214,170,.22)', 2.4);
        // ridge highlight down the long axis
        g.save(); g.translate(cx, cy); g.rotate(ang);
        g.fillStyle = 'rgba(255,226,180,.5)';
        g.fillRect(-R, -1, R * 2, 2);
        g.restore();
        break;
      }
      case 2: {   // HDB slab: expansion joints, water tanks, lift rooms
        this.roofStripes(g, cx, cy, R, ang, 16, 1, 'rgba(0,0,0,.08)');
        const spots = this.roofSpots(b, bb, Math.max(1, Math.round(area / 1400)), rng, 7);
        for (const [x, y] of spots) {
          if (rng() < 0.55) {  // round water tank
            g.fillStyle = 'rgba(0,0,0,.18)';
            g.beginPath(); g.arc(x + 1.5, y + 1.5, 5, 0, 7); g.fill();
            g.fillStyle = '#e4e8e0';
            g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
            g.fillStyle = '#b4b8b0';
            g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill();
          } else {             // lift motor room
            g.fillStyle = 'rgba(0,0,0,.18)';
            g.fillRect(x - 4, y - 3, 10, 9);
            g.fillStyle = '#bec2ba';
            g.fillRect(x - 5, y - 4, 10, 9);
            g.fillStyle = 'rgba(255,255,255,.4)';
            g.fillRect(x - 5, y - 4, 10, 2);
          }
        }
        // pastel painted parapet trim (the cute HDB signature)
        const TRIM = ['#e8a8a0', '#a8c8e0', '#b8d8a8', '#e8d090', '#d8b0d0'];
        g.strokeStyle = TRIM[Math.floor(rng() * TRIM.length)];
        g.lineWidth = 3;
        g.beginPath(); this.tracePoly(g, b.p); g.stroke();
        break;
      }
      case 3: {   // industrial: ribbed metal sheeting + skylight strips
        this.roofStripes(g, cx, cy, R, ang, 5, 1.6, 'rgba(255,255,255,.30)');
        this.roofStripes(g, cx, cy, R, ang, 5, 1, 'rgba(30,50,70,.18)', 2.6);
        if (area > 900) this.roofStripes(g, cx, cy, R, ang, 26, 3, 'rgba(200,240,255,.45)', 9);
        break;
      }
      case 4: {   // mall / office: HVAC farm + skylight spine
        this.roofStripes(g, cx, cy, R, ang, 18, 1, 'rgba(0,0,0,.07)');
        if (bb.w > 30 || bb.h > 30) {   // glass skylight down the spine
          g.save(); g.translate(cx, cy); g.rotate(ang);
          g.fillStyle = 'rgba(120,180,205,.75)';
          g.fillRect(-R * 0.5, -3, R, 6);
          g.fillStyle = 'rgba(230,250,255,.5)';
          g.fillRect(-R * 0.5, -3, R, 1.6);
          g.restore();
        }
        const units = this.roofSpots(b, bb, Math.max(2, Math.round(area / 900)), rng, 6);
        for (const [x, y] of units) {   // aircon units with fan dots
          g.fillStyle = 'rgba(0,0,0,.18)';
          g.fillRect(x - 3, y - 2, 8, 7);
          g.fillStyle = '#878d90';
          g.fillRect(x - 4, y - 3, 8, 7);
          g.fillStyle = '#c8ced0';
          g.fillRect(x - 2, y - 1, 3, 3);
        }
        break;
      }
      case 5: {   // carpark top deck: stall stripes + parked cars
        this.roofStripes(g, cx, cy, R, ang + Math.PI / 2, 7, 1, 'rgba(255,255,255,.38)');
        g.save(); g.translate(cx, cy); g.rotate(ang);
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.fillRect(-R, -1, R * 2, 1.4);   // centre lane line
        g.restore();
        const CARS = ['#c62828', '#1565c0', '#e8e4da', '#2e7d32', '#f9a825', '#6d4c41'];
        const cars = this.roofSpots(b, bb, Math.max(1, Math.round(area / 700)), rng, 5);
        for (const [x, y] of cars) {
          g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2);
          g.fillStyle = 'rgba(0,0,0,.25)';
          g.fillRect(-3, -2, 8, 5);
          g.fillStyle = CARS[Math.floor(rng() * CARS.length)];
          g.fillRect(-4, -2.5, 8, 5);
          g.fillStyle = 'rgba(30,40,60,.7)';
          g.fillRect(-2, -1.5, 2, 3);
          g.restore();
        }
        break;
      }
      case 6: {   // temple / mosque / church: gold ridged roof, red trim
        this.roofStripes(g, cx, cy, R, ang, 4, 1.2, 'rgba(120,70,10,.30)');
        g.save(); g.translate(cx, cy); g.rotate(ang);
        g.fillStyle = '#8e1f1f';
        g.fillRect(-R, -1.5, R * 2, 3);
        g.restore();
        g.strokeStyle = '#8e1f1f'; g.lineWidth = 2.5;
        g.beginPath(); this.tracePoly(g, b.p); g.stroke();
        break;
      }
      case 7: {   // school: bright ribbed metal roof + pale ridge
        this.roofStripes(g, cx, cy, R, ang, 6, 1.6, 'rgba(255,255,255,.26)');
        this.roofStripes(g, cx, cy, R, ang, 6, 1, 'rgba(10,30,50,.22)', 3);
        g.save(); g.translate(cx, cy); g.rotate(ang);
        g.fillStyle = 'rgba(255,255,255,.55)';
        g.fillRect(-R, -1, R * 2, 2);
        g.restore();
        break;
      }
      case 8: {   // open canopy / covered walkway: light framed panels
        this.roofStripes(g, cx, cy, R, ang, 8, 1, 'rgba(90,100,110,.4)');
        this.roofStripes(g, cx, cy, R, ang + Math.PI / 2, 12, 1, 'rgba(90,100,110,.3)');
        break;
      }
      default: {  // generic flat: faint joints + a stray vent or two
        this.roofStripes(g, cx, cy, R, ang, 14, 1, 'rgba(0,0,0,.07)');
        for (const [x, y] of this.roofSpots(b, bb, Math.round(area / 1600), rng, 6)) {
          g.fillStyle = '#9a968a';
          g.fillRect(x - 3, y - 3, 6, 6);
          g.fillStyle = 'rgba(255,255,255,.35)';
          g.fillRect(x - 3, y - 3, 6, 1.5);
        }
      }
    }
    // sun-lit edge: light along the top-left, shade along the bottom-right
    g.save(); g.translate(-1.2, -1.2);
    g.strokeStyle = 'rgba(255,255,240,.35)'; g.lineWidth = 2;
    g.beginPath(); this.tracePoly(g, b.p); g.stroke();
    g.restore();
    g.save(); g.translate(1.2, 1.2);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    g.beginPath(); this.tracePoly(g, b.p); g.stroke();
    g.restore();
    g.restore();

    // landmark tint keeps story buildings readable on the map
    if (b.lm) {
      g.save();
      g.beginPath(); this.tracePoly(g, b.p); g.clip();
      g.fillStyle = 'rgba(239,131,84,.30)';
      g.fillRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4);
      g.restore();
      g.strokeStyle = '#ef8354'; g.lineWidth = 2;
      this.strokePoly(g, b.p);
    } else {
      g.strokeStyle = 'rgba(0,0,0,.30)'; g.lineWidth = 1.5;
      this.strokePoly(g, b.p);
    }
  },

  /* ---------- recreation micro-features (real OSM data) ---------- */

  /* open-air carpark: asphalt, stall stripes along the long axis, cars */
  carpark(g, p, rng) {
    const bb = this.polyBounds(p);
    if (bb.w < 8 || bb.h < 8) return;
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    const R = Math.hypot(bb.w, bb.h) / 2 + 4;
    const ang = this.polyAngle(p);
    g.fillStyle = '#7e848c';
    this.fillPoly(g, p);
    g.save();
    g.beginPath(); this.tracePoly(g, p); g.clip();
    this.roofStripes(g, cx, cy, R, ang + Math.PI / 2, 8, 1, 'rgba(255,255,255,.30)');
    const CARS = ['#c62828', '#1565c0', '#e8e4da', '#2e7d32', '#f9a825', '#37474f'];
    const spots = this.roofSpots({ p }, bb, Math.max(1, Math.round(bb.w * bb.h / 800)), rng, 5);
    for (const [x, y] of spots) {
      g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(-3, -2, 8, 5);
      g.fillStyle = CARS[Math.floor(rng() * CARS.length)];
      g.fillRect(-4, -2.5, 8, 5);
      g.fillStyle = 'rgba(30,40,60,.7)';
      g.fillRect(-2, -1.5, 2, 3);
      g.restore();
    }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5;
    this.strokePoly(g, p);
  },

  /* sports pitch / court with sport-appropriate colour + markings */
  pitch(g, pt, rng) {
    const p = pt.p, sport = pt.s || '';
    const bb = this.polyBounds(p);
    if (bb.w < 8 || bb.h < 8) return;
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    const ang = this.polyAngle(p);
    const long = Math.hypot(bb.w, bb.h) / 2;
    const court = /basketball|tennis|netball/.test(sport);
    const track = /running|athletics/.test(sport);
    g.fillStyle = track ? '#c4633c' : court ? '#3f7d8c' : '#3d8b46';
    this.fillPoly(g, p);
    g.save();
    g.beginPath(); this.tracePoly(g, p); g.clip();
    if (!court && !track) {   // grass field: mowing stripes
      this.roofStripes(g, cx, cy, long + 4, ang, 8, 4, 'rgba(255,255,255,.06)');
    }
    // markings: centre line + boundary
    g.save();
    g.translate(cx, cy); g.rotate(ang);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.4;
    const hw = Math.min(long * 0.72, Math.max(bb.w, bb.h) / 2 - 3);
    const hh = Math.max(4, Math.min(bb.w, bb.h) / 2 - 3.5);
    g.strokeRect(-hw, -hh, hw * 2, hh * 2);
    g.beginPath(); g.moveTo(0, -hh); g.lineTo(0, hh); g.stroke();
    g.beginPath(); g.arc(0, 0, Math.min(6, hh * 0.7), 0, 7); g.stroke();
    g.restore();
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.2;
    this.strokePoly(g, p);
  },

  /* HDB void-deck playground: rubber mat, slide, swing */
  playground(g, x, y, rng) {
    // rubber safety mat
    g.fillStyle = '#c88a54';
    g.beginPath(); g.ellipse(x, y + 2, 17, 11, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.10)';
    for (let i = 0; i < 8; i++)
      g.fillRect(x - 14 + Math.floor(rng() * 10) * 3, y - 5 + Math.floor(rng() * 5) * 3, 3, 3);
    Sprites.draw(g, 'playground', x, y - 4, 2.4);
  },

  /* ---------- poly / path helpers ---------- */

  tracePoly(g, pts) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  },
  fillPoly(g, pts) {
    g.beginPath(); this.tracePoly(g, pts); g.fill();
  },
  strokePoly(g, pts) {
    g.beginPath(); this.tracePoly(g, pts); g.stroke();
  },
  polyBounds(pts) {
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    for (const [x, y] of pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  },

  strokePath(g, pts, w, color) {
    g.strokeStyle = color; g.lineWidth = w;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  },

  portal(g, x, y) {
    x = clamp(x, 20, 940); y = clamp(y, 20, 580);
    Sprites.draw(g, 'portal', x, y, 3);
  },

  /* Temporary Operations Command — the field HQ the player defends.
     (A deployable tent post reads plausibly anywhere, unlike an MRT
     station appearing in a park or on a dam.)                        */
  opsCommand(g, x, y) {
    x = clamp(x, 44, 916); y = clamp(y, 34, 566);
    // soft ground shadow
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath(); g.ellipse(x + 3, y + 26, 44, 10, 0, 0, 7); g.fill();
    // field HQ tent (pixel sprite: canvas roof, radio mast, sandbag ring)
    Sprites.draw(g, 'command_post', x, y, 4);
    // beacon on the radio mast
    g.fillStyle = '#ff5252';
    g.fillRect(x - 37, y - 32, 4, 4);
    // OPS COMMAND sign over the doorway
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#20180c';
    g.fillRect(x - 17, y - 4, 34, 10);
    g.fillStyle = '#ffd23c';
    g.font = 'bold 8px monospace';
    g.fillText('OPS HQ', x, y + 1);
  },

  /* ---------- landmark drawing ---------- */

  landmark(g, lm, rng) {
    const { x, y, kind, label } = lm;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    switch (kind) {
      case 'building':   // real footprint already drawn (lm flag); just badge it
        g.fillStyle = 'rgba(255,235,59,.9)';
        g.fillRect(x - 3, y - 10, 6, 6);
        g.beginPath();
        g.moveTo(x - 5, y - 4); g.lineTo(x + 5, y - 4); g.lineTo(x, y + 3);
        g.closePath(); g.fill();
        break;
      case 'market': {
        const w = lm.w || 60, h = lm.h || 32;
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(x - w / 2 + 4, y - h / 2 + 4, w, h);
        g.fillStyle = lm.color || '#8d6e63';
        g.fillRect(x - w / 2, y - h / 2 + 8, w, h - 8);
        for (let i = 0; i < w; i += 12) {
          g.fillStyle = (i / 12) % 2 ? '#e8e4da' : '#c62828';
          g.fillRect(x - w / 2 + i, y - h / 2, Math.min(12, w - i), 10);
        }
        g.fillStyle = '#3c2c1c';
        g.fillRect(x - 8, y + h / 2 - 12, 16, 12);
        break;
      }
      case 'mosque': {
        g.fillStyle = '#c8a44a';
        g.beginPath(); g.arc(x, y - 10, 22, Math.PI, 0); g.fill();
        g.fillRect(x - 26, y - 10, 52, 30);
        g.fillStyle = '#e8dcc0';
        g.fillRect(x - 26, y - 6, 52, 26);
        g.fillStyle = '#8a6d2f';
        g.fillRect(x - 5, y + 4, 10, 16);
        g.fillStyle = '#e8dcc0';
        g.fillRect(x - 40, y - 26, 8, 46);
        g.fillRect(x + 32, y - 26, 8, 46);
        g.fillStyle = '#c8a44a';
        g.fillRect(x - 42, y - 32, 12, 8);
        g.fillRect(x + 30, y - 32, 12, 8);
        break;
      }
      case 'pagoda': {
        for (let i = 0; i < 3; i++) {
          const w = 56 - i * 14, ry = y + 8 - i * 16;
          g.fillStyle = '#8e1f1f';
          g.fillRect(x - w / 2, ry - 6, w, 6);
          g.fillStyle = '#c53030';
          g.fillRect(x - w / 2 + 8, ry - 14, w - 16, 8);
        }
        g.fillStyle = '#e8b13a';
        g.fillRect(x - 3, y - 48, 6, 8);
        break;
      }
      case 'merlion': Sprites.draw(g, 'merlion', x, y, 4); break;
      case 'tower': {
        g.fillStyle = '#c8b060';
        g.fillRect(x - 6, y - 40, 12, 46);
        g.fillStyle = '#a89040';
        g.fillRect(x - 12, y - 48, 24, 10);
        g.fillStyle = '#e8dcc0';
        g.fillRect(x - 9, y - 46, 18, 6);
        break;
      }
      case 'gate': {
        g.fillStyle = '#c53030';
        g.fillRect(x - 36, y - 30, 10, 36);
        g.fillRect(x + 26, y - 30, 10, 36);
        g.fillStyle = '#8e1f1f';
        g.fillRect(x - 44, y - 38, 88, 10);
        g.fillStyle = '#e8b13a';
        g.fillRect(x - 40, y - 42, 80, 5);
        break;
      }
      case 'spring': {
        g.fillStyle = '#9aa4ae';
        g.beginPath(); g.ellipse(x, y, 26, 14, 0, 0, 7); g.fill();
        g.fillStyle = '#7ec8e8';
        g.beginPath(); g.ellipse(x, y, 20, 10, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.8)';
        g.fillRect(x - 2, y - 22, 4, 8);
        g.fillRect(x - 8, y - 16, 3, 6);
        g.fillRect(x + 6, y - 18, 3, 7);
        break;
      }
      case 'cliff': {
        g.fillStyle = '#8a929c';
        g.beginPath();
        g.moveTo(x - 40, y + 16); g.lineTo(x - 22, y - 28); g.lineTo(x - 8, y - 6);
        g.lineTo(x + 8, y - 34); g.lineTo(x + 26, y - 2); g.lineTo(x + 40, y + 16);
        g.closePath(); g.fill();
        g.fillStyle = '#5f6870';
        g.beginPath();
        g.moveTo(x + 8, y - 34); g.lineTo(x + 26, y - 2); g.lineTo(x + 40, y + 16);
        g.lineTo(x + 8, y + 16); g.closePath(); g.fill();
        break;
      }
      case 'summit': {
        g.fillStyle = '#6d573c';
        g.beginPath();
        g.moveTo(x - 34, y + 18); g.lineTo(x, y - 26); g.lineTo(x + 34, y + 18);
        g.closePath(); g.fill();
        g.fillStyle = '#4c7a2c';
        g.beginPath();
        g.moveTo(x - 20, y + 18); g.lineTo(x, y - 8); g.lineTo(x + 20, y + 18);
        g.closePath(); g.fill();
        break;
      }
      case 'playground': {
        g.fillStyle = '#e8b13a';
        g.fillRect(x - 24, y - 18, 30, 22);
        g.fillStyle = '#c53030';
        g.fillRect(x - 30, y - 10, 8, 8);
        g.fillStyle = '#e8b13a';
        g.fillRect(x + 6, y - 8, 12, 12); g.fillRect(x + 18, y - 2, 12, 8);
        g.fillStyle = '#fff';
        g.fillRect(x - 18, y - 12, 5, 5);
        break;
      }
      case 'label':
        break; // text only
    }
    if (label) {
      g.font = 'bold 11px monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
      const ly = kind === 'label' ? y - 6 : y + (lm.h ? lm.h / 2 : 22) + 3;
      g.fillStyle = 'rgba(0,0,0,.55)';
      const tw = g.measureText(label.toUpperCase()).width;
      g.fillRect(x - tw / 2 - 3, ly - 1, tw + 6, 13);
      g.fillStyle = '#ffe9b0';
      g.fillText(label.toUpperCase(), x, ly);
    }
  },

  deco(g, kind, x, y, rng) {
    switch (kind) {
      case 'trees':
        Sprites.draw(g, rng() < 0.55 ? 'tree' : rng() < 0.5 ? 'rain_tree' : 'bush', x, y, 3);
        break;
      case 'jungle':
        Sprites.draw(g, ['tree', 'rain_tree', 'palm', 'bush'][Math.floor(rng() * 4)], x, y, 3 + Math.floor(rng() * 2));
        break;
      case 'coast':
        Sprites.draw(g, ['palm', 'palm', 'rock', 'bush'][Math.floor(rng() * 4)], x, y, 3);
        break;
      case 'hdb':
        Sprites.draw(g, ['rain_tree', 'tree', 'bench', 'bush'][Math.floor(rng() * 4)], x, y, 2.6);
        break;
      case 'shophouse':
        Sprites.draw(g, ['rain_tree', 'bench', 'bush'][Math.floor(rng() * 3)], x, y, 2.6);
        break;
    }
  },

  /* Singapore street furniture along the enemy route: bus stops, lamp
     posts and the odd roadside rain tree — the heartland look. */
  streetFurniture(g, geo, layout, paths, rng) {
    for (const path of paths) {
      const bp = buildPath(path.points);
      for (let d = 90; d < bp.total - 70; d += 120 + rng() * 90) {
        const p = pointAt(bp, d);
        const side = rng() < 0.5 ? 1 : -1;
        const off = 27 + rng() * 6;
        const x = p.x - p.dy * off * side, y = p.y + p.dx * off * side;
        if (x < 24 || x > 936 || y < 40 || y > 576) continue;
        if (!this.openGroundLoose(geo, layout, paths, x, y)) continue;
        const r = rng();
        if (r < 0.30) Sprites.draw(g, 'bus_stop', x, y, 2.6);
        else if (r < 0.55) Sprites.draw(g, 'lamp_post', x, y - 4, 2.4);
        else if (r < 0.8) Sprites.draw(g, 'rain_tree', x, y, 2.8);
        else Sprites.draw(g, 'bench', x, y, 2.2);
      }
    }
  },

  /* looser variant for small roadside props (they may hug the path) */
  openGroundLoose(geo, layout, paths, x, y) {
    for (const path of paths) if (distToPath(path, x, y) < 24) return false;
    for (const [sx, sy] of layout.spots) if (dist(x, y, sx, sy) < 40) return false;
    for (const r of geo.roads) if (r.c <= 3 && distToLinePts(r.p, x, y) < ROAD_W[r.c] / 2 + 4) return false;
    for (const [wx, wy, ww, wh] of (geo.sea || []))
      if (x > wx - 10 && x < wx + ww + 10 && y > wy - 20 && y < wy + wh + 10) return false;
    for (const w of geo.water) if (pointInPolyR(w, x, y)) return false;
    for (const w of (geo.pools || [])) if (pointInPolyR(w, x, y)) return false;
    for (const pc of (geo.pitches || [])) if (pointInPolyR(pc.p, x, y)) return false;
    for (const lot of (geo.lots || [])) if (pointInPolyR(lot, x, y)) return false;
    for (const b of geo.buildings) if (pointInPolyR(b.p, x, y)) return false;
    for (const [px, py] of (geo.plays || [])) if (dist(x, y, px, py) < 26) return false;
    for (const lm of (layout.landmarks || [])) if (dist(x, y, lm.x, lm.y) < 50) return false;
    for (const line of geo.rail) if (distToLinePts(line, x, y) < 18) return false;
    return true;
  },

  /* ---------- dynamic drawing ---------- */

  draw(ctx, game) {
    ctx.clearRect(0, 0, 960, 600);
    ctx.imageSmoothingEnabled = false;
    if (this.bg) ctx.drawImage(this.bg, 0, 0);

    // animated MRT trains on the viaducts
    this.drawTrains(ctx);

    // rally point marker
    if (game.rallyPickTower) {
      ctx.strokeStyle = 'rgba(255,235,59,.9)'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      const t = game.rallyPickTower;
      ctx.beginPath(); ctx.arc(t.x, t.y, towerStats(t).range, 0, 7);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // range circle for selected tower
    if (game.selected && game.selected.kind === 'tower') {
      const t = game.selected.tower;
      const r = towerStats(t).range;
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, 7); ctx.fill(); ctx.stroke();
    }

    // hero hold-point flags + selection ring
    for (const h of game.heroes) {
      if (game.selected && game.selected.kind === 'hero' && game.selected.hero === h) {
        ctx.strokeStyle = 'rgba(255,235,59,.9)'; ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(h.x, h.y, 20, 0, 7); ctx.stroke();
        if (h.def.range) { ctx.beginPath(); ctx.arc(h.x, h.y, h.def.range, 0, 7); ctx.stroke(); }
        ctx.setLineDash([]);
        if (dist(h.x, h.y, h.hx, h.hy) > 8) {
          ctx.fillStyle = 'rgba(165,214,167,.9)';
          ctx.fillRect(h.hx - 2, h.hy - 12, 3, 12);
          ctx.beginPath();
          ctx.moveTo(h.hx + 1, h.hy - 12); ctx.lineTo(h.hx + 11, h.hy - 9); ctx.lineTo(h.hx + 1, h.hy - 6);
          ctx.closePath(); ctx.fill();
        }
      }
    }

    // soldiers
    for (const s of game.soldiers) this.soldier(ctx, s);

    // heroes
    for (const h of game.heroes) this.hero(ctx, h, game.time);

    // enemies (ground first, flying on top)
    const sorted = [...game.enemies].sort((a, b) => (a.def.flying ? 1 : 0) - (b.def.flying ? 1 : 0));
    for (const e of sorted) this.enemy(ctx, e, game.time);

    // towers
    for (const t of game.towers) this.tower(ctx, t, game.time);

    // projectiles
    for (const p of game.projectiles) this.projectile(ctx, p);

    // time-of-day live overlay (units blend into the scene lighting;
    // floating text / effects stay crisp above it)
    if (this.tod && this.tod.live) {
      ctx.fillStyle = this.tod.live;
      ctx.fillRect(0, 0, 960, 600);
    }

    // particles / floating text
    for (const fx of game.effects) this.effect(ctx, fx);
  },

  enemy(ctx, e, time) {
    const bob = Math.sin(time * 6 + e.seed * 9) * 3;
    const y = e.y + (e.def.flying ? bob - 14 : bob * 0.4);
    const scale = e.def.boss ? 3 : 2;
    const flip = (e.vx ?? 1) < 0 ? -1 : 1;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.def.size * 0.85, e.def.size * 0.8, e.def.size * 0.3, 0, 0, 7);
    ctx.fill();

    // pixel sprite body — fully opaque
    const spr = Sprites.get(e.type) ? e.type : 'toyol';
    Sprites.draw(ctx, spr, e.x, y, scale, flip);
    if (e.slowT > 0) Sprites.drawTinted(ctx, spr, 'rgba(110,190,255,.45)', e.x, y, scale, flip);
    if (e.burnT > 0) Sprites.drawTinted(ctx, spr, 'rgba(255,120,40,.40)', e.x, y, scale, flip);

    // boss aura
    if (e.def.boss) {
      ctx.strokeStyle = `rgba(255,64,64,${0.45 + 0.25 * Math.sin(time * 4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, y, e.def.size + 10, 0, 7); ctx.stroke();
    }

    // hp bar
    if (e.hp < e.maxHp) {
      const w = e.def.size * 2.2;
      ctx.fillStyle = '#111';
      ctx.fillRect(e.x - w / 2 - 1, y - e.def.size - 11, w + 2, 7);
      ctx.fillStyle = '#37474f';
      ctx.fillRect(e.x - w / 2, y - e.def.size - 10, w, 5);
      ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#66bb6a' : e.hp / e.maxHp > 0.25 ? '#ffca28' : '#ef5350';
      ctx.fillRect(e.x - w / 2, y - e.def.size - 10, w * (e.hp / e.maxHp), 5);
    }
  },

  tower(ctx, t, time) {
    const lv = t.level;
    const scale = 2.6 + lv * 0.5;
    const sprite = towerSpriteName(t);

    // shadow under sprite
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 12, 22, 9, 0, 0, 7); ctx.fill();

    Sprites.draw(ctx, sprite, t.x, t.y - 8, scale);

    // ultimate towers get a soft golden aura
    if (lv >= 3) {
      const gl = 0.16 + 0.10 * Math.sin(time * 3 + t.id);
      ctx.strokeStyle = `rgba(255,213,79,${gl + 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y - 4, 26 + Math.sin(time * 3 + t.id) * 1.5, 0, 7); ctx.stroke();
    }

    // firing flash for cell tower
    if (t.type === 'cell' && t.cool < 0.1 && t.cool > 0) {
      ctx.fillStyle = 'rgba(160,220,255,.9)';
      ctx.fillRect(t.x - 3, t.y - 8 - 7 * scale, 6, 6);
    }
    // crackling coil sparks
    if (t.type === 'power' && t.cool < 0.15 && t.cool > 0) {
      ctx.fillStyle = 'rgba(126,232,255,.9)';
      ctx.fillRect(t.x - 6, t.y - 8 - 6 * scale, 4, 4);
      ctx.fillRect(t.x + 3, t.y - 4 - 6 * scale, 4, 4);
    }
    // wok flames flicker
    if (t.type === 'wok') {
      const fl = 0.5 + 0.5 * Math.sin(time * 9 + t.x);
      ctx.fillStyle = `rgba(255,140,40,${0.35 + fl * 0.3})`;
      ctx.fillRect(t.x - 2, t.y - 10 - 6 * scale - fl * 3, 5, 5);
    }
    // frosty shimmer on the ice cart
    if (t.type === 'ice') {
      const gl = 0.18 + 0.12 * Math.sin(time * 2.5 + t.y);
      ctx.fillStyle = `rgba(150,220,255,${gl})`;
      ctx.beginPath(); ctx.arc(t.x, t.y - 8 - 4 * scale, 9, 0, 7); ctx.fill();
    }
    // temple glow
    if (t.type === 'temple') {
      const glow = 0.25 + 0.15 * Math.sin(time * 3 + t.x);
      ctx.fillStyle = `rgba(255,213,79,${glow})`;
      ctx.beginPath(); ctx.arc(t.x, t.y - 8 - 5 * scale, 10, 0, 7); ctx.fill();
    }

    // level pips (ultimate shows a star instead)
    if (lv >= 3) {
      ctx.fillStyle = '#ffd54f';
      ctx.strokeStyle = '#5c4a10'; ctx.lineWidth = 1;
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeText('★', t.x, t.y + 19);
      ctx.fillText('★', t.x, t.y + 19);
    } else {
      ctx.fillStyle = '#ffd54f';
      ctx.strokeStyle = '#5c4a10'; ctx.lineWidth = 1;
      for (let i = 0; i <= lv; i++) {
        ctx.fillRect(t.x - 10 + i * 8, t.y + 16, 5, 5);
        ctx.strokeRect(t.x - 10 + i * 8, t.y + 16, 5, 5);
      }
    }
  },

  hero(ctx, h, time) {
    if (h.dead) {
      // respawn hourglass at the hold point
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(h.hx, h.hy, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
      const frac = 1 - h.respawnT / HERO_RESPAWN;
      ctx.beginPath(); ctx.arc(h.hx, h.hy, 13, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd54f';
      ctx.fillText(Math.ceil(h.respawnT), h.hx, h.hy);
      return;
    }
    const bob = Math.sin(time * 5 + h.id) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 11, 11, 4.5, 0, 0, 7); ctx.fill();
    Sprites.draw(ctx, h.def.sprite, h.x, h.y - 4 + bob, 2.4);
    // gold hero chevron
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(h.x - 5, h.y - 26 + bob); ctx.lineTo(h.x + 5, h.y - 26 + bob); ctx.lineTo(h.x, h.y - 20 + bob);
    ctx.closePath(); ctx.fill();
    // hp bar
    if (h.hp < h.maxHp) {
      ctx.fillStyle = '#111'; ctx.fillRect(h.x - 14, h.y - 19, 28, 6);
      ctx.fillStyle = '#37474f'; ctx.fillRect(h.x - 13, h.y - 18, 26, 4);
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(h.x - 13, h.y - 18, 26 * (h.hp / h.maxHp), 4);
    }
  },

  soldier(ctx, s) {
    if (s.dead) return;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y + 9, 8, 3.5, 0, 0, 7); ctx.fill();
    Sprites.draw(ctx, 'soldier', s.x, s.y - 2, 2);
    if (s.hp < s.maxHp) {
      ctx.fillStyle = '#111'; ctx.fillRect(s.x - 11, s.y - 17, 22, 5);
      ctx.fillStyle = '#37474f'; ctx.fillRect(s.x - 10, s.y - 16, 20, 3);
      ctx.fillStyle = '#66bb6a'; ctx.fillRect(s.x - 10, s.y - 16, 20 * (s.hp / s.maxHp), 3);
    }
  },

  projectile(ctx, p) {
    switch (p.kind) {
      case 'zap':
        ctx.strokeStyle = 'rgba(129,212,250,.95)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#e1f5fe';
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        break;
      case 'durian':
        Sprites.draw(ctx, 'p_durian', p.x, p.y - p.arc, p.big ? 3.2 : 2);
        break;
      case 'snipe': {
        // long tracer round
        const dx = p.x - p.sx, dy = p.y - p.sy, dl = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = 'rgba(255,240,180,.9)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - dx / dl * 22, p.y - dy / dl * 22);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = '#fffde7';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        break;
      }
      case 'wokfire':
        ctx.fillStyle = 'rgba(255,120,30,.9)';
        ctx.beginPath(); ctx.arc(p.x, p.y - p.arc, 6, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,90,.95)';
        ctx.fillRect(p.x - 2, p.y - p.arc - 2, 4, 4);
        break;
      case 'chain':
        ctx.strokeStyle = 'rgba(126,232,255,.95)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#e0f7ff';
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        break;
      case 'hero':
        ctx.strokeStyle = p.magic ? 'rgba(206,147,216,.9)' : 'rgba(255,224,130,.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.stroke();
        ctx.fillStyle = p.magic ? '#e1bee7' : '#ffecb3';
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        break;
      case 'talisman':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.t * 12);
        ctx.imageSmoothingEnabled = false;
        const c = Sprites.get('p_talisman');
        ctx.drawImage(c, -c.width, -c.height, c.width * 2, c.height * 2);
        ctx.restore();
        break;
    }
  },

  effect(ctx, fx) {
    const a = 1 - fx.t / fx.dur;
    if (fx.kind === 'boom') {
      const r = fx.r * (1 - a * 0.5);
      ctx.fillStyle = `rgba(255,${160 + 60 * a | 0},60,${a * 0.75})`;
      const step = 8;
      for (let dx = -r; dx < r; dx += step)
        for (let dy = -r; dy < r; dy += step)
          if (dx * dx + dy * dy < r * r && ((dx + dy) / step) % 2 === 0)
            ctx.fillRect(fx.x + dx, fx.y + dy, step - 1, step - 1);
    } else if (fx.kind === 'text') {
      ctx.globalAlpha = a;
      ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = fx.color || '#ffe082';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      ctx.strokeText(fx.text, fx.x, fx.y - fx.t * 26);
      ctx.fillText(fx.text, fx.x, fx.y - fx.t * 26);
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'freeze') {
      // expanding frost ring (ice kacang pulse)
      const r = fx.r * (0.35 + 0.65 * (fx.t / fx.dur));
      ctx.strokeStyle = `rgba(150,220,255,${a * 0.8})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, 7); ctx.stroke();
      ctx.strokeStyle = `rgba(240,252,255,${a * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, r * 0.8, 0, 7); ctx.stroke();
    } else if (fx.kind === 'arc') {
      // chain-lightning jump between two enemies
      ctx.strokeStyle = `rgba(126,232,255,${a * 0.9})`;
      ctx.lineWidth = 2.5;
      const mx = (fx.x + fx.x2) / 2 + (fx.j || 0), my = (fx.y + fx.y2) / 2 - Math.abs(fx.j || 6);
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(mx, my); ctx.lineTo(fx.x2, fx.y2); ctx.stroke();
    } else if (fx.kind === 'poof') {
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#e8e4da';
      const r = 6 + fx.t * 30;
      for (let i = 0; i < 6; i++) {
        const ang = i * 1.05 + fx.t * 2;
        ctx.fillRect(fx.x + Math.cos(ang) * r - 3, fx.y - fx.t * 18 + Math.sin(ang) * r * 0.6 - 3, 6, 6);
      }
      ctx.globalAlpha = 1;
    }
  },
};

/* small geometry helpers used by the renderer */
function distToLinePts(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - x1) * dx + (y - y1) * dy) / len2, 0, 1);
    best = Math.min(best, Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t)));
  }
  return best;
}
function pointInPolyR(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
