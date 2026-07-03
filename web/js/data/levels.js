/* ===== 30 Singapore neighbourhood levels =====
   Every level has its OWN layout, sketched after the real place:
   road geometry, water bodies and landmarks follow the actual
   neighbourhood (simplified to a 960x600 tile).                  */
'use strict';

/*
  Layout format:
    paths:     [ [ [x,y], ... ] ]  waypoint roads (offscreen ends where sensible)
    spots:     [ [x,y], ... ]      build pads
    water:     [ [x,y,w,h,label?] ]
    landmarks: [ { x, y, kind, label, w?, h?, color? } ]
  Landmark kinds: building, market, mosque, pagoda, merlion, tower, gate,
                  spring, cliff, summit, playground, label
*/
const LAYOUTS = [

  // 0 — ANG MO KIO CENTRAL: Ave 6 (west) & Ave 8 (east) run N-S, joined by
  //     Ave 3; everything funnels to AMK Hub / MRT in the town centre.
  {
    paths: [
      [[260,-30],[260,390],[480,390],[480,630]],
      [[700,-30],[700,390],[480,390],[480,630]],
    ],
    spots: [[180,150],[340,150],[620,150],[780,150],[180,300],[340,300],[620,300],[780,300],[360,480],[600,480],[150,470],[840,470]],
    landmarks: [
      { x: 560, y: 500, kind: 'building', label: 'AMK Hub', w: 90, h: 60, color: '#ef8354' },
      { x: 120, y: 90,  kind: 'label',    label: 'Ave 6' },
      { x: 850, y: 90,  kind: 'label',    label: 'Ave 8' },
    ],
  },

  // 1 — TOA PAYOH TOWN PARK: walking loop around the central pond,
  //     observation tower, dragon playground to the south-east.
  {
    paths: [[[-30,200],[250,200],[250,440],[700,440],[700,200],[990,200]]],
    spots: [[150,120],[150,300],[150,520],[400,520],[560,520],[400,140],[560,140],[820,300],[820,120],[760,540],[300,320],[660,320]],
    water: [[330,250,300,140,'Town Park Pond']],
    landmarks: [
      { x: 480, y: 200, kind: 'tower', label: 'Observation Tower' },
      { x: 860, y: 540, kind: 'playground', label: 'Dragon Playground' },
    ],
  },

  // 2 — SERANGOON GARDENS: the famous roundabout; radial avenues feed it,
  //     Chomp Chomp hawker just off-circle.
  {
    paths: [
      [[480,-30],[480,200],[551,229],[580,300],[551,371],[480,400],[480,630]],
      [[-30,300],[380,300],[409,371],[480,400],[480,630]],
    ],
    spots: [[300,180],[300,420],[660,420],[660,260],[170,200],[170,400],[800,300],[800,480],[340,540],[620,540],[790,120],[300,60]],
    landmarks: [
      { x: 650, y: 150, kind: 'market', label: 'Chomp Chomp', w: 80, h: 40, color: '#8d6e63' },
    ],
  },

  // 3 — YISHUN DAM: a straight dam road between two waters.
  {
    paths: [[[-30,300],[400,300],[480,260],[560,300],[990,300]]],
    spots: [[120,220],[280,220],[680,220],[840,220],[120,380],[280,380],[680,380],[840,380],[480,380],[480,190]],
    water: [[0,0,960,170,'Lower Seletar Reservoir'],[0,430,960,170,'Strait of Johor']],
    landmarks: [
      { x: 480, y: 330, kind: 'label', label: 'Yishun Dam' },
    ],
  },

  // 4 — SEMBAWANG HOT SPRING PARK: winding garden trail past the spring pool.
  {
    paths: [[[-30,150],[300,150],[300,450],[620,450],[620,150],[990,150]]],
    spots: [[150,250],[150,60],[430,60],[430,250],[760,60],[760,250],[460,540],[150,540],[760,540],[870,300]],
    landmarks: [
      { x: 460, y: 320, kind: 'spring', label: 'Hot Spring' },
    ],
  },

  // 5 — WOODLANDS CAUSEWAY: the invasion crosses the Causeway from Johor,
  //     through the Checkpoint, into Woodlands town.
  {
    paths: [[[420,-30],[420,320],[700,320],[700,630]]],
    spots: [[540,260],[300,420],[540,420],[160,420],[160,560],[420,540],[840,420],[840,560],[560,560],[150,260]],
    water: [[0,80,960,140,'Straits of Johor']],
    landmarks: [
      { x: 260, y: 350, kind: 'building', label: 'Woodlands Checkpoint', w: 100, h: 46, color: '#78909c' },
      { x: 480, y: 30,  kind: 'label',    label: '→ JOHOR' },
    ],
  },

  // 6 — HOUGANG AVE 8: heartland HDB grid, the avenue snakes between blocks.
  {
    paths: [[[-30,480],[240,480],[240,160],[560,160],[560,480],[860,480],[860,-30]]],
    spots: [[120,380],[120,560],[360,380],[360,280],[120,60],[400,60],[700,60],[700,260],[700,560],[420,560],[350,560],[960,300]],
  },

  // 7 — PASIR RIS PARK: beach along the top, boardwalk loops the mangrove.
  {
    paths: [[[-30,190],[520,190],[520,260],[820,260],[820,500],[500,500],[500,630]]],
    spots: [[150,270],[300,270],[450,330],[650,180],[900,180],[900,400],[650,560],[300,450],[150,450],[300,560]],
    water: [[0,0,960,120,'Pasir Ris Beach'],[560,320,180,120,'Mangrove']],
  },

  // 8 — TAMPINES HUB: the ring road wraps Our Tampines Hub.
  {
    paths: [[[-30,300],[340,300],[340,170],[640,170],[640,430],[420,430],[420,630]]],
    spots: [[160,200],[160,400],[240,120],[480,100],[760,120],[760,300],[760,520],[560,520],[260,520],[860,400]],
    landmarks: [
      { x: 480, y: 300, kind: 'building', label: 'Our Tampines Hub', w: 130, h: 90, color: '#26a69a' },
    ],
  },

  // 9 — PUNGGOL WATERWAY: promenades on both banks of the waterway.
  {
    paths: [
      [[-30,220],[300,220],[300,160],[640,160],[640,220],[990,220]],
      [[-30,390],[360,390],[360,450],[700,450],[700,390],[990,390]],
    ],
    spots: [[150,80],[400,80],[640,80],[860,80],[150,520],[400,520],[640,520],[860,520]],
    water: [[0,270,960,70,'Punggol Waterway']],
  },

  // 10 — CHANGI VILLAGE: coast road past the hawker centre to the jetty.
  {
    paths: [[[-30,200],[430,200],[430,360],[700,360],[700,85]]],
    spots: [[150,300],[150,450],[360,450],[560,450],[560,260],[840,300],[840,450],[300,140],[560,140],[840,140]],
    water: [[0,0,960,110,'Changi Beach']],
    landmarks: [
      { x: 260, y: 320, kind: 'market', label: 'Hawker Centre', w: 80, h: 40, color: '#8d6e63' },
      { x: 790, y: 60,  kind: 'label',  label: 'Changi Point Jetty' },
    ],
  },

  // 11 — BEDOK INTERCHANGE: three trunk roads converge on the interchange.
  {
    paths: [
      [[-30,300],[300,300],[300,420],[480,420],[480,630]],
      [[990,300],[660,300],[660,420],[480,420],[480,630]],
      [[480,-30],[480,630]],
    ],
    spots: [[160,200],[160,400],[380,200],[580,200],[800,200],[800,400],[360,360],[600,360],[200,540],[760,540]],
    landmarks: [
      { x: 600, y: 550, kind: 'building', label: 'Bedok Mall', w: 80, h: 50, color: '#7e57c2' },
    ],
  },

  // 12 — GEYLANG SERAI: lorongs zigzag off the main road, market up north.
  {
    paths: [[[-30,460],[240,460],[240,220],[420,220],[420,460],[600,460],[600,220],[780,220],[780,460],[990,460]]],
    spots: [[120,360],[120,540],[330,340],[330,540],[510,340],[510,120],[690,340],[690,540],[880,340],[880,120],[150,120]],
    landmarks: [
      { x: 330, y: 140, kind: 'market', label: 'Geylang Serai Market', w: 90, h: 46, color: '#43a047' },
    ],
  },

  // 13 — KAMPONG GLAM: the streets bend around Sultan Mosque.
  {
    paths: [[[-30,480],[300,480],[300,250],[660,250],[660,480],[990,480]]],
    spots: [[150,380],[150,570],[420,380],[420,570],[560,380],[560,570],[800,380],[800,180],[870,570],[160,180],[300,120]],
    landmarks: [
      { x: 480, y: 160, kind: 'mosque', label: 'Sultan Mosque' },
    ],
  },

  // 14 — LITTLE INDIA: Serangoon Rd climbs the map NE in stair-steps
  //     past Tekka Centre and Mustafa.
  {
    paths: [[[-30,560],[240,560],[240,400],[480,400],[480,240],[720,240],[720,80],[990,80]]],
    spots: [[120,300],[360,300],[360,500],[600,340],[600,140],[840,300],[600,500],[120,140],[880,480],[360,140]],
    landmarks: [
      { x: 130, y: 480, kind: 'market',   label: 'Tekka Centre', w: 80, h: 44, color: '#fb8c00' },
      { x: 820, y: 180, kind: 'building', label: 'Mustafa Centre', w: 70, h: 56, color: '#5c6bc0' },
    ],
  },

  // 15 — MACRITCHIE TRAIL: the trail hugs the reservoir's south & east shore.
  {
    paths: [[[-30,520],[900,520],[900,90],[640,90],[640,-30]]],
    spots: [[150,420],[150,280],[150,140],[260,60],[450,60],[300,470],[500,470],[700,470],[60,60]],
    water: [[320,140,540,280,'MacRitchie Reservoir']],
  },

  // 16 — BUKIT TIMAH HILL: switchbacks climb to the 163 m summit.
  {
    paths: [[[-30,540],[760,540],[760,400],[200,400],[200,260],[760,260],[760,120],[480,120]]],
    spots: [[150,470],[400,470],[650,470],[870,470],[870,330],[400,330],[600,330],[120,330],[300,190],[600,190],[120,120],[870,120]],
    landmarks: [
      { x: 480, y: 70, kind: 'summit', label: 'Summit 163m' },
    ],
  },

  // 17 — BUKIT BATOK QUARRY (Little Guilin): the path rings the quarry lake.
  {
    paths: [[[480,630],[480,500],[200,500],[200,140],[760,140],[760,500],[990,500]]],
    spots: [[100,300],[100,80],[320,60],[480,60],[640,60],[870,300],[870,80],[320,570],[640,570],[100,570]],
    water: [[300,220,360,200,'Quarry Lake']],
    landmarks: [
      { x: 480, y: 195, kind: 'cliff', label: 'Little Guilin' },
    ],
  },

  // 18 — JURONG LAKE GARDENS: a big loop around the lake, pagoda on shore.
  {
    paths: [[[-30,90],[820,90],[820,530],[100,530],[100,630]]],
    spots: [[650,170],[650,300],[650,440],[40,300],[250,40],[450,40],[700,40],[900,300],[400,590],[600,590]],
    water: [[180,160,380,280,'Jurong Lake']],
    landmarks: [
      { x: 620, y: 360, kind: 'pagoda', label: 'Chinese Garden' },
    ],
  },

  // 19 — CLEMENTI FOREST: the old rail corridor cuts a diagonal through jungle.
  {
    paths: [[[-30,80],[200,80],[200,260],[420,260],[420,440],[640,440],[640,560],[990,560]]],
    spots: [[100,180],[320,160],[320,360],[120,400],[540,340],[540,160],[760,340],[880,440],[200,560],[60,300]],
  },

  // 20 — HAW PAR VILLA: hairpins climb the statue-lined hillside from the gate.
  {
    paths: [[[480,630],[480,520],[160,520],[160,400],[800,400],[800,280],[160,280],[160,160],[800,160],[990,160]]],
    spots: [[300,460],[600,460],[300,340],[600,340],[300,220],[600,220],[80,460],[880,340],[80,220],[880,90],[480,90]],
    landmarks: [
      { x: 580, y: 570, kind: 'gate',  label: 'Haw Par Villa' },
      { x: 100, y: 100, kind: 'label', label: 'Ten Courts of Hell' },
    ],
  },

  // 21 — QUEENSTOWN COMMONS: long parallel estate streets.
  {
    paths: [[[-30,160],[780,160],[780,340],[180,340],[180,520],[990,520]]],
    spots: [[120,80],[400,80],[700,80],[120,250],[400,250],[700,250],[300,430],[600,430],[880,430],[400,590],[700,590],[80,430]],
  },

  // 22 — TIONG BAHRU ESTATE: the art-deco horseshoe around the market.
  {
    paths: [[[220,-30],[220,400],[300,500],[480,540],[660,500],[740,400],[740,-30]]],
    spots: [[120,150],[120,350],[360,150],[360,330],[600,150],[600,330],[840,150],[840,350],[480,420],[480,120]],
    landmarks: [
      { x: 480, y: 300, kind: 'market', label: 'Tiong Bahru Market', w: 96, h: 50, color: '#bcaaa4' },
    ],
  },

  // 23 — CHINATOWN PAGODA ST: Pagoda / Temple / Smith streets in parallel.
  {
    paths: [[[-30,180],[760,180],[760,320],[200,320],[200,460],[990,460]]],
    spots: [[120,100],[400,100],[650,100],[120,250],[400,250],[600,250],[880,250],[300,390],[560,390],[820,390],[120,560],[500,560]],
    landmarks: [
      { x: 870, y: 120, kind: 'pagoda', label: 'Sri Mariamman' },
      { x: 110, y: 545, kind: 'building', label: 'Buddha Tooth Relic', w: 76, h: 50, color: '#c62828' },
    ],
  },

  // 24 — BOAT QUAY: the road follows the river bend below the CBD towers.
  {
    paths: [[[-30,430],[360,430],[520,400],[700,370],[990,370]]],
    spots: [[150,330],[150,150],[350,330],[350,150],[550,300],[550,120],[760,120],[880,250],[880,120]],
    water: [[0,500,500,100,'Singapore River'],[400,470,560,130,'']],
    landmarks: [
      { x: 760, y: 250, kind: 'building', label: 'UOB Plaza', w: 50, h: 90, color: '#546e7a' },
    ],
  },

  // 25 — CLARKE QUAY NIGHT: two bridges cross the river into the quay.
  {
    paths: [
      [[-30,190],[300,190],[300,420],[990,420]],
      [[-30,190],[700,190],[700,420],[990,420]],
    ],
    spots: [[150,100],[450,100],[820,100],[400,500],[600,500],[850,500],[200,470],[560,100]],
    water: [[0,260,960,90,'Singapore River']],
    landmarks: [
      { x: 500, y: 120, kind: 'building', label: 'Clarke Quay', w: 90, h: 40, color: '#ab47bc' },
    ],
  },

  // 26 — ORCHARD ROAD: the shopping boulevard steps gently uphill W→E.
  {
    paths: [[[-30,340],[240,340],[240,280],[520,280],[520,220],[800,220],[800,160],[990,160]]],
    spots: [[120,240],[120,440],[360,400],[360,120],[620,120],[450,380],[740,340],[880,260],[880,60],[160,120],[700,60]],
    landmarks: [
      { x: 310, y: 180, kind: 'building', label: 'ION Orchard', w: 70, h: 66, color: '#90a4ae' },
      { x: 620, y: 350, kind: 'building', label: 'Ngee Ann City', w: 110, h: 60, color: '#8d6e63' },
    ],
  },

  // 27 — MARINA BARRAGE: the dam road between reservoir and open sea.
  {
    paths: [[[-30,340],[300,320],[660,300],[990,290]]],
    spots: [[120,270],[300,260],[480,250],[660,250],[840,240],[300,380],[480,370],[660,360],[840,340]],
    water: [[0,0,960,230,'Marina Reservoir'],[0,400,960,200,'Singapore Strait']],
    landmarks: [
      { x: 170, y: 380, kind: 'building', label: 'Marina Barrage', w: 84, h: 40, color: '#66bb6a' },
    ],
  },

  // 28 — SENTOSA SILOSO: the beachfront path below Fort Siloso.
  {
    paths: [[[-30,420],[300,420],[300,300],[560,300],[560,420],[990,420]]],
    spots: [[150,330],[430,370],[430,200],[700,330],[700,180],[860,330],[860,180],[430,80],[150,80],[150,200]],
    water: [[0,480,960,120,'Siloso Beach']],
    landmarks: [
      { x: 120, y: 210, kind: 'gate', label: 'Fort Siloso' },
    ],
  },

  // 29 — MERLION PARK: the bayfront promenade past the Merlion itself.
  {
    paths: [[[300,-30],[300,180],[520,180],[520,480],[260,480],[260,630]]],
    spots: [[120,120],[120,420],[400,300],[400,90],[400,560],[80,560],[560,560],[140,180],[400,390]],
    water: [[620,0,340,600,'Marina Bay']],
    landmarks: [
      { x: 590, y: 300, kind: 'merlion',  label: 'The Merlion' },
      { x: 140, y: 300, kind: 'building', label: 'Fullerton Hotel', w: 90, h: 46, color: '#eceff1' },
    ],
  },
];

