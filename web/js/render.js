/* ===== Canvas renderer: pixel-art Singapore scenery ===== */
'use strict';

const THEMES = {
  town:   { grass: '#6aa03c', grass2: '#5c8f33', road: '#8a8f98', roadEdge: '#63686f', deco: 'hdb' },
  park:   { grass: '#79b04a', grass2: '#69a03e', road: '#b09878', roadEdge: '#8a7156', deco: 'trees' },
  forest: { grass: '#4c7a2c', grass2: '#3d6822', road: '#94795c', roadEdge: '#6d573c', deco: 'jungle' },
  coast:  { grass: '#8cb455', grass2: '#7ca648', road: '#d4bd90', roadEdge: '#b09b6e', deco: 'coast' },
  river:  { grass: '#6aa03c', grass2: '#5c8f33', road: '#8a8f98', roadEdge: '#63686f', deco: 'shophouse' },
};

const Renderer = {
  bg: null, // cached background canvas

  /** Pre-render static background for a level. */
  buildBackground(level, layout, paths) {
    const theme = THEMES[level.theme] || THEMES.town;
    const c = document.createElement('canvas');
    c.width = 960; c.height = 600;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rng = makeRng(4242 + LEVELS.indexOf(level) * 101);

    // grass base + chunky pixel patches
    g.fillStyle = theme.grass;
    g.fillRect(0, 0, 960, 600);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rng() < 0.6 ? theme.grass2 : 'rgba(255,255,255,0.06)';
      const x = Math.floor(rng() * 120) * 8, y = Math.floor(rng() * 75) * 8;
      const w = (1 + Math.floor(rng() * 3)) * 8;
      g.fillRect(x, y, w, 8);
    }

    // water bodies
    if (layout.water) {
      for (const [x, y, w, h, label] of layout.water) {
        g.fillStyle = '#2e7bb4';
        g.fillRect(x, y, w, h);
        g.fillStyle = '#3f97d4';
        g.fillRect(x, y, w, Math.min(6, h));
        // pixel wave flecks
        g.fillStyle = 'rgba(255,255,255,.35)';
        for (let i = 0; i < (w * h) / 3200; i++) {
          const wx = x + Math.floor(rng() * (w / 8)) * 8;
          const wy = y + 8 + Math.floor(rng() * ((h - 12) / 8)) * 8;
          g.fillRect(wx, wy, 12, 3);
        }
        if (label) {
          g.font = 'bold 13px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = 'rgba(255,255,255,.5)';
          g.fillText(label.toUpperCase(), x + w / 2, y + h / 2);
        }
      }
    }

    // roads
    for (const path of paths) {
      this.strokePath(g, path.points, 46, theme.roadEdge);
      this.strokePath(g, path.points, 38, theme.road);
      g.save();
      g.setLineDash([12, 10]);
      this.strokePath(g, path.points, 3, 'rgba(255,255,255,.5)');
      g.restore();
    }

    // entrance / exit markers
    for (const path of paths) {
      const p0 = path.points[0], pn = path.points[path.points.length - 1];
      this.portal(g, p0[0], p0[1]);
      this.mrtExit(g, pn[0], pn[1]);
    }

    // build pads
    for (const [x, y] of layout.spots) {
      g.fillStyle = '#5f6870';
      g.fillRect(x - 22, y - 12, 44, 28);
      g.fillStyle = '#9aa4ae';
      g.fillRect(x - 22, y - 16, 44, 28);
      g.fillStyle = '#b8c2cc';
      g.fillRect(x - 18, y - 12, 36, 20);
      g.strokeStyle = '#5f6870'; g.lineWidth = 2;
      g.strokeRect(x - 22, y - 16, 44, 28);
      g.fillStyle = '#6d7880';
      g.fillRect(x - 5, y - 7, 10, 3);
      g.fillRect(x - 7, y - 2, 14, 3);
      g.fillRect(x - 5, y + 3, 10, 3);
    }

    // landmarks (real-place anchors)
    if (layout.landmarks) {
      for (const lm of layout.landmarks) this.landmark(g, lm, rng);
    }

    // scenery decorations away from roads/pads/landmarks
    const decos = { hdb: 9, trees: 14, jungle: 16, coast: 10, shophouse: 9 }[theme.deco];
    let placed = 0, tries = 0;
    while (placed < decos && tries < 400) {
      tries++;
      const x = 40 + rng() * 880, y = 60 + rng() * 500;
      let ok = true;
      for (const path of paths) if (distToPath(path, x, y) < 62) { ok = false; break; }
      if (ok) for (const [sx, sy] of layout.spots) if (dist(x, y, sx, sy) < 58) { ok = false; break; }
      if (ok && layout.water) for (const [wx, wy, ww, wh] of layout.water)
        if (x > wx - 24 && x < wx + ww + 24 && y > wy - 50 && y < wy + wh + 24) { ok = false; break; }
      if (ok && layout.landmarks) for (const lm of layout.landmarks)
        if (dist(x, y, lm.x, lm.y) < 80) { ok = false; break; }
      if (!ok) continue;
      this.deco(g, theme.deco, x, y, rng);
      placed++;
    }

    this.bg = c;
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

  mrtExit(g, x, y) {
    x = clamp(x, 30, 930); y = clamp(y, 26, 574);
    g.fillStyle = '#8e1f1f';
    g.fillRect(x - 28, y - 24, 56, 44);
    g.fillStyle = '#d32f2f';
    g.fillRect(x - 26, y - 22, 52, 40);
    g.fillStyle = '#fff';
    g.fillRect(x - 22, y - 18, 44, 20);
    g.fillStyle = '#d32f2f';
    g.font = 'bold 13px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MRT', x, y - 8);
    g.fillStyle = '#fff';
    g.font = 'bold 11px monospace';
    g.fillText('EXIT', x, y + 10);
  },

  /* ---------- landmark drawing ---------- */

  landmark(g, lm, rng) {
    const { x, y, kind, label } = lm;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    switch (kind) {
      case 'building': {
        const w = lm.w || 70, h = lm.h || 50;
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(x - w / 2 + 5, y - h / 2 + 5, w, h);
        g.fillStyle = lm.color || '#78909c';
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.fillStyle = 'rgba(255,255,255,.75)';
        for (let fy = y - h / 2 + 7; fy < y + h / 2 - 8; fy += 11)
          for (let fx = x - w / 2 + 6; fx < x + w / 2 - 8; fx += 12)
            g.fillRect(fx, fy, 6, 6);
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(x - w / 2, y + h / 2 - 5, w, 5);
        break;
      }
      case 'market': {
        const w = lm.w || 80, h = lm.h || 40;
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(x - w / 2 + 4, y - h / 2 + 4, w, h);
        g.fillStyle = lm.color || '#8d6e63';
        g.fillRect(x - w / 2, y - h / 2 + 8, w, h - 8);
        // striped awning
        for (let i = 0; i < w; i += 12) {
          g.fillStyle = (i / 12) % 2 ? '#e8e4da' : '#c62828';
          g.fillRect(x - w / 2 + i, y - h / 2, Math.min(12, w - i), 10);
        }
        g.fillStyle = '#3c2c1c';
        g.fillRect(x - 8, y + h / 2 - 14, 16, 14);
        break;
      }
      case 'mosque': {
        g.fillStyle = '#c8a44a';                       // golden dome
        g.beginPath(); g.arc(x, y - 10, 22, Math.PI, 0); g.fill();
        g.fillRect(x - 26, y - 10, 52, 30);
        g.fillStyle = '#e8dcc0';
        g.fillRect(x - 26, y - 6, 52, 26);
        g.fillStyle = '#8a6d2f';
        g.fillRect(x - 5, y + 4, 10, 16);
        // minarets
        g.fillStyle = '#e8dcc0';
        g.fillRect(x - 40, y - 26, 8, 46);
        g.fillRect(x + 32, y - 26, 8, 46);
        g.fillStyle = '#c8a44a';
        g.fillRect(x - 42, y - 32, 12, 8);
        g.fillRect(x + 30, y - 32, 12, 8);
        break;
      }
      case 'pagoda': {
        g.fillStyle = '#8e1f1f';
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
      case 'merlion': {
        Sprites.draw(g, 'merlion', x, y, 4);
        break;
      }
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
        g.fillStyle = '#e8b13a';                        // dragon head
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
      case 'hdb': {
        // mini HDB slab block, pixel style
        const w = 48 + Math.floor(rng() * 3) * 8, h = 48 + Math.floor(rng() * 5) * 8;
        const col = ['#e8e4da', '#f0d8a8', '#c2d8a0', '#a8d0e0'][Math.floor(rng() * 4)];
        g.fillStyle = 'rgba(0,0,0,.22)';
        g.fillRect(x - w / 2 + 5, y - h + 6, w, h);
        g.fillStyle = col;
        g.fillRect(x - w / 2, y - h, w, h);
        g.fillStyle = '#4c5c66';
        for (let fy = y - h + 6; fy < y - 8; fy += 10)
          for (let fx = x - w / 2 + 5; fx < x + w / 2 - 6; fx += 10)
            g.fillRect(fx, fy, 5, 5);
        g.fillStyle = '#c53030';
        g.fillRect(x - w / 2, y - h - 5, w, 5);
        break;
      }
      case 'shophouse': {
        const w = 40;
        g.fillStyle = ['#e88a6a', '#6ab4a8', '#e8d87a'][Math.floor(rng() * 3)];
        g.fillRect(x - w / 2, y - 34, w, 34);
        g.fillStyle = '#8a5a2a';
        g.beginPath(); g.moveTo(x - w / 2 - 5, y - 34); g.lineTo(x, y - 50); g.lineTo(x + w / 2 + 5, y - 34); g.fill();
        g.fillStyle = '#4c3018'; g.fillRect(x - 6, y - 16, 12, 16);
        g.fillStyle = '#2c1c0c';
        g.fillRect(x - w / 2 + 5, y - 28, 8, 8); g.fillRect(x + w / 2 - 13, y - 28, 8, 8);
        break;
      }
      case 'trees':
        Sprites.draw(g, rng() < 0.6 ? 'tree' : 'bush', x, y, 3);
        break;
      case 'jungle':
        Sprites.draw(g, ['tree', 'tree', 'palm', 'bush'][Math.floor(rng() * 4)], x, y, 3 + Math.floor(rng() * 2));
        break;
      case 'coast':
        Sprites.draw(g, ['palm', 'palm', 'rock', 'bush'][Math.floor(rng() * 4)], x, y, 3);
        break;
    }
  },

  /* ---------- dynamic drawing ---------- */

  draw(ctx, game) {
    ctx.clearRect(0, 0, 960, 600);
    ctx.imageSmoothingEnabled = false;
    if (this.bg) ctx.drawImage(this.bg, 0, 0);

    // rally point marker
    if (game.rallyPickTower) {
      ctx.strokeStyle = 'rgba(255,235,59,.9)'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      const t = game.rallyPickTower;
      ctx.beginPath(); ctx.arc(t.x, t.y, TOWER_TYPES[t.type].levels[t.level].range, 0, 7);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // range circle for selected tower
    if (game.selected && game.selected.kind === 'tower') {
      const t = game.selected.tower;
      const r = TOWER_TYPES[t.type].levels[t.level].range;
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, 7); ctx.fill(); ctx.stroke();
    }

    // soldiers
    for (const s of game.soldiers) this.soldier(ctx, s);

    // enemies (ground first, flying on top)
    const sorted = [...game.enemies].sort((a, b) => (a.def.flying ? 1 : 0) - (b.def.flying ? 1 : 0));
    for (const e of sorted) this.enemy(ctx, e, game.time);

    // towers
    for (const t of game.towers) this.tower(ctx, t, game.time);

    // projectiles
    for (const p of game.projectiles) this.projectile(ctx, p);

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
    const sprite = { cell: 't_cell', durian: 't_durian', temple: 't_temple', camp: 't_camp' }[t.type];

    // shadow under sprite
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 12, 22, 9, 0, 0, 7); ctx.fill();

    Sprites.draw(ctx, sprite, t.x, t.y - 8, scale);

    // firing flash for cell tower
    if (t.type === 'cell' && t.cool < 0.1 && t.cool > 0) {
      ctx.fillStyle = 'rgba(160,220,255,.9)';
      ctx.fillRect(t.x - 3, t.y - 8 - 7 * scale, 6, 6);
    }
    // temple glow
    if (t.type === 'temple') {
      const glow = 0.25 + 0.15 * Math.sin(time * 3 + t.x);
      ctx.fillStyle = `rgba(255,213,79,${glow})`;
      ctx.beginPath(); ctx.arc(t.x, t.y - 8 - 5 * scale, 10, 0, 7); ctx.fill();
    }

    // level pips
    ctx.fillStyle = '#ffd54f';
    ctx.strokeStyle = '#5c4a10'; ctx.lineWidth = 1;
    for (let i = 0; i <= lv; i++) {
      ctx.fillRect(t.x - 10 + i * 8, t.y + 16, 5, 5);
      ctx.strokeRect(t.x - 10 + i * 8, t.y + 16, 5, 5);
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
        Sprites.draw(ctx, 'p_durian', p.x, p.y - p.arc, 2);
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
      // chunky pixel explosion
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
