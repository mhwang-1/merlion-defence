/* ===== DOM UI: screens, popups, HUD ===== */
'use strict';

const $ = id => document.getElementById(id);

const UI = {
  canvas: null, ctx: null,

  init() {
    this.canvas = $('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // menu
    $('btn-play').onclick = () => { Sound.ensure(); this.show('levels'); this.renderLevels(); };
    $('btn-help').onclick = () => this.show('help');
    $('btn-help-back').onclick = () => this.show('menu');
    $('btn-reset').onclick = () => {
      if (confirm('Reset all level progress?')) { Progress.reset(); }
    };
    $('btn-levels-back').onclick = () => this.show('menu');

    // hud
    $('btn-next-wave').onclick = () => Game.callNextWave();
    $('btn-pause').onclick = () => this.togglePause(true);
    $('btn-resume').onclick = () => this.togglePause(false);
    $('btn-speed').onclick = () => {
      Game.speed = Game.speed === 1 ? 2 : Game.speed === 2 ? 3 : 1;
      $('btn-speed').textContent = Game.speed + '×';
    };
    $('btn-mute').onclick = () => {
      Sound.muted = !Sound.muted;
      $('btn-mute').textContent = Sound.muted ? '🔇' : '🔊';
    };
    $('btn-quit').onclick = () => { this.show('levels'); this.renderLevels(); Game.running = false; };

    $('btn-pause-retry').onclick = () => { this.togglePause(false); this.startLevel(Game.levelIndex); };
    $('btn-pause-map').onclick = () => { this.togglePause(false); Game.running = false; this.show('levels'); this.renderLevels(); };

    $('btn-end-retry').onclick = () => { $('end-overlay').classList.add('hidden'); this.startLevel(Game.levelIndex); };
    $('btn-end-map').onclick = () => { $('end-overlay').classList.add('hidden'); this.show('levels'); this.renderLevels(); };
    $('btn-end-next').onclick = () => {
      $('end-overlay').classList.add('hidden');
      const next = Game.levelIndex + 1;
      if (next < LEVELS.length && Progress.unlocked(next)) this.startLevel(next);
      else { this.show('levels'); this.renderLevels(); }
    };

    // canvas interaction
    this.canvas.addEventListener('pointerdown', e => this.onCanvasTap(e));

    // keyboard
    window.addEventListener('keydown', e => {
      if (!Game.running && !Game.paused) return;
      if (e.key === ' ') { e.preventDefault(); Game.callNextWave(); }
      if (e.key === 'p' || e.key === 'Escape') this.togglePause(!Game.paused);
      if (e.key === 'f') $('btn-speed').click();
    });
  },

  show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name).classList.add('active');
  },

  /* ---------- level select ---------- */

  renderLevels() {
    $('total-stars').textContent = `★ ${Progress.totalStars()} / ${LEVELS.length * 3}`;
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const unlocked = Progress.unlocked(i);
      const stars = Progress.starsFor(i);
      const card = document.createElement('div');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="lv-num">LEVEL ${i + 1}</div>
        <div class="lv-name">${unlocked ? lv.name : '🔒 ' + lv.name}</div>
        <div class="lv-stars">${'★'.repeat(stars)}<span style="color:#45586a">${'★'.repeat(3 - stars)}</span></div>
        <div class="lv-diff diff-${lv.diff}">${lv.diff.toUpperCase()}</div>`;
      if (unlocked) card.onclick = () => this.startLevel(i);
      grid.appendChild(card);
    });
  },

  startLevel(i) {
    Sound.ensure();
    this.hidePopups();
    $('end-overlay').classList.add('hidden');
    $('pause-overlay').classList.add('hidden');
    Game.start(i);
    $('btn-speed').textContent = '1×';
    this.show('game');
    this.banner(`${LEVELS[i].name}`);
  },

  /* ---------- canvas taps ---------- */

  canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (960 / r.width),
      y: (e.clientY - r.top) * (600 / r.height),
    };
  },

  onCanvasTap(e) {
    if (!Game.running || Game.paused) return;
    const { x, y } = this.canvasPos(e);

    // placing a rally point?
    if (Game.rallyPickTower) {
      const t = Game.rallyPickTower;
      Game.setRally(t, Game.nearestRoadPoint(x, y));
      Game.rallyPickTower = null;
      this.hidePopups();
      return;
    }

    const spot = Game.spotAt(x, y);
    if (spot >= 0) {
      const t = Game.towerAtSpot(spot);
      if (t) { Game.selected = { kind: 'tower', tower: t }; this.showTowerMenu(t); }
      else { Game.selected = { kind: 'spot', spot }; this.showBuildMenu(spot); }
      return;
    }
    Game.selected = null;
    this.hidePopups();
  },

  /* ---------- popups ---------- */

  hidePopups() {
    $('build-menu').classList.add('hidden');
    $('tower-menu').classList.add('hidden');
  },

  placePopup(el, x, y) {
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width / 960, sy = r.height / 600;
    el.classList.remove('hidden');
    const w = el.offsetWidth, h = el.offsetHeight;
    let px = x * sx - w / 2;
    let py = y * sy - h - 46 * sy;
    px = clamp(px, 4, r.width - w - 4);
    if (py < 4) py = y * sy + 34 * sy;
    el.style.left = px + 'px';
    el.style.top = py + 'px';
  },

  showBuildMenu(spotIdx) {
    const [x, y] = Game.layout.spots[spotIdx];
    const el = $('build-menu');
    el.innerHTML = '';
    for (const key of Object.keys(TOWER_TYPES)) {
      const def = TOWER_TYPES[key];
      const cost = def.levels[0].cost;
      const btn = document.createElement('button');
      btn.className = 'p-btn' + (Game.gold < cost ? ' disabled' : '');
      btn.title = def.desc;
      btn.innerHTML = `<span class="ico">${def.emoji}</span><span class="nm">${def.name}</span><span class="cost">🪙 ${cost}</span>`;
      btn.onclick = ev => {
        ev.stopPropagation();
        if (Game.build(spotIdx, key)) this.hidePopups();
      };
      el.appendChild(btn);
    }
    this.placePopup(el, x, y);
  },

  showTowerMenu(t) {
    const def = TOWER_TYPES[t.type];
    const el = $('tower-menu');
    el.innerHTML = '';

    // upgrade
    if (t.level < def.levels.length - 1) {
      const cost = def.levels[t.level + 1].cost;
      const b = document.createElement('button');
      b.className = 'p-btn' + (Game.gold < cost ? ' disabled' : '');
      b.innerHTML = `<span class="ico">⬆️</span><span class="nm">${def.levels[t.level + 1].label}</span><span class="cost">🪙 ${cost}</span>`;
      b.onclick = ev => { ev.stopPropagation(); if (Game.upgrade(t)) this.showTowerMenu(t); };
      el.appendChild(b);
    } else {
      const b = document.createElement('button');
      b.className = 'p-btn disabled';
      b.innerHTML = `<span class="ico">🏆</span><span class="nm">MAX LEVEL</span><span class="cost">${def.levels[t.level].label}</span>`;
      el.appendChild(b);
    }

    // rally (barracks only)
    if (def.barracks) {
      const b = document.createElement('button');
      b.className = 'p-btn';
      b.innerHTML = `<span class="ico">🚩</span><span class="nm">RALLY POINT</span><span class="cost">tap road</span>`;
      b.onclick = ev => { ev.stopPropagation(); Game.rallyPickTower = t; this.hidePopups(); };
      el.appendChild(b);
    }

    // sell
    const refund = Math.round(towerTotalValue(t.type, t.level) * 0.6);
    const s = document.createElement('button');
    s.className = 'p-btn sell';
    s.innerHTML = `<span class="ico">💰</span><span class="nm">SELL</span><span class="cost">+${refund}</span>`;
    s.onclick = ev => { ev.stopPropagation(); Game.sell(t); Game.selected = null; this.hidePopups(); };
    el.appendChild(s);

    this.placePopup(el, t.x, t.y);
  },

  /* ---------- HUD / banners / overlays ---------- */

  banner(text) {
    const b = $('banner');
    b.textContent = text;
    b.classList.remove('hidden');
    // restart animation
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.add('hidden'), 2200);
  },

  togglePause(on) {
    if (!Game.running && !on) { /* allow resume of overlay only */ }
    Game.paused = on;
    $('pause-overlay').classList.toggle('hidden', !on);
  },

  showEnd(won, stars) {
    $('end-title').textContent = won ? '🎉 Victory!' : '💀 Defeat';
    $('end-stars').innerHTML = won
      ? '★'.repeat(stars) + `<span class="off">${'★'.repeat(3 - stars)}</span>`
      : '<span class="off">★★★</span>';
    const lv = LEVELS[Game.levelIndex];
    $('end-msg').textContent = won
      ? `${lv.name} is safe! ${Game.lives}/${Game.maxLives} lives kept.`
      : `The hantus overran ${lv.name}. Try a new strategy, can one!`;
    const next = Game.levelIndex + 1;
    $('btn-end-next').style.display = won && next < LEVELS.length ? '' : 'none';
    setTimeout(() => $('end-overlay').classList.remove('hidden'), won ? 600 : 400);
  },

  refreshHud() {
    $('hud-lives').textContent = `❤️ ${Game.lives}`;
    $('hud-gold').textContent = `🪙 ${Math.floor(Game.gold)}`;
    $('hud-wave').textContent = `🌊 ${Math.max(0, Game.waveIndex + 1)}/${Game.waves.length}`;
    const btn = $('btn-next-wave');
    btn.disabled = !Game.canCallWave() && Game.waveIndex >= 0;
    if (Game.waveIndex < 0) {
      $('next-wave-timer').textContent = '';
      btn.disabled = false;
    } else if (!Game.waveActive && Game.autoWaveTimer > 0) {
      $('next-wave-timer').textContent = `(${Math.ceil(Game.autoWaveTimer)}s)`;
    } else {
      $('next-wave-timer').textContent = '';
    }
  },
};