/* Normalize layouts: pull any build pad that sits too far from the road
   in toward the nearest road point (max useful tower range ~160), and
   keep pads on the play field, out of water and clear of landmarks.    */
(function normalizeLayouts() {
  const inWater = (L, x, y) => (L.water || []).some(([wx, wy, ww, wh]) =>
    x > wx - 26 && x < wx + ww + 26 && y > wy - 30 && y < wy + wh + 26);
  const nearLandmark = (L, x, y) => (L.landmarks || []).some(lm =>
    lm.kind !== 'label' && dist(x, y, lm.x, lm.y) < ((lm.w || 50) / 2 + 44));

  for (const L of LAYOUTS) {
    const built = L.paths.map(p => buildPath(p));
    const roadDist = (x, y) => Math.min(...built.map(p => distToPath(p, x, y)));

    // hand-placed spots are treated as hints; each pad is re-seated on the
    // nearest valid grid cell (near a road, on land, clear of everything)
    const placed = [];
    for (const [hx, hy] of L.spots) {
      let best = null, bd = Infinity;
      for (let gx = 40; gx <= 920; gx += 16) {
        for (let gy = 52; gy <= 564; gy += 16) {
          const rd = roadDist(gx, gy);
          if (rd < 32 || rd > 100) continue;
          if (inWater(L, gx, gy) || nearLandmark(L, gx, gy)) continue;
          if (placed.some(([px, py]) => dist(gx, gy, px, py) < 56)) continue;
          const dd = dist(gx, gy, hx, hy);
          if (dd < bd) { bd = dd; best = [gx, gy]; }
        }
      }
      if (best) placed.push(best);
    }
    L.spots = placed;
  }
})();

