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
Sound.ensure = () => {};
Object.keys(Sound).forEach(k => { if (typeof Sound[k] === 'function') Sound[k] = () => {}; });
['js/data/enemies.js', 'js/data/towers.js', 'js/data/levels.js', 'js/render.js', 'js/game.js'].forEach(load);
Renderer.buildBackground = () => {};
global.UI = { banner() {}, showEnd() {} };

function simulate(li) {
  Game.start(li);
  // rank pads by distance to nearest path
  const ranked = Game.layout.spots
    .map(([x, y], i) => ({ i, d: Math.min(...Game.paths.map(p => distToPath(p, x, y))) }))
    .sort((a, b) => a.d - b.d)
    .map(o => o.i);
  const mix = ['cell', 'temple', 'durian', 'cell', 'camp', 'temple', 'durian', 'cell', 'temple', 'durian', 'cell', 'temple'];
  let bi = 0;

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
      }
    }
    if (!Game.waveActive && Game.canCallWave() && Game.enemies.length === 0 && Game.spawnQueue.length === 0)
      Game.callNextWave();
  }
  return { won: Game.won, lives: Game.lives, max: Game.maxLives };
}

// validate data
for (let i = 0; i < LEVELS.length; i++) {
  const waves = genWaves(i);
  if (waves.length !== LEVELS[i].waves) throw new Error('wave count mismatch L' + (i + 1));
  for (const w of waves) for (const g of w)
    if (!ENEMY_TYPES[g.type]) throw new Error('unknown enemy ' + g.type);
}
console.log('✔ 30 levels / wave data validated\n');

let fails = 0;
for (let li = 0; li < LEVELS.length; li++) {
  const r = simulate(li);
  if (!r.won) fails++;
  console.log(
    `L${String(li + 1).padStart(2)} ${LEVELS[li].name.padEnd(22)} [${LEVELS[li].diff.padEnd(6)}]`,
    r.won ? `WON  lives ${r.lives}/${r.max}` : 'LOST'
  );
}
console.log(fails === 0 ? '\n✔ ALL LEVELS BEATABLE' : `\n✘ ${fails} levels failed`);
process.exit(fails === 0 ? 0 : 1);
