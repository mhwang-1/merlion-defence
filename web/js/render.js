/* ===== Canvas renderer: cartoon Singapore scenery ===== */
'use strict';

const THEMES = {
  town:   { grass: '#7cb342', grass2: '#689f38', road: '#9e9e9e', roadEdge: '#757575', deco: 'hdb' },
  park:   { grass: '#8bc34a', grass2: '#7cb342', road: '#bcaaa4', roadEdge: '#8d6e63', deco: 'trees' },
  forest: { grass: '#558b2f', grass2: '#33691e', road: '#a1887f', roadEdge: '#6d4c41', deco: 'jungle' },
  coast:  { grass: '#9ccc65', grass2: '#8bc34a', road: '#e0cda8', roadEdge: '#c0a97e', deco: 'coast' },
  river:  { grass: '#7cb342', grass2: '#689f38', road: '#9e9e9e', roadEdge: '#757575', deco: 'shophouse' },
};

const Renderer = {
  bg: null, // cached background canvas

  /** Pre-render static background for a level. */
  buildBackground(level, layout, paths) {
    const theme = THEMES[level.theme] || THEMES.town;
    const c = document.createElement('canvas');
    c.width = 960; c.height = 600;
    const g = c.getContext('2d');
    const rng = makeRng(4242 + LEVELS.indexOf(level) * 101);

    // grass base + patches
    g.fillStyle = theme.grass;
    g.fillRect(0, 0, 960, 600);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rng() < 0.5 ? theme.grass2 : 'rgba(255,255,255,0.05)';
      const x = rng() * 960, y = rng() * 600, r = 8 + rng() * 26;
      g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, 7); g.fill();
    }

    // water strips
    if (layout.water) {
      for (const [x, y, w, h] of layout.water) {
        const grad = g.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, '#4fc3f7'); grad.addColorStop(1, '#0288d1');
        g.fillStyle = grad;
        g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(255,255,255,.35)';
        g.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const wx = x + rng() * w, wy = y + 8 + rng() * (h - 14);
          g.beginPath(); g.moveTo(wx, wy);
          g.quadraticCurveTo(wx + 12, wy - 4, wx + 24, wy); g.stroke();
        }
      }
    }

    // roads
    for (const path of paths) {
      this.strokePath(g, path.points, 46, theme.roadEdge);
      this.strokePath(g, path.points, 38, theme.road);
      // dashed centre line
      g.save();
      g.setLineDash([14, 12]);
      this.strokePath(g, path.points, 3, 'rgba(255,255,255,.55)');
      g.restore();
    }

    // entrance / exit markers
    for (const path of paths) {
      const p0 = path.points[0], pn = path.points[path.points.length - 1];
      this.portal(g, p0[0], p0[1], '#7b1fa2');       // spooky entrance
      this.mrtExit(g, pn[0], pn[1]);                 // MRT exit
    }

    // build pads
    for (const [x, y] of layout.spots) {
      g.fillStyle = '#b0bec5';
      g.strokeStyle = '#78909c'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y + 4, 26, 15, 0, 0, 7); g.fill();
      g.fillStyle = '#cfd8dc';
      g.beginPath(); g.ellipse(x, y, 26, 15, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#90a4ae';
      g.font = '13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🔨', x, y + 1);
    }

    // scenery decorations away from roads/pads
    const decos = { hdb: 9, trees: 14, jungle: 16, coast: 10, shophouse: 9 }[theme.deco];
    let placed = 0, tries = 0;
    while (placed < decos && tries < 400) {
      tries++;
      const x = 30 + rng() * 900, y = 40 + rng() * 520;
      let ok = true;
      for (const path of paths) if (distToPath(path, x, y) < 62) { ok = false; break; }
      if (ok) for (const [sx, sy] of layout.spots) if (dist(x, y, sx, sy) < 58) { ok = false; break; }
      if (ok && layout.water) for (const [wx, wy, ww, wh] of layout.water)
        if (x > wx - 20 && x < wx + ww + 20 && y > wy - 40 && y < wy + wh + 20) { ok = false; break; }
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

  portal(g, x, y, color) {
    x = clamp(x, 18, 942); y = clamp(y, 18, 582);
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill();
    g.fillStyle = '#4a148c';
    g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill();
    g.font = '16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('🌀', x, y);
  },

  mrtExit(g, x, y) {
    x = clamp(x, 26, 934); y = clamp(y, 26, 574);
    g.fillStyle = '#d32f2f';
    g.fillRect(x - 26, y - 22, 52, 40);
    g.fillStyle = '#fff';
    g.fillRect(x - 22, y - 18, 44, 20);
    g.fillStyle = '#d32f2f';
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MRT', x, y - 8);
    g.fillStyle = '#fff';
    g.font = '11px sans-serif';
    g.fillText('EXIT', x, y + 9);
  },

  deco(g, kind, x, y, rng) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    switch (kind) {
      case 'hdb': {
        // mini HDB block
        const w = 46 + rng() * 20, h = 46 + rng() * 34;
        const col = ['#eceff1', '#ffe0b2', '#c5e1a5', '#b3e5fc'][Math.floor(rng() * 4)];
        g.fillStyle = 'rgba(0,0,0,.18)';
        g.fillRect(x - w / 2 + 4, y - h + 6, w, h);
        g.fillStyle = col;
        g.fillRect(x - w / 2, y - h, w, h);
        g.fillStyle = '#546e7a';
        for (let fy = y - h + 6; fy < y - 8; fy += 10)
          for (let fx = x - w / 2 + 5; fx < x + w / 2 - 6; fx += 10)
            g.fillRect(fx, fy, 5, 5);
        g.fillStyle = '#ef5350';
        g.fillRect(x - w / 2, y - h - 5, w, 5);
        break;
      }
      case 'shophouse': {
        const w = 40;
        g.fillStyle = ['#ffab91', '#80cbc4', '#fff59d'][Math.floor(rng() * 3)];
        g.fillRect(x - w / 2, y - 34, w, 34);
        g.fillStyle = '#8d6e63';
        g.beginPath(); g.moveTo(x - w / 2 - 5, y - 34); g.lineTo(x, y - 50); g.lineTo(x + w / 2 + 5, y - 34); g.fill();
        g.fillStyle = '#5d4037'; g.fillRect(x - 6, y - 16, 12, 16);
        break;
      }
      case 'trees':
        g.font = `${22 + rng() * 12}px sans-serif`;
        g.fillText(rng() < 0.6 ? '🌳' : '🌴', x, y);
        break;
      case 'jungle':
        g.font = `${24 + rng() * 16}px sans-serif`;
        g.fillText(['🌴', '🌳', '🌿', '🎋'][Math.floor(rng() * 4)], x, y);
        break;
      case 'coast':
        g.font = `${22 + rng() * 12}px sans-serif`;
        g.fillText(['🌴', '⛱', '🛶', '🐚'][Math.floor(rng() * 4)], x, y);
        break;
    }
  },

  /* ---------- dynamic drawing ---------- */

  draw(ctx, game) {
    ctx.clearRect(0, 0, 960, 600);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);

    // rally point marker
    if (game.rallyPickTower) {
      ctx.strokeStyle = 'rgba(255,235,59,.9)'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      const t = game.rallyPickTower;
      ctx.beginPath(); ctx.arc(t.x, t.y, TOWER_TYPES[t.type].levels[t.level].range, 0, 7);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // range circle for selected tower / build spot
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

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.def.size * 0.75, e.def.size * 0.8, e.def.size * 0.32, 0, 0, 7);
    ctx.fill();

    // body
    ctx.font = `${e.def.size * 2}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (e.slowT > 0) { ctx.save(); ctx.filter = 'hue-rotate(150deg) saturate(2)'; }
    ctx.fillText(e.def.emoji, e.x, y);
    if (e.slowT > 0) ctx.restore();

    // boss aura
    if (e.def.boss) {
      ctx.strokeStyle = `rgba(255,64,64,${0.4 + 0.25 * Math.sin(time * 4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, y, e.def.size + 8, 0, 7); ctx.stroke();
    }

    // hp bar
    if (e.hp < e.maxHp) {
      const w = e.def.size * 2.2;
      ctx.fillStyle = '#37474f';
      ctx.fillRect(e.x - w / 2, y - e.def.size - 10, w, 5);
      ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#66bb6a' : e.hp / e.maxHp > 0.25 ? '#ffca28' : '#ef5350';
      ctx.fillRect(e.x - w / 2, y - e.def.size - 10, w * (e.hp / e.maxHp), 5);
    }
  },

  tower(ctx, t, time) {
    const def = TOWER_TYPES[t.type];
    const lv = t.level;
    // base
    ctx.fillStyle = '#78909c';
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 8, 24, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 4, 24, 13, 0, 0, 7); ctx.fill();

    // structure grows with level
    const h = 18 + lv * 7;
    switch (t.type) {
      case 'cell': {
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(t.x - 4, t.y - h, 8, h + 4);
        ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(t.x - 12, t.y - h + 4); ctx.lineTo(t.x, t.y - h - 10); ctx.lineTo(t.x + 12, t.y - h + 4); ctx.stroke();
        ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('📡', t.x, t.y - h - 6);
        if (t.cool < 0.1) { // firing flash
          ctx.fillStyle = 'rgba(129,212,250,.8)';
          ctx.beginPath(); ctx.arc(t.x, t.y - h - 8, 5, 0, 7); ctx.fill();
        }
        break;
      }
      case 'durian': {
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(t.x - 10, t.y - h + 6, 20, h - 2);
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(t.x - 13, t.y - h + 2, 26, 6);
        ctx.font = `${20 + lv * 3}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('🍈', t.x, t.y - h - 4);
        break;
      }
      case 'temple': {
        ctx.fillStyle = '#c62828';
        ctx.fillRect(t.x - 11, t.y - h + 8, 22, h - 4);
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(t.x - 15, t.y - h + 3, 30, 6);
        ctx.font = `${20 + lv * 3}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('⛩', t.x, t.y - h - 4);
        const glow = 0.3 + 0.2 * Math.sin(time * 3 + t.x);
        ctx.fillStyle = `rgba(255,213,79,${glow})`;
        ctx.beginPath(); ctx.arc(t.x, t.y - h - 4, 14, 0, 7); ctx.fill();
        break;
      }
      case 'camp': {
        ctx.fillStyle = '#33691e';
        ctx.fillRect(t.x - 14, t.y - 16, 28, 20);
        ctx.fillStyle = '#558b2f';
        ctx.beginPath(); ctx.moveTo(t.x - 17, t.y - 16); ctx.lineTo(t.x, t.y - 30 - lv * 3); ctx.lineTo(t.x + 17, t.y - 16); ctx.fill();
        ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🎖', t.x, t.y - 6);
        break;
      }
    }
    // level pips
    ctx.fillStyle = '#ffd54f';
    for (let i = 0; i <= lv; i++) {
      ctx.beginPath(); ctx.arc(t.x - 8 + i * 8, t.y + 16, 3, 0, 7); ctx.fill();
    }
  },

  soldier(ctx, s) {
    if (s.dead) return;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y + 8, 8, 3.5, 0, 0, 7); ctx.fill();
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💂', s.x, s.y - 2);
    if (s.hp < s.maxHp) {
      ctx.fillStyle = '#37474f'; ctx.fillRect(s.x - 10, s.y - 16, 20, 3);
      ctx.fillStyle = '#66bb6a'; ctx.fillRect(s.x - 10, s.y - 16, 20 * (s.hp / s.maxHp), 3);
    }
  },

  projectile(ctx, p) {
    switch (p.kind) {
      case 'zap':
        ctx.strokeStyle = 'rgba(129,212,250,.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#e1f5fe';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill();
        break;
      case 'durian': {
        ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🍈', p.x, p.y - p.arc);
        break;
      }
      case 'talisman':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.t * 12);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(-4, -7, 8, 14);
        ctx.fillStyle = '#d32f2f';
        ctx.fillRect(-3, -5, 6, 4);
        ctx.restore();
        break;
    }
  },

  effect(ctx, fx) {
    const a = 1 - fx.t / fx.dur;
    if (fx.kind === 'boom') {
      ctx.fillStyle = `rgba(255,${160 + 60 * a},60,${a * 0.7})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1 - a * 0.5), 0, 7); ctx.fill();
    } else if (fx.kind === 'text') {
      ctx.globalAlpha = a;
      ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = fx.color || '#ffe082';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      ctx.strokeText(fx.text, fx.x, fx.y - fx.t * 26);
      ctx.fillText(fx.text, fx.x, fx.y - fx.t * 26);
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'poof') {
      ctx.globalAlpha = a * 0.8;
      ctx.font = `${16 + fx.t * 22}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💨', fx.x, fx.y - fx.t * 18);
      ctx.globalAlpha = 1;
    }
  },
};
