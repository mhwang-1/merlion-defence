#!/usr/bin/env node
/* ===== Build-time tool: bake real Singapore geography into level data =====

   For each of the 30 levels we query the Overpass API (OpenStreetMap) for the
   real road network, water bodies, rail viaducts, parks and large building
   footprints around the actual neighbourhood, then:

     - project everything into the 960x600 game canvas
     - route the enemy path ALONG THE REAL STREETS (Dijkstra over the OSM
       road graph between hand-picked real-world entry/exit points)
     - simplify + quantize the geometry
     - write web/js/data/geo.js

   Usage:
     node tools/fetch-geo.js            # fetch all levels (cached)
     node tools/fetch-geo.js --level 0  # single level
     node tools/fetch-geo.js --preview  # also write SVG previews to tools/preview/

   Raw Overpass responses are cached in tools/cache/ so re-runs are offline.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, 'cache');
const PREVIEW = path.join(__dirname, 'preview');
const OUT = path.join(ROOT, 'web', 'js', 'data', 'geo.js');

const W = 960, H = 600;
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/* ---------------------------------------------------------------- specs --
   Each level: real-world centre + bbox height (degrees of latitude; width is
   1.6x for the 960x600 canvas), enemy path endpoints (routed on real roads),
   landmark anchors, and an optional open-sea seed for coastline flood fill.
   Coordinates picked off the real places on OpenStreetMap.
--------------------------------------------------------------------------- */
const SPECS = [
  { // 0 Ang Mo Kio Central — Ave 8 & Ave 6 feed AMK Hub / MRT; NSL viaduct runs N-S
    name: 'Ang Mo Kio Central', c: [1.36925, 103.84870], h: 0.0092,
    paths: [
      { from: [1.37380, 103.84840], to: [1.36940, 103.84840] },   // down Ave 8 to the Hub
      { from: [1.37370, 103.84400], via: [[1.36760, 103.84450]], to: [1.36940, 103.84840] }, // down Ave 6, in via Ave 3
    ],
    landmarks: [
      { at: [1.36910, 103.84830], kind: 'building', label: 'AMK Hub', match: /AMK Hub/i },
      { at: [1.37000, 103.84960], kind: 'label', label: 'Ang Mo Kio MRT' },
    ],
  },
  { // 1 Toa Payoh Town Park — Lor 6 & Lor 2 around the park pond
    name: 'Toa Payoh Town Park', c: [1.33430, 103.84860], h: 0.0080,
    paths: [
      { from: [1.33810, 103.84540], to: [1.33270, 103.84730] },
      { from: [1.33810, 103.85280], to: [1.33270, 103.84730] },
    ],
    landmarks: [
      { at: [1.33330, 103.84850], kind: 'tower', label: 'Observation Tower' },
      { at: [1.33270, 103.84700], kind: 'label', label: 'Toa Payoh Int' },
    ],
  },
  { // 2 Serangoon Gardens — the famous roundabout, radial avenues
    name: 'Serangoon Gardens', c: [1.36400, 103.86560], h: 0.0078,
    paths: [
      { from: [1.36740, 103.86800], to: [1.36330, 103.86480] },
      { from: [1.36060, 103.86230], to: [1.36330, 103.86480] },
    ],
    landmarks: [
      { at: [1.36430, 103.86680], kind: 'market', label: 'Chomp Chomp', match: /Chomp Chomp/i },
      { at: [1.36390, 103.86560], kind: 'label', label: 'The Circus' },
    ],
  },
  { // 3 Yishun Dam — the straight dam road between two waters
    name: 'Yishun Dam', c: [1.42500, 103.85700], h: 0.0090,
    paths: [{ from: [1.42260, 103.85020], to: [1.42780, 103.86300] }],
    landmarks: [{ at: [1.42500, 103.85660], kind: 'label', label: 'Yishun Dam' }],
    seaSeed: [1.42900, 103.85500],
  },
  { // 4 Sembawang Hot Spring Park — Gambas Ave to the spring
    name: 'Sembawang Hot Spring', c: [1.43550, 103.82550], h: 0.0080, allowMinor: true,
    paths: [{ from: [1.43230, 103.81960], via: [[1.43590, 103.82750]], to: [1.43460, 103.83060] }],
    landmarks: [{ at: [1.43640, 103.82780], kind: 'spring', label: 'Hot Spring' }],
  },
  { // 5 Woodlands Causeway — across the Causeway, through the Checkpoint
    name: 'Woodlands Causeway', c: [1.44650, 103.76980], h: 0.0095,
    paths: [{ from: [1.45080, 103.76680], to: [1.44240, 103.77140] }],
    landmarks: [
      { at: [1.44540, 103.76900], kind: 'building', label: 'Woodlands Checkpoint', match: /Woodlands Checkpoint/i },
      { at: [1.45050, 103.76650], kind: 'label', label: 'To Johor' },
    ],
    seaSeed: [1.44950, 103.77400],
  },
  { // 6 Hougang Ave 8 — heartland HDB grid
    name: 'Hougang Ave 8', c: [1.37150, 103.89150], h: 0.0085,
    paths: [{ from: [1.37560, 103.89050], via: [[1.37150, 103.89250]], to: [1.37110, 103.89290] }],
    landmarks: [{ at: [1.37100, 103.89300], kind: 'label', label: 'Hougang Ave 8' }],
  },
  { // 7 Pasir Ris Park — beach along the top, park drive
    name: 'Pasir Ris Park', c: [1.38050, 103.95200], h: 0.0080, allowMinor: true, footpaths: true,
    paths: [{ from: [1.37750, 103.94480], to: [1.38180, 103.95760] }],
    landmarks: [{ at: [1.38350, 103.95100], kind: 'label', label: 'Pasir Ris Beach' }],
    seaSeed: [1.38550, 103.95200],
  },
  { // 8 Tampines Hub — ring roads wrap Our Tampines Hub
    // maxZoom 1: the two lanes approach from opposite corners — zooming
    // spreads them so far apart the split defense becomes unwinnable
    name: 'Tampines Hub', c: [1.35310, 103.94020], h: 0.0080, maxZoom: 1,
    paths: [
      { from: [1.35670, 103.93720], to: [1.35330, 103.94050] },
      { from: [1.34950, 103.94380], to: [1.35330, 103.94050] },
    ],
    landmarks: [{ at: [1.35330, 103.94060], kind: 'building', label: 'Our Tampines Hub', match: /Tampines Hub/i }],
  },
  { // 9 Punggol Waterway — promenades on both banks
    name: 'Punggol Waterway', c: [1.40680, 103.90600], h: 0.0078,
    paths: [
      { from: [1.41020, 103.90200], to: [1.40530, 103.90280] },
      { from: [1.40330, 103.91050], to: [1.40530, 103.90280] },
    ],
    landmarks: [{ at: [1.40680, 103.90650], kind: 'label', label: 'Punggol Waterway' }],
  },
  { // 10 Changi Village — coast road past the hawker centre to the jetty
    name: 'Changi Village', c: [1.38900, 103.98790], h: 0.0075,
    paths: [{ from: [1.38560, 103.98420], to: [1.39150, 103.98800] }],
    landmarks: [
      { at: [1.38920, 103.98790], kind: 'market', label: 'Hawker Centre', match: /Changi Village.*(Hawker|Market)/i },
      { at: [1.39210, 103.98830], kind: 'label', label: 'Changi Pt Jetty' },
    ],
    seaSeed: [1.39250, 103.98500],
  },
  { // 11 Bedok Interchange — trunk roads converge on the interchange
    name: 'Bedok Interchange', c: [1.32450, 103.92980], h: 0.0080,
    paths: [
      { from: [1.32810, 103.92720], to: [1.32480, 103.92990] },
      { from: [1.32120, 103.93400], to: [1.32480, 103.92990] },
    ],
    landmarks: [{ at: [1.32490, 103.92920], kind: 'building', label: 'Bedok Mall', match: /Bedok Mall/i }],
  },
  { // 12 Geylang Serai — lorongs off Changi Rd / Sims Ave, market up north
    name: 'Geylang Serai', c: [1.31680, 103.89800], h: 0.0075,
    paths: [{ from: [1.31530, 103.89230], to: [1.31700, 103.89890] }],
    landmarks: [{ at: [1.31690, 103.89870], kind: 'market', label: 'Geylang Serai Market', match: /Geylang Serai/i }],
  },
  { // 13 Kampong Glam — streets bend around Sultan Mosque
    name: 'Kampong Glam', c: [1.30260, 103.85910], h: 0.0068,
    paths: [{ from: [1.30560, 103.85630], via: [[1.30170, 103.85850]], to: [1.30230, 103.86000] }],
    landmarks: [{ at: [1.30230, 103.85920], kind: 'mosque', label: 'Sultan Mosque' }],
  },
  { // 14 Little India — Serangoon Rd past Tekka Centre
    name: 'Little India', c: [1.30690, 103.85100], h: 0.0078,
    paths: [{ from: [1.31030, 103.85430], to: [1.30590, 103.84920] }],
    landmarks: [
      { at: [1.30610, 103.85070], kind: 'market', label: 'Tekka Centre', match: /Tekka/i },
      { at: [1.30960, 103.85480], kind: 'label', label: 'Serangoon Rd' },
    ],
  },
  { // 15 MacRitchie — Lornie Rd hugs the reservoir's south shore
    name: 'MacRitchie Trail', c: [1.34100, 103.83380], h: 0.0085,
    paths: [{ from: [1.33740, 103.82830], to: [1.34240, 103.83950] }],
    landmarks: [{ at: [1.34290, 103.83280], kind: 'label', label: 'MacRitchie Reservoir' }],
  },
  { // 16 Bukit Timah Hill — Hindhede Dr climbs toward the summit
    name: 'Bukit Timah Hill', c: [1.34870, 103.77800], h: 0.0080, allowMinor: true,
    paths: [{ from: [1.34500, 103.78140], to: [1.35120, 103.77680] }],
    landmarks: [{ at: [1.35440, 103.77630], kind: 'summit', label: 'Summit 163m' }],
  },
  { // 17 Bukit Batok Quarry (Little Guilin)
    name: 'Bukit Batok Quarry', c: [1.34830, 103.74850], h: 0.0075,
    paths: [{ from: [1.34450, 103.74640], to: [1.35010, 103.74980] }],
    landmarks: [{ at: [1.34790, 103.74830], kind: 'cliff', label: 'Little Guilin' }],
  },
  { // 18 Jurong Lake Gardens — Yuan Ching Rd along the lake, pagodas on shore
    name: 'Jurong Lake Gardens', c: [1.34000, 103.72550], h: 0.0090,
    paths: [{ from: [1.34430, 103.72300], to: [1.33710, 103.72460] }],
    landmarks: [{ at: [1.34000, 103.72960], kind: 'pagoda', label: 'Chinese Garden' }],
  },
  { // 19 Clementi Forest — the old rail corridor cuts through jungle
    name: 'Clementi Forest', c: [1.32450, 103.77850], h: 0.0090, allowMinor: true,
    paths: [{ from: [1.32890, 103.77380], to: [1.32040, 103.78120] }],
    landmarks: [{ at: [1.32450, 103.77850], kind: 'label', label: 'Rail Corridor' }],
  },
  { // 20 Haw Par Villa — Pasir Panjang Rd past the gate
    name: 'Haw Par Villa', c: [1.28230, 103.78300], h: 0.0072,
    paths: [{ from: [1.27890, 103.78740], to: [1.28470, 103.78180] }],
    landmarks: [
      { at: [1.28380, 103.78180], kind: 'gate', label: 'Haw Par Villa' },
      { at: [1.28500, 103.78350], kind: 'label', label: 'Ten Courts of Hell' },
    ],
  },
  { // 21 Queenstown Commons — Commonwealth Ave / Margaret Dr estates
    name: 'Queenstown Commons', c: [1.29750, 103.80300], h: 0.0078,
    paths: [{ from: [1.30080, 103.79880], to: [1.29470, 103.80600] }],
    landmarks: [{ at: [1.29480, 103.80590], kind: 'label', label: 'Queenstown MRT' }],
  },
  { // 22 Tiong Bahru Estate — the art-deco horseshoe around the market
    name: 'Tiong Bahru Estate', c: [1.28540, 103.83180], h: 0.0068,
    paths: [{ from: [1.28880, 103.83180], via: [[1.28510, 103.83280]], to: [1.28480, 103.83240] }],
    landmarks: [{ at: [1.28500, 103.83220], kind: 'market', label: 'Tiong Bahru Market', match: /Tiong Bahru Market/i }],
  },
  { // 23 Chinatown — Pagoda / Temple / Smith streets in parallel
    name: 'Chinatown Pagoda St', c: [1.28330, 103.84400], h: 0.0062, allowMinor: true,
    paths: [{ from: [1.28790, 103.83950], via: [[1.28440, 103.84450]], to: [1.28330, 103.84520] }],
    landmarks: [
      { at: [1.28280, 103.84510], kind: 'pagoda', label: 'Sri Mariamman' },
      { at: [1.28150, 103.84420], kind: 'building', label: 'Buddha Tooth Relic', match: /Buddha Tooth/i },
    ],
  },
  { // 24 Boat Quay — the road follows the river bend below the CBD towers
    name: 'Boat Quay', c: [1.28650, 103.84900], h: 0.0062,
    paths: [{ from: [1.28960, 103.84590], to: [1.28560, 103.85110] }],
    landmarks: [
      { at: [1.28480, 103.85080], kind: 'building', label: 'UOB Plaza', match: /UOB Plaza/i },
      { at: [1.28700, 103.84900], kind: 'label', label: 'Boat Quay' },
    ],
  },
  { // 25 Clarke Quay — bridges cross the river into the quay
    name: 'Clarke Quay Night', c: [1.29020, 103.84480], h: 0.0062,
    paths: [
      { from: [1.29350, 103.84500], to: [1.28870, 103.84480] },
      { from: [1.28820, 103.84070], to: [1.28870, 103.84480] },
    ],
    landmarks: [{ at: [1.28930, 103.84640], kind: 'building', label: 'Clarke Quay', match: /Clarke Quay/i }],
  },
  { // 26 Orchard Road — the shopping boulevard
    name: 'Orchard Road', c: [1.30330, 103.83450], h: 0.0068,
    paths: [{ from: [1.30650, 103.82970], to: [1.30190, 103.83870] }],
    landmarks: [
      { at: [1.30400, 103.83180], kind: 'building', label: 'ION Orchard', match: /ION Orchard/i },
      { at: [1.30260, 103.83480], kind: 'building', label: 'Ngee Ann City', match: /Ngee Ann City|Takashimaya/i },
    ],
  },
  { // 27 Marina Barrage — the dam between reservoir and open sea
    // maxZoom capped: at ×1.75 the dam road grows too long to defend in heroic
    name: 'Marina Barrage', c: [1.28050, 103.87050], h: 0.0080, maxZoom: 1.4,
    paths: [{ from: [1.27760, 103.86590], to: [1.28230, 103.87200] }],
    landmarks: [{ at: [1.28030, 103.87090], kind: 'building', label: 'Marina Barrage', match: /Marina Barrage/i }],
    seaSeed: [1.27650, 103.87500],
  },
  { // 28 Sentosa Siloso — the beachfront road below Fort Siloso
    name: 'Sentosa Siloso', c: [1.25550, 103.81300], h: 0.0072, allowMinor: true,
    paths: [{ from: [1.25900, 103.81820], to: [1.25640, 103.80940] }],
    landmarks: [{ at: [1.25680, 103.80930], kind: 'gate', label: 'Fort Siloso' }],
    seaSeed: [1.25900, 103.80900],
  },
  { // 29 Merlion Park — the bayfront promenade past the Merlion
    name: 'Merlion Park', c: [1.28650, 103.85300], h: 0.0068,
    paths: [{ from: [1.29010, 103.85320], via: [[1.28680, 103.85310]], to: [1.28580, 103.85280] }],
    landmarks: [
      { at: [1.28680, 103.85430], kind: 'merlion', label: 'The Merlion' },
      { at: [1.28620, 103.85290], kind: 'building', label: 'Fullerton Hotel', match: /Fullerton Hotel/i },
    ],
    seaSeed: [1.28800, 103.85700],
  },
];

