/* ===== 30 Singapore neighbourhood levels ===== */
'use strict';

/*
  Canvas is 960x600.
  Layouts: { paths: [ [ [x,y],... ] ], spots: [ [x,y],... ], water: [...rects], theme hints }
  Multiple paths => multi-entrance maps (each wave picks a path).
*/
const LAYOUTS = [

  // 0 — classic S-curve (heartland town centre)
  {
    paths: [[[-30,120],[240,120],[240,300],[110,300],[110,470],[460,470],[460,220],[700,220],[700,420],[990,420]]],
    spots: [[170,190],[310,180],[170,370],[300,390],[390,300],[530,300],[540,530],[630,140],[770,300],[630,480],[830,490],[860,350]],
  },

  // 1 — coastal road (one long bend along water)
  {
    paths: [[[-30,480],[300,480],[300,260],[560,260],[560,440],[820,440],[820,150],[990,150]]],
    spots: [[220,400],[380,340],[380,180],[480,340],[640,350],[640,180],[740,520],[740,330],[900,300],[890,90],[210,550],[490,520]],
    water: [[0,0,960,90]],
  },

  // 2 — twin entrances converging (junction town)
  {
    paths: [
      [[-30,150],[420,150],[420,330],[680,330],[680,480],[990,480]],
      [[-30,450],[260,450],[260,330],[680,330],[680,480],[990,480]],
    ],
    spots: [[180,230],[180,370],[340,240],[340,400],[500,240],[520,410],[610,240],[760,400],[760,250],[850,550],[560,530],[120,540]],
  },

  // 3 — spiral to centre (maze-like old estate)
  {
    paths: [[[-30,80],[840,80],[840,520],[160,520],[160,220],[660,220],[660,380],[330,380]]],
    spots: [[240,150],[450,150],[700,150],[900,300],[740,450],[450,450],[240,450],[240,300],[420,300],[580,300],[500,450],[90,350]],
  },

  // 4 — river split (bridge crossings)
  {
    paths: [[[-30,300],[200,300],[200,140],[480,140],[480,460],[760,460],[760,260],[990,260]]],
    spots: [[120,220],[300,220],[300,60],[390,240],[560,240],[390,530],[570,530],[660,370],[860,370],[860,180],[120,400],[560,60]],
    water: [[0,560,960,40]],
  },

  // 5 — U-turn valley
  {
    paths: [[[-30,140],[760,140],[760,460],[-30,460]]],
    spots: [[150,230],[320,230],[490,230],[650,230],[860,300],[650,370],[490,370],[320,370],[150,370],[150,60],[490,60],[490,540]],
  },

  // 6 — zigzag hillside
  {
    paths: [[[480,-30],[480,130],[180,130],[180,300],[700,300],[700,470],[300,470],[300,610]]],
    spots: [[380,60],[580,200],[280,210],[100,220],[380,220],[600,220],[790,380],[580,390],[400,390],[200,390],[400,540],[100,470]],
  },

  // 7 — double loop (market circuit)
  {
    paths: [
      [[-30,220],[350,220],[350,440],[620,440],[620,220],[990,220]],
      [[-30,220],[350,220],[350,440],[620,440],[620,220],[990,220]],
    ],
    spots: [[160,140],[160,310],[270,320],[470,340],[470,140],[720,330],[720,120],[860,310],[270,530],[720,530],[550,120],[880,120]],
  },

  // 8 — long snake (expressway)
  {
    paths: [[[-30,540],[160,540],[160,120],[400,120],[400,480],[640,480],[640,120],[880,120],[880,610]]],
    spots: [[70,420],[250,300],[250,60],[320,300],[490,300],[490,560],[560,300],[730,300],[730,60],[800,300],[960,400],[70,120]],
  },

  // 9 — crossroads with island
  {
    paths: [
      [[480,-30],[480,240],[300,240],[300,420],[990,420]],
      [[-30,300],[190,300],[190,420,],[990,420]],
    ],
    spots: [[390,120],[570,140],[570,320],[390,330],[220,200],[100,220],[100,400],[240,500],[420,500],[620,340],[760,340],[760,500]],
  },
];

