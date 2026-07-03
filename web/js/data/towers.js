/* ===== Tower catalogue — urban Singapore defenses ===== */
'use strict';

/*
  Each tower has 3 levels, then a choice of TWO ultimate upgrades
  (Kingdom Rush style): after reaching level 3 the player picks one of
  `ults` — each a full stat row with its own sprite and flavour.
  damageType: 'physical' | 'magic' | 'splash'(physical aoe)
  fireRate = shots per second.
*/
const TOWER_TYPES = {
  cell: {
    name: 'Cell-Base Tower', emoji: '📡',
    desc: '5G microwave bursts. Fast, cheap, hits air & ground.',
    damageType: 'physical', targets: 'both',
    levels: [
      { cost: 70,  damage: 12, range: 120, fireRate: 1.8, label: '4G Mast' },
      { cost: 90,  damage: 22, range: 135, fireRate: 2.1, label: '5G Tower' },
      { cost: 190, damage: 38, range: 155, fireRate: 2.5, label: '6G Array' },
    ],
    ults: [
      { cost: 370, damage: 46, range: 200, fireRate: 2.5, label: 'Satellite Uplink', sprite: 't_cell_ua',
        blurb: 'Orbital dish — huge range.' },
      { cost: 370, damage: 40, range: 160, fireRate: 3.6, label: 'Overdrive Array', sprite: 't_cell_ub',
        blurb: 'Overclocked — blistering fire rate.' },
    ],
  },
  durian: {
    name: 'Durian Launcher', emoji: '🍈',
    desc: 'Lobs spiky king-of-fruits. Splash damage, ground only.',
    damageType: 'physical', targets: 'ground', splash: 55,
    levels: [
      { cost: 100, damage: 32, range: 130, fireRate: 0.6,  label: 'Pasar Stall' },
      { cost: 140, damage: 58, range: 145, fireRate: 0.65, label: 'D24 Catapult' },
      { cost: 260, damage: 100, range: 160, fireRate: 0.7, label: 'Mao Shan Wang' },
    ],
    ults: [
      { cost: 470, damage: 175, range: 170, fireRate: 0.62, splash: 92, label: 'King of Fruits', sprite: 't_durian_ua',
        blurb: 'Colossal durians — massive splash.' },
      { cost: 470, damage: 105, range: 175, fireRate: 1.15, splash: 66, label: 'Thorn Barrage', sprite: 't_durian_ub',
        blurb: 'Rapid-fire spiky volleys.' },
    ],
  },
  temple: {
    name: 'Talisman Temple', emoji: '⛩',
    desc: 'Blessed talismans pierce armour and slow spirits.',
    damageType: 'magic', targets: 'both', slow: { factor: 0.6, dur: 1.4 },
    levels: [
      { cost: 110, damage: 26, range: 115, fireRate: 1.0, label: 'Wayside Shrine' },
      { cost: 160, damage: 48, range: 130, fireRate: 1.1, label: 'Temple Hall' },
      { cost: 290, damage: 85, range: 145, fireRate: 1.2, label: 'Grand Pagoda' },
    ],
    ults: [
      { cost: 490, damage: 150, range: 160, fireRate: 1.25, label: 'Nine Emperor Court', sprite: 't_temple_ua',
        blurb: 'Imperial talismans — heavy magic damage.' },
      { cost: 490, damage: 95,  range: 155, fireRate: 1.3, slow: { factor: 0.38, dur: 2.2 }, label: 'Lion Dance Troupe', sprite: 't_temple_ub',
        blurb: 'Drums & cymbals — spirits crawl.' },
    ],
  },
  camp: {
    name: 'NS Camp', emoji: '🎖',
    desc: 'Deploys 3 NSmen to block ground enemies on the road.',
    damageType: 'physical', targets: 'ground', barracks: true,
    levels: [
      { cost: 90,  damage: 8,  range: 95,  fireRate: 1, label: 'Recruits',  soldierHp: 110, respawn: 8 },
      { cost: 120, damage: 16, range: 105, fireRate: 1, label: 'NSFs',      soldierHp: 200, respawn: 7 },
      { cost: 230, damage: 28, range: 115, fireRate: 1, label: 'Commandos', soldierHp: 340, respawn: 6 },
    ],
    ults: [
      { cost: 430, damage: 48, range: 125, fireRate: 1, label: 'Guards Elite', sprite: 't_camp_ua',
        soldierHp: 520, respawn: 6, blurb: 'Red berets — hardened blockers.' },
      { cost: 430, damage: 30, range: 125, fireRate: 1, label: 'Combat Medics', sprite: 't_camp_ub',
        soldierHp: 400, respawn: 3, blurb: 'Casualty drills — instant reinforcements.' },
    ],
  },
  mata: {
    name: 'Mata Sniper Post', emoji: '🎯',
    desc: 'Police marksman. Long-range shots that ignore armour.',
    damageType: 'physical', targets: 'both', pierce: true,
    levels: [
      { cost: 140, damage: 48,  range: 195, fireRate: 0.42, label: 'Neighbourhood Post' },
      { cost: 190, damage: 90,  range: 215, fireRate: 0.46, label: 'Marksman Nest' },
      { cost: 330, damage: 160, range: 240, fireRate: 0.50, label: 'STAR Overwatch' },
    ],
    ults: [
      { cost: 550, damage: 340, range: 275, fireRate: 0.38, label: 'Anti-Materiel Post', sprite: 't_mata_ua',
        blurb: 'One shot, one hantu.' },
      { cost: 550, damage: 165, range: 250, fireRate: 0.85, label: 'Twin Marksmen', sprite: 't_mata_ub',
        blurb: 'Two shooters — double the volleys.' },
    ],
  },
  wok: {
    name: 'Hawker Wok', emoji: '🔥',
    desc: 'Flaming wok hei! Splash damage that keeps burning. Ground only.',
    damageType: 'physical', targets: 'ground', splash: 46, burnDur: 3,
    levels: [
      { cost: 120, damage: 20, range: 105, fireRate: 1.0,  burnDps: 9,  label: 'Zi Char Stall' },
      { cost: 170, damage: 34, range: 115, fireRate: 1.05, burnDps: 16, label: 'Wok Hei Master' },
      { cost: 300, damage: 56, range: 125, fireRate: 1.1,  burnDps: 27, label: 'Michelin Hawker' },
    ],
    ults: [
      { cost: 500, damage: 82, range: 135, fireRate: 1.1, burnDps: 60, label: 'Dragon Breath Wok', sprite: 't_wok_ua',
        blurb: 'Infernal wok hei — searing afterburn.' },
      { cost: 500, damage: 96, range: 140, fireRate: 1.15, burnDps: 30, splash: 78, label: 'Chilli Crab Cauldron', sprite: 't_wok_ub',
        blurb: 'Bubbling gravy — huge splash.' },
    ],
  },
  power: {
    name: 'Substation Coil', emoji: '⚡',
    desc: 'Grid lightning arcs between spirits. Magic chain damage.',
    damageType: 'magic', targets: 'both',
    levels: [
      { cost: 150, damage: 30, range: 130, fireRate: 0.80, chain: 2, label: 'PUB Substation' },
      { cost: 210, damage: 52, range: 140, fireRate: 0.85, chain: 3, label: 'Grid Coil' },
      { cost: 350, damage: 88, range: 155, fireRate: 0.90, chain: 4, label: 'Tesla Array' },
    ],
    ults: [
      { cost: 570, damage: 110, range: 170, fireRate: 0.95, chain: 7, label: 'Monsoon Storm', sprite: 't_power_ua',
        blurb: 'Forked lightning sweeps whole packs.' },
      { cost: 570, damage: 210, range: 165, fireRate: 0.85, chain: 2, label: 'Megawatt Coil', sprite: 't_power_ub',
        blurb: 'Grid overload — single-bolt devastation.' },
    ],
  },
  ice: {
    name: 'Ice Kacang Cart', emoji: '🍧',
    desc: 'Freezing pulse chills EVERY spirit in range. Hits air & ground.',
    damageType: 'magic', targets: 'both', slow: { dur: 1.6 },
    levels: [
      { cost: 150, damage: 10, range: 105, fireRate: 0.55, slowFactor: 0.50, label: 'Ais Kacang Cart' },
      { cost: 200, damage: 18, range: 115, fireRate: 0.60, slowFactor: 0.45, label: 'Snow Ice Stand' },
      { cost: 330, damage: 30, range: 125, fireRate: 0.65, slowFactor: 0.40, label: 'Blizzard Bing' },
    ],
    ults: [
      { cost: 540, damage: 40, range: 140, fireRate: 0.70, slowFactor: 0.22, label: 'Absolute Zero', sprite: 't_ice_ua',
        blurb: 'Deep freeze — spirits barely crawl.' },
      { cost: 540, damage: 85, range: 135, fireRate: 0.75, slowFactor: 0.40, label: 'Hailstorm Bing', sprite: 't_ice_ub',
        blurb: 'Shredding hail — the pulse bites hard.' },
    ],
  },
};

