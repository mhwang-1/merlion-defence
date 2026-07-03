/* ===== 30 Singapore neighbourhood levels =====
   Map geometry is REAL: tools/fetch-geo.js bakes OpenStreetMap roads, rail
   viaducts, water, coastline, parks and building footprints for each actual
   neighbourhood into js/data/geo.js. Enemy paths are routed along the real
   streets, and build pads are seated on real open ground beside them.      */
'use strict';

/* Cap build pads per level — fewer towers means every placement matters.
   Pads are baked in path order, so even sampling keeps them spread out. */
const MAX_PADS = 12;
function trimSpots(spots) {
  if (spots.length <= MAX_PADS) return spots;
  const out = [];
  for (let i = 0; i < MAX_PADS; i++)
    out.push(spots[Math.floor(i * spots.length / MAX_PADS)]);
  return out;
}

/* Layout view over the baked geometry (see geo.js / GEO). */
const LAYOUTS = GEO.map(g => ({
  paths: g.paths,          // waypoint roads (routed on real streets)
  spots: trimSpots(g.spots), // build pads, capped (baked clear of roads/water)
  landmarks: g.landmarks,  // labelled real-place anchors
  geo: g,                  // full geometry for the renderer
}));

/*
  30 levels — real Singapore neighbourhoods, difficulty ramps up.
  Ordered as a geographic campaign: each tier is a cluster of adjacent
  areas, and the invasion marches north → east → west/central → city.
  Every level uses its own layout (layout index == level index).
*/
const LEVELS = [
  // === ACT 1 · NORTHERN HEARTLANDS (easy) ===
  { name: 'Ang Mo Kio Central',  diff: 'easy',   layout: 0,  theme: 'town',   tod: 'morning', waves: 6,  gold: 240, lives: 20 },
  { name: 'Toa Payoh Town Park', diff: 'easy',   layout: 1,  theme: 'park',   tod: 'day',     waves: 6,  gold: 240, lives: 20 },
  { name: 'Serangoon Gardens',   diff: 'easy',   layout: 2,  theme: 'town',   tod: 'day',     waves: 7,  gold: 250, lives: 20 },
  { name: 'Yishun Dam',          diff: 'easy',   layout: 3,  theme: 'river',  tod: 'morning', waves: 7,  gold: 250, lives: 20 },
  { name: 'Sembawang Hot Spring',diff: 'easy',   layout: 4,  theme: 'park',   tod: 'evening', waves: 7,  gold: 260, lives: 20 },
  { name: 'Woodlands Causeway',  diff: 'easy',   layout: 5,  theme: 'coast',  tod: 'night',   waves: 8,  gold: 260, lives: 20 },

  // === ACT 2 · THE EAST (normal) ===
  { name: 'Hougang Ave 8',       diff: 'normal', layout: 6,  theme: 'town',   tod: 'day',     waves: 8,  gold: 270, lives: 18 },
  { name: 'Pasir Ris Park',      diff: 'normal', layout: 7,  theme: 'coast',  tod: 'morning', waves: 8,  gold: 270, lives: 18 },
  { name: 'Tampines Hub',        diff: 'normal', layout: 8,  theme: 'town',   tod: 'day',     waves: 9,  gold: 280, lives: 18 },
  { name: 'Punggol Waterway',    diff: 'normal', layout: 9,  theme: 'river',  tod: 'evening', waves: 9,  gold: 700, lives: 18, boss: 'nagaBoss' },
  { name: 'Changi Village',      diff: 'normal', layout: 10, theme: 'coast',  tod: 'morning', waves: 9,  gold: 280, lives: 16 },
  { name: 'Bedok Interchange',   diff: 'normal', layout: 11, theme: 'town',   tod: 'day',     waves: 9,  gold: 500, lives: 16 },
  { name: 'Geylang Serai',       diff: 'normal', layout: 12, theme: 'town',   tod: 'night',   waves: 10, gold: 460, lives: 16 },
  { name: 'Kampong Glam',        diff: 'normal', layout: 13, theme: 'town',   tod: 'evening', waves: 10, gold: 290, lives: 16 },
  { name: 'Little India',        diff: 'normal', layout: 14, theme: 'town',   tod: 'day',     waves: 10, gold: 290, lives: 16 },

  // === ACT 3 · CENTRAL & WEST (hard) ===
  { name: 'MacRitchie Trail',    diff: 'hard',   layout: 15, theme: 'forest', tod: 'morning', waves: 10, gold: 300, lives: 15 },
  { name: 'Bukit Timah Hill',    diff: 'hard',   layout: 16, theme: 'forest', tod: 'day',     waves: 11, gold: 300, lives: 15 },
  { name: 'Bukit Batok Quarry',  diff: 'hard',   layout: 17, theme: 'forest', tod: 'evening', waves: 11, gold: 310, lives: 15 },
  { name: 'Jurong Lake Gardens', diff: 'hard',   layout: 18, theme: 'park',   tod: 'day',     waves: 11, gold: 310, lives: 15 },
  { name: 'Clementi Forest',     diff: 'hard',   layout: 19, theme: 'forest', tod: 'night',   waves: 12, gold: 560, lives: 15 },
  { name: 'Haw Par Villa',       diff: 'hard',   layout: 20, theme: 'park',   tod: 'evening', waves: 12, gold: 880, lives: 12, boss: 'rangda' },
  { name: 'Queenstown Commons',  diff: 'hard',   layout: 21, theme: 'town',   tod: 'day',     waves: 12, gold: 730, lives: 12 },
  { name: 'Tiong Bahru Estate',  diff: 'hard',   layout: 22, theme: 'town',   tod: 'morning', waves: 12, gold: 430, lives: 12 },
  { name: 'Chinatown Pagoda St', diff: 'hard',   layout: 23, theme: 'town',   tod: 'night',   waves: 13, gold: 330, lives: 12 },
  { name: 'Boat Quay',           diff: 'hard',   layout: 24, theme: 'river',  tod: 'evening', waves: 13, gold: 390, lives: 12 },

  // === ACT 4 · CITY & THE SOUTH (heroic) ===
  { name: 'Clarke Quay Night',   diff: 'heroic', layout: 25, theme: 'river',  tod: 'night',   waves: 13, gold: 440, lives: 12 },
  { name: 'Orchard Road',        diff: 'heroic', layout: 26, theme: 'town',   tod: 'evening', waves: 14, gold: 710, lives: 10 },
  { name: 'Marina Barrage',      diff: 'heroic', layout: 27, theme: 'coast',  tod: 'day',     waves: 14, gold: 350, lives: 10 },
  { name: 'Sentosa Siloso',      diff: 'heroic', layout: 28, theme: 'coast',  tod: 'morning', waves: 15, gold: 360, lives: 10 },
  { name: 'Merlion Park',        diff: 'heroic', layout: 29, theme: 'coast',  tod: 'night',   waves: 15, gold: 400, lives: 10, boss: 'yamaOx' },
];

