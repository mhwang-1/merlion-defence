/* ===== Pixel-art sprite factory =====
   Sprites are defined as ASCII grids + palettes, baked to offscreen
   canvases once at load, then refined through an EPX (Scale2x) 4×
   upscale + rim-shading pass so everything renders with fine, rounded,
   shaded pixels instead of raw chunky blocks. '.' / ' ' = transparent. */
'use strict';

const Sprites = {
  cache: {},
  tintCache: {},
  urlCache: {},

  def(name, pal, rows) {
    const w = Math.max(...rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = rows.length;
    const g = c.getContext('2d');
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        g.fillStyle = pal[ch] || '#f0f';
        g.fillRect(x, y, 1, 1);
      }
    }
    // bake fine version: pad → EPX×2 → EPX×2 → rim shade  (factor 4)
    const hi = this._shade(this._epx(this._epx(this._pad(c))));
    hi._f = 4;
    this.cache[name] = hi;
  },

  /* 1px transparent border so outlines can round outward */
  _pad(c) {
    const p = document.createElement('canvas');
    p.width = c.width + 2; p.height = c.height + 2;
    p.getContext('2d').drawImage(c, 1, 1);
    return p;
  },

  /* EPX / Scale2x — doubles resolution, rounding diagonal steps */
  _epx(src) {
    const w = src.width, h = src.height;
    const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    const out = document.createElement('canvas');
    out.width = w * 2; out.height = h * 2;
    const og = out.getContext('2d');
    const oi = og.createImageData(w * 2, h * 2), od = oi.data;
    const at = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      const i = (y * w + x) * 4;
      return sd[i + 3] < 8 ? 0 : (0x1000000 | (sd[i] << 16) | (sd[i + 1] << 8) | sd[i + 2]);
    };
    const put = (x, y, v) => {
      if (!v) return;
      const i = (y * w * 2 + x) * 4;
      od[i] = (v >> 16) & 255; od[i + 1] = (v >> 8) & 255; od[i + 2] = v & 255; od[i + 3] = 255;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const P = at(x, y);
        const A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        let p1 = P, p2 = P, p3 = P, p4 = P;
        if (C === A && C !== D && A !== B) p1 = A;
        if (A === B && A !== C && B !== D) p2 = B;
        if (D === C && D !== B && C !== A) p3 = C;
        if (B === D && B !== A && D !== C) p4 = B;
        put(x * 2, y * 2, p1); put(x * 2 + 1, y * 2, p2);
        put(x * 2, y * 2 + 1, p3); put(x * 2 + 1, y * 2 + 1, p4);
      }
    }
    og.putImageData(oi, 0, 0);
    return out;
  },

  /* subtle rim light on top edges, shadow on bottom edges */
  _shade(c) {
    const w = c.width, h = c.height, g = c.getContext('2d');
    const im = g.getImageData(0, 0, w, h), d = im.data;
    const src = new Uint8ClampedArray(d);
    const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[(y * w + x) * 4 + 3];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] < 8) continue;
        const lum = src[i] * 0.3 + src[i + 1] * 0.6 + src[i + 2] * 0.1;
        if (alpha(x, y - 1) < 8 && lum > 66) {          // lit top rim
          d[i]     = Math.min(255, src[i] * 1.28 + 22);
          d[i + 1] = Math.min(255, src[i + 1] * 1.28 + 22);
          d[i + 2] = Math.min(255, src[i + 2] * 1.28 + 22);
        } else if (alpha(x, y + 1) < 8 && lum > 46) {   // shaded bottom rim
          d[i] = src[i] * 0.68; d[i + 1] = src[i + 1] * 0.68; d[i + 2] = src[i + 2] * 0.68;
        }
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  },

  get(name) { return this.cache[name]; },

  /** dataURL for DOM <img> usage (menus etc.) */
  url(name) {
    if (!this.urlCache[name]) this.urlCache[name] = this.cache[name].toDataURL();
    return this.urlCache[name];
  },

  /** Draw sprite centered at (x, y). scale is in ORIGINAL art pixels. */
  draw(ctx, name, x, y, scale = 2, flip = 1) {
    const c = this.cache[name];
    if (!c) return;
    const f = c._f || 1;
    const w = c.width * scale / f, h = c.height * scale / f;
    ctx.imageSmoothingEnabled = false;
    if (flip < 0) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y - h / 2));
      ctx.scale(-1, 1);
      ctx.drawImage(c, Math.round(-w / 2), 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
    }
  },

  /** Draw a translucent color-tinted copy over the sprite (frost etc.). */
  drawTinted(ctx, name, tint, x, y, scale = 2, flip = 1) {
    const key = name + '|' + tint;
    if (!this.tintCache[key]) {
      const src = this.cache[name];
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = tint;
      g.fillRect(0, 0, c.width, c.height);
      c._f = src._f || 1;
      this.tintCache[key] = c;
    }
    const c = this.tintCache[key];
    const f = c._f || 1;
    const w = c.width * scale / f, h = c.height * scale / f;
    ctx.imageSmoothingEnabled = false;
    if (flip < 0) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y - h / 2));
      ctx.scale(-1, 1);
      ctx.drawImage(c, Math.round(-w / 2), 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
    }
  },
};

/* ================= ENEMIES ================= */

// Toyol — mischievous green child spirit
Sprites.def('toyol', { o: '#0c2a10', g: '#6ecb45', d: '#48a12c', r: '#ff4242', k: '#111a10' }, [
  "....oooo....",
  "...oggggo...",
  "..oggggggo..",
  ".ogrggggrgo.",
  ".oggggggggo.",
  ".oggkkkkggo.",
  "..odddddgo..",
  "..oggggggo..",
  ".oggo..oggo.",
  ".ogo....ogo.",
  "..oddddddo..",
  "...oo..oo...",
]);

// Pocong — hopping shrouded ghost
Sprites.def('pocong', { o: '#3a3a30', w: '#f3f0e0', s: '#cfc9ad', k: '#1c1c14', t: '#b7a26b' }, [
  ".....oo.....",
  "....otto....",
  "...owwwwo...",
  "..owwwwwwo..",
  "..owkwwkwo..",
  "..owwwwwwo..",
  "..owwkkwwo..",
  "..owwwwwwo..",
  "..oswwwwso..",
  "..owwwwwwo..",
  "..oswwwwso..",
  "...owwwwo...",
  "....oooo....",
]);

// Pontianak — pale spirit, long dark hair, white gown
Sprites.def('pontianak', { o: '#14101c', h: '#221c30', f: '#e9d6c4', r: '#c62838', w: '#f0f0fa', s: '#c9c9dd' }, [
  "...oooooo...",
  "..ohhhhhho..",
  ".ohhffffhho.",
  ".ohfrffrfho.",
  ".ohffffffho.",
  ".ohhfrrfhho.",
  ".ohhwwwwhho.",
  ".ohwwwwwwho.",
  ".ohwwsswwho.",
  ".ohwwwwwwho.",
  "..owwsswwo..",
  "..owwwwwwo..",
  "...owwwwo...",
]);

// Manananggal — winged severed torso
Sprites.def('manananggal', { o: '#1a1022', w: '#5e4a78', v: '#8a6aa8', f: '#d8c3ad', r: '#ff3b3b', g: '#b03040' }, [
  ".o..........o.",
  "owo........owo",
  "owwo..oo..owwo",
  "owvwooffoowvwo",
  ".owvofrrfovwo.",
  ".owvoffffovwo.",
  "..oooffffooo..",
  "....offffo....",
  ".....offo.....",
  ".....ogo......",
  "......og......",
  ".....og.......",
]);

// Garuda hatchling — armoured golden eagle
Sprites.def('garuda', { o: '#4a2c08', y: '#f0b23c', d: '#c8842a', w: '#fbe4a0', b: '#7a4b12', r: '#e33' }, [
  "oo..........oo",
  "oyo..oooo..oyo",
  "oyyoowyywooyyo",
  "oyyyoyryyoyyyo",
  ".oyyoyyyyoyyo.",
  ".oyydyyyydyyo.",
  "..ooyyyyyyoo..",
  "...oyywwyyo...",
  "....oyyyyo....",
  "....odddo.....",
  ".....obbo.....",
  "....ob..bo....",
]);

