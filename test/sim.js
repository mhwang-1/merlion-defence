/* Headless balance simulation: node test/sim.js
   Uses a reasonable-player AI: builds on pads closest to the road,
   mixes tower types, upgrades when affordable. Every level should be
   winnable by this AI (players are smarter than this).            */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const W = f => path.join(__dirname, '..', 'web', f);

global.window = { addEventListener() {}, AudioContext: null };
global.localStorage = { getItem: () => null, setItem() {} };
global.document = {
  createElement: () => ({
    getContext: () => new Proxy({}, {
      get: (t, p) => p === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {},
    }),
    width: 0, height: 0,
  }),
};

const load = f => vm.runInThisContext(fs.readFileSync(W(f), 'utf8'), { filename: f });
['js/util.js', 'js/audio.js'].forEach(load);
// deterministic runs: hero crits/stuns/evades roll Math.random
Math.random = makeRng(123456789);
Sound.ensure = () => {};
Object.keys(Sound).forEach(k => { if (typeof Sound[k] === 'function') Sound[k] = () => {}; });
['js/data/enemies.js', 'js/data/towers.js', 'js/data/heroes.js', 'js/data/geo.js',
 'js/data/levels.js', 'js/render.js', 'js/game.js'].forEach(load);
Renderer.buildBackground = () => {};
Renderer.initTrains = () => {};
Renderer.initPeople = () => {};
global.UI = { banner() {}, showEnd() {} };
// sim plays with everything unlocked (players buy unlocks with merits)
for (const k of Object.keys(TOWER_TYPES)) Progress.data.towersU[k] = true;
for (const k of Object.keys(HERO_TYPES)) Progress.data.heroes[k] = true;


function simulate(li, mode = 'campaign') {
  // reasonable hero loadout: a blocker plus a ranged pick for act 3-4
  Progress.data.loadout = li >= 15 ? ['badang', 'boseng'] : ['utama'];
  Game.start(li, mode);
  // rank pads by distance to nearest path
  const ranked = Game.layout.spots
    .map(([x, y], i) => ({ i, d: Math.min(...Game.paths.map(p => distToPath(p, x, y))) }))
    .sort((a, b) => a.d - b.d)
    .map(o => o.i);
  // adapt the tower mix to the wave composition (as a player would):
  // flying-heavy levels get mostly anti-air (cell/temple)
  let flying = 0, total = 0;
  for (const w of Game.waves) for (const grp of w) {
    total += grp.count;
    if (ENEMY_TYPES[grp.type].flying) flying += grp.count;
  }
  const airFrac = flying / Math.max(1, total);
  let mix = airFrac > 0.35
    ? ['cell', 'temple', 'mata', 'cell', 'temple', 'power', 'cell', 'ice', 'temple', 'mata', 'cell', 'temple', 'cell', 'power', 'temple', 'cell', 'mata', 'cell']
    : ['cell', 'temple', 'durian', 'mata', 'camp', 'wok', 'ice', 'cell', 'temple', 'durian', 'power', 'mata', 'cell', 'wok', 'temple', 'cell', 'durian', 'temple'];
  if (Game.allowedTowers) {
    mix = mix.filter(t => Game.allowedTowers.includes(t));
    while (mix.length < 18) mix.push(Game.allowedTowers[mix.length % Game.allowedTowers.length]);
  }
  let bi = 0;

  // challenge modes are one-life; measure LEAKS for the baseline AI instead
  // (a human player with retries only needs the leak count to be small)
  if (mode !== 'campaign') { Game.lives = 50; Game.maxLives = 50; }

  // pre-build with starting gold (like a real player)
  while (bi < ranked.length && bi < mix.length &&
         Game.gold >= TOWER_TYPES[mix[bi]].levels[0].cost) {
    Game.build(ranked[bi], mix[bi]); bi++;
  }

  Game.callNextWave();
  let steps = 0;
  while (!Game.over && steps < 3000000) {
    Game.update(1 / 60); steps++;
    if (bi < ranked.length && bi < mix.length) {
      const cost = TOWER_TYPES[mix[bi]].levels[0].cost;
      if (Game.gold >= cost) { Game.build(ranked[bi], mix[bi]); bi++; }
    } else {
      for (const t of Game.towers) {
        const def = TOWER_TYPES[t.type];
        if (t.level < def.levels.length - 1 && Game.gold >= def.levels[t.level + 1].cost + 80) {
          Game.upgrade(t); break;
        }
        // max level → pick an ultimate (alternate between the two paths)
        if (t.level === def.levels.length - 1 && def.ults) {
          const ui = t.id % 2;
          if (Game.gold >= def.ults[ui].cost + 80) { Game.chooseUlt(t, ui); break; }
        }
      }
    }
    if (!Game.waveActive && Game.canCallWave() && Game.enemies.length === 0 && Game.spawnQueue.length === 0)
      Game.callNextWave();
  }
  return { won: Game.won, lives: Game.lives, max: Game.maxLives, leaks: Game.maxLives - Game.lives };
}