/* Campaign acts — geographic clusters shown as headers in level select */
const ACTS = [
  { at: 0,  name: 'ACT 1 · Northern Heartlands', blurb: 'Ang Mo Kio → Woodlands' },
  { at: 6,  name: 'ACT 2 · The East',            blurb: 'Hougang → Little India' },
  { at: 15, name: 'ACT 3 · Central & West',      blurb: 'MacRitchie → Boat Quay' },
  { at: 25, name: 'ACT 4 · City & the South',    blurb: 'Clarke Quay → Merlion Park' },
];

/* Difficulty scaling factors — tuned up now that heroes fight alongside
   the towers (every level fields 1 hero in acts 1-2, 2 heroes in 3-4),
   and up AGAIN for the 8-tower arsenal + capped pads (12/level).
   Whole ladder shifted one tier up (easy≈old normal … heroic beyond
   the old top) after playtests found the game too easy — and then
   AGAIN (easy≈old hard, normal above that, hard/heroic well beyond)
   after the game was still reported too easy — validated against a
   stronger sim AI that also micro-manages heroes like real players.  */
const DIFF_SCALE = { easy: 1.70, normal: 2.20, hard: 2.50, heroic: 2.70 };

/* ===== Game modes (Kingdom Rush style) =====
   campaign — the story mode; earn up to ★★★.
   After a 3-star campaign rating, two challenges unlock (1 bonus ★ each):
   heroic — 6 brutal waves of the level's toughest creatures, ONE life.
   iron   — one long unbroken siege, ONE life, and only some towers work.  */
const MODES = {
  campaign: { name: 'Campaign',         sprite: 'ui_sword',  desc: 'The story mode. Keep lives to earn up to ★★★.' },
  heroic:   { name: 'Heroic Challenge', sprite: 'ui_flame',  desc: '6 elite waves. One life. No mistakes.' },
  iron:     { name: 'Iron Challenge',   sprite: 'ui_shield', desc: 'One endless siege. One life. Limited towers.' },
};