// Jiangshi — hopping vampire in Qing robes
Sprites.def('jiangshi', { o: '#101820', b: '#27496d', d: '#16324a', f: '#bfe0b0', y: '#ffd23c', r: '#c62828', k: '#111' }, [
  "...oooooo...",
  "..odddddo...",
  ".oddddddddo.",
  "..offffffo..",
  "..ofkffkfo..",
  "..oryyyyro..",
  "..oryyyyro..",
  ".oobbbbbboo.",
  "obobbyybobo.",
  "o.obbyybo.o.",
  "..obbbbbbo..",
  "..odd..ddo..",
  "..oo....oo..",
]);

// Rakshasa — shape-shifting demon warrior
Sprites.def('rakshasa', { o: '#33080a', r: '#d84334', d: '#a82a20', y: '#ffcf40', w: '#fff2d0', k: '#1c0d08', g: '#3f7a34' }, [
  ".oo......oo.",
  ".oyo....oyo.",
  "..orrrrrro..",
  ".orrrrrrrro.",
  ".orwkrrkwro.",
  ".orrrrrrrro.",
  ".orkwwwwkro.",
  "..orrrrrro..",
  ".oorddddroo.",
  "ogorddddrogo",
  "o.odddddd.o.",
  "..odd..ddo..",
  "..oo....oo..",
]);

// Oni — armoured Japanese ogre with club
Sprites.def('oni', { o: '#2a0808', r: '#c53030', d: '#8e1f1f', w: '#ffe9c8', k: '#140a06', y: '#e8b13a', b: '#5b4632' }, [
  ".ow......wo.",
  ".owo....owo.",
  "..orrrrrro..",
  ".orrrrrrrro.",
  ".orwkrrkwro.",
  ".orrrrrrrro.",
  ".orwwkkwwro.",
  "..orrrrrro..",
  ".oyyyyyyyyob",
  ".oyrrrrrryob",
  "..oddddddob.",
  "..odd..ddo..",
  "..oo....oo..",
]);

// Hantu Raya — grand shadow spirit
Sprites.def('hantuRaya', { o: '#0c0616', s: '#2c1a4a', d: '#1a0e30', r: '#ffd23c' }, [
  "....oooo....",
  "..oossssoo..",
  ".osssssssso.",
  ".osrssssrso.",
  ".osssssssso.",
  ".ossddddsso.",
  ".osddddddso.",
  ".osddddddso.",
  ".ossddddsso.",
  "..osssssso..",
  ".osso..osso.",
  ".oo......oo.",
]);

// Krasue — floating head trailing viscera
Sprites.def('krasue', { o: '#1c0c10', h: '#1e1428', f: '#e9c9a8', r: '#ff5a3c', g: '#c33', k: '#140a06' }, [
  "...oooooo...",
  "..ohhhhhho..",
  ".ohhffffhho.",
  ".ohfkffkfho.",
  ".ohffffffho.",
  "..offrrffo..",
  "...offffo...",
  "....orgo....",
  "....ogro....",
  ".....org....",
  "....gro.....",
  ".....g......",
]);

// Orang Minyak — slick oily man
Sprites.def('kuntilanakSwarm', { o: '#050505', b: '#241f1c', s: '#4a423c', w: '#e8e4da' }, [
  "....oooo....",
  "...obbbbo...",
  "..obsbbsbo..",
  "..obwbbwbo..",
  "..obbbbbbo..",
  "...obssbo...",
  "..obbbbbbo..",
  ".obobbbbobo.",
  "..o.obbo.o..",
  "...obbbbo...",
  "...obo.obo..",
  "...oo...oo..",
]);

// Naga — serpent-king boss
Sprites.def('nagaBoss', { o: '#062c26', t: '#2aa08a', d: '#1a7a66', y: '#ffd23c', r: '#ff4242', w: '#d8fff2', k: '#04140f' }, [
  "..oo........oo..",
  "..oyo......oyo..",
  "...oyoooooooy...",
  "...otttttttto...",
  "..otttttttttto..",
  ".otrkttttttkrto.",
  ".otttttttttttto.",
  ".ottttwwwwtttto.",
  "..otttwkkwttto..",
  "...otttttttto...",
  "..odttddddttdo..",
  ".odtdo....odtdo.",
  ".otdo......odto.",
  ".oddo......oddo.",
  "..oo........oo..",
]);

// Rangda — Balinese demon queen boss
Sprites.def('rangda', { o: '#1c0810', h: '#efe6d8', w: '#fff8ec', k: '#140a06', r: '#e03030', y: '#e8b13a' }, [
  "oo....oooo....oo",
  "oho..ohhhho..oho",
  "ohhoohhhhhhoohho",
  "ohhhhwwwwwwhhhho",
  ".ohwwrwwwwrwwho.",
  ".ohwwkwwwwkwwho.",
  ".ohwwwwwwwwwwho.",
  ".ohwrkkkkkkrwho.",
  "..owwkwwwwkwwo..",
  "...owwwkkwwwo...",
  "...oyyywwyyyo...",
  "..oyrrrrrrrryo..",
  "..orrrooorrrro..",
  "...oo..oo..oo...",
]);

// Ox-Head Warden boss
Sprites.def('yamaOx', { o: '#170d06', b: '#7a5230', d: '#5a3a20', k: '#140a06', y: '#e8b13a', r: '#c62828', s: '#8a8f98', w: '#efe6d8' }, [
  ".ow..........wo.",
  ".oww........wwo.",
  "..owoooooooowo..",
  "..oobbbbbbbboo..",
  "..obbrbbbbrbbo..",
  "..obbbbbbbbbbo..",
  "..obbkbbbbkbbo..",
  "...obbkkkkbbo...",
  "..osssssssssso..",
  "..osyssyyssyso..",
  "..osssssssssso..",
  "...osddddddso...",
  "...odo....odo...",
  "...oo......oo...",
]);

/* ================= TOWERS ================= */

Sprites.def('t_cell', { o: '#20262c', s: '#9aa8b4', d: '#5f6e7a', r: '#e04040', w: '#e8f2f8', b: '#39485c' }, [
  "......oro.....",
  "......owo.....",
  "..o...oso...o.",
  "..oo..oso..oo.",
  "...oossssoo...",
  ".....osso.....",
  ".....osso.....",
  "....osssso....",
  "....odssdo....",
  "....osssso....",
  "...odssssdo...",
  "...obbbbbbo...",
  "..obbbbbbbbo..",
]);

Sprites.def('t_durian', { o: '#231407', w: '#8a5a2a', d: '#5f3a16', g: '#7aa02c', k: '#4c7018', y: '#c8b060' }, [
  ".....oggo.....",
  "...ogkggkgo...",
  "...oggggggo...",
  "...ogkggkgo...",
  "....oggggo....",
  ".....oyyo.....",
  "....owwwwo....",
  "...owwddwwo...",
  "...owdwwdwo...",
  "...owwddwwo...",
  "..owwwwwwwwo..",
  "..oddddddddo..",
  ".owwwwwwwwwwo.",
]);

Sprites.def('t_temple', { o: '#2a0c08', r: '#c53030', d: '#8e1f1f', y: '#e8b13a', w: '#f6e8c8', k: '#3c1410' }, [
  "......yy......",
  ".....oyyo.....",
  "..oyyyyyyyyo..",
  ".oyyyyyyyyyyo.",
  "...odrrrrdo...",
  "...orrrrrro...",
  "..oyyyyyyyyo..",
  "...orwwwwro...",
  "...orwkkwro...",
  "...orwwwwro...",
  "...orrrrrro...",
  "..odrrrrrrdo..",
  ".oyyyyyyyyyyo.",
]);

