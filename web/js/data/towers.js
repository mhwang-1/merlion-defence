/* ===== Tower catalogue — urban Singapore defenses ===== */
'use strict';

/*
  Each tower has 3 levels. damageType: 'physical' | 'magic' | 'splash'(physical aoe)
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
      { cost: 140, damage: 38, range: 155, fireRate: 2.5, label: '6G Array' },
    ],
  },
  durian: {
    name: 'Durian Launcher', emoji: '🍈',
    desc: 'Lobs spiky king-of-fruits. Splash damage, ground only.',
    damageType: 'physical', targets: 'ground', splash: 55,
    levels: [
      { cost: 100, damage: 32, range: 130, fireRate: 0.6,  label: 'Pasar Stall' },
      { cost: 140, damage: 58, range: 145, fireRate: 0.65, label: 'D24 Catapult' },
      { cost: 210, damage: 100, range: 160, fireRate: 0.7, label: 'Mao Shan Wang' },
    ],
  },
  temple: {
    name: 'Talisman Temple', emoji: '⛩',
    desc: 'Blessed talismans pierce armour and slow spirits.',
    damageType: 'magic', targets: 'both', slow: { factor: 0.6, dur: 1.4 },
    levels: [
      { cost: 110, damage: 26, range: 115, fireRate: 1.0, label: 'Wayside Shrine' },
      { cost: 160, damage: 48, range: 130, fireRate: 1.1, label: 'Temple Hall' },
      { cost: 240, damage: 85, range: 145, fireRate: 1.2, label: 'Grand Pagoda' },
    ],
  },
  camp: {
    name: 'NS Camp', emoji: '🎖',
    desc: 'Deploys 3 NSmen to block ground enemies on the road.',
    damageType: 'physical', targets: 'ground', barracks: true,
    levels: [
      { cost: 90,  damage: 8,  range: 95,  fireRate: 1, label: 'Recruits',  soldierHp: 110, respawn: 8 },
      { cost: 120, damage: 16, range: 105, fireRate: 1, label: 'NSFs',      soldierHp: 200, respawn: 7 },
      { cost: 180, damage: 28, range: 115, fireRate: 1, label: 'Commandos', soldierHp: 340, respawn: 6 },
    ],
  },
  mata: {
    name: 'Mata Sniper Post', emoji: '🎯',
    desc: 'Police marksman. Long-range shots that ignore armour.',
    damageType: 'physical', targets: 'both', pierce: true,
    levels: [
      { cost: 120, damage: 48,  range: 195, fireRate: 0.42, label: 'Neighbourhood Post' },
      { cost: 170, damage: 90,  range: 215, fireRate: 0.46, label: 'Marksman Nest' },
      { cost: 260, damage: 160, range: 240, fireRate: 0.50, label: 'STAR Overwatch' },
    ],
  },
  wok: {
    name: 'Hawker Wok', emoji: '🔥',
    desc: 'Flaming wok hei! Splash damage that keeps burning. Ground only.',
    damageType: 'physical', targets: 'ground', splash: 46, burnDur: 3,
    levels: [
      { cost: 100, damage: 20, range: 105, fireRate: 1.0,  burnDps: 9,  label: 'Zi Char Stall' },
      { cost: 150, damage: 34, range: 115, fireRate: 1.05, burnDps: 16, label: 'Wok Hei Master' },
      { cost: 230, damage: 56, range: 125, fireRate: 1.1,  burnDps: 27, label: 'Michelin Hawker' },
    ],
  },
  power: {
    name: 'Substation Coil', emoji: '⚡',
    desc: 'Grid lightning arcs between spirits. Magic chain damage.',
    damageType: 'magic', targets: 'both',
    levels: [
      { cost: 130, damage: 30, range: 130, fireRate: 0.80, chain: 2, label: 'PUB Substation' },
      { cost: 190, damage: 52, range: 140, fireRate: 0.85, chain: 3, label: 'Grid Coil' },
      { cost: 280, damage: 88, range: 155, fireRate: 0.90, chain: 4, label: 'Tesla Array' },
    ],
  },
  ice: {
    name: 'Ice Kacang Cart', emoji: '🍧',
    desc: 'Freezing pulse chills EVERY spirit in range. Hits air & ground.',
    damageType: 'magic', targets: 'both', slow: { dur: 1.6 },
    levels: [
      { cost: 110, damage: 10, range: 105, fireRate: 0.55, slowFactor: 0.50, label: 'Ais Kacang Cart' },
      { cost: 160, damage: 18, range: 115, fireRate: 0.60, slowFactor: 0.45, label: 'Snow Ice Stand' },
      { cost: 240, damage: 30, range: 125, fireRate: 0.65, slowFactor: 0.40, label: 'Blizzard Bing' },
    ],
  },
};

/* canvas sprite name per tower type (render + DOM menus) */
const TOWER_SPRITE = {
  cell: 't_cell', durian: 't_durian', temple: 't_temple', camp: 't_camp',
  mata: 't_mata', wok: 't_wok', power: 't_power', ice: 't_ice',
};

function towerTotalValue(type, level) {
  let v = 0;
  for (let i = 0; i <= level; i++) v += TOWER_TYPES[type].levels[i].cost;
  return v;
}