// validate data (all three modes)
for (let i = 0; i < LEVELS.length; i++) {
  const waves = genWaves(i);
  if (waves.length !== LEVELS[i].waves) throw new Error('wave count mismatch L' + (i + 1));
  for (const mode of ['campaign', 'heroic', 'iron']) {
    for (const w of genWaves(i, mode)) for (const g of w)
      if (!ENEMY_TYPES[g.type]) throw new Error('unknown enemy ' + g.type + ' in ' + mode);
  }
  if (genWaves(i, 'heroic').length !== 6) throw new Error('heroic must be 6 waves L' + (i + 1));
  if (genWaves(i, 'iron').length !== 1) throw new Error('iron must be 1 wave L' + (i + 1));
  const it = ironTowers(i);
  // must always have an anti-air tower; from L10 (li>=9) the magic-resistant
  // flying krasue demands a PHYSICAL anti-air pick (cell or mata)
  const antiAir = it.some(t => TOWER_TYPES[t].targets === 'both');
  if (!antiAir) throw new Error('iron combo lacks anti-air L' + (i + 1));
  if (i >= 9 && !it.includes('cell') && !it.includes('mata'))
    throw new Error('iron combo lacks physical anti-air L' + (i + 1));
  if (LAYOUTS[i].spots.length < 10) throw new Error('too few build pads L' + (i + 1) + ': ' + LAYOUTS[i].spots.length);
}
console.log('✔ 30 levels / wave data validated (campaign + heroic + iron)\n');

const modes = process.argv.includes('--all-modes')
  ? ['campaign', 'heroic', 'iron'] : ['campaign'];
// baseline AI must fully win campaign; challenges must be nearly clean
// (≤6 leaks for the dumb AI ≈ winnable by a real player with retries)
const LEAK_TOLERANCE = 6;
let fails = 0;
for (const mode of modes) {
  console.log(`--- ${mode.toUpperCase()} ---`);
  for (let li = 0; li < LEVELS.length; li++) {
    const r = simulate(li, mode);
    const ok = mode === 'campaign' ? r.won : (r.won && r.leaks <= LEAK_TOLERANCE);
    if (!ok) fails++;
    console.log(
      `L${String(li + 1).padStart(2)} ${LEVELS[li].name.padEnd(22)} [${LEVELS[li].diff.padEnd(6)}]`,
      mode === 'campaign'
        ? (r.won ? `WON  lives ${r.lives}/${r.max}` : 'LOST')
        : (ok ? `OK   leaks ${r.leaks}` : `TOO HARD  leaks ${r.leaks}`)
    );
  }
}
console.log(fails === 0 ? '\n✔ ALL LEVELS BEATABLE' : `\n✘ ${fails} runs failed`);
process.exit(fails === 0 ? 0 : 1);