// Mata Sniper Post — police watchtower, long scope
Sprites.def('t_mata', { o: '#0c141c', b: '#2a4a6a', d: '#1c3348', s: '#9aa8b4', w: '#e8f2f8', r: '#d32f2f', k: '#101a24' }, [
  "....osssso....",
  "...ossssssro..",
  "...obwkkwbo...",
  "...obbbbbbo...",
  "....odbbdo....",
  "....obbbbo....",
  "...os.oo.so...",
  "...os.oo.so...",
  "....odbbdo....",
  "...obbbbbbo...",
  "...odbbbbdo...",
  "..obbbbbbbbo..",
  "..okkkkkkkko..",
]);

// Hawker Wok — zi char stall, canopy, flaming wok
Sprites.def('t_wok', { o: '#241006', r: '#c53030', d: '#8e1f1f', w: '#f6e8c8', y: '#ffd23c', f: '#ff7b2e', k: '#3c2214', b: '#5f3a16' }, [
  ".....offo.....",
  "....ofyfo.....",
  ".....offo.....",
  "....okkkko....",
  "...okkkkkko...",
  "..orrrrrrrro..",
  ".orwrwrwrwro..",
  "...obbbbbbo...",
  "...obwwwwbo...",
  "...obwyywbo...",
  "...obwwwwbo...",
  "...obbbbbbo...",
  "..obb....bbo..",
]);

// Substation Coil — PUB grid coil, arcing sparks
Sprites.def('t_power', { o: '#0e161e', s: '#9aa8b4', d: '#5f6e7a', c: '#7ee8ff', y: '#ffd23c', k: '#26303a', b: '#39485c' }, [
  "..c...cc...c..",
  "...c.occo.c...",
  "....occcco....",
  "....osccso....",
  ".....osso.....",
  "....odssdo....",
  ".....osso.....",
  "....odssdo....",
  "....osssso....",
  "...obbbbbbo...",
  "...obyybybo...",
  "...obbbbbbo...",
  "..okkkkkkkko..",
]);

// Ice Kacang Cart — shaved-ice mound on a striped cart
Sprites.def('t_ice', { o: '#122030', w: '#eef6fa', c: '#b8e4f2', b: '#4aa8d8', d: '#2e7bb4', p: '#f48fb1', g: '#7cc47c', k: '#1c3040' }, [
  ".....owwo.....",
  "....owwwwo....",
  "...owcwwcwo...",
  "...opwgwpwo...",
  "...owwcwwwo...",
  "..occcccccco..",
  "...obbbbbbo...",
  "..obwbwbwbbo..",
  "..obbbbbbbbo..",
  "..obwbwbwbbo..",
  "..obbbbbbbbo..",
  "...okk..okk...",
  "...oo....oo...",
]);

/* ---- upgraded tower art: each level looks visibly different ---- */

// Cell L2 — 5G Tower: taller lattice mast, twin panel antennas
Sprites.def('t_cell_2', { o: '#20262c', s: '#9aa8b4', d: '#5f6e7a', r: '#e04040', w: '#e8f2f8', b: '#39485c', c: '#7ec8e8' }, [
  "......oro.....",
  "......owo.....",
  ".oo...oso..oo.",
  ".oco..oso.oco.",
  ".oo.oossoo.oo.",
  "....osssso....",
  ".....osso.....",
  "....os.oso....",
  "....oso.so....",
  "....osssso....",
  "...odssssdo...",
  "...obbbbbbo...",
  "..obbwbbwbbo..",
  "..obbbbbbbbo..",
]);

// Cell L3 — 6G Array: triple dish crown, beacon lights
Sprites.def('t_cell_3', { o: '#20262c', s: '#9aa8b4', d: '#5f6e7a', r: '#e04040', w: '#e8f2f8', b: '#39485c', c: '#7ec8e8', y: '#ffd23c' }, [
  "..r...oro...r.",
  ".owo..owo..owo",
  ".oso..oso..oso",
  "..oo..oso..oo.",
  "..occoossoocco",
  "...oossssoo...",
  "....osssso....",
  ".....osso.....",
  "....os.oso....",
  "....osssso....",
  "...odsyysdo...",
  "...obbbbbbo...",
  "..obbwbwbbbo..",
  ".obbbbbbbbbbo.",
]);

// Cell ULT A — Satellite Uplink: huge dish tracking the sky
Sprites.def('t_cell_ua', { o: '#1a2026', s: '#9aa8b4', d: '#5f6e7a', w: '#eef6fa', b: '#39485c', c: '#7ec8e8', y: '#ffd23c', r: '#e04040' }, [
  "...owwwwwwo...",
  "..owccccccwo..",
  ".owccccccccwo.",
  ".owcccsscccwo.",
  "..owccssccwo..",
  "...owwsswwo...",
  "....oossoo....",
  ".....osso.....",
  "....osssso....",
  "....osryso....",
  "...odssssdo...",
  "...obbyybbo...",
  "..obbbbbbbbo..",
  ".obbbbbbbbbbo.",
]);

// Cell ULT B — Overdrive Array: crackling twin masts, hot coils
Sprites.def('t_cell_ub', { o: '#20262c', s: '#9aa8b4', d: '#5f6e7a', w: '#e8f2f8', b: '#39485c', c: '#7ee8ff', y: '#ffd23c', r: '#ff5a3c' }, [
  ".c..oro.oro..c",
  "..c.owo.owo.c.",
  "..cooso.osooc.",
  "...coso.osoc..",
  "..oossooosso..",
  "...osssssso...",
  "....osrrso....",
  "....osrrso....",
  "....osssso....",
  "...oysssyso...",
  "...odssssdo...",
  "...obybbybo...",
  "..obbbbbbbbo..",
  "..obbbbbbbbo..",
]);

// Durian L2 — D24 Catapult: timber frame, twin fruit rack
Sprites.def('t_durian_2', { o: '#231407', w: '#8a5a2a', d: '#5f3a16', g: '#7aa02c', k: '#4c7018', y: '#c8b060' }, [
  "...oggo.oggo..",
  "..ogkggogkgo..",
  "..oggggoggggo.",
  "...oggo.oggo..",
  "....oyy.yyo...",
  "...owwwwwwo...",
  "..owwddddwwo..",
  "..owdwwwwdwo..",
  "..owwddddwwo..",
  ".owwwwwwwwwwo.",
  ".odddddddddo..",
  ".owwwwwwwwwwo.",
  "oddddddddddddo",
]);

// Durian L3 — Mao Shan Wang: reinforced tower, golden crown fruit
Sprites.def('t_durian_3', { o: '#231407', w: '#8a5a2a', d: '#5f3a16', g: '#7aa02c', k: '#4c7018', y: '#ffd23c', e: '#e8b13a' }, [
  ".....oyyo.....",
  "...ogkggkgo...",
  "..oggggggggo..",
  "..ogkgggggko..",
  "...ogggggo....",
  "..oggo.oggo...",
  "...oeyyyyeo...",
  "...owwwwwwo...",
  "..owddwwddwo..",
  "..owwwddwwwo..",
  ".owwwwwwwwwwo.",
  ".oddddddddddo.",
  ".owwwwwwwwwwo.",
  "oddddddddddddo",
]);

// Durian ULT A — King of Fruits: colossal crowned durian on a throne
Sprites.def('t_durian_ua', { o: '#231407', w: '#8a5a2a', d: '#5f3a16', g: '#7aa02c', k: '#4c7018', y: '#ffd23c', r: '#c53030' }, [
  "....y.yy.y....",
  "....oyyyyo....",
  "...ogkggkgo...",
  "..oggggggggo..",
  ".ogkgggggkggo.",
  ".oggggkgggggo.",
  ".ogkgggggkggo.",
  "..ogggggggo...",
  "...orrrrro....",
  "..owwwwwwwwo..",
  "..owddddddwo..",
  ".owwwwwwwwwwo.",
  ".oddddddddddo.",
  "oddddddddddddo",
]);

