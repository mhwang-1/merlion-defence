/* ===== Core game simulation ===== */
'use strict';

const Game = {
  // static per-level
  levelIndex: 0, level: null, layout: null, paths: [], waves: [],
  mode: 'campaign', allowedTowers: null,   // null = all towers

  // dynamic state
  running: false, over: false, won: false,
  time: 0, speed: 1, paused: false,
  gold: 0, lives: 0, maxLives: 0,
  waveIndex: -1, waveActive: false, autoWaveTimer: 0,
  spawnQueue: [],
  enemies: [], towers: [], soldiers: [], heroes: [], projectiles: [], effects: [],
  selected: null, rallyPickTower: null,
  idSeq: 0,

  /* ---------- setup ---------- */

  start(levelIndex, mode = 'campaign') {
    const lv = LEVELS[levelIndex];
    this.levelIndex = levelIndex;
    this.level = lv;
    this.mode = mode;
    this.layout = LAYOUTS[lv.layout];
    this.paths = this.layout.paths.map(p => buildPath(p));
    this.waves = genWaves(levelIndex, mode);
    this.allowedTowers = mode === 'iron' ? ironTowers(levelIndex) : null;

    this.running = true; this.over = false; this.won = false;
    this.time = 0; this.speed = 1; this.paused = false;
    this.meritsEarned = 0;
    // challenges: a little extra gold to compensate for one life / less bounty room
    this.gold = lv.gold + levelIndex * 12 + (mode === 'iron' ? 220 : mode === 'heroic' ? 120 : 0);
    this.lives = mode === 'campaign' ? lv.lives : 1;
    this.maxLives = this.lives;
    this.waveIndex = -1; this.waveActive = false; this.autoWaveTimer = 0;
    this.spawnQueue = [];
    this.enemies = []; this.towers = []; this.soldiers = [];
    this.projectiles = []; this.effects = [];
    this.selected = null; this.rallyPickTower = null;

    this.spawnHeroes();

    Renderer.buildBackground(lv, this.layout, this.paths);
  },

  /* ---------- heroes ---------- */

  spawnHeroes() {
    this.heroes = [];
    const slots = heroSlots(this.levelIndex);
    const picks = (Progress.data.loadout || ['utama'])
      .filter(k => HERO_TYPES[k] && Progress.heroUnlocked(k))
      .slice(0, slots);
    if (!picks.length) picks.push('utama');
    const path = this.paths[0];
    picks.forEach((key, i) => {
      const def = HERO_TYPES[key];
      const p = pointAt(path, Math.max(0, path.total - 130 - i * 60));
      const hx = clamp(p.x - p.dy * 34, 24, 936), hy = clamp(p.y + p.dx * 34, 24, 576);
      this.heroes.push({
        id: ++this.idSeq, key, def, isHero: true,
        x: hx, y: hy, hx, hy,
        hp: def.hp, maxHp: def.hp,
        dead: false, respawnT: 0, target: null, cool: 0,
      });
    });
  },

  heroAt(x, y) {
    for (const h of this.heroes)
      if (!h.dead && dist(x, y, h.x, h.y) < 22) return h;
    return null;
  },

  orderHero(h, x, y) {
    h.hx = clamp(x, 16, 944); h.hy = clamp(y, 16, 584);
    h.target = null;
    for (const e of this.enemies) if (e.blockedBy === h) e.blockedBy = null;
    this.floatText(h.hx, h.hy - 12, '⚑', '#a5d6a7');
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

  towerAllowed(type) {
    // Iron mode dictates its own tower set; otherwise the Armory unlock gates it
    if (this.allowedTowers) return this.allowedTowers.includes(type);
    return Progress.towerUnlocked(type);
  },

  build(spotIdx, type) {
    const def = TOWER_TYPES[type];
    const cost = def.levels[0].cost;
    if (!this.towerAllowed(type)) return false;
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

  dealDamage(e, amount, dmgType, pierce, raw) {
    const red = pierce ? 0 : (dmgType === 'magic' ? e.def.resist : e.def.armor);
    const dmg = raw ? amount * (1 - red) : Math.max(1, amount * (1 - red));
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
    this.updateHeroes(dt);
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
      if (e.burnT > 0) {           // wok hei afterburn (true damage over time)
        e.burnT -= dt;
        this.dealDamage(e, e.burnDps * dt, 'physical', true, true);
        if (e.dead) continue;
      }
      if (e.stunT > 0) { e.stunT -= dt; continue; }

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
          let dmg = 8 + e.maxHp * 0.03;
          if (s.isHero && s.def.special.evade && Math.random() < s.def.special.evade) dmg = 0;
          s.hp -= dmg;
          if (s.hp <= 0) {
            s.dead = true;
            s.respawnT = s.isHero ? HERO_RESPAWN
              : TOWER_TYPES[s.tower.type].levels[s.tower.level].respawn;
            for (const e2 of this.enemies) if (e2.blockedBy === s) e2.blockedBy = null;
            this.poof(s.x, s.y);
            if (s.isHero) this.floatText(s.x, s.y - 14, `${s.def.emoji} down!`, '#ef9a9a');
          }
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

  updateHeroes(dt) {
    for (const h of this.heroes) {
      const sp = h.def.special || {};
      if (h.dead) {
        h.respawnT -= dt;
        if (h.respawnT <= 0) {
          h.dead = false; h.hp = h.maxHp;
          h.x = h.hx; h.y = h.hy; h.target = null;
          this.poof(h.x, h.y);
          this.floatText(h.x, h.y - 16, `${h.def.emoji} returns!`, '#a5d6a7');
        }
        continue;
      }
      // regen
      if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.def.regen * dt * (h.target ? 0.25 : 1));
      // healing aura
      if (sp.heal) {
        for (const s of this.soldiers)
          if (!s.dead && s.hp < s.maxHp && dist(h.x, h.y, s.x, s.y) < sp.heal.r)
            s.hp = Math.min(s.maxHp, s.hp + sp.heal.rate * dt);
        for (const o of this.heroes)
          if (o !== h && !o.dead && o.hp < o.maxHp && dist(h.x, h.y, o.x, o.y) < sp.heal.r)
            o.hp = Math.min(o.maxHp, o.hp + sp.heal.rate * dt);
      }

      if (h.def.kind === 'melee') this.updateMeleeHero(h, sp, dt);
      else this.updateRangedHero(h, sp, dt);
    }
  },

  updateMeleeHero(h, sp, dt) {
    const maxBlock = sp.block || 1;
    // drop invalid target
    if (h.target && (h.target.dead || (h.target.blockedBy && h.target.blockedBy !== h))) h.target = null;
    // acquire target near hold point
    if (!h.target) {
      let bd = 95;
      for (const e of this.enemies) {
        if (e.dead || e.def.flying) continue;
        if (e.blockedBy && e.blockedBy !== h) continue;
        const dd = dist(h.hx, h.hy, e.x, e.y);
        if (dd < bd) { bd = dd; h.target = e; }
      }
    }
    let tx = h.hx, ty = h.hy;
    if (h.target) { tx = h.target.x; ty = h.target.y; }
    const d = dist(h.x, h.y, tx, ty);
    if (d > (h.target ? 20 : 4)) {
      h.x += (tx - h.x) / d * h.def.speed * dt;
      h.y += (ty - h.y) / d * h.def.speed * dt;
    } else if (h.target) {
      // block up to maxBlock enemies standing here
      let blocked = 0;
      for (const e of this.enemies) {
        if (blocked >= maxBlock) break;
        if (e.dead || e.def.flying) continue;
        if (e.blockedBy && e.blockedBy !== h) continue;
        if (dist(h.x, h.y, e.x, e.y) < 28) { e.blockedBy = h; blocked++; }
      }
      h.cool -= dt;
      if (h.cool <= 0) {
        h.cool = 1 / h.def.atkRate;
        let dmg = h.def.damage;
        if (sp.crit && Math.random() < sp.crit.chance) {
          dmg *= sp.crit.mul;
          this.floatText(h.target.x, h.target.y - 18, 'CRIT!', '#ffab40');
        }
        this.dealDamage(h.target, dmg, h.def.dmgType);
        if (sp.stun && Math.random() < sp.stun.chance) {
          h.target.stunT = sp.stun.dur;
          this.floatText(h.target.x, h.target.y - 18, '✵', '#fff59d');
        }
        if (sp.aoe) {
          for (const e of this.enemies) {
            if (e === h.target || e.dead || e.def.flying) continue;
            if (dist(h.target.x, h.target.y, e.x, e.y) <= sp.aoe)
              this.dealDamage(e, h.def.damage * 0.6, h.def.dmgType);
          }
        }
      }
    }
  },

  updateRangedHero(h, sp, dt) {
    // walk to hold point
    const d = dist(h.x, h.y, h.hx, h.hy);
    if (d > 4) {
      h.x += (h.hx - h.x) / d * h.def.speed * dt;
      h.y += (h.hy - h.y) / d * h.def.speed * dt;
      return;
    }
    h.cool -= dt;
    if (h.cool > 0) return;
    let best = null, bestD = -1;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (dist(h.x, h.y, e.x, e.y) <= h.def.range && e.d > bestD) { bestD = e.d; best = e; }
    }
    if (!best) return;
    h.cool = 1 / h.def.atkRate;
    this.projectiles.push({
      kind: 'hero', sx: h.x, sy: h.y - 14, x: h.x, y: h.y - 14,
      target: best, speed: 480, damage: h.def.damage, dmgType: h.def.dmgType,
      splash: sp.splash || 0, slow: sp.slow || null, pierce: !!sp.pierce, t: 0,
      magic: h.def.dmgType === 'magic',
    });
    if (h.def.dmgType === 'magic') Sound.magic(); else Sound.shoot();
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
      case 'mata':
        this.projectiles.push({
          kind: 'snipe', sx: t.x, sy: t.y - 34, x: t.x, y: t.y - 34,
          target, speed: 1300, damage: lv.damage, dmgType: 'physical',
          pierce: true, t: 0,
        });
        Sound.shoot();
        break;
      case 'wok':
        this.projectiles.push({
          kind: 'wokfire', sx: t.x, sy: t.y - 26, x: t.x, y: t.y - 26,
          target, speed: 320, damage: lv.damage, dmgType: 'physical',
          splash: def.splash + t.level * 6,
          burn: { dps: lv.burnDps, dur: def.burnDur }, arc: 0, t: 0,
        });
        break;
      case 'power':
        this.projectiles.push({
          kind: 'chain', sx: t.x, sy: t.y - 32, x: t.x, y: t.y - 32,
          target, speed: 760, damage: lv.damage, dmgType: 'magic',
          chain: lv.chain, t: 0,
        });
        Sound.magic();
        break;
      case 'ice': {
        // frost pulse: chills EVERYTHING in range (no projectile)
        this.effects.push({ kind: 'freeze', x: t.x, y: t.y, r: lv.range, t: 0, dur: 0.45 });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (dist(t.x, t.y, e.x, e.y) <= lv.range) {
            this.dealDamage(e, lv.damage, 'magic');
            if (!e.dead) { e.slowT = def.slow.dur; e.slowFactor = lv.slowFactor; }
          }
        }
        Sound.magic();
        break;
      }
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
        if (p.kind === 'durian' || p.kind === 'wokfire') {
          this.boom(tx, ty, p.splash);
          Sound.splash();
          for (const e of this.enemies) {
            if (e.dead || e.def.flying) continue;
            if (dist(tx, ty, e.x, e.y) <= p.splash) {
              this.dealDamage(e, p.damage, 'physical');
              if (p.burn && !e.dead) { e.burnT = p.burn.dur; e.burnDps = p.burn.dps; }
            }
          }
        } else if (p.kind === 'chain') {
          // strike the target, then arc to nearby spirits
          if (p.target && !p.target.dead) this.dealDamage(p.target, p.damage, 'magic');
          let from = p.target, dmg = p.damage * 0.7;
          const struck = new Set([p.target]);
          for (let j = 0; j < p.chain && from; j++) {
            let best = null, bd = 95;
            for (const e of this.enemies) {
              if (e.dead || struck.has(e)) continue;
              const dd = dist(from.x, from.y, e.x, e.y);
              if (dd < bd) { bd = dd; best = e; }
            }
            if (!best) break;
            this.effects.push({
              kind: 'arc', x: from.x, y: from.y - 8, x2: best.x, y2: best.y - 8,
              j: (Math.random() - 0.5) * 18, t: 0, dur: 0.22,
            });
            this.dealDamage(best, dmg, 'magic');
            struck.add(best);
            from = best; dmg *= 0.75;
          }
        } else if (p.kind === 'hero' && p.splash) {
          this.boom(tx, ty, p.splash);
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (dist(tx, ty, e.x, e.y) <= p.splash) {
              this.dealDamage(e, p.damage, p.dmgType, p.pierce);
              if (p.slow) { e.slowT = p.slow.dur; e.slowFactor = p.slow.factor; }
            }
          }
        } else if (p.target && !p.target.dead) {
          this.dealDamage(p.target, p.damage, p.dmgType, p.pierce);
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
      if (this.mode === 'campaign') {
        const ratio = this.lives / this.maxLives;
        this.stars = ratio >= 0.9 ? 3 : ratio >= 0.55 ? 2 : 1;
        this.meritsEarned = Progress.complete(this.levelIndex, this.stars);
      } else {
        this.stars = 1; // challenge medal
        this.meritsEarned = Progress.completeChallenge(this.levelIndex, this.mode);
      }
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
  data: {
    stars: {}, heroic: {}, iron: {}, merits: 0,
    heroes: { utama: true }, towersU: { cell: true, camp: true }, loadout: ['utama'],
  },

  defaults() {
    return {
      stars: {}, heroic: {}, iron: {},
      merits: 0,
      heroes: { utama: true },          // unlocked heroes
      towersU: { cell: true, camp: true }, // unlocked towers
      loadout: ['utama'],               // equipped heroes (max 2)
    };
  },

  load() {
    try { this.data = JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch (e) { this.data = {}; }
    this.normalize();
  },
  normalize() {
    const d = this.defaults();
    for (const k of Object.keys(d))
      if (this.data[k] === undefined) this.data[k] = d[k];
    this.data.heroes.utama = true;
    this.data.towersU.cell = true;
    this.data.towersU.camp = true;
    if (!this.data.loadout.length) this.data.loadout = ['utama'];
  },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this.data)); },
  reset() { this.data = this.defaults(); this.save(); },

  /* ---- save export / import (survives cleared browser storage) ---- */
  exportJSON() {
    return JSON.stringify({ game: 'merlion-defense', version: 1, saved: new Date().toISOString(), data: this.data }, null, 2);
  },
  importJSON(text) {
    const obj = JSON.parse(text);
    const d = obj && obj.game === 'merlion-defense' ? obj.data : obj;
    if (!d || typeof d !== 'object' || !d.stars) throw new Error('not a Merlion Defense save');
    this.data = d;
    this.normalize();
    this.save();
  },

  /* ---- merit points (spend in the Armory on towers & heroes) ---- */
  merits() { return this.data.merits || 0; },
  addMerits(n) { this.data.merits = this.merits() + n; this.save(); },
  heroUnlocked(k) { return !!this.data.heroes[k]; },
  towerUnlocked(k) { return !!this.data.towersU[k]; },
  unlockHero(k) {
    const def = HERO_TYPES[k];
    if (!def || this.heroUnlocked(k) || this.merits() < def.cost) return false;
    this.data.merits -= def.cost;
    this.data.heroes[k] = true;
    if (this.data.loadout.length < 2) this.data.loadout.push(k);
    this.save();
    return true;
  },
  unlockTower(k) {
    const cost = TOWER_MERIT_COST[k];
    if (cost === undefined || this.towerUnlocked(k) || this.merits() < cost) return false;
    this.data.merits -= cost;
    this.data.towersU[k] = true;
    this.save();
    return true;
  },
  toggleLoadout(k) {
    if (!this.heroUnlocked(k)) return;
    const i = this.data.loadout.indexOf(k);
    if (i >= 0) { if (this.data.loadout.length > 1) this.data.loadout.splice(i, 1); }
    else { this.data.loadout.push(k); if (this.data.loadout.length > 2) this.data.loadout.shift(); }
    this.save();
  },

  starsFor(i) { return this.data.stars[i] || 0; },
  heroicDone(i) { return !!this.data.heroic[i]; },
  ironDone(i) { return !!this.data.iron[i]; },
  /* total = campaign stars + 1 per completed challenge (KR-style 5 per level) */
  totalStars() {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0) +
      Object.keys(this.data.heroic).length + Object.keys(this.data.iron).length;
  },
  maxStars() { return LEVELS.length * 5; },
  unlocked(i) {
    if (i === 0) return true;
    return this.starsFor(i - 1) > 0;
  },
  /* challenges unlock after a 3-star campaign clear (like Kingdom Rush) */
  challengesUnlocked(i) { return this.starsFor(i) >= 3; },
  /* returns merits earned this clear */
  complete(i, stars) {
    let merits = 0;
    if (this.starsFor(i) === 0) merits += 20;              // first clear bonus
    const delta = stars - this.starsFor(i);
    if (delta > 0) { merits += delta * 10; this.data.stars[i] = stars; }
    if (merits) this.data.merits = this.merits() + merits;
    this.save();
    return merits;
  },
  completeChallenge(i, mode) {
    const key = mode === 'heroic' ? 'heroic' : 'iron';
    let merits = 0;
    if (!this.data[key][i]) { merits = 25; this.data.merits = this.merits() + merits; }
    this.data[key][i] = true;
    this.save();
    return merits;
  },
};

/* Armory prices for the locked towers (cell & camp are free) */
const TOWER_MERIT_COST = { durian: 15, temple: 20, wok: 25, ice: 30, mata: 35, power: 40 };