/* canvas sprite name per tower type (render + DOM menus) */
const TOWER_SPRITE = {
  cell: 't_cell', durian: 't_durian', temple: 't_temple', camp: 't_camp',
  mata: 't_mata', wok: 't_wok', power: 't_power', ice: 't_ice',
};

/* Stats row for a live tower — levels 0-2 from `levels`, level 3 from the
   chosen ultimate (t.ult = 0|1). */
function towerStats(t) {
  const def = TOWER_TYPES[t.type];
  return t.level >= 3 ? def.ults[t.ult || 0] : def.levels[t.level];
}

/* Sprite name for a live tower — per-level art, ultimates carry their own */
function towerSpriteName(t) {
  const def = TOWER_TYPES[t.type];
  if (t.level >= 3) return def.ults[t.ult || 0].sprite;
  const name = TOWER_SPRITE[t.type] + (t.level > 0 ? '_' + (t.level + 1) : '');
  return Sprites.get(name) ? name : TOWER_SPRITE[t.type];
}

function towerTotalValue(type, level, ult) {
  let v = 0;
  for (let i = 0; i <= Math.min(level, 2); i++) v += TOWER_TYPES[type].levels[i].cost;
  if (level >= 3) v += TOWER_TYPES[type].ults[ult || 0].cost;
  return v;
}