// Durian ULT B — Thorn Barrage: triple-barrel fruit battery
Sprites.def('t_durian_ub', { o: '#231407', w: '#8a5a2a', d: '#5f3a16', g: '#7aa02c', k: '#4c7018', y: '#c8b060', s: '#9aa8b4' }, [
  "..oggo.go.ggo.",
  ".ogkgogkgogkgo",
  ".oggggggggggo.",
  "..ogo.ogo.ogo.",
  "..oso.oso.oso.",
  "..osssssssso..",
  "...oyyyyyyo...",
  "...owwwwwwo...",
  "..owwddddwwo..",
  "..owdwwwwdwo..",
  ".owwwwwwwwwwo.",
  ".oddddddddddo.",
  "oddddddddddddo",
]);

// Temple L2 — Temple Hall: two-tier roof, guardian lions
Sprites.def('t_temple_2', { o: '#2a0c08', r: '#c53030', d: '#8e1f1f', y: '#e8b13a', w: '#f6e8c8', k: '#3c1410' }, [
  "......yy......",
  ".....oyyo.....",
  "..oyyyyyyyyo..",
  "...odrrrrdo...",
  ".oyyyyyyyyyyo.",
  "..odrrrrrrdo..",
  "...orwwwwro...",
  "...orwkkwro...",
  "...orwwwwro...",
  "..y.orrrro.y..",
  ".oyoorrrrooyo.",
  "..odrrrrrrdo..",
  ".oyyyyyyyyyyo.",
]);

// Temple L3 — Grand Pagoda: three-tier pagoda, gold finial
Sprites.def('t_temple_3', { o: '#2a0c08', r: '#c53030', d: '#8e1f1f', y: '#ffd23c', w: '#f6e8c8', k: '#3c1410' }, [
  "......yy......",
  ".....oyyo.....",
  "....orrrro....",
  "..oyyyyyyyyo..",
  "...orrrrrro...",
  ".oyyyyyyyyyyo.",
  "..odrrrrrrdo..",
  "...orwwwwro...",
  "...orwkkwro...",
  "...orwwwwro...",
  "..oyyyyyyyyo..",
  "..odrrrrrrdo..",
  ".oyyyyyyyyyyo.",
]);

// Temple ULT A — Nine Emperor Court: imperial hall, dragon gold roof
Sprites.def('t_temple_ua', { o: '#2a0c08', r: '#c53030', d: '#8e1f1f', y: '#ffd23c', w: '#f6e8c8', k: '#3c1410', c: '#7ee8ff' }, [
  "..y...cc...y..",
  ".oyo.occo.oyo.",
  "..oyyyyyyyyo..",
  ".oyyyyyyyyyyo.",
  "..orrrrrrrro..",
  ".oyyyyyyyyyyo.",
  "..odrrrrrrdo..",
  "..orwwwwwwro..",
  "..orwkyykwro..",
  "..orwwwwwwro..",
  "..oyyyyyyyyo..",
  ".odrrrrrrrrdo.",
  "oyyyyyyyyyyyyo",
]);

// Temple ULT B — Lion Dance Troupe: lion head crest, drums
Sprites.def('t_temple_ub', { o: '#2a0c08', r: '#c53030', d: '#8e1f1f', y: '#ffd23c', w: '#f6e8c8', k: '#3c1410', g: '#2e7a4a' }, [
  "..oyo....oyo..",
  "..orrrrrrrro..",
  ".orwwrrrrwwro.",
  ".orkwrrrrwkro.",
  ".orrrryyrrrro.",
  "..orrwwwwrro..",
  "...owwkkwwo...",
  "..ogggggggo...",
  ".oggyggggygo..",
  ".orro.oo.orro.",
  ".orwo.oo.orwo.",
  ".orro....orro.",
  ".oyyo....oyyo.",
]);

// Camp L2 — NSF Camp: bigger tent, sandbag ring, twin flags
Sprites.def('t_camp_2', { o: '#12250e', g: '#4c7a34', d: '#35592a', r: '#c53030', b: '#b09a60', n: '#8a784a' }, [
  "..orr....orr..",
  "..orrr...orrr.",
  "..o......o....",
  "..o..ogo.o....",
  "....ogggo.....",
  "...ogggggo....",
  "..ogggggggo...",
  ".ogggdddgggo..",
  "ogggggdddggggo",
  "oggo..ooo.oggo",
  "obbbbbbbbbbbo.",
  "obnbbnbbnbbno.",
  ".oo.......oo..",
]);

// Camp L3 — Commando Base: watchtower + fortified tent
Sprites.def('t_camp_3', { o: '#12250e', g: '#4c7a34', d: '#35592a', r: '#c53030', b: '#b09a60', n: '#8a784a', k: '#20180c', s: '#9aa8b4' }, [
  "orr...........",
  "orrr..........",
  "o.okkkko......",
  "o.okssko......",
  "o.okkkko.ogo..",
  "o..oo...ogggo.",
  "o..oo..ogggggo",
  "o..oo.ogggdggo",
  "o..oooggggdggo",
  "o..oogggggggo.",
  "obbbbbbbbbbbbo",
  "obnbbnbbnbbnbo",
  ".oo........oo.",
]);

// Camp ULT A — Guards Elite: red beret HQ, armoured barricades
Sprites.def('t_camp_ua', { o: '#12250e', g: '#4c7a34', d: '#35592a', r: '#c53030', b: '#b09a60', n: '#8a784a', k: '#20180c', y: '#ffd23c' }, [
  "..orr....orr..",
  "..orrrr..orrrr",
  "..o......o....",
  "...oyyyyyo....",
  "...orrrrro....",
  "..orrrrrrro...",
  ".orrrdddrrro..",
  "orrrrgdddrrrro",
  "orro..ooo.orro",
  "okkkkkkkkkkkko",
  "okbbkkbbkkbbko",
  "obbbbbbbbbbbbo",
  ".oo........oo.",
]);

// Camp ULT B — Combat Medics: field hospital, red cross tent
Sprites.def('t_camp_ub', { o: '#12250e', g: '#4c7a34', d: '#35592a', r: '#c53030', w: '#f0e8d0', b: '#b09a60', n: '#8a784a' }, [
  "......oro.....",
  "......oro.....",
  ".....ogggo....",
  "....ogggggo...",
  "...ogggggggo..",
  "..ogggwwwgggo.",
  ".ogggwwrwwgggo",
  "oggggwrrrwgggo",
  "oggggwwrwwggo.",
  "oggo.owwwo.ogo",
  "obbbbbbbbbbbo.",
  "obnbbnbbnbbno.",
  ".oo.......oo..",
]);

// Mata L2 — Marksman Nest: armoured cabin, longer barrel
Sprites.def('t_mata_2', { o: '#0c141c', b: '#2a4a6a', d: '#1c3348', s: '#9aa8b4', w: '#e8f2f8', r: '#d32f2f', k: '#101a24' }, [
  "...osssssso...",
  "..ossssssssro.",
  "..obwkkwkwbo..",
  "..obbbbbbbbo..",
  "...odbbbbdo...",
  "....obbbbo....",
  "...os.oo.so...",
  "...os.oo.so...",
  "...os.oo.so...",
  "....odbbdo....",
  "..obbbbbbbbo..",
  "..odbbbbbbdo..",
  ".obbbbbbbbbbo.",
  ".okkkkkkkkkko.",
]);

// Mata L3 — STAR Overwatch: twin-deck tower, scope glint
Sprites.def('t_mata_3', { o: '#0c141c', b: '#2a4a6a', d: '#1c3348', s: '#9aa8b4', w: '#e8f2f8', r: '#d32f2f', k: '#101a24', c: '#7ee8ff' }, [
  "..osssssssro..",
  "..obwkkcwkbo..",
  "..obbbbbbbbo..",
  "...osssssso...",
  "...obwkkwbo...",
  "...obbbbbbo...",
  "....odbbdo....",
  "...os.oo.so...",
  "...os.oo.so...",
  "....odbbdo....",
  "..obbbbbbbbo..",
  "..odbbbbbbdo..",
  ".obbbbbbbbbbo.",
  ".okkkkkkkkkko.",
]);