/*
  30 levels — real Singapore neighbourhoods, difficulty ramps up.
  waves are generated deterministically from level number by genWaves().
*/
const LEVELS = [
  { name: 'Ang Mo Kio Central',  diff: 'easy',   layout: 0, theme: 'town',   waves: 6,  gold: 240, lives: 20 },
  { name: 'Toa Payoh Town Park', diff: 'easy',   layout: 5, theme: 'park',   waves: 6,  gold: 240, lives: 20 },
  { name: 'Bedok Interchange',   diff: 'easy',   layout: 1, theme: 'town',   waves: 7,  gold: 250, lives: 20 },
  { name: 'Changi Village',      diff: 'easy',   layout: 1, theme: 'coast',  waves: 7,  gold: 250, lives: 20 },
  { name: 'Tiong Bahru Estate',  diff: 'easy',   layout: 3, theme: 'town',   waves: 7,  gold: 260, lives: 20 },
  { name: 'Clementi Forest',     diff: 'easy',   layout: 6, theme: 'forest', waves: 8,  gold: 260, lives: 20 },
  { name: 'Serangoon Gardens',   diff: 'normal', layout: 2, theme: 'town',   waves: 8,  gold: 270, lives: 18 },
  { name: 'Kampong Glam',        diff: 'normal', layout: 7, theme: 'town',   waves: 8,  gold: 270, lives: 18 },
  { name: 'Chinatown Pagoda St', diff: 'normal', layout: 3, theme: 'town',   waves: 9,  gold: 280, lives: 18 },
  { name: 'Boat Quay',           diff: 'normal', layout: 4, theme: 'river',  waves: 9,  gold: 300, lives: 18, boss: 'nagaBoss' },
  { name: 'Little India',        diff: 'normal', layout: 9, theme: 'town',   waves: 9,  gold: 280, lives: 16 },
  { name: 'Bukit Timah Hill',    diff: 'normal', layout: 6, theme: 'forest', waves: 9,  gold: 280, lives: 16 },
  { name: 'Pasir Ris Park',      diff: 'normal', layout: 1, theme: 'coast',  waves: 10, gold: 290, lives: 16 },
  { name: 'Yishun Dam',          diff: 'normal', layout: 4, theme: 'river',  waves: 10, gold: 290, lives: 16 },
  { name: 'Jurong Lake Gardens', diff: 'normal', layout: 5, theme: 'park',   waves: 10, gold: 290, lives: 16 },
  { name: 'Hougang Ave 8',       diff: 'hard',   layout: 8, theme: 'town',   waves: 10, gold: 300, lives: 15 },
  { name: 'Tampines Hub',        diff: 'hard',   layout: 2, theme: 'town',   waves: 11, gold: 300, lives: 15 },
  { name: 'Punggol Waterway',    diff: 'hard',   layout: 4, theme: 'river',  waves: 11, gold: 310, lives: 15 },
  { name: 'Geylang Serai',       diff: 'hard',   layout: 7, theme: 'town',   waves: 11, gold: 310, lives: 15 },
  { name: 'Haw Par Villa',       diff: 'hard',   layout: 3, theme: 'park',   waves: 12, gold: 330, lives: 15, boss: 'rangda' },
  { name: 'Woodlands Causeway',  diff: 'hard',   layout: 8, theme: 'coast',  waves: 12, gold: 320, lives: 12 },
  { name: 'Queenstown Commons',  diff: 'hard',   layout: 0, theme: 'town',   waves: 12, gold: 380, lives: 12 },
  { name: 'MacRitchie Trail',    diff: 'hard',   layout: 6, theme: 'forest', waves: 12, gold: 330, lives: 12 },
  { name: 'Sembawang Hot Spring',diff: 'hard',   layout: 5, theme: 'park',   waves: 13, gold: 330, lives: 12 },
  { name: 'Marina Barrage',      diff: 'hard',   layout: 1, theme: 'coast',  waves: 13, gold: 340, lives: 12 },
  { name: 'Bukit Batok Quarry',  diff: 'heroic', layout: 9, theme: 'forest', waves: 13, gold: 440, lives: 12 },
  { name: 'Clarke Quay Night',   diff: 'heroic', layout: 4, theme: 'river',  waves: 14, gold: 350, lives: 10 },
  { name: 'Orchard Road',        diff: 'heroic', layout: 8, theme: 'town',   waves: 14, gold: 350, lives: 10 },
  { name: 'Sentosa Siloso',      diff: 'heroic', layout: 2, theme: 'coast',  waves: 15, gold: 360, lives: 10 },
  { name: 'Merlion Park',        diff: 'heroic', layout: 7, theme: 'coast',  waves: 15, gold: 400, lives: 10, boss: 'yamaOx' },
];

/* Difficulty scaling factors */
const DIFF_SCALE = { easy: 1.0, normal: 1.12, hard: 1.2, heroic: 1.26 };

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
function genWaves(li) {
  const lv = LEVELS[li];
  const rng = makeRng(1337 + li * 7919);
  const pool = enemyPool(li);
  const nPaths = LAYOUTS[lv.layout].paths.length;
  // multi-entrance maps split the defense — discount the wave budget
  const scale = DIFF_SCALE[lv.diff] / (1 + (nPaths - 1) * 0.18);
  const waves = [];

  for (let w = 0; w < lv.waves; w++) {
    const progress = w / (lv.waves - 1);              // 0..1 within level
    const budget = (50 + li * 5.5) * (1 + progress * 1.7) * scale;
    const hpMul = (1 + li * 0.022) * (0.85 + progress * 0.3) * scale;
    const groups = [];
    let spent = 0, delay = 0;

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
      spent += count * unitCost;
    }
    waves.push(groups);
  }

  // Boss finale
  if (lv.boss) {
    waves[waves.length - 1].push({
      type: lv.boss, count: 1, gap: 0, delay: 5,
      pathIndex: 0, hpMul: scale * (1 + li * 0.05),
    });
  }
  return waves;
}