/* Iron Challenge: which towers stay online (deterministic per level).
   Always keeps at least one anti-air tower (cell or temple); later levels
   face heavy flying waves, so they always get a 3-tower loadout.          */
const IRON_COMBOS_EARLY = [
  ['cell', 'durian'],
  ['cell', 'camp'],
  ['temple', 'wok'],
  ['mata', 'durian'],
  ['cell', 'ice'],
  ['power', 'durian', 'camp'],
  ['temple', 'durian', 'camp'],
  ['mata', 'wok', 'ice'],
];
/* from li>=9 the magic-resistant flying krasue appears — every combo
   must carry a PHYSICAL anti-air tower (cell or mata) or it's unwinnable */
const IRON_COMBOS_LATE = [
  ['cell', 'durian', 'camp'],
  ['cell', 'temple', 'wok'],
  ['mata', 'power', 'camp'],
  ['cell', 'ice', 'durian'],
  ['mata', 'temple', 'ice'],
  ['cell', 'power', 'wok'],
];
function ironTowers(li) {
  const rng = makeRng(9001 + li * 613);
  const combos = li >= 9 ? IRON_COMBOS_LATE : IRON_COMBOS_EARLY;
  return combos[Math.floor(rng() * combos.length)];
}

/* Enemy pools unlocked progressively by level index */
function enemyPool(li) {
  const pool = ['toyol'];
  if (li >= 1)  pool.push('pocong');
  if (li >= 2)  pool.push('pontianak');
  if (li >= 4)  pool.push('manananggal');
  if (li >= 5)  pool.push('jiangshi');
  if (li >= 7)  pool.push('kuntilanakSwarm');
  if (li >= 9)  pool.push('krasue');
  if (li >= 11) pool.push('garuda');
  if (li >= 13) pool.push('hantuRaya');
  if (li >= 16) pool.push('rakshasa');
  if (li >= 20) pool.push('oni');
  return pool;
}

/*
  Deterministic wave generation.
  Returns array of waves; each wave = array of groups
  { type, count, gap (s), delay (s), pathIndex, hpMul }
*/
function genWaves(li, mode = 'campaign') {
  if (mode === 'heroic') return genHeroicWaves(li);
  if (mode === 'iron') return genIronWaves(li);

  const lv = LEVELS[li];
  const rng = makeRng(1337 + li * 7919);
  const pool = enemyPool(li);
  const nPaths = LAYOUTS[lv.layout].paths.length;
  // multi-entrance maps split the defense — discount the wave budget
  // (K raised with the pad cap AND the auto-zoomed maps: fewer towers
  //  cover proportionally less of the longer, wider-split lanes)
  const scale = DIFF_SCALE[lv.diff] / (1 + (nPaths - 1) * 0.42);
  const waves = [];

  for (let w = 0; w < lv.waves; w++) {
    const progress = w / (lv.waves - 1);              // 0..1 within level
    const budget = (54 + li * 6.0) * (1 + progress * 1.7) * scale;
    const hpMul = (1 + li * 0.024) * (0.85 + progress * 0.3) * scale;
    const groups = [];
    let delay = 0;

    // Later waves get more simultaneous groups
    const nGroups = 1 + Math.floor(progress * 2 + rng() * 1.4);

    for (let g = 0; g < nGroups; g++) {
      // Bias picks: early waves from weaker half of pool; wave 1 is always fodder
      const biasMax = w === 0 ? Math.min(3, pool.length)
        : clamp(Math.floor(pool.length * (0.45 + progress * 0.75)) + 1, 1, pool.length);
      const type = pool[Math.floor(rng() * biasMax)];
      const et = ENEMY_TYPES[type];
      // heavier creatures cost more budget and come in smaller packs
      const unitCost = et.bounty * 1.6 + et.hp / 22;
      const maxPack = et.hp > 300 ? 4 : et.hp > 150 ? 8 : 14;
      const count = clamp(Math.round((budget / nGroups) / unitCost), 1, maxPack);
      groups.push({
        type, count,
        gap: et.boss ? 2 : clamp(1.35 - progress * 0.55 - li * 0.008, 0.45, 1.4),
        delay,
        pathIndex: Math.floor(rng() * nPaths),
        hpMul,
      });
      delay += 1.5 + rng() * 2.5;
    }
    waves.push(groups);
  }

  // Boss finale (×0.72 keeps boss HP near its pre-rebalance level — the
  // harder REGULAR waves are where the new difficulty lives)
  if (lv.boss) {
    waves[waves.length - 1].push({
      type: lv.boss, count: 1, gap: 0, delay: 5,
      pathIndex: 0, hpMul: scale * 0.72 * (1 + li * 0.05),
    });
  }
  return waves;
}