// Mata ULT A — Anti-Materiel Post: massive cannon barrel
Sprites.def('t_mata_ua', { o: '#0c141c', b: '#2a4a6a', d: '#1c3348', s: '#9aa8b4', w: '#e8f2f8', r: '#d32f2f', k: '#101a24', y: '#ffd23c' }, [
  "........osso..",
  ".......ossso..",
  "......osso....",
  "..oossssoo....",
  ".osssssssro...",
  ".obwkkwkwbo...",
  ".obbbybbbbo...",
  "..odbbbbdo....",
  "...os.oo.so...",
  "...os.oo.so...",
  "....odbbdo....",
  "..obbbbbbbbo..",
  ".obbbbbbbbbbo.",
  ".okkkkkkkkkko.",
]);

// Mata ULT B — Twin Marksmen: two cabins back to back
Sprites.def('t_mata_ub', { o: '#0c141c', b: '#2a4a6a', d: '#1c3348', s: '#9aa8b4', w: '#e8f2f8', r: '#d32f2f', k: '#101a24' }, [
  ".rosso..ossor.",
  ".ossso..osssso",
  ".obwkboobkwbo.",
  ".obbbbbbbbbbo.",
  "..obbbbbbbbo..",
  "...odbbbbdo...",
  "....obbbbo....",
  "...os.oo.so...",
  "...os.oo.so...",
  "....odbbdo....",
  "..obbbbbbbbo..",
  "..odbbbbbbdo..",
  ".obbbbbbbbbbo.",
  ".okkkkkkkkkko.",
]);

// Wok L2 — Wok Hei Master: double burner, taller flame
Sprites.def('t_wok_2', { o: '#241006', r: '#c53030', d: '#8e1f1f', w: '#f6e8c8', y: '#ffd23c', f: '#ff7b2e', k: '#3c2214', b: '#5f3a16' }, [
  "...offo.offo..",
  "...ofyfoofyfo.",
  "...offo.offo..",
  "...okkkokkko..",
  "..okkkkkkkkko.",
  ".orrrrrrrrrro.",
  "orwrwrwrwrwro.",
  "..obbbbbbbbo..",
  "..obwwwwwwbo..",
  "..obwyyyywbo..",
  "..obwwwwwwbo..",
  "..obbbbbbbbo..",
  ".obb......bbo.",
]);

// Wok L3 — Michelin Hawker: star plaque, roaring twin flames
Sprites.def('t_wok_3', { o: '#241006', r: '#c53030', d: '#8e1f1f', w: '#f6e8c8', y: '#ffd23c', f: '#ff7b2e', k: '#3c2214', b: '#5f3a16', e: '#e8b13a' }, [
  "..offo..offo..",
  ".ofyffoofyffo.",
  "..offfooofffo.",
  "...okkkkkko...",
  "..okkkkkkkko..",
  ".orrrrrrrrrro.",
  "orwrwrwrwrwro.",
  ".oeyeobbobeyeo",
  "..obbwwwwbbo..",
  "..obwyyyywbo..",
  "..obwwwwwwbo..",
  "..obbbbbbbbo..",
  ".obb......bbo.",
]);

// Wok ULT A — Dragon Breath Wok: dragon-head burner
Sprites.def('t_wok_ua', { o: '#241006', r: '#c53030', d: '#8e1f1f', w: '#f6e8c8', y: '#ffd23c', f: '#ff7b2e', k: '#3c2214', b: '#5f3a16', g: '#2e7a4a' }, [
  ".f..offfo..f..",
  "..fofyyyfof...",
  "..offyyyffo...",
  "...offfffo....",
  "..oggggggggo..",
  ".oggyggggygo..",
  ".ogggkkkkggo..",
  ".orrrrrrrrrro.",
  "orwrwrwrwrwro.",
  "..obbwwwwbbo..",
  "..obwyffywbo..",
  "..obwwwwwwbo..",
  "..obbbbbbbbo..",
  ".obb......bbo.",
]);

// Wok ULT B — Chilli Crab Cauldron: bubbling red cauldron, crab claws
Sprites.def('t_wok_ub', { o: '#241006', r: '#e03030', d: '#8e1f1f', w: '#f6e8c8', y: '#ffd23c', f: '#ff7b2e', k: '#3c2214', b: '#5f3a16' }, [
  ".oro..y..oro..",
  "orrro.f.orrro.",
  "orro..f..orro.",
  "..o.offfo.o...",
  "..orrrrrrro...",
  ".orryrryrrro..",
  ".orrrrrrrrro..",
  "..okkkkkkko...",
  "..obbbbbbbbo..",
  "..obwwwwwwbo..",
  "..obwyyyywbo..",
  "..obwwwwwwbo..",
  "..obbbbbbbbo..",
  ".obb......bbo.",
]);

// Power L2 — Grid Coil: taller coil stack, twin arcs
Sprites.def('t_power_2', { o: '#0e161e', s: '#9aa8b4', d: '#5f6e7a', c: '#7ee8ff', y: '#ffd23c', k: '#26303a', b: '#39485c' }, [
  ".c...cc...c...",
  "..c.occo.c....",
  "...occcco.....",
  "...osccso.....",
  "....osso......",
  "...odssdo.....",
  "....osso......",
  "...odssdo.....",
  "....osso......",
  "...odssdo.....",
  "...osssso.....",
  "..obbybybo....",
  "..obbbbbbo....",
  ".okkkkkkkko...",
]);

// Power L3 — Tesla Array: twin coils, big spark crown
Sprites.def('t_power_3', { o: '#0e161e', s: '#9aa8b4', d: '#5f6e7a', c: '#7ee8ff', y: '#ffd23c', k: '#26303a', b: '#39485c', w: '#e0f7ff' }, [
  "c..cc..cc..c..",
  ".coccoocco.c..",
  "..occwwcco....",
  "..osccccso....",
  "...oss.sso....",
  "..odsdodsdo...",
  "...oss.sso....",
  "..odsdodsdo...",
  "...ossssso....",
  "...odssssdo...",
  "..obbyybybo...",
  "..obbbbbbbo...",
  ".okkkkkkkkko..",
]);

// Power ULT A — Monsoon Storm: storm-cloud crown, forked bolts
Sprites.def('t_power_ua', { o: '#0e161e', s: '#9aa8b4', d: '#5f6e7a', c: '#7ee8ff', y: '#ffd23c', k: '#26303a', b: '#39485c', g: '#5a6a7a', w: '#e0f7ff' }, [
  "..oggggggggo..",
  ".oggggggggggo.",
  ".oggwggggwggo.",
  "..oggggggggo..",
  "..c..cc..c....",
  "...c.cc.c.....",
  "...occcco.....",
  "...osccso.....",
  "....osso......",
  "...odssdo.....",
  "....osso......",
  "...osssso.....",
  "..obybbybo....",
  ".okkkkkkkko...",
]);

// Power ULT B — Megawatt Coil: massive single coil, warning stripes
Sprites.def('t_power_ub', { o: '#0e161e', s: '#9aa8b4', d: '#5f6e7a', c: '#7ee8ff', y: '#ffd23c', k: '#26303a', b: '#39485c', r: '#e04040', w: '#e0f7ff' }, [
  "....owwwwo....",
  "...occcccco...",
  "..occwccwcco..",
  "..osccccccso..",
  "...ossssso....",
  "...odsssdo....",
  "...ossssso....",
  "...odsssdo....",
  "...ossssso....",
  "..oyskkksyo...",
  "..obybrbybo...",
  "..obbbbbbbo...",
  ".okkkkkkkkko..",
  ".okrkrkrkrko..",
]);

// Ice L2 — Snow Ice Stand: bigger mound, parasol
Sprites.def('t_ice_2', { o: '#122030', w: '#eef6fa', c: '#b8e4f2', b: '#4aa8d8', d: '#2e7bb4', p: '#f48fb1', g: '#7cc47c', k: '#1c3040', r: '#e05050' }, [
  "......oo......",
  "...orrwwrro...",
  "..orwwrrwwro..",
  ".......o......",
  "....owwwwo....",
  "...owcwwcwo...",
  "...opwgwpwo...",
  "..occcccccco..",
  "..obbbbbbbbo..",
  ".obwbwbwbwbbo.",
  ".obbbbbbbbbbo.",
  ".obwbwbwbwbbo.",
  "..okk....okk..",
  "..oo......oo..",
]);

