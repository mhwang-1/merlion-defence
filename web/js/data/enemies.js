/* ===== Enemy bestiary — creatures of SE / South / East Asian folklore ===== */
'use strict';

/*
  armor  : 0..0.8  physical damage reduction
  resist : 0..0.8  magic damage reduction
  flying : ignores path blocking + durians can't hit
  speed  : px per second (base)
*/
const ENEMY_TYPES = {
  // --- fodder ---
  toyol: {
    name: 'Toyol', emoji: '👶', origin: 'Malay',
    hp: 72, speed: 78, armor: 0, resist: 0, bounty: 6, lives: 51,
    size: 13, color: '#8bc34a',
    desc: 'Mischievous child spirit that steals from the living.',
  },
  pocong: {
    name: 'Pocong', emoji: '🧟', origin: 'Indonesian/Malay',
    hp: 110, speed: 46, armor: 0.1, resist: 0, bounty: 9, lives: 51,
    size: 15, color: '#e0e0e0',
    desc: 'A hopping shrouded ghost, bound in its burial cloth.',
  },
  pontianak: {
    name: 'Pontianak', emoji: '👻', origin: 'Malay',
    hp: 100, speed: 95, armor: 0, resist: 0.35, bounty: 12, lives: 51,
    size: 15, color: '#f8bbd0',
    desc: 'Vengeful female spirit announced by the scent of frangipani.',
  },
  // --- flying ---
  manananggal: {
    name: 'Manananggal', emoji: '🦇', origin: 'Filipino',
    hp: 90, speed: 85, armor: 0, resist: 0.2, bounty: 14, lives: 51,
    size: 15, color: '#ce93d8', flying: true,
    desc: 'Self-severing viscera-flyer of Philippine legend.',
  },
  garuda: {
    name: 'Garuda Hatchling', emoji: '🦅', origin: 'Hindu/Buddhist',
    hp: 180, speed: 70, armor: 0.25, resist: 0.1, bounty: 20, lives: 51,
    size: 17, color: '#ffb74d', flying: true,
    desc: 'Young of the divine eagle. Armoured feathers deflect bullets.',
  },
  // --- armored / tanks ---
  jiangshi: {
    name: 'Jiangshi', emoji: '🧛', origin: 'Chinese',
    hp: 220, speed: 38, armor: 0.5, resist: 0, bounty: 18, lives: 51,
    size: 16, color: '#90a4ae',
    desc: 'Hopping vampire in Qing robes. Stiff but very sturdy.',
  },
  rakshasa: {
    name: 'Rakshasa', emoji: '👹', origin: 'Indian',
    hp: 350, speed: 52, armor: 0.35, resist: 0.35, bounty: 30, lives: 52,
    size: 19, color: '#ef5350',
    desc: 'Shape-shifting demon warrior of the epics.',
  },
  oni: {
    name: 'Oni', emoji: '👺', origin: 'Japanese',
    hp: 450, speed: 40, armor: 0.55, resist: 0.1, bounty: 34, lives: 52,
    size: 20, color: '#e53935',
    desc: 'Club-wielding ogre. Nearly immune to physical attacks.',
  },
  // --- spectral (magic-resist) ---
  hantuRaya: {
    name: 'Hantu Raya', emoji: '🌑', origin: 'Malay',
    hp: 290, speed: 55, armor: 0.1, resist: 0.6, bounty: 28, lives: 52,
    size: 18, color: '#7e57c2',
    desc: 'A grand spirit familiar; talismans barely touch it.',
  },
  krasue: {
    name: 'Krasue', emoji: '💀', origin: 'Thai/Khmer',
    hp: 140, speed: 105, armor: 0, resist: 0.5, bounty: 18, lives: 51,
    size: 14, color: '#ff8a65', flying: true,
    desc: 'Floating head trailing its organs — fast and eerie.',
  },
  // --- swarm ---
  kuntilanakSwarm: {
    name: 'Orang Minyak', emoji: '🛢', origin: 'Malay',
    hp: 85, speed: 120, armor: 0.15, resist: 0.15, bounty: 8, lives: 51,
    size: 13, color: '#4e342e',
    desc: 'Slippery oily man — hard to catch, quick on his feet.',
  },
  // --- bosses ---
  nagaBoss: {
    name: 'Naga', emoji: '🐉', origin: 'SE Asian',
    hp: 2400, speed: 26, armor: 0.4, resist: 0.4, bounty: 200, lives: 10,
    size: 28, color: '#26a69a', boss: true,
    desc: 'Serpent-king of the rivers. A true calamity.',
  },
  rangda: {
    name: 'Rangda', emoji: '🎭', origin: 'Balinese',
    hp: 1500, speed: 34, armor: 0.2, resist: 0.65, bounty: 150, lives: 8,
    size: 25, color: '#ab47bc', boss: true,
    desc: 'The demon queen of the Leyaks. Magic slides right off her.',
  },
  yamaOx: {
    name: 'Ox-Head Warden', emoji: '🐂', origin: 'Chinese/Buddhist',
    hp: 1900, speed: 30, armor: 0.6, resist: 0.15, bounty: 170, lives: 8,
    size: 26, color: '#8d6e63', boss: true,
    desc: 'Underworld gaoler in iron armour, come to collect souls.',
  },
};