/* ------------------------------------------------------------- helpers -- */

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MerlionDefense-map-baker/1.0 (game dev tool; one-off fetch)',
      },
      timeout: 90000,
    }, res => {
      let data = '';
      res.on('data', d => (data += d));
      res.on('end', () => res.statusCode === 200 ? resolve(data) : reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`)));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end('data=' + encodeURIComponent(body));
  });
}

async function overpass(query) {
  let err;
  for (const m of MIRRORS) {
    try { return await post(m, query); }
    catch (e) { err = e; console.log(`  mirror failed (${e.message}), trying next…`); }
  }
  throw err;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function bboxOf(spec) {
  const dlat = spec.h, dlon = spec.h * 1.6; // canvas is 960x600; deg lon ≈ deg lat at 1.3°N
  return {
    s: spec.c[0] - dlat / 2, n: spec.c[0] + dlat / 2,
    w: spec.c[1] - dlon / 2, e: spec.c[1] + dlon / 2,
  };
}

function projector(bb) {
  return ([lat, lon]) => [
    (lon - bb.w) / (bb.e - bb.w) * W,
    (bb.n - lat) / (bb.n - bb.s) * H,
  ];
}

function q(v) { return Math.round(v); } // quantize to px ints

/* Douglas-Peucker simplification */
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, maxI = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - x1) * dx + (pts[i][1] - y1) * dy) / len2));
      const px = x1 + dx * t, py = y1 + dy * t;
      const d = Math.hypot(pts[i][0] - px, pts[i][1] - py);
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tol) { keep[maxI] = true; stack.push([a, maxI], [maxI, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

/* Stitch relation member ways into closed rings (best effort). */
function stitchRings(members) {
  const segs = members.map(m => m.geometry.map(g => [g.lat, g.lon])).filter(s => s.length > 1);
  const rings = [];
  const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
  while (segs.length) {
    let ring = segs.shift();
    let closed = key(ring[0]) === key(ring[ring.length - 1]);
    let guard = 0;
    while (!closed && guard++ < 400) {
      const end = key(ring[ring.length - 1]);
      let found = -1, rev = false;
      for (let i = 0; i < segs.length; i++) {
        if (key(segs[i][0]) === end) { found = i; break; }
        if (key(segs[i][segs[i].length - 1]) === end) { found = i; rev = true; break; }
      }
      if (found < 0) break;
      let s = segs.splice(found, 1)[0];
      if (rev) s = s.slice().reverse();
      ring = ring.concat(s.slice(1));
      closed = key(ring[0]) === key(ring[ring.length - 1]);
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}

/* --------------------------------------------------------- road classes -- */
const ROAD_CLASS = {
  motorway: 0, trunk: 0, motorway_link: 0, trunk_link: 0,
  primary: 1, primary_link: 1,
  secondary: 2, secondary_link: 2, tertiary: 2, tertiary_link: 2,
  residential: 3, unclassified: 3, living_street: 3,
  service: 4, pedestrian: 4,
  footway: 4, path: 4, cycleway: 4, track: 4,
};
const ROUTE_COST = [0.8, 0.82, 0.88, 1.0, 1.45]; // gently prefer big roads

/* ------------------------------------------------------------ Overpass -- */

async function fetchLevel(i, spec) {
  fs.mkdirSync(CACHE, { recursive: true });
  const cacheFile = path.join(CACHE, `L${i}.json`);
  if (fs.existsSync(cacheFile)) {
    console.log(`L${i} ${spec.name}: cached`);
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  const bb = bboxOf(spec);
  const B = `(${bb.s},${bb.w},${bb.n},${bb.e})`;
  const query = `[out:json][timeout:90];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link${spec.footpaths ? '|footway|path|cycleway|track' : ''})$"]${B};
  way["railway"~"^(rail|subway|monorail|light_rail)$"]${B};
  way["natural"="water"]${B};
  way["waterway"~"^(riverbank|dock|canal)$"]${B};
  relation["natural"="water"]${B};
  relation["waterway"="riverbank"]${B};
  way["natural"="coastline"]${B};
  way["leisure"~"^(park|garden|nature_reserve|pitch|golf_course|playground|swimming_pool|sports_centre|track|dog_park)$"]${B};
  node["leisure"="playground"]${B};
  way["amenity"="parking"]${B};
  way["landuse"~"^(forest|grass|recreation_ground|meadow|village_green|cemetery)$"]${B};
  way["natural"~"^(wood|scrub|beach|sand)$"]${B};
  way["building"]${B};
);
out geom qt;`;
  console.log(`L${i} ${spec.name}: fetching…`);
  const raw = await overpass(query);
  const json = JSON.parse(raw);
  fs.writeFileSync(cacheFile, JSON.stringify(json));
  await sleep(2000);
  return json;
}

/* ------------------------------------------------------------- routing -- */

function buildGraph(roadWays, proj, allowMinor) {
  // node key -> { p:[x,y], edges: [{to, w}] }
  const nodes = new Map();
  const keyOf = g => g.lat.toFixed(7) + ',' + g.lon.toFixed(7);
  for (const way of roadWays) {
    const cls = ROAD_CLASS[way.tags.highway];
    if (cls >= 4 && !allowMinor) continue;     // no service/pedestrian scraps
    const cost = ROUTE_COST[cls];
    const geo = way.geometry;
    for (let j = 0; j < geo.length; j++) {
      const k = keyOf(geo[j]);
      if (!nodes.has(k)) nodes.set(k, { p: proj([geo[j].lat, geo[j].lon]), edges: [] });
      if (j > 0) {
        const k0 = keyOf(geo[j - 1]);
        const a = nodes.get(k0), b = nodes.get(k);
        const d = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) * cost;
        a.edges.push({ to: k, w: d });
        b.edges.push({ to: k0, w: d });
      }
    }
  }
  return largestComponent(nodes);
}

/* keep only the largest connected component (drop disconnected islands) */
function largestComponent(nodes) {
  const seen = new Set();
  let bestComp = null;
  for (const start of nodes.keys()) {
    if (seen.has(start)) continue;
    const comp = new Set([start]);
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const k = stack.pop();
      for (const e of nodes.get(k).edges) {
        if (!seen.has(e.to)) { seen.add(e.to); comp.add(e.to); stack.push(e.to); }
      }
    }
    if (!bestComp || comp.size > bestComp.size) bestComp = comp;
  }
  const out = new Map();
  for (const k of bestComp) out.set(k, nodes.get(k));
  return out;
}

function nearestNode(nodes, pt) {
  let best = null, bd = Infinity;
  for (const [k, n] of nodes) {
    const d = Math.hypot(n.p[0] - pt[0], n.p[1] - pt[1]);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

function dijkstra(nodes, from, to) {
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const visited = new Set();
  // simple binary-less PQ (graphs are small: a few thousand nodes)
  const pq = [[0, from]];
  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [d, k] = pq.splice(bi, 1)[0];
    if (visited.has(k)) continue;
    visited.add(k);
    if (k === to) break;
    for (const e of nodes.get(k).edges) {
      const nd = d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd); prev.set(e.to, k);
        pq.push([nd, e.to]);
      }
    }
  }
  if (!prev.has(to) && from !== to) return null;
  const out = [to];
  let k = to;
  while (k !== from) { k = prev.get(k); out.push(k); }
  return out.reverse().map(k => nodes.get(k).p);
}

function routePath(nodes, spec, pdef, proj) {
  const pts = [pdef.from, ...(pdef.via || []), pdef.to].map(proj);
  let full = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = nearestNode(nodes, pts[i]);
    const b = nearestNode(nodes, pts[i + 1]);
    const seg = dijkstra(nodes, a, b);
    if (!seg) throw new Error(`no route for ${spec.name} leg ${i}`);
    full = full.length ? full.concat(seg.slice(1)) : seg;
  }
  full = simplify(full, 2.5);
  // extend the entry end offscreen if it starts near an edge
  const [x0, y0] = full[0];
  if (x0 < 70 || x0 > W - 70 || y0 < 70 || y0 > H - 70) {
    const [x1, y1] = full[1];
    const dx = x0 - x1, dy = y0 - y1;
    const d = Math.hypot(dx, dy) || 1;
    // push far enough to clear the canvas
    const t = (Math.min(
      dx > 0 ? (W + 40 - x0) / dx : dx < 0 ? (-40 - x0) / dx : Infinity,
      dy > 0 ? (H + 40 - y0) / dy : dy < 0 ? (-40 - y0) / dy : Infinity,
    ));
    if (isFinite(t) && t > 0 && t < 400) full.unshift([x0 + dx / d * Math.min(t * d, 120), y0 + dy / d * Math.min(t * d, 120)]);
  }
  return full.map(p => [q(p[0]), q(p[1])]);
}

/* ------------------------------------------------------------ process -- */

function processLevel(i, spec, osm) {
  const bb = bboxOf(spec);
  const proj = projector(bb);
  const els = osm.elements;

  const roadWays = els.filter(e => e.type === 'way' && e.tags && ROAD_CLASS[e.tags.highway] !== undefined && e.geometry);
  const railWays = els.filter(e => e.type === 'way' && e.tags && e.tags.railway && e.geometry);
  const coastWays = els.filter(e => e.type === 'way' && e.tags && e.tags.natural === 'coastline' && e.geometry);
  const waterWays = els.filter(e => e.type === 'way' && e.tags && e.geometry &&
    (e.tags.natural === 'water' || ['riverbank', 'dock', 'canal'].includes(e.tags.waterway)));
  const waterRels = els.filter(e => e.type === 'relation' && e.tags &&
    (e.tags.natural === 'water' || e.tags.waterway === 'riverbank') && e.members);
  const greenWays = els.filter(e => e.type === 'way' && e.tags && e.geometry && (
    ['park', 'garden', 'nature_reserve', 'golf_course', 'dog_park'].includes(e.tags.leisure) ||
    ['forest', 'grass', 'recreation_ground', 'meadow', 'village_green', 'cemetery'].includes(e.tags.landuse) ||
    ['wood', 'scrub'].includes(e.tags.natural)));
  const pitchWays = els.filter(e => e.type === 'way' && e.tags && e.geometry &&
    ['pitch', 'track', 'sports_centre'].includes(e.tags.leisure));
  const poolWays = els.filter(e => e.type === 'way' && e.tags && e.geometry && e.tags.leisure === 'swimming_pool');
  const playWays = els.filter(e => e.type === 'way' && e.tags && e.geometry && e.tags.leisure === 'playground');
  const playNodes = els.filter(e => e.type === 'node' && e.tags && e.tags.leisure === 'playground');
  const lotWays = els.filter(e => e.type === 'way' && e.tags && e.geometry &&
    e.tags.amenity === 'parking' && !e.tags.building &&
    e.tags.parking !== 'underground' && e.tags.parking !== 'multi-storey');
  const sandWays = els.filter(e => e.type === 'way' && e.tags && e.geometry &&
    ['beach', 'sand'].includes(e.tags.natural));
  const buildings = els.filter(e => e.type === 'way' && e.tags && e.tags.building && e.geometry);

  const toPoly = way => simplify(way.geometry.map(g => proj([g.lat, g.lon])), 2).map(p => [q(p[0]), q(p[1])]);
  const toLine = (way, tol) => simplify(way.geometry.map(g => proj([g.lat, g.lon])), tol).map(p => [q(p[0]), q(p[1])]);
  // with auto-zoom the bbox can extend past the canvas — drop invisible geometry
  const MARGIN = 50;
  const onCanvas = pts => pts.some(([x, y]) => x > -MARGIN && x < W + MARGIN && y > -MARGIN && y < H + MARGIN);

  // --- roads (context rendering) ---
  const roads = [];
  for (const way of roadWays) {
    const cls = ROAD_CLASS[way.tags.highway];
    const line = toLine(way, cls >= 3 ? 2 : 1.5);
    if (line.length < 2 || !onCanvas(line)) continue;
    // skip tiny service scraps
    let len = 0;
    for (let j = 1; j < line.length; j++) len += Math.hypot(line[j][0] - line[j - 1][0], line[j][1] - line[j - 1][1]);
    if (cls === 4 && len < 40) continue;
    roads.push({ c: cls, p: line, b: way.tags.bridge ? 1 : 0 });
  }

  // --- rail (for viaduct + train animation) ---
  const rail = [];
  for (const way of railWays) {
    if (way.tags.tunnel) continue;              // underground MRT: nothing to see
    const line = toLine(way, 2);
    if (line.length >= 2 && onCanvas(line)) rail.push(line);
  }
  const railChains = chainLines(rail);

  // --- water polygons ---
  const water = [];
  for (const way of waterWays) {
    const poly = toPoly(way);
    if (poly.length > 3 && polyArea(poly) > 350 && onCanvas(poly)) water.push(poly);
  }
  for (const rel of waterRels) {
    const outers = rel.members.filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry);
    for (const ring of stitchRings(outers)) {
      const poly = simplify(ring.map(g => proj(g)), 2).map(p => [q(p[0]), q(p[1])]);
      if (poly.length > 3 && polyArea(poly) > 350 && onCanvas(poly)) water.push(poly);
    }
  }

  // --- coastline → sea rectangles (flood fill on an 8px grid) ---
  const coast = coastWays.map(wy => toLine(wy, 2)).filter(l => l.length >= 2);
  const sea = spec.seaSeed && coast.length ? rasterSea(coast) : [];

  // --- parks / green ---
  const parks = [];
  for (const way of greenWays) {
    const poly = toPoly(way);
    if (poly.length > 3 && polyArea(poly) > 900 && onCanvas(poly)) parks.push(poly);
  }
  parks.sort((a, b) => polyArea(b) - polyArea(a));
  parks.length = Math.min(parks.length, 40);

  // --- recreation micro-features: pitches, pools, playgrounds, carparks, beaches ---
  const pitches = [];
  for (const way of pitchWays) {
    const poly = toPoly(way);
    if (poly.length > 3 && polyArea(poly) > 130 && onCanvas(poly)) pitches.push({ p: poly, s: (way.tags.sport || '').split(';')[0] });
  }
  pitches.sort((a, b) => polyArea(b.p) - polyArea(a.p));
  pitches.length = Math.min(pitches.length, 40);
  const pools = [];
  for (const way of poolWays) {
    const poly = toPoly(way);
    if (poly.length > 3 && polyArea(poly) > 70 && onCanvas(poly)) pools.push(poly);
  }
  pools.length = Math.min(pools.length, 40);
  const lots = [];
  for (const way of lotWays) {
    const poly = toPoly(way);
    if (poly.length > 3 && polyArea(poly) > 380 && onCanvas(poly)) lots.push(poly);
  }
  lots.sort((a, b) => polyArea(b) - polyArea(a));
  lots.length = Math.min(lots.length, 30);
  const sand = [];
  for (const way of sandWays) {
    const poly = toPoly(way);
    if (poly.length > 3 && polyArea(poly) > 420 && onCanvas(poly)) sand.push(poly);
  }
  const plays = [];
  const addPlay = (x, y) => {
    if (x < 10 || y < 10 || x > W - 10 || y > H - 10) return;
    if (plays.some(p => Math.hypot(p[0] - x, p[1] - y) < 36)) return;
    plays.push([q(x), q(y)]);
  };
  for (const way of playWays) {
    const pts = way.geometry.map(g2 => proj([g2.lat, g2.lon]));
    if (pts.length > 2) { const [cx, cy] = centroid(pts); addPlay(cx, cy); }
  }
  for (const n of playNodes) { const [x, y] = proj([n.lat, n.lon]); addPlay(x, y); }
  plays.length = Math.min(plays.length, 14);

  // --- buildings: keep the biggest + all landmark matches ---
  const bl = [];
  for (const way of buildings) {
    const poly = toPoly(way);
    if (poly.length < 4 || !onCanvas(poly)) continue;
    const area = polyArea(poly);
    const name = way.tags.name || '';
    const levels = parseInt(way.tags['building:levels']) || 0;
    bl.push({ poly, area, name, levels, tag: way.tags.building, kind: roofKind(way.tags, area, levels) });
  }
  bl.sort((a, b) => b.area - a.area);
  const kept = [];
  for (const b of bl) {
    const isLm = spec.landmarks.some(lm => lm.match && lm.match.test(b.name));
    if (kept.length < 90 && (b.area > 260 || isLm)) kept.push({ ...b, lm: isLm });
    else if (isLm) kept.push({ ...b, lm: true });
  }

  // --- landmarks: anchor to matched building centroid when found ---
  const landmarks = spec.landmarks.map(lm => {
    let [x, y] = proj(lm.at).map(q);
    const match = lm.match && kept.find(b => lm.match.test(b.name));
    if (match) [x, y] = centroid(match.poly).map(q);
    return { x, y, kind: lm.kind, label: lm.label };
  });

  // --- enemy paths on the real road graph ---
  const graph = buildGraph(roadWays, proj, !!spec.allowMinor);
  const paths = spec.paths.map(pd => routePath(graph, spec, pd, proj));

  const g = {
    paths,
    roads,
    rail: railChains,
    water,
    sea,
    parks,
    pitches,
    pools,
    lots,
    sand,
    plays,
    buildings: kept.map(b => ({ p: b.poly, n: b.lm ? b.name : undefined, h: b.levels, lm: b.lm ? 1 : 0, k: b.kind })),
    landmarks,
  };
  g.spots = generateSpots(g);
  return g;
}

/* Rooftop style class, derived from OSM building tags — lets the renderer
   draw satellite-plausible pixel-art roofs (tiled landed houses, HDB slab
   roofs with water tanks, mall HVAC farms, carpark decks, …).
   0 generic flat · 1 tiled pitched · 2 HDB slab · 3 industrial ribbed ·
   4 commercial flat · 5 carpark deck · 6 place of worship · 7 school ·
   8 open canopy                                                            */
function roofKind(tags, area, levels) {
  const t = tags.building;
  const rs = tags['roof:shape'] || '';
  if (['gabled', 'hipped', 'pyramidal', 'gambrel'].includes(rs)) return 1;
  if (['house', 'detached', 'semidetached_house', 'terrace', 'bungalow',
       'shophouse', 'hut', 'shed'].includes(t)) return 1;
  if (['residential', 'apartments', 'dormitory'].includes(t)) return 2;
  if (['industrial', 'warehouse', 'hangar', 'garage', 'service',
       'greenhouse'].includes(t)) return 3;
  if (['retail', 'commercial', 'office', 'hotel', 'mix_used'].includes(t)) return 4;
  if (t === 'parking' || t === 'carport') return 5;
  if (['temple', 'church', 'chapel', 'mosque', 'shrine'].includes(t)) return 6;
  if (['school', 'kindergarten', 'university', 'college', 'education'].includes(t)) return 7;
  if (t === 'roof') return 8;
  // 'yes' & friends: guess from scale — tall = HDB-ish, small = landed house
  if (levels >= 10) return 2;
  if (area < 700 && levels <= 3) return 1;   // small footprint ≈ tiled landed house
  if (area > 2600 && levels <= 4) return 4;  // big low block ≈ mall/podium
  return 0;
}

/* ------------------------------------------------- build pad placement --
   Bake tower pads: near the enemy path, on open ground — clear of every
   road, building footprint, water body and landmark.                      */
function distToLine(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t)));
  }
  return best;
}
function pointInPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function generateSpots(g) {
  const ROAD_HALF = [16, 14, 11, 9, 5];
  // relax pass by pass until we can seat enough pads in dense districts:
  // clearance from context roads / buildings shrinks, path band widens
  const RELAX = [
    { road: 17, bld: 20, pmin: 44, pmax: 108 },
    { road: 10, bld: 10, pmin: 40, pmax: 118 },
    { road: 4,  bld: 3,  pmin: 36, pmax: 128 },
    { road: 0,  bld: 0,  pmin: 32, pmax: 150 },
  ];
  const validAt = (x, y, R) => {
    const dp = Math.min(...g.paths.map(p => distToLine(p, x, y)));
    if (dp < R.pmin || dp > R.pmax) return false;
    if (R.road > -1) for (const r of g.roads) {
      if (r.c <= 2 && distToLine(r.p, x, y) < ROAD_HALF[r.c] + 4) return false; // never on big roads
      if (distToLine(r.p, x, y) < ROAD_HALF[r.c] + R.road - 12) return false;
    }
    for (const rl of g.rail) if (distToLine(rl, x, y) < 20) return false;
    for (const [sx, sy, sw, sh] of g.sea)
      if (x > sx - 14 && x < sx + sw + 14 && y > sy - 14 && y < sy + sh + 14) return false;
    for (const w of g.water)
      if (pointInPoly(w, x, y) || distToLine(w.concat([w[0]]), x, y) < 16) return false;
    for (const w of (g.pools || []))
      if (pointInPoly(w, x, y)) return false;
    for (const pl of (g.plays || []))
      if (Math.hypot(x - pl[0], y - pl[1]) < 26) return false;
    for (const b of g.buildings)
      if (pointInPoly(b.p, x, y) || distToLine(b.p.concat([b.p[0]]), x, y) < R.bld) return false;
    for (const lm of g.landmarks)
      if (Math.hypot(x - lm.x, y - lm.y) < 46) return false;
    return true;
  };

  // candidate grid, tagged with the relax pass where it becomes valid
  const cands = [];
  for (let x = 40; x <= 920; x += 12)
    for (let y = 56; y <= 560; y += 12)
      for (let ri = 0; ri < RELAX.length; ri++)
        if (validAt(x, y, RELAX[ri])) { cands.push({ p: [x, y], ri }); break; }

  // spread pads evenly along the enemy path(s)
  const spots = [];
  const totalLen = g.paths.map(p => {
    let l = 0;
    for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return l;
  });
  const allLen = totalLen.reduce((a, b) => a + b, 0);
  const N = 16;
  for (let pi = 0; pi < g.paths.length; pi++) {
    const p = g.paths[pi];
    const n = Math.max(4, Math.round(N * totalLen[pi] / allLen));
    for (let s = 0; s < n; s++) {
      // point along path at fraction
      const target = (s + 0.5) / n * totalLen[pi];
      let acc = 0, px = p[0][0], py = p[0][1];
      for (let i = 1; i < p.length; i++) {
        const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (acc + seg >= target) {
          const t = (target - acc) / seg;
          px = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
          py = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
          break;
        }
        acc += seg;
      }
      // two nearest candidates near this stretch; prefer stricter (lower ri)
      const near = cands
        .filter(c => Math.hypot(c.p[0] - px, c.p[1] - py) < 150 &&
                     !spots.some(sp => Math.hypot(c.p[0] - sp[0], c.p[1] - sp[1]) < 56))
        .sort((a, b) => (a.ri - b.ri) * 60 +
          (Math.hypot(a.p[0] - px, a.p[1] - py) - Math.hypot(b.p[0] - px, b.p[1] - py)));
      for (let k = 0; k < Math.min(2, near.length); k++) {
        const c = near[k].p;
        if (!spots.some(sp => Math.hypot(c[0] - sp[0], c[1] - sp[1]) < 56)) spots.push(c);
      }
    }
  }
  return spots.slice(0, 18);
}

/* ---------------------------------------------------------- auto-zoom --
   Some neighbourhoods route a path that only crosses part of the canvas
   (e.g. Ang Mo Kio Central). Rather than showing lots of map irrelevant to
   play, zoom the projection into the path's bounding box (plus margin) and
   re-process. The zoomed bbox always stays INSIDE the original spec bbox,
   so cached Overpass responses remain valid.                              */
const ZOOM_MAX = 1.5, ZOOM_MIN = 1.12, ZOOM_MARGIN = 80;
const ZOOM_ENTRY_SKIP = 90;   // px of the entry run-in allowed offscreen
function autoZoomSpec(spec, g) {
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  for (const p of g.paths) {
    // a short entry run-in may sit offscreen (enemies march in from outside)
    let acc = 0;
    for (let i = 0; i < p.length; i++) {
      if (i > 0) acc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (acc < ZOOM_ENTRY_SKIP && i < p.length - 1) continue;
      const cx = clampN(p[i][0], 0, W), cy = clampN(p[i][1], 0, H);
      x1 = Math.min(x1, cx); y1 = Math.min(y1, cy);
      x2 = Math.max(x2, cx); y2 = Math.max(y2, cy);
    }
  }
  // landmarks are part of the scene story — keep them in view too
  for (const lm of g.landmarks) {
    if (lm.x < -20 || lm.x > W + 20 || lm.y < -20 || lm.y > H + 20) continue;
    x1 = Math.min(x1, lm.x); y1 = Math.min(y1, lm.y);
    x2 = Math.max(x2, lm.x); y2 = Math.max(y2, lm.y);
  }
  const bw = (x2 - x1) + ZOOM_MARGIN * 2, bh = (y2 - y1) + ZOOM_MARGIN * 2;
  const zoom = Math.min(W / bw, H / bh, spec.maxZoom ?? ZOOM_MAX);
  if (!(zoom >= ZOOM_MIN)) return null;
  // new centre in original-projection px, clamped inside the old bbox
  const hw = W / zoom / 2, hh = H / zoom / 2;
  const cx = clampN((x1 + x2) / 2, hw, W - hw);
  const cy = clampN((y1 + y2) / 2, hh, H - hh);
  const bb = bboxOf(spec);
  const lat = bb.n - cy / H * (bb.n - bb.s);
  const lon = bb.w + cx / W * (bb.e - bb.w);
  return { ...spec, c: [lat, lon], h: spec.h / zoom, _zoom: zoom };
}

/* Rasterize coastline walls on an 8px grid, flood fill from the sea seed,
   return merged horizontal run rectangles [x,y,w,h].                       */
function rasterSea(coastLines) {
  const CS = 8, GW = W / CS, GH = H / CS;
  // OSM convention: land lies on the LEFT of a coastline way's direction.
  // Classify each grid cell by the side of the nearest coastline segment.
  const chains = chainAll(coastLines);
  const sea = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const px = gx * CS + CS / 2, py = gy * CS + CS / 2;
      let bd = Infinity, side = 0;
      for (const line of chains) {
        for (let i = 1; i < line.length; i++) {
          const [x1, y1] = line[i - 1], [x2, y2] = line[i];
          const dx = x2 - x1, dy = y2 - y1;
          const len2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
          const cx = x1 + dx * t, cy = y1 + dy * t;
          const d = Math.hypot(px - cx, py - cy);
          if (d < bd) {
            bd = d;
            // cross > 0 (canvas y-down) => point right of A->B => sea
            side = dx * (py - y1) - dy * (px - x1);
          }
        }
      }
      if (side > 0) sea[gy * GW + gx] = 1;
    }
  }
  // merge to horizontal run rects, then stack identical runs vertically
  const runs = [];
  for (let y = 0; y < GH; y++) {
    let x = 0;
    while (x < GW) {
      if (!sea[y * GW + x]) { x++; continue; }
      let x2 = x;
      while (x2 < GW && sea[y * GW + x2]) x2++;
      runs.push({ x, y, w: x2 - x, h: 1 });
      x = x2;
    }
  }
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (!r) continue;
    for (let j = i + 1; j < runs.length; j++) {
      const s = runs[j];
      if (!s) continue;
      if (s.x === r.x && s.w === r.w && s.y === r.y + r.h) { r.h += s.h; runs[j] = null; }
      else if (s.y > r.y + r.h) break;
    }
  }
  return runs.filter(Boolean).map(r => [r.x * CS, r.y * CS, r.w * CS, r.h * CS]);
}
function clampN(v, a, b) { return v < a ? a : v > b ? b : v; }

/* chain ALL lines sharing endpoints (no pruning) */
function chainAll(lines) {
  const key = p => Math.round(p[0]) + ',' + Math.round(p[1]);
  const segs = lines.map(l => l.slice());
  const chains = [];
  while (segs.length) {
    let chain = segs.shift();
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (key(s[0]) === key(chain[chain.length - 1])) { chain = chain.concat(s.slice(1)); segs.splice(i, 1); grew = true; break; }
        if (key(s[s.length - 1]) === key(chain[chain.length - 1])) { chain = chain.concat(s.slice().reverse().slice(1)); segs.splice(i, 1); grew = true; break; }
        if (key(s[s.length - 1]) === key(chain[0])) { chain = s.concat(chain.slice(1)); segs.splice(i, 1); grew = true; break; }
        if (key(s[0]) === key(chain[0])) { chain = s.slice().reverse().concat(chain.slice(1)); segs.splice(i, 1); grew = true; break; }
      }
    }
    chains.push(chain);
  }
  return chains;
}

/* join rail segments that share endpoints into long chains */
function chainLines(lines) {
  const key = p => p[0] + ',' + p[1];
  const segs = lines.slice();
  const chains = [];
  while (segs.length) {
    let chain = segs.shift();
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (key(s[0]) === key(chain[chain.length - 1])) { chain = chain.concat(s.slice(1)); segs.splice(i, 1); grew = true; break; }
        if (key(s[s.length - 1]) === key(chain[chain.length - 1])) { chain = chain.concat(s.slice().reverse().slice(1)); segs.splice(i, 1); grew = true; break; }
        if (key(s[s.length - 1]) === key(chain[0])) { chain = s.concat(chain.slice(1)); segs.splice(i, 1); grew = true; break; }
        if (key(s[0]) === key(chain[0])) { chain = s.slice().reverse().concat(chain.slice(1)); segs.splice(i, 1); grew = true; break; }
      }
    }
    let len = 0;
    for (let j = 1; j < chain.length; j++) len += Math.hypot(chain[j][0] - chain[j - 1][0], chain[j][1] - chain[j - 1][1]);
    if (len > 120) chains.push(chain);
  }
  chains.sort((a, b) => lineLen(b) - lineLen(a));
  return chains.slice(0, 4);
}
function lineLen(l) {
  let len = 0;
  for (let j = 1; j < l.length; j++) len += Math.hypot(l[j][0] - l[j - 1][0], l[j][1] - l[j - 1][1]);
  return len;
}

/* ------------------------------------------------------------- preview -- */

function previewSVG(i, spec, g) {
  const line = (pts, style) => `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" ${style}/>`;
  const poly = (pts, style) => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" ${style}/>`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">`;
  s += `<rect width="960" height="600" fill="#6aa03c"/>`;
  for (const p of g.parks) s += poly(p, 'fill="#4c8a2c" opacity="0.7"');
  for (const p of (g.sand || [])) s += poly(p, 'fill="#e8d8a8"');
  for (const p of (g.lots || [])) s += poly(p, 'fill="#9aa0a8"');
  for (const p of (g.pitches || [])) s += poly(p.p, 'fill="#3d8b46" stroke="#fff"');
  for (const p of (g.pools || [])) s += poly(p, 'fill="#3ec6e8"');
  for (const w of g.water) s += poly(w, 'fill="#2e7bb4"');
  for (const r of g.sea) s += `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#2e7bb4"/>`;
  const widths = [13, 10, 8, 5, 3];
  for (const r of g.roads) s += line(r.p, `stroke="#8a8f98" stroke-width="${widths[r.c]}" stroke-linecap="round"`);
  for (const r of g.rail) s += line(r, 'stroke="#444" stroke-width="4" stroke-dasharray="8,4"');
  for (const b of g.buildings) s += poly(b.p, `fill="${b.lm ? '#ef8354' : '#c8c2b8'}" stroke="#00000033"`);
  const pathCols = ['#ffdd44', '#ff44dd', '#44ffee'];
  g.paths.forEach((p, pi) => { s += line(p, `stroke="${pathCols[pi % 3]}" stroke-width="6" opacity="0.85"`); });
  for (const p of g.paths) s += `<circle cx="${p[0][0]}" cy="${p[0][1]}" r="10" fill="#a0f"/><circle cx="${p[p.length - 1][0]}" cy="${p[p.length - 1][1]}" r="10" fill="#f00"/>`;
  // spec waypoints (debug): where from/via/to project to
  const proj = projector(bboxOf(spec));
  for (const pd of spec.paths) {
    for (const pt of [pd.from, ...(pd.via || []), pd.to]) {
      const [x, y] = proj(pt);
      s += `<path d="M${x - 8},${y} L${x + 8},${y} M${x},${y - 8} L${x},${y + 8}" stroke="#0ff" stroke-width="2"/>`;
    }
  }
  for (const sp of (g.spots || [])) s += `<rect x="${sp[0] - 11}" y="${sp[1] - 8}" width="22" height="16" fill="#b8c2cc" stroke="#333"/>`;
  for (const pl of (g.plays || [])) s += `<circle cx="${pl[0]}" cy="${pl[1]}" r="6" fill="#e8862a" stroke="#333"/>`;
  for (const lm of g.landmarks) s += `<text x="${lm.x}" y="${lm.y}" font-size="13" fill="#fff" text-anchor="middle" stroke="#000" stroke-width="0.4">${lm.label}</text>`;
  s += `<text x="480" y="20" font-size="16" fill="#fff" text-anchor="middle">${i}: ${spec.name}</text></svg>`;
  fs.mkdirSync(PREVIEW, { recursive: true });
  fs.writeFileSync(path.join(PREVIEW, `L${String(i).padStart(2, '0')}.svg`), s);
}

