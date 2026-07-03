/* ===== DOM UI: screens, popups, HUD ===== */
'use strict';

const $ = id => document.getElementById(id);

const UI = {
  canvas: null, ctx: null,

  init() {
    this.canvas = $('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // pixel-art merlion on the main menu
    const tm = document.querySelector('.title-merlion');
    if (tm) tm.innerHTML = `<img src="${Sprites.url('merlion')}" alt="Merlion" class="pixel-merlion">`;

    // menu
    $('btn-play').onclick = () => { Sound.ensure(); this.show('levels'); this.renderLevels(); };
    $('btn-armory').onclick = () => { Sound.ensure(); this.show('armory'); this.renderArmory(); };
    $('btn-help').onclick = () => this.show('help');
    $('btn-help-back').onclick = () => this.show('menu');
    $('btn-reset').onclick = () => {
      if (confirm('Reset all level progress?')) { Progress.reset(); }
    };
    $('btn-levels-back').onclick = () => this.show('menu');
    $('btn-armory-back').onclick = () => this.show('menu');
    $('btn-levels-armory').onclick = () => { this.show('armory'); this.renderArmory(); };

    // save export / import
    $('btn-export').onclick = () => this.exportSave();
    $('btn-import').onclick = () => $('import-file').click();
    $('import-file').onchange = e => this.importSave(e.target.files[0]);

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

    $('btn-pause-retry').onclick = () => { this.togglePause(false); this.startLevel(Game.levelIndex, Game.mode); };
    $('btn-pause-map').onclick = () => { this.togglePause(false); Game.running = false; this.show('levels'); this.renderLevels(); };

    $('btn-end-retry').onclick = () => { $('end-overlay').classList.add('hidden'); this.startLevel(Game.levelIndex, Game.mode); };
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

  /* ---------- save export / import ---------- */

  exportSave() {
    const blob = new Blob([Progress.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `merlion-defense-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },

  importSave(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Progress.importJSON(reader.result);
        alert(`Save loaded! ★ ${Progress.totalStars()} stars · 🎖 ${Progress.merits()} merits restored.`);
        if ($('screen-levels').classList.contains('active')) this.renderLevels();
        if ($('screen-armory').classList.contains('active')) this.renderArmory();
      } catch (e) {
        alert('Could not load save file: ' + e.message);
      }
      $('import-file').value = '';
    };
    reader.readAsText(file);
  },

  /* ---------- armory (spend merits on towers & heroes) ---------- */

  renderArmory() {
    $('armory-merits').textContent = `🎖 ${Progress.merits()} merits`;
    const grid = $('armory-grid');
    grid.innerHTML = '';

    const head = t => {
      const h = document.createElement('div');
      h.className = 'act-header';
      h.innerHTML = `<span class="act-name">${t}</span>`;
      grid.appendChild(h);
    };

    head('🗼 TOWERS');
    for (const key of Object.keys(TOWER_TYPES)) {
      const def = TOWER_TYPES[key];
      const cost = TOWER_MERIT_COST[key];
      const owned = Progress.towerUnlocked(key);
      const card = document.createElement('div');
      card.className = 'armory-card' + (owned ? ' owned' : Progress.merits() >= cost ? ' buyable' : ' locked');
      const sprite = TOWER_SPRITE[key];
      card.innerHTML = `
        <img class="ac-ico" src="${Sprites.url(sprite)}" alt="">
        <div class="ac-body">
          <div class="ac-name">${def.emoji} ${def.name}</div>
          <div class="ac-desc">${def.desc}</div>
        </div>
        <div class="ac-cost">${owned ? '✓ OWNED' : `🎖 ${cost}`}</div>`;
      if (!owned) card.onclick = () => {
        if (Progress.unlockTower(key)) { Sound.build(); this.renderArmory(); }
      };
      grid.appendChild(card);
    }

    head(`🦸 HEROES — equip ${'◆'} (1 hero in Acts 1–2, 2 in Acts 3–4)`);
    for (const key of HERO_ORDER) {
      const def = HERO_TYPES[key];
      const owned = Progress.heroUnlocked(key);
      const equipped = Progress.data.loadout.includes(key);
      const card = document.createElement('div');
      card.className = 'armory-card' +
        (owned ? (equipped ? ' owned equipped' : ' owned') :
          Progress.merits() >= def.cost ? ' buyable' : ' locked');
      const kindTag = def.kind === 'melee' ? '⚔ melee' : '🏹 ranged';
      card.innerHTML = `
        <img class="ac-ico" src="${Sprites.url(def.sprite)}" alt="">
        <div class="ac-body">
          <div class="ac-name">${def.emoji} ${def.name} <span class="ac-kind">${kindTag}</span></div>
          <div class="ac-desc">${def.blurb}</div>
          <div class="ac-stats">❤ ${def.hp} · ⚔ ${def.damage}${def.range ? ' · ◎ ' + def.range : ''}</div>
        </div>
        <div class="ac-cost">${owned ? (equipped ? '◆ EQUIPPED' : 'tap to equip') : def.cost === 0 ? 'FREE' : `🎖 ${def.cost}`}</div>`;
      card.onclick = () => {
        if (owned) { Progress.toggleLoadout(key); Sound.coin(); }
        else if (Progress.unlockHero(key)) Sound.build();
        this.renderArmory();
      };
      grid.appendChild(card);
    }
  },

  /* ---------- level select ---------- */

  renderLevels() {
    $('total-stars').textContent = `★ ${Progress.totalStars()} / ${Progress.maxStars()} · 🎖 ${Progress.merits()}`;
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const act = ACTS.find(a => a.at === i);
      if (act) {
        const h = document.createElement('div');
        h.className = 'act-header';
        h.innerHTML = `<span class="act-name">${act.name}</span><span class="act-blurb">${act.blurb}</span>`;
        grid.appendChild(h);
      }
      const unlocked = Progress.unlocked(i);
      const stars = Progress.starsFor(i);
      const chal = Progress.challengesUnlocked(i);
      const card = document.createElement('div');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      const badges = chal
        ? `<span class="lv-badge ${Progress.heroicDone(i) ? 'done' : ''}" title="Heroic Challenge">🔥</span>` +
          `<span class="lv-badge ${Progress.ironDone(i) ? 'done' : ''}" title="Iron Challenge">🛡</span>`
        : '';
      card.innerHTML = `
        <div class="lv-num">LEVEL ${i + 1}</div>
        <div class="lv-name">${unlocked ? lv.name : '🔒 ' + lv.name}</div>
        <div class="lv-stars">${'★'.repeat(stars)}<span style="color:#45586a">${'★'.repeat(3 - stars)}</span>${badges}</div>
        <div class="lv-diff diff-${lv.diff}">${lv.diff.toUpperCase()} <span title="${TIMES_OF_DAY[lv.tod || 'day'].name}">${TIMES_OF_DAY[lv.tod || 'day'].icon}</span></div>`;
      if (unlocked) card.onclick = () => chal ? this.showModePicker(i) : this.startLevel(i, 'campaign');
      grid.appendChild(card);
    });
  },

  /* Kingdom Rush-style mode picker (after ★★★ campaign clear) */
  showModePicker(i) {
    const lv = LEVELS[i];
    const wrap = $('mode-overlay');
    const stars = Progress.starsFor(i);
    const rows = Object.keys(MODES).map(key => {
      const m = MODES[key];
      const done = key === 'campaign'
        ? `★ ${stars}/3`
        : (key === 'heroic' ? Progress.heroicDone(i) : Progress.ironDone(i)) ? '★ done' : '☆ not yet';
      const extra = key === 'iron'
        ? `<div class="mode-extra">Towers: ${ironTowers(i).map(t => TOWER_TYPES[t].name).join(', ')}</div>`
        : '';
      return `
        <button class="mode-btn mode-${key}" data-mode="${key}">
          <span class="mode-ico">${m.icon}</span>
          <span class="mode-body">
            <span class="mode-name">${m.name}</span>
            <span class="mode-desc">${m.desc}</span>${extra}
          </span>
          <span class="mode-done">${done}</span>
        </button>`;
    }).join('');
    wrap.innerHTML = `
      <div class="end-box mode-box">
        <h2>${lv.name}</h2>
        <p class="mode-sub">Choose your challenge</p>
        ${rows}
        <button class="big-btn secondary" id="btn-mode-cancel">← BACK</button>
      </div>`;
    wrap.classList.remove('hidden');
    wrap.querySelectorAll('.mode-btn').forEach(b => {
      b.onclick = () => { wrap.classList.add('hidden'); this.startLevel(i, b.dataset.mode); };
    });
    $('btn-mode-cancel').onclick = () => wrap.classList.add('hidden');
    wrap.onclick = e => { if (e.target === wrap) wrap.classList.add('hidden'); };
  },

  startLevel(i, mode = 'campaign') {
    Sound.ensure();
    this.hidePopups();
    $('end-overlay').classList.add('hidden');
    $('pause-overlay').classList.add('hidden');
    $('mode-overlay').classList.add('hidden');
    Game.start(i, mode);
    $('btn-speed').textContent = '1×';
    this.show('game');
    const mtag = mode === 'campaign' ? '' : ` · ${MODES[mode].name}`;
    this.banner(`${LEVELS[i].name}${mtag}`);
    if (mode === 'iron') {
      setTimeout(() => this.banner(`🛡 Only: ${Game.allowedTowers.map(t => TOWER_TYPES[t].name).join(' + ')}`), 2400);
    }
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

    // tap a hero to take command
    const h = Game.heroAt(x, y);
    if (h) {
      Game.selected = { kind: 'hero', hero: h };
      this.hidePopups();
      Sound.coin();
      return;
    }

    const spot = Game.spotAt(x, y);
    if (spot >= 0) {
      const t = Game.towerAtSpot(spot);
      if (t) { Game.selected = { kind: 'tower', tower: t }; this.showTowerMenu(t); }
      else { Game.selected = { kind: 'spot', spot }; this.showBuildMenu(spot); }
      return;
    }

    // hero selected → tap ground to move them there
    if (Game.selected && Game.selected.kind === 'hero') {
      Game.orderHero(Game.selected.hero, x, y);
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
      if (!Game.towerAllowed(key)) continue;
      const def = TOWER_TYPES[key];
      const cost = def.levels[0].cost;
      const btn = document.createElement('button');
      btn.className = 'p-btn' + (Game.gold < cost ? ' disabled' : '');
      btn.title = def.desc;
      btn.innerHTML = `<img class="ico" src="${Sprites.url(TOWER_SPRITE[key])}" alt=""><span class="nm">${def.name}</span><span class="cost">${cost}g</span>`;
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
    const lv = LEVELS[Game.levelIndex];
    const mode = Game.mode;
    $('end-title').textContent = won
      ? (mode === 'campaign' ? '🎉 Victory!' : `${MODES[mode].icon} Challenge Complete!`)
      : '💀 Defeat';
    if (mode === 'campaign') {
      $('end-stars').innerHTML = won
        ? '★'.repeat(stars) + `<span class="off">${'★'.repeat(3 - stars)}</span>`
        : '<span class="off">★★★</span>';
    } else {
      $('end-stars').innerHTML = won ? '★' : '<span class="off">★</span>';
    }
    let msg;
    if (won && mode === 'campaign') {
      msg = `${lv.name} is safe! ${Game.lives}/${Game.maxLives} lives kept.`;
      if (Game.meritsEarned) msg += ` +${Game.meritsEarned} 🎖 merits!`;
      if (stars >= 3 && !Progress.heroicDone(Game.levelIndex) && !Progress.ironDone(Game.levelIndex))
        msg += ' Heroic & Iron Challenges unlocked!';
    } else if (won) {
      msg = `${MODES[mode].name} conquered — bonus star earned!`;
      if (Game.meritsEarned) msg += ` +${Game.meritsEarned} 🎖 merits!`;
    } else {
      msg = mode === 'campaign'
        ? `The hantus overran ${lv.name}. Try a new strategy, can one!`
        : `One life only — ${MODES[mode].name} shows no mercy. Try again!`;
    }
    $('end-msg').textContent = msg;
    const next = Game.levelIndex + 1;
    $('btn-end-next').style.display = won && mode === 'campaign' && next < LEVELS.length ? '' : 'none';
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