/*
  30 levels — real Singapore neighbourhoods, difficulty ramps up.
  Ordered as a geographic campaign: each tier is a cluster of adjacent
  areas, and the invasion marches north → east → west/central → city.
  Every level uses its own layout (layout index == level index).
*/
const LEVELS = [
  // === ACT 1 · NORTHERN HEARTLANDS (easy) ===
  { name: 'Ang Mo Kio Central',  diff: 'easy',   layout: 0,  theme: 'town',   waves: 6,  gold: 240, lives: 20 },
  { name: 'Toa Payoh Town Park', diff: 'easy',   layout: 1,  theme: 'park',   waves: 6,  gold: 240, lives: 20 },
  { name: 'Serangoon Gardens',   diff: 'easy',   layout: 2,  theme: 'town',   waves: 7,  gold: 250, lives: 20 },
  { name: 'Yishun Dam',          diff: 'easy',   layout: 3,  theme: 'river',  waves: 7,  gold: 250, lives: 20 },
  { name: 'Sembawang Hot Spring',diff: 'easy',   layout: 4,  theme: 'park',   waves: 7,  gold: 260, lives: 20 },
  { name: 'Woodlands Causeway',  diff: 'easy',   layout: 5,  theme: 'coast',  waves: 8,  gold: 260, lives: 20 },

  // === ACT 2 · THE EAST (normal) ===
  { name: 'Hougang Ave 8',       diff: 'normal', layout: 6,  theme: 'town',   waves: 8,  gold: 270, lives: 18 },
  { name: 'Pasir Ris Park',      diff: 'normal', layout: 7,  theme: 'coast',  waves: 8,  gold: 270, lives: 18 },
  { name: 'Tampines Hub',        diff: 'normal', layout: 8,  theme: 'town',   waves: 9,  gold: 280, lives: 18 },
  { name: 'Punggol Waterway',    diff: 'normal', layout: 9,  theme: 'river',  waves: 9,  gold: 300, lives: 18, boss: 'nagaBoss' },
  { name: 'Changi Village',      diff: 'normal', layout: 10, theme: 'coast',  waves: 9,  gold: 280, lives: 16 },
  { name: 'Bedok Interchange',   diff: 'normal', layout: 11, theme: 'town',   waves: 9,  gold: 280, lives: 16 },
  { name: 'Geylang Serai',       diff: 'normal', layout: 12, theme: 'town',   waves: 10, gold: 290, lives: 16 },
  { name: 'Kampong Glam',        diff: 'normal', layout: 13, theme: 'town',   waves: 10, gold: 290, lives: 16 },
  { name: 'Little India',        diff: 'normal', layout: 14, theme: 'town',   waves: 10, gold: 290, lives: 16 },

  // === ACT 3 · CENTRAL & WEST (hard) ===
  { name: 'MacRitchie Trail',    diff: 'hard',   layout: 15, theme: 'forest', waves: 10, gold: 300, lives: 15 },
  { name: 'Bukit Timah Hill',    diff: 'hard',   layout: 16, theme: 'forest', waves: 11, gold: 300, lives: 15 },
  { name: 'Bukit Batok Quarry',  diff: 'hard',   layout: 17, theme: 'forest', waves: 11, gold: 310, lives: 15 },
  { name: 'Jurong Lake Gardens', diff: 'hard',   layout: 18, theme: 'park',   waves: 11, gold: 310, lives: 15 },
  { name: 'Clementi Forest',     diff: 'hard',   layout: 19, theme: 'forest', waves: 12, gold: 320, lives: 15 },
  { name: 'Haw Par Villa',       diff: 'hard',   layout: 20, theme: 'park',   waves: 12, gold: 330, lives: 12, boss: 'rangda' },
  { name: 'Queenstown Commons',  diff: 'hard',   layout: 21, theme: 'town',   waves: 12, gold: 380, lives: 12 },
  { name: 'Tiong Bahru Estate',  diff: 'hard',   layout: 22, theme: 'town',   waves: 12, gold: 330, lives: 12 },
  { name: 'Chinatown Pagoda St', diff: 'hard',   layout: 23, theme: 'town',   waves: 13, gold: 330, lives: 12 },
  { name: 'Boat Quay',           diff: 'hard',   layout: 24, theme: 'river',  waves: 13, gold: 340, lives: 12 },

  // === ACT 4 · CITY & THE SOUTH (heroic) ===
  { name: 'Clarke Quay Night',   diff: 'heroic', layout: 25, theme: 'river',  waves: 13, gold: 440, lives: 12 },
  { name: 'Orchard Road',        diff: 'heroic', layout: 26, theme: 'town',   waves: 14, gold: 350, lives: 10 },
  { name: 'Marina Barrage',      diff: 'heroic', layout: 27, theme: 'coast',  waves: 14, gold: 350, lives: 10 },
  { name: 'Sentosa Siloso',      diff: 'heroic', layout: 28, theme: 'coast',  waves: 15, gold: 360, lives: 10 },
  { name: 'Merlion Park',        diff: 'heroic', layout: 29, theme: 'coast',  waves: 15, gold: 400, lives: 10, boss: 'yamaOx' },
];

/* Campaign acts — geographic clusters shown as headers in level select */
const ACTS = [
  { at: 0,  name: 'ACT 1 · Northern Heartlands', blurb: 'Ang Mo Kio → Woodlands' },
  { at: 6,  name: 'ACT 2 · The East',            blurb: 'Hougang → Little India' },
  { at: 15, name: 'ACT 3 · Central & West',      blurb: 'MacRitchie → Boat Quay' },
  { at: 25, name: 'ACT 4 · City & the South',    blurb: 'Clarke Quay → Merlion Park' },
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