/* ---------------------------------------------------------------- main -- */

(async function main() {
  const argv = process.argv.slice(2);
  const onlyIdx = argv.includes('--level') ? parseInt(argv[argv.indexOf('--level') + 1]) : null;
  const doPreview = argv.includes('--preview');

  // load existing output so single-level runs merge
  let existing = [];
  if (fs.existsSync(OUT)) {
    const m = fs.readFileSync(OUT, 'utf8').match(/const GEO = (\[[\s\S]*\]);/);
    if (m) existing = JSON.parse(m[1]);
  }
  const out = existing.length === SPECS.length ? existing : new Array(SPECS.length).fill(null);

  for (let i = 0; i < SPECS.length; i++) {
    if (onlyIdx !== null && i !== onlyIdx) continue;
    const spec = SPECS[i];
    try {
      const osm = await fetchLevel(i, spec);
      let g = processLevel(i, spec, osm);
      let usedSpec = spec;
      const zoomed = autoZoomSpec(spec, g);
      if (zoomed) {
        console.log(`  ↳ path covers a small area — zooming ×${zoomed._zoom.toFixed(2)}`);
        usedSpec = zoomed;
        g = processLevel(i, zoomed, osm);
      }
      out[i] = g;
      if (doPreview) previewSVG(i, usedSpec, g);
      const size = JSON.stringify(g).length;
      console.log(`  ✔ roads:${g.roads.length} rail:${g.rail.length} water:${g.water.length} parks:${g.parks.length} pitch:${g.pitches.length} pool:${g.pools.length} play:${g.plays.length} bldg:${g.buildings.length} paths:${g.paths.map(p => p.length).join('/')} (${(size / 1024).toFixed(1)}KB)`);
    } catch (e) {
      console.error(`  ✘ L${i} ${spec.name}: ${e.message}`);
    }
  }

  const body = '/* AUTO-GENERATED by tools/fetch-geo.js — real OpenStreetMap geometry\n' +
    '   (© OpenStreetMap contributors, ODbL) projected into the 960x600 canvas. */\n' +
    "'use strict';\nconst GEO = " + JSON.stringify(out) + ';\n';
  fs.writeFileSync(OUT, body);
  console.log(`\nwrote ${OUT} (${(body.length / 1024).toFixed(0)}KB)`);
})();