/* Heroic Challenge: 6 waves drawn from the STRONG end of the enemy pool,
   with beefed-up HP. One life — the player must hold a perfect line.      */
function genHeroicWaves(li) {
  const lv = LEVELS[li];
  const rng = makeRng(7777 + li * 577);
  const pool = enemyPool(Math.min(li + 3, LEVELS.length - 1)); // preview stronger foes
  const nPaths = LAYOUTS[lv.layout].paths.length;
  // one-life modes: split defenses hurt much more, discount harder
  const scale = DIFF_SCALE[lv.diff] / (1 + (nPaths - 1) * 0.45);
  const waves = [];
  const N = 6;

  for (let w = 0; w < N; w++) {
    const progress = w / (N - 1);
    // wave power ≈ a mid/late campaign wave — the ONE LIFE is the challenge
    const budget = (40 + li * 2.8) * (0.9 + progress * 1.1) * scale;
    const hpMul = (1 + li * 0.011) * (0.9 + progress * 0.18) * scale;
    const groups = [];
    let delay = 0;
    const nGroups = 1 + Math.floor(progress * 1.6 + rng() * 1.3);

    for (let g = 0; g < nGroups; g++) {
      // bias to the strong half of the pool
      const lo = Math.floor(pool.length * clamp(0.15 + progress * 0.35, 0, 0.55));
      const type = pool[lo + Math.floor(rng() * (pool.length - lo))];
      const et = ENEMY_TYPES[type];
      const unitCost = et.bounty * 1.6 + et.hp / 22;
      const maxPack = et.hp > 300 ? 3 : et.hp > 150 ? 6 : 11;
      const count = clamp(Math.round((budget / nGroups) / unitCost), 1, maxPack);
      groups.push({
        type, count,
        gap: clamp(1.25 - progress * 0.4, 0.55, 1.25),
        delay,
        pathIndex: Math.floor(rng() * nPaths),
        hpMul,
      });
      delay += 2.2 + rng() * 2.6;
    }
    waves.push(groups);
  }
  if (lv.boss) {
    waves[N - 1].push({
      type: lv.boss, count: 1, gap: 0, delay: 6,
      pathIndex: 0, hpMul: scale * 0.55,
    });
  }
  return waves;
}

/* Iron Challenge: ONE long unbroken siege (a dozen groups back to back),
   one life, and only the towers in ironTowers(li) may be built.           */
function genIronWaves(li) {
  const lv = LEVELS[li];
  const rng = makeRng(4444 + li * 331);
  const pool = enemyPool(li);
  const nPaths = LAYOUTS[lv.layout].paths.length;
  const scale = DIFF_SCALE[lv.diff] / (1 + (nPaths - 1) * 0.45);
  const groups = [];
  const nGroups = 8 + Math.floor(li / 8);
  let delay = 0;

  for (let g = 0; g < nGroups; g++) {
    const progress = g / (nGroups - 1);
    const budget = (30 + li * 1.9) * (0.85 + progress * 0.9) * scale;
    const hpMul = (1 + li * 0.009) * (0.9 + progress * 0.14) * scale;
    const biasMax = clamp(Math.floor(pool.length * (0.45 + progress * 0.6)) + 1, Math.min(2, pool.length), pool.length);
    const type = pool[Math.floor(rng() * biasMax)];
    const et = ENEMY_TYPES[type];
    const unitCost = et.bounty * 1.6 + et.hp / 22;
    const maxPack = et.hp > 300 ? 3 : et.hp > 150 ? 7 : 12;
    const count = clamp(Math.round(budget / unitCost), 1, maxPack);
    groups.push({
      type, count,
      gap: clamp(1.25 - progress * 0.45, 0.6, 1.25),
      delay,
      pathIndex: Math.floor(rng() * nPaths),
      hpMul,
    });
    delay += 10 + rng() * 6;  // groups roll in continuously, with breathing room
  }
  if (lv.boss) {
    groups.push({ type: lv.boss, count: 1, gap: 0, delay: delay + 4, pathIndex: 0, hpMul: scale * 0.38 });
  }
  return [groups]; // a single mega-wave
}