// Ice L3 — Blizzard Bing: frost aura, icicle crown
Sprites.def('t_ice_3', { o: '#122030', w: '#eef6fa', c: '#b8e4f2', b: '#4aa8d8', d: '#2e7bb4', p: '#f48fb1', g: '#7cc47c', k: '#1c3040' }, [
  "..w...ww...w..",
  "..oc..cc..co..",
  "...owwwwwwo...",
  "..owwcwwcwwo..",
  "..owcwwwwcwo..",
  "..opwgwwgpwo..",
  "..owwcwwcwwo..",
  ".occcccccccco.",
  "..obbbbbbbbo..",
  ".obwbwbwbwbbo.",
  ".obbbbbbbbbbo.",
  ".obwbwbwbwbbo.",
  "..okk....okk..",
  "..oo......oo..",
]);

// Ice ULT A — Absolute Zero: crystal spire cart
Sprites.def('t_ice_ua', { o: '#122030', w: '#eef6fa', c: '#b8e4f2', b: '#4aa8d8', d: '#2e7bb4', k: '#1c3040', v: '#d8f4ff' }, [
  "......vv......",
  ".....ovvo.....",
  ".....ovcvo....",
  "....ovccvo....",
  "....ovccvvo...",
  "...ovccvcvvo..",
  "...ovcvvccvo..",
  "..ovvcccvcvvo.",
  "..occcccccco..",
  "..obbbbbbbbo..",
  ".obwbwbwbwbbo.",
  ".obbbbbbbbbbo.",
  "..okk....okk..",
  "..oo......oo..",
]);

// Ice ULT B — Hailstorm Bing: storm funnel, hail hopper
Sprites.def('t_ice_ub', { o: '#122030', w: '#eef6fa', c: '#b8e4f2', b: '#4aa8d8', d: '#2e7bb4', k: '#1c3040', s: '#9aa8b4', v: '#d8f4ff' }, [
  ".w..w.ww.w..w.",
  "..v..vvvv..v..",
  "..osssssssso..",
  "...osvvvvso...",
  "....osvvso....",
  "...owwwwwwo...",
  "..owcwwwwcwo..",
  "..owwcwwcwwo..",
  ".occcccccccco.",
  "..obbbbbbbbo..",
  ".obwbwbwbwbbo.",
  ".obbbbbbbbbbo.",
  "..okk....okk..",
  "..oo......oo..",
]);

Sprites.def('t_camp', { o: '#12250e', g: '#4c7a34', d: '#35592a', r: '#c53030' }, [
  ".......orr....",
  ".......orrr...",
  ".......orr....",
  ".......o......",
  "......ogo.....",
  ".....ogggo....",
  "....ogggggo...",
  "...ogggggggo..",
  "..ogggdddgggo.",
  ".oggggdddggggo",
  ".oggo.ooo.oggo",
  "..oo.......oo.",
]);

/* soldier / NSman */
Sprites.def('soldier', { o: '#101c0c', g: '#5a7a3c', d: '#3c5528', f: '#e0b890' }, [
  "..oooo..",
  ".oggggo.",
  ".odggdo.",
  "..offo..",
  ".oggggo.",
  "ooggggoo",
  ".odggdo.",
  "..oggo..",
  "..o..o..",
  "..oo.oo.",
]);

/* ================= HEROES ================= */

// Sang Nila Utama — royal prince, lion crest
Sprites.def('h_utama', { o: '#1c1206', y: '#ffd23c', d: '#c8962a', r: '#c53030', f: '#e8bd90', w: '#fff2d0', k: '#141414' }, [
  "....oyyo....",
  "...oyyyyo...",
  "..oyryyryo..",
  "..offffffo..",
  "..ofkffkfo..",
  "...offffo...",
  "..oryyyyro..",
  ".oryyyyyyro.",
  ".orywyywyro.",
  ".oryyyyyyro.",
  "..odyyyydo..",
  "..odd..ddo..",
  "..oo....oo..",
]);

// Sang Kancil — the trickster mousedeer
Sprites.def('h_kancil', { o: '#241206', b: '#a06a34', d: '#7a4e22', w: '#e8d8c0', k: '#141008' }, [
  ".oo......oo.",
  ".obo....obo.",
  "..obboobbo..",
  "..obbbbbbo..",
  ".obkbbbbkbo.",
  ".obbbbbbbbo.",
  "..obwwwwbo..",
  "...obbbbo...",
  "..obbbbbbo..",
  ".obbdbbdbbo.",
  "..oddddddo..",
  "..od.oo.do..",
  "..oo....oo..",
]);

// Badang — the strongman
Sprites.def('h_badang', { o: '#1a0e04', s: '#b57a48', d: '#8a5830', r: '#c53030', k: '#140a06', w: '#f0e0c8' }, [
  "....oooo....",
  "...okkkko...",
  "..osssssso..",
  "..osksskso..",
  "..osssssso..",
  "...oswwso...",
  ".oossssssoo.",
  "osossssssoso",
  "osossssssoso",
  ".o.orrrro.o.",
  "...orrrro...",
  "...odd.ddo..",
  "...oo...oo..",
]);

// Samsui Sister — red headgear, blue samfoo
Sprites.def('h_samsui', { o: '#180c08', r: '#d03028', d: '#9e1f1a', b: '#2a5a8a', n: '#1c4066', f: '#e8bd90', k: '#141008' }, [
  "..orrrrrro..",
  ".orrrrrrrro.",
  ".odrrrrrrdo.",
  "..offffffo..",
  "..ofkffkfo..",
  "...offffo...",
  "..obbbbbbo..",
  ".obbbbbbbbo.",
  ".obnbbbbnbo.",
  ".obbbbbbbbo.",
  "..onbbbbno..",
  "..onn..nno..",
  "..oo....oo..",
]);

// Hang Tuah — warrior with keris
Sprites.def('h_tuah', { o: '#140e06', g: '#2e7a4a', d: '#1e5a34', y: '#ffd23c', f: '#c89058', k: '#141008', s: '#c8ccd4' }, [
  "...oyyyyo...",
  "..ogggggo...",
  "..offffffo..",
  "..ofkffkfo..",
  "...offffo..s",
  "..oggggggos.",
  ".ogggggggso.",
  ".ogygggygo..",
  ".oggggggggo.",
  "..odggggdo..",
  "..odggggdo..",
  "..odd..ddo..",
  "..oo....oo..",
]);

// Nenek Kebayan — forest witch
Sprites.def('h_nenek', { o: '#101408', g: '#4c7a2c', d: '#35591e', w: '#d8d2c4', f: '#caa070', k: '#141008', p: '#7a2fae' }, [
  "....wwww....",
  "...owwwwo...",
  "..owwwwwwo..",
  "..offffffo..",
  "..ofkffkfo..",
  "...offffo.p.",
  "..oggggggop.",
  ".ogggggggop.",
  ".ogpggggpop.",
  ".ogggggggop.",
  "..odggggdop.",
  "..odd..ddo..",
  "..oo....oo..",
]);

// Lim Bo Seng — resistance fighter with rifle
Sprites.def('h_boseng', { o: '#101408', g: '#4a5a3c', d: '#36452c', f: '#e0b890', k: '#141008', b: '#5a3a1a', s: '#8a8f98' }, [
  "...oooooo...",
  "..oggggggo..",
  "..offffffo..",
  "..ofkffkfo..",
  "...offffo...",
  "..ogggggo.s.",
  ".ogggggggos.",
  ".ogggggggbs.",
  ".ogdggggdbo.",
  ".ogggggggo..",
  "..odggggdo..",
  "..odd..ddo..",
  "..oo....oo..",
]);

