/* ===== Hero roster — champions of Singapore & SE Asian legend =====
   Heroes are controllable units (tap hero, tap ground to move).
   kind: 'melee' heroes block enemies on the road; 'ranged' heroes
   shoot from their hold point and can hit flying spirits.
   cost = merit price in the Armory (utama is free).
   special: aoe (melee splash r) | crit {chance,mul} | stun {chance,dur}
            splash (ranged splash r) | pierce (ignore armor)
            slow {factor,dur} | evade (dodge chance) | heal {rate,r}
            block (max enemies blocked at once)                        */
'use strict';

const HERO_TYPES = {
  utama: {
    name: 'Sang Nila Utama', emoji: '🦁', sprite: 'h_utama', cost: 0,
    kind: 'melee', hp: 360, regen: 14, speed: 105, damage: 24, atkRate: 1.1,
    range: 0, dmgType: 'physical', special: { stun: { chance: 0.22, dur: 1.1 } },
    blurb: 'The prince who named Singapura. His lion-roar strikes stagger foes.',
  },
  kancil: {
    name: 'Sang Kancil', emoji: '🦌', sprite: 'h_kancil', cost: 50,
    kind: 'melee', hp: 240, regen: 12, speed: 150, damage: 18, atkRate: 1.8,
    range: 0, dmgType: 'physical', special: { evade: 0.45 },
    blurb: 'The trickster mousedeer — blindingly fast and nearly impossible to hit.',
  },
  badang: {
    name: 'Badang', emoji: '💪', sprite: 'h_badang', cost: 60,
    kind: 'melee', hp: 560, regen: 16, speed: 80, damage: 34, atkRate: 0.8,
    range: 0, dmgType: 'physical', special: { aoe: 46 },
    blurb: 'The strongman who threw the Singapore Stone. Ground-slams crowds.',
  },
  samsui: {
    name: 'Samsui Sister', emoji: '👷', sprite: 'h_samsui', cost: 70,
    kind: 'ranged', hp: 260, regen: 10, speed: 95, damage: 20, atkRate: 0.9,
    range: 120, dmgType: 'physical', special: { splash: 38 },
    blurb: 'Red-hatted builder of the nation — hurls scalding mortar in a splash.',
  },
  tuah: {
    name: 'Hang Tuah', emoji: '🗡', sprite: 'h_tuah', cost: 80,
    kind: 'melee', hp: 320, regen: 12, speed: 120, damage: 26, atkRate: 1.5,
    range: 0, dmgType: 'physical', special: { crit: { chance: 0.25, mul: 3 } },
    blurb: 'The laksamana of Melaka. The keris Taming Sari never misses twice.',
  },
  nenek: {
    name: 'Nenek Kebayan', emoji: '🌿', sprite: 'h_nenek', cost: 90,
    kind: 'ranged', hp: 250, regen: 10, speed: 85, damage: 26, atkRate: 1.0,
    range: 135, dmgType: 'magic', special: { slow: { factor: 0.5, dur: 1.6 } },
    blurb: 'Forest witch of the kebun. Her hexes root spirits to the spot.',
  },
  boseng: {
    name: 'Lim Bo Seng', emoji: '🎖', sprite: 'h_boseng', cost: 100,
    kind: 'ranged', hp: 240, regen: 10, speed: 90, damage: 34, atkRate: 0.9,
    range: 170, dmgType: 'physical', special: { pierce: true },
    blurb: 'The war hero of Force 136. Armour-piercing rifle rounds, long range.',
  },
  radin: {
    name: 'Radin Mas', emoji: '👑', sprite: 'h_radin', cost: 110,
    kind: 'ranged', hp: 300, regen: 12, speed: 95, damage: 16, atkRate: 1.0,
    range: 115, dmgType: 'magic', special: { heal: { rate: 26, r: 110 } },
    blurb: 'The golden princess of Telok Blangah. Mends NSmen and heroes nearby.',
  },
  kusu: {
    name: 'Kusu Guardian', emoji: '🐢', sprite: 'h_kusu', cost: 120,
    kind: 'melee', hp: 780, regen: 30, speed: 60, damage: 20, atkRate: 0.9,
    range: 0, dmgType: 'physical', special: { block: 3 },
    blurb: 'The turtle that became an island. Blocks three spirits at once.',
  },
  merlia: {
    name: 'Merlion Guardian', emoji: '🌊', sprite: 'h_merlia', cost: 140,
    kind: 'ranged', hp: 380, regen: 14, speed: 85, damage: 30, atkRate: 0.8,
    range: 125, dmgType: 'magic', special: { splash: 48 },
    blurb: 'The living spirit of the Merlion — crashing waves strike in an arc.',
  },
};

const HERO_ORDER = ['utama', 'kancil', 'badang', 'samsui', 'tuah',
                    'nenek', 'boseng', 'radin', 'kusu', 'merlia'];

/* Acts 1–2 (levels 0..14) field ONE hero; acts 3–4 (15..29) field TWO. */
function heroSlots(li) { return li >= 15 ? 2 : 1; }

const HERO_RESPAWN = 13; // seconds
