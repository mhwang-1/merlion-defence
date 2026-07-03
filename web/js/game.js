/* ===== Core game simulation ===== */
'use strict';

const Game = {
  // static per-level
  levelIndex: 0, level: null, layout: null, paths: [], waves: [],

  // dynamic state
  running: false, over: false, won: false,
  time: 0, speed: 1, paused: false,
  gold: 0, lives: 0, maxLives: 0,
  waveIndex: -1, waveActive: false, autoWaveTimer: 0,
  spawnQueue: [],
  enemies: [], towers: [], soldiers: [], projectiles: [], effects: [],
  selected: null, rallyPickTower: null,
  idSeq: 0,

  /* ---------- setup ---------- */

  start(levelIndex) {
    const lv = LEVELS[levelIndex];
    this.levelIndex = levelIndex;
    this.level = lv;
    this.layout = LAYOUTS[lv.layout];
    this.paths = this.layout.paths.map(p => buildPath(p));
    this.waves = genWaves(levelIndex);

    this.running = true; this.over = false; this.won = false;
    this.time = 0; this.speed = 1; this.paused = false;
    this.gold = lv.gold + levelIndex * 12; // richer start on later levels
    this.lives = lv.lives; this.maxLives = lv.lives;
    this.waveIndex = -1; this.waveActive = false; this.autoWaveTimer = 0;
    this.spawnQueue = [];
    this.enemies = []; this.towers = []; this.soldiers = [];
    this.projectiles = []; this.effects = [];
    this.selected = null; this.rallyPickTower = null;

    Renderer.buildBackground(lv, this.layout, this.paths);
  },

  /* ---------- waves ---------- */

  canCallWave() {
    return this.running && !this.over && this.waveIndex < this.waves.length - 1;
  },

  callNextWave() {
    if (!this.canCallWave()) return;
    // early-call bonus
    if (this.waveActive || (this.waveIndex >= 0 && this.autoWaveTimer > 1)) {
      const bonus = Math.round(8 + this.autoWaveTimer * 1.5);
      this.gold += bonus;
      this.floatText(480, 60, `+${bonus} early bonus!`, '#ffe082');
      Sound.coin();
    }
    this.waveIndex++;
    this.waveActive = true;
    this.autoWaveTimer = 0;
    Sound.wave();
    UI.banner(this.waveIndex === this.waves.length - 1
      ? '☠ FINAL WAVE ☠'
      : `Wave ${this.waveIndex + 1}`);

    for (const grp of this.waves[this.waveIndex]) {
      for (let i = 0; i < grp.count; i++) {
        this.spawnQueue.push({
          at: this.time + grp.delay + i * grp.gap,
          type: grp.type, pathIndex: grp.pathIndex, hpMul: grp.hpMul,
        });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
  },

  spawnEnemy(type, pathIndex, hpMul) {
    const def = ENEMY_TYPES[type];
    const path = this.paths[pathIndex % this.paths.length];
    const hp = Math.round(def.hp * hpMul);
    const bounty = Math.round(def.bounty * (1 + (hpMul - 1) * 0.55));
    this.enemies.push({
      id: ++this.idSeq, type, def, path, bounty,
      d: -Math.random() * 12, x: path.points[0][0], y: path.points[0][1],
      hp, maxHp: hp, slowT: 0, seed: Math.random(),
      blockedBy: null,
    });
  },

  /* ---------- towers ---------- */

  spotAt(x, y) {
    for (let i = 0; i < this.layout.spots.length; i++) {
      const [sx, sy] = this.layout.spots[i];
      if (dist(x, y, sx, sy) < 30) return i;
    }
    return -1;
  },

  towerAtSpot(i) {
    return this.towers.find(t => t.spot === i) || null;
  },

  build(spotIdx, type) {
    const def = TOWER_TYPES[type];
    const cost = def.levels[0].cost;
    if (this.gold < cost || this.towerAtSpot(spotIdx)) return false;
    this.gold -= cost;
    const [x, y] = this.layout.spots[spotIdx];
    const t = { id: ++this.idSeq, type, level: 0, spot: spotIdx, x, y, cool: 0, rally: null };
    this.towers.push(t);
    if (def.barracks) this.setRally(t, this.nearestRoadPoint(x, y));
    Sound.build();
    this.poof(x, y);
    return true;
  },

  upgrade(t) {
    const def = TOWER_TYPES[t.type];
    if (t.level >= def.levels.length - 1) return false;
    const cost = def.levels[t.level + 1].cost;
    if (this.gold < cost) return false;
    this.gold -= cost;
    t.level++;
    if (def.barracks) this.refreshSoldiers(t);
    Sound.build();
    this.poof(t.x, t.y - 20);
    return true;
  },

  sell(t) {
    const refund = Math.round(towerTotalValue(t.type, t.level) * 0.6);
    this.gold += refund;
    this.towers = this.towers.filter(x => x !== t);
    this.soldiers = this.soldiers.filter(s => s.tower !== t);
    this.floatText(t.x, t.y - 20, `+${refund} 🪙`, '#ffe082');
    Sound.sell();
  },

  nearestRoadPoint(x, y) {
    let best = null, bd = Infinity;
    for (const path of this.paths) {
      for (let d = 0; d < path.total; d += 12) {
        const p = pointAt(path, d);
        const dd = dist(x, y, p.x, p.y);
        if (dd < bd) { bd = dd; best = { x: p.x, y: p.y }; }
      }
    }
    return best;
  },

  setRally(t, pt) {
    const def = TOWER_TYPES[t.type];
    const r = def.levels[t.level].range;
    // clamp rally within range
    const d = dist(t.x, t.y, pt.x, pt.y);
    if (d > r) { pt = { x: t.x + (pt.x - t.x) * r / d, y: t.y + (pt.y - t.y) * r / d }; }
    t.rally = pt;
    this.refreshSoldiers(t);
  },

  refreshSoldiers(t) {
    const lv = TOWER_TYPES[t.type].levels[t.level];
    this.soldiers = this.soldiers.filter(s => s.tower !== t);
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      this.soldiers.push({
        id: ++this.idSeq, tower: t,
        hx: t.rally.x + Math.cos(ang) * 16, hy: t.rally.y + Math.sin(ang) * 16,
        x: t.x, y: t.y,
        hp: lv.soldierHp, maxHp: lv.soldierHp,
        dead: false, respawnT: 0, target: null, cool: 0,
      });
    }
  },

  /* ---------- combat helpers ---------- */

  dealDamage(e, amount, dmgType) {
    const red = dmgType === 'magic' ? e.def.resist : e.def.armor;
    const dmg = Math.max(1, amount * (1 - red));
    e.hp -= dmg;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.gold += e.bounty;
      this.floatText(e.x, e.y - 14, `+${e.bounty}`, '#ffe082');
      this.poof(e.x, e.y);
      Sound.die();
    }
  },

  floatText(x, y, text, color) {
    this.effects.push({ kind: 'text', x, y, text, color, t: 0, dur: 1.1 });
  },
  poof(x, y) {
    this.effects.push({ kind: 'poof', x, y, t: 0, dur: 0.5 });
  },
  boom(x, y, r) {
    this.effects.push({ kind: 'boom', x, y, r, t: 0, dur: 0.35 });
  },

  /* ---------- main update ---------- */

  update(dt) {
    if (!this.running || this.paused || this.over) return;
    this.time += dt;

    // spawn queue
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
      const s = this.spawnQueue.shift();
      this.spawnEnemy(s.type, s.pathIndex, s.hpMul);
    }

    this.updateEnemies(dt);
    this.updateSoldiers(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);

    // effects
    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter(fx => fx.t < fx.dur);

    // wave end / auto-call
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      if (this.waveIndex >= this.waves.length - 1) return this.finish(true);
      this.autoWaveTimer = 18;
      this.floatText(480, 90, 'Wave cleared!', '#a5d6a7');
    }
    if (!this.waveActive && this.waveIndex >= 0 && this.autoWaveTimer > 0) {
      this.autoWaveTimer -= dt;
      if (this.autoWaveTimer <= 0) this.callNextWave();
    }
  },

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.slowT > 0) e.slowT -= dt;

      // blocked by soldier?
      if (e.blockedBy && (e.blockedBy.dead || dist(e.x, e.y, e.blockedBy.x, e.blockedBy.y) > 30)) {
        e.blockedBy = null;
      }
      if (e.blockedBy) {
        // fight the soldier
        e.atkCool = (e.atkCool || 0) - dt;
        if (e.atkCool <= 0) {
          e.atkCool = 1;
          const s = e.blockedBy;
          s.hp -= 8 + e.maxHp * 0.03;
          if (s.hp <= 0) { s.dead = true; s.respawnT = TOWER_TYPES[s.tower.type].levels[s.tower.level].respawn; e.blockedBy = null; this.poof(s.x, s.y); }
        }
        continue; // stand still while fighting
      }

      const slowMul = e.slowT > 0 ? e.slowFactor : 1;
      e.d += e.def.speed * slowMul * dt;
      const p = pointAt(e.path, Math.max(0, e.d));
      e.x = p.x; e.y = p.y;
      if (Math.abs(p.dx) > 0.1) e.vx = p.dx; // facing for sprite flip

      if (e.d >= e.path.total - 2) {
        e.dead = true; e.leaked = true;
        this.lives -= e.def.lives;
        Sound.leak();
        this.floatText(e.x, e.y - 10, `-${e.def.lives} ❤️`, '#ef9a9a');
        if (this.lives <= 0) { this.lives = 0; return this.finish(false); }
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);
  },

  updateSoldiers(dt) {
    for (const s of this.soldiers) {
      if (s.dead) {
        s.respawnT -= dt;
        if (s.respawnT <= 0) {
          const lv = TOWER_TYPES[s.tower.type].levels[s.tower.level];
          s.dead = false; s.hp = lv.soldierHp; s.maxHp = lv.soldierHp;
          s.x = s.tower.x; s.y = s.tower.y;
          this.poof(s.x, s.y);
        }
        continue;
      }
      // slow regen when idle
      if (!s.target && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + 6 * dt);

      // find enemy to engage near holding point
      if (!s.target || s.target.dead || s.target.blockedBy && s.target.blockedBy !== s) {
        s.target = null;
        let bd = 70;
        for (const e of this.enemies) {
          if (e.dead || e.def.flying) continue;
          if (e.blockedBy && e.blockedBy !== s) continue;
          const dd = dist(s.hx, s.hy, e.x, e.y);
          if (dd < bd) { bd = dd; s.target = e; }
        }
      }

      let tx = s.hx, ty = s.hy;
      if (s.target) { tx = s.target.x; ty = s.target.y; }
      const d = dist(s.x, s.y, tx, ty);
      if (d > (s.target ? 20 : 4)) {
        s.x += (tx - s.x) / d * 85 * dt;
        s.y += (ty - s.y) / d * 85 * dt;
      } else if (s.target) {
        // engage: block + attack
        s.target.blockedBy = s;
        s.cool -= dt;
        if (s.cool <= 0) {
          s.cool = 0.9;
          const lv = TOWER_TYPES[s.tower.type].levels[s.tower.level];
          this.dealDamage(s.target, lv.damage, 'physical');
        }
      }
    }
  },

  updateTowers(dt) {
    for (const t of this.towers) {
      const def = TOWER_TYPES[t.type];
      if (def.barracks) continue;
      const lv = def.levels[t.level];
      t.cool -= dt;
      if (t.cool > 0) continue;

      // pick target: furthest along path within range
      let best = null, bestD = -1;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (def.targets === 'ground' && e.def.flying) continue;
        if (dist(t.x, t.y, e.x, e.y) <= lv.range && e.d > bestD) { bestD = e.d; best = e; }
      }
      if (!best) continue;
      t.cool = 1 / lv.fireRate;
      this.fire(t, def, lv, best);
    }
  },

  fire(t, def, lv, target) {
    switch (t.type) {
      case 'cell':
        this.projectiles.push({
          kind: 'zap', sx: t.x, sy: t.y - 30, x: t.x, y: t.y - 30,
          target, speed: 900, damage: lv.damage, dmgType: 'physical', t: 0,
        });
        Sound.shoot();
        break;
      case 'durian':
        this.projectiles.push({
          kind: 'durian', sx: t.x, sy: t.y - 24, x: t.x, y: t.y - 24,
          tx: target.x + (target.def.speed * 0.35) * 0, ty: target.y,
          target, speed: 260, damage: lv.damage, dmgType: 'physical',
          splash: def.splash + t.level * 8, arc: 0, t: 0,
        });
        break;
      case 'temple':
        this.projectiles.push({
          kind: 'talisman', sx: t.x, sy: t.y - 30, x: t.x, y: t.y - 30,
          target, speed: 420, damage: lv.damage, dmgType: 'magic',
          slow: def.slow, t: 0,
        });
        Sound.magic();
        break;
    }
  },

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.t += dt;
      const tx = p.target && !p.target.dead ? p.target.x : (p.lx ?? p.x);
      const ty = p.target && !p.target.dead ? p.target.y - (p.target.def.flying ? 14 : 0) : (p.ly ?? p.y);
      p.lx = tx; p.ly = ty;
      const d = dist(p.x, p.y, tx, ty);
      const step = p.speed * dt;
      if (p.kind === 'durian') p.arc = Math.sin(clamp(p.t * 2.2, 0, Math.PI)) * 36;

      if (d <= step + 6) {
        p.hit = true;
        // impact
        if (p.kind === 'durian') {
          this.boom(tx, ty, p.splash);
          Sound.splash();
          for (const e of this.enemies) {
            if (e.dead || e.def.flying) continue;
            if (dist(tx, ty, e.x, e.y) <= p.splash) this.dealDamage(e, p.damage, 'physical');
          }
        } else if (p.target && !p.target.dead) {
          this.dealDamage(p.target, p.damage, p.dmgType);
          if (p.slow) { p.target.slowT = p.slow.dur; p.target.slowFactor = p.slow.factor; }
        }
      } else {
        p.x += (tx - p.x) / d * step;
        p.y += (ty - p.y) / d * step;
      }
      if (p.t > 4) p.hit = true; // safety
    }
    this.projectiles = this.projectiles.filter(p => !p.hit);
  },

  /* ---------- end ---------- */

  finish(won) {
    if (this.over) return;
    this.over = true; this.won = won; this.running = false;
    if (won) {
      const ratio = this.lives / this.maxLives;
      this.stars = ratio >= 0.9 ? 3 : ratio >= 0.55 ? 2 : 1;
      Progress.complete(this.levelIndex, this.stars);
      Sound.win();
    } else {
      this.stars = 0;
      Sound.lose();
    }
    UI.showEnd(won, this.stars);
  },
};

/* ---------- persistent progress ---------- */
const Progress = {
  KEY: 'merlion-defense-v1',
  data: { stars: {} },

  load() {
    try { this.data = JSON.parse(localStorage.getItem(this.KEY)) || { stars: {} }; }
    catch (e) { this.data = { stars: {} }; }
    if (!this.data.stars) this.data.stars = {};
  },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this.data)); },
  reset() { this.data = { stars: {} }; this.save(); },

  starsFor(i) { return this.data.stars[i] || 0; },
  totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + b, 0); },
  unlocked(i) {
    if (i === 0) return true;
    return this.starsFor(i - 1) > 0;
  },
  complete(i, stars) {
    if (stars > this.starsFor(i)) { this.data.stars[i] = stars; this.save(); }
  },
};