// Radin Mas — golden princess
Sprites.def('h_radin', { o: '#1a1206', y: '#ffd23c', d: '#c8962a', w: '#fff2d0', f: '#d8a878', k: '#141008', h: '#241a10' }, [
  "....oyyo....",
  "...ohhhho...",
  "..ohhhhhho..",
  "..offffffo..",
  "..ofkffkfo..",
  "...offffo...",
  "..oywwwwyo..",
  ".oywwwwwwyo.",
  ".oywyyyywyo.",
  ".oywwwwwwyo.",
  "..owwwwwwo..",
  "..oww..wwo..",
  "..oo....oo..",
]);

// Kusu Guardian — giant turtle spirit
Sprites.def('h_kusu', { o: '#0c2014', g: '#3f8a5c', d: '#2c6a42', s: '#7ab890', y: '#ffd23c', k: '#0a140c' }, [
  "....oooo....",
  "..oosssso...",
  ".osgggggso..",
  "osggdggdgso.",
  "osgdggggdgso",
  "osggggggggso",
  "osgdggggdgso",
  "osggdggdggso",
  ".osgggggso..",
  "o.ossssso.o.",
  "oyo......oyo",
  ".oo......oo.",
]);

// Merlion Guardian — living merlion spirit
Sprites.def('h_merlia', { o: '#12242c', w: '#eef4f6', s: '#c2d4dc', b: '#4aa8d8', d: '#2e7bb4', k: '#182226' }, [
  "....ooooo...",
  "...owwwwwo..",
  "..owswwswo..",
  "..owkwwkwo..",
  "..owwwwwwo..",
  "...owwkko...",
  "..oswwwwso..",
  ".obwwwwwwbo.",
  ".obwsswswbo.",
  ".obbwwwwbbo.",
  "..odbbbbdo..",
  "...odbbdo...",
  "....oddo....",
]);

/* ================= PROJECTILES ================= */

Sprites.def('p_durian', { o: '#2c3c10', g: '#8aa83c', k: '#5c7a22' }, [
  ".o.o.o.",
  "ogggggo",
  "okggkgo",
  "ogggggo",
  "ogkggko",
  "ogggggo",
  ".o.o.o.",
]);

Sprites.def('p_talisman', { o: '#5c4a10', y: '#ffe066', r: '#c62828' }, [
  "ooooo",
  "oyyyo",
  "oyryo",
  "oyryo",
  "oyryo",
  "oyyyo",
  "ooooo",
]);

/* ================= SCENERY ================= */

Sprites.def('bush', { o: '#12300f', g: '#4c9a3c', l: '#66b850' }, [
  "..oooo..",
  ".oglggo.",
  "ogggglgo",
  "oglggggo",
  ".oooooo.",
]);

/* HDB void-deck playground — red tower + yellow slide + blue swing */
Sprites.def('playground', { o: '#26180c', r: '#d94f3d', d: '#a83828', y: '#f2b632', w: '#fdf3dd', b: '#3f7dbf' }, [
  "..orro......",
  ".orrrro.....",
  "..oddo..bbb.",
  "..owwoy.b.b.",
  "..owwoyyob.b",
  "..oddo.yyorb",
  "..o..o..yyo.",
  "..o..o...yyo",
  ".oo..oo...oo",
]);

/* Bus stop — the orange-roofed heartland shelter */
Sprites.def('bus_stop', { o: '#2a1a0c', r: '#e8862a', d: '#b05f18', s: '#9aa8b4', w: '#f6e8c8', k: '#26180c', g: '#4aa8d8' }, [
  "orrrrrrrrrro",
  "odddddddddo.",
  ".os......so.",
  ".os.wggw.so.",
  ".os.wggw.so.",
  ".os......so.",
  ".oskkkkkkso.",
  ".os......so.",
  ".oo......oo.",
]);

/* Street lamp — warm sodium light on a grey post */
Sprites.def('lamp_post', { o: '#1c2228', s: '#7a848c', y: '#ffd23c', w: '#fff2c0' }, [
  ".oyyo",
  "oywwyo",
  ".oyyo.",
  "..oso.",
  "..oso.",
  "..oso.",
  "..oso.",
  "..oso.",
  ".ooso.",
]);

/* Park bench under a small planter */
Sprites.def('bench', { o: '#241408', w: '#a06a34', d: '#7a4e22', g: '#4c9a3c' }, [
  ".g......g.",
  "ogo....ogo",
  "owwwwwwwwo",
  "odwwwwwwdo",
  "owwwwwwwwo",
  ".od....do.",
  ".oo....oo.",
]);

Sprites.def('rock', { o: '#2c3238', s: '#8a929c', d: '#5f6870' }, [
  "..oooo..",
  ".osssso.",
  "ossdssdo",
  "osdsssso",
  ".oooooo.",
]);

/* Temporary Operations Command — field HQ tent, radio mast, sandbag ring */
Sprites.def('command_post', {
  o: '#141a10', g: '#5a7a3c', d: '#3c5528', t: '#6e8a4a',
  s: '#9aa8b4', r: '#d32f2f', w: '#f0e8d0', y: '#ffd23c',
  k: '#20180c', b: '#b09a60', n: '#8a784a',
}, [
  "....s...................",
  "...ss..oooooooooo.......",
  "...s.oottttttttttoo.....",
  "...soottggggggggttoo....",
  "...osggggggggggggggso...",
  "..oggggggggggggggggggo..",
  ".oggdgggggggggggggdggo..",
  ".ogddgwrrwgwrrwgggddgo..",
  ".ogddgwrrwgwrrwgggddgo..",
  ".odddggggggggggggdddgo..",
  ".odddgggokkkkogggdddgo..",
  "obbbbbbbokkkkobbbbbbbbo.",
  "obnbbnbbokkkkobbnbbnbbo.",
  "obbbbbbbokkkkobbbbbbbbo.",
  "..oooooooooooooooooooo..",
]);

/* ================= UI ICONS (pixel-art buttons) ================= */

Sprites.def('ui_play', { o: '#4a3208', y: '#ffd23c', w: '#fff2c0' }, [
  "oo........",
  "oyoo......",
  "owyyoo....",
  "owyyyyoo..",
  "owyyyyyyo.",
  "owyyyyyyo.",
  "owyyyyoo..",
  "owyyoo....",
  "oyoo......",
  "oo........",
]);

Sprites.def('ui_pause', { o: '#4a3208', y: '#ffd23c', w: '#fff2c0' }, [
  "ooo...ooo",
  "owyo.owyo",
  "owyo.owyo",
  "owyo.owyo",
  "owyo.owyo",
  "owyo.owyo",
  "owyo.owyo",
  "owyo.owyo",
  "ooo...ooo",
]);

Sprites.def('ui_home', { o: '#3a2210', r: '#d94f3d', s: '#a83828', w: '#fdf3dd', d: '#8a5a2a', k: '#5f3a16' }, [
  "....oo....",
  "...orro...",
  "..orrrro..",
  ".orrssrro.",
  "orrssssrro",
  "o.owwwwo.o",
  "..owkdwo..",
  "..owkdwo..",
  "..owkdwo..",
  "..oooooo..",
]);

Sprites.def('ui_sound', { o: '#3a2210', y: '#ffd23c', d: '#c8962a', c: '#4aa8d8' }, [
  "....oo..c.",
  "...oyo.c.c",
  "..oyyo..c.",
  "ooyyyo.c.c",
  "oydyyo.c.c",
  "oydyyo.c.c",
  "ooyyyo.c.c",
  "..oyyo..c.",
  "...oyo.c.c",
  "....oo..c.",
]);

Sprites.def('ui_mute', { o: '#3a2210', y: '#b0a894', d: '#8a8272', r: '#d94f3d' }, [
  "....oo....",
  "...oyo....",
  "..oyyor..r",
  "ooyyyo.rr.",
  "oydyyo.rr.",
  "oydyyor..r",
  "ooyyyor..r",
  "..oyyo.rr.",
  "...oyo.rr.",
  "....oor..r",
]);

Sprites.def('ui_book', { o: '#3a2210', r: '#c53030', w: '#fdf3dd', g: '#cfc4ae' }, [
  "..oooooo..",
  ".owwowwro.",
  "owgwowwrro",
  "owwwowwrro",
  "owgwowwrro",
  "owwwowwrro",
  "owgwowwrro",
  "owwwowwrro",
  ".owwowwro.",
  "..oooooo..",
]);

Sprites.def('ui_medal', { o: '#3a2210', y: '#ffd23c', d: '#c8962a', r: '#d94f3d', b: '#4aa8d8', w: '#fff2c0' }, [
  "..or..bo..",
  "..orr.bbo.",
  "..orrbbo..",
  "...oyyo...",
  "..oyyyyo..",
  ".oyywwyyo.",
  ".oyywwyyo.",
  ".oydyyydo.",
  "..oyddyo..",
  "...oooo...",
]);

Sprites.def('ui_trash', { o: '#3a2210', s: '#9aa8b4', d: '#5f6e7a', r: '#d94f3d' }, [
  "...oooo...",
  ".oossssoo.",
  ".osssssso.",
  ".oooooooo.",
  "..ossssso.",
  "..osdsdso.",
  "..osdsdso.",
  "..osdsdso.",
  "..ossssso.",
  "...ooooo..",
]);

Sprites.def('ui_down', { o: '#3a2210', g: '#4c9a3c', w: '#c8e8b8' }, [
  "...oooo...",
  "...owggo..",
  "...owggo..",
  "...owggo..",
  ".oowwggoo.",
  ".owwggggo.",
  "..owggo...",
  "...owgo...",
  "....oo....",
  "..oooooo..",
]);

Sprites.def('ui_up', { o: '#3a2210', b: '#4aa8d8', w: '#c8e8f8' }, [
  "..oooooo..",
  "....oo....",
  "...owbo...",
  "..owwbbo..",
  ".owwbbbbo.",
  ".oowwbboo.",
  "...owbbo..",
  "...owbbo..",
  "...owbbo..",
  "...oooo...",
]);

Sprites.def('ui_back', { o: '#3a2210', y: '#ffd23c', w: '#fff2c0' }, [
  "....oo....",
  "...owo....",
  "..owyo....",
  ".owyyooooo",
  "owyyyyyyyo",
  "owyyyyyyyo",
  ".owyyooooo",
  "..owyo....",
  "...owo....",
  "....oo....",
]);

Sprites.def('ui_map', { o: '#3a2210', g: '#7cc47c', b: '#4aa8d8', w: '#fdf3dd', r: '#d94f3d' }, [
  "oooooooooo",
  "owwgggwbbo",
  "owgggwwbbo",
  "owggwwbbwo",
  "owgwwrbbwo",
  "owwwwbbwwo",
  "owwwbbwwgo",
  "owwbbwwggo",
  "owbbwwgggo",
  "oooooooooo",
]);

Sprites.def('ui_retry', { o: '#3a2210', y: '#ffd23c', w: '#fff2c0' }, [
  "...oooo...",
  "..oyyyyoo.",
  ".oyo..oyyo",
  "oyo...oyyo",
  "oyo..oyyyy",
  "oyo...oyo.",
  "oyo....o..",
  ".oyo..oyo.",
  "..oyyyyo..",
  "...oooo...",
]);

Sprites.def('ui_sword', { o: '#2a1c08', s: '#d8e4ec', w: '#f6fbff', y: '#ffd23c', b: '#8a5a2a' }, [
  ".......oo.",
  "......oswo",
  ".....oswo.",
  "....oswo..",
  "oo.oswo...",
  "oyoswo....",
  ".oyyo.....",
  ".oyyyo....",
  "oyo.oyo...",
  "obo..oo...",
]);

Sprites.def('ui_heart', { o: '#3a0f10', r: '#e5533c', l: '#ff8a70', d: '#b23325' }, [
  "..oo..oo..",
  ".orroodro.",
  "orlrrrddro",
  "orllrrdddo",
  "orlrrrdddo",
  ".orrrdddo.",
  "..orrddo..",
  "...orro...",
  "....oo....",
]);

Sprites.def('ui_coin', { o: '#3a2a08', y: '#ffd23c', d: '#c8962a', w: '#fff2c0' }, [
  "...oooo...",
  "..oyyyyo..",
  ".oywwyydo.",
  "oyywoyyydo",
  "oywo.oyydo",
  "oywooyyydo",
  "oyywyyyddo",
  ".oyyyyddo.",
  "..oyyddo..",
  "...oooo...",
]);

Sprites.def('ui_wave', { o: '#0e2a44', b: '#3f9bd8', l: '#9adcf8', w: '#e8f8ff' }, [
  "..........",
  "..oo......",
  ".olwo..oo.",
  "olwlo.olwo",
  "olblooblbo",
  "obbbbobbbo",
  "obbbbbbbbo",
  ".obbbbbbo.",
  "..oooooo..",
  "..........",
]);

Sprites.def('ui_flame', { o: '#3a1206', r: '#e5533c', y: '#ffd23c', w: '#fff2c0' }, [
  "....oo....",
  "...oro....",
  "..orrro.o.",
  ".orryrooro",
  ".orryrrrro",
  "orryyyrrro",
  "orrywyyro.",
  "orywwwyro.",
  ".oywwwyo..",
  "..ooooo...",
]);

Sprites.def('ui_shield', { o: '#1c2836', s: '#8fa8c0', l: '#d8e4ec', d: '#5a7288', y: '#ffd23c' }, [
  "oooooooooo",
  "olssssssdo",
  "olsyyyysdo",
  "olsyssysdo",
  "olsyssysdo",
  "olsyyyysdo",
  ".olssssdo.",
  ".olssssdo.",
  "..olssdo..",
  "...oooo...",
]);

Sprites.def('ui_flag', { o: '#2a1c08', r: '#e5533c', d: '#b23325', t: '#8a5a2a' }, [
  "oo........",
  "otorrrrro.",
  "otorrrdro.",
  "otorrrrdo.",
  "otorrddro.",
  "otorrrrro.",
  "otoooooo..",
  "oto.......",
  "oto.......",
  "oo........",
]);

/* Merlion — drawn from the Merlion Park statue: large lion head with a
   layered swept-back mane, open mouth spouting water, broad chest
   tapering into a short scaled fish body, tail fin curling up behind,
   all seated on the carved blue wave base. */
Sprites.def('merlion', { o: '#26343c', w: '#eef4f6', s: '#c2d4dc', m: '#93b4c4', d: '#6e93a6', k: '#182226', b: '#7ec8e8', n: '#4a7fb6' }, [
  "..........ooo..ooo..........",
  ".........ommoommmmoo........",
  "........ommmmmmdmmmmo.......",
  ".......omdmmdmmmdmmmmo......",
  "......omwwmmmmdmmmdmmoo.....",
  ".....omwwwwwmmmdmmmdmmmo....",
  "....omwwwwwwwmdmmmdmmmo.....",
  "....owwkkwwwwwmmdmmdmmmo....",
  "...oowwkkwwwwwdmmmdmmdmo....",
  "..owwwwwwwwsswwmdmmdmmo.....",
  ".owwwwwwswwwwwwdmmmdmmmo....",
  ".osswwooowwwwwwmmdmmdmo.....",
  "..ookkkkkowwwwwdmmmdmmo.....",
  "bbokkkkkkowwwwwmmdmmmo......",
  "b.owwwwwooswwwwdmmdmo.......",
  "b..ooooo.owwwwwwmmmo........",
  "b...owwwwwwwwwwwwmo.........",
  "b...owwswswswswwwso.........",
  ".b..owswswswswswwso.........",
  ".b..oswswswswswswso.........",
  "....owswswswswswsso.........",
  "....oswswswswswswso.........",
  "....owswswswswswsso.........",
  ".....oswswswswswsswo........",
  ".....owswswswswswwwso...oo..",
  "......oswswswswswwwwso.oswo.",
  "......owswswswwwwwwwwooswwo.",
  ".......owwwwwwwwwwwwwwwwso..",
  ".....oobbbbbbbbbbbbbbbboo...",
  "....obnbbnbbnbbnbbnbbnbo....",
  ".....oobbbbbbbbbbbbbboo.....",
  ".......ooooooooooooo........",
]);
