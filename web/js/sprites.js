/* ===== Pixel-art sprite factory =====
   Sprites are defined as ASCII grids + palettes and baked to offscreen
   canvases once at load. '.' and ' ' are transparent.                  */
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
    this.cache[name] = c;
  },

  get(name) { return this.cache[name]; },

  /** dataURL for DOM <img> usage (menus etc.) */
  url(name) {
    if (!this.urlCache[name]) this.urlCache[name] = this.cache[name].toDataURL();
    return this.urlCache[name];
  },

  /** Draw sprite centered at (x, y). */
  draw(ctx, name, x, y, scale = 2, flip = 1) {
    const c = this.cache[name];
    if (!c) return;
    const w = c.width * scale, h = c.height * scale;
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
      this.tintCache[key] = c;
    }
    const c = this.tintCache[key];
    const w = c.width * scale, h = c.height * scale;
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

Sprites.def('tree', { o: '#10260e', g: '#3f8a34', d: '#2c6a24', l: '#5cae44', t: '#5f3a16' }, [
  "...oooo...",
  "..ogglgo..",
  ".oggglggo.",
  ".oglgggdgo",
  ".ogggldggo",
  "..odggdgo.",
  "...oggdo..",
  "....otto..",
  "....otto..",
  "...oottoo.",
]);

Sprites.def('palm', { o: '#123014', g: '#4fae44', d: '#2c7a28', t: '#8a5a2a', k: '#5f3a16' }, [
  "og.o...o.go",
  ".ogo.o.ogo.",
  "..ogogogo..",
  "....oto....",
  "....oto....",
  "...okto....",
  "...oto.....",
  "..ootoo....",
]);

Sprites.def('bush', { o: '#12300f', g: '#4c9a3c', l: '#66b850' }, [
  "..oooo..",
  ".oglggo.",
  "ogggglgo",
  "oglggggo",
  ".oooooo.",
]);

Sprites.def('rock', { o: '#2c3238', s: '#8a929c', d: '#5f6870' }, [
  "..oooo..",
  ".osssso.",
  "ossdssdo",
  "osdsssso",
  ".oooooo.",
]);

Sprites.def('portal', { o: '#2a0a44', p: '#7a2fae', v: '#a85ae0', k: '#12041e', w: '#e6c8ff' }, [
  "...oooooo...",
  "..oppppppo..",
  ".oppvvvvppo.",
  ".opvkkkkvpo.",
  "opvkwwwwkvpo",
  "opvkwkkwkvpo",
  "opvkwkkwkvpo",
  "opvkwwwwkvpo",
  ".opvkkkkvpo.",
  ".oppvvvvppo.",
  "..oppppppo..",
  "...oooooo...",
]);

/* Merlion for the main menu */
Sprites.def('merlion', { o: '#26343c', w: '#eef4f6', s: '#c2d4dc', b: '#7ec8e8', k: '#182226' }, [
  ".....ooooo......",
  "....owwwwwo.....",
  "...owwswwswo....",
  "...owkwwwkwo....",
  "...owwwwwwwo....",
  "...owwkkkwwo....",
  "....owwkkwo.....",
  "...oswwwwwso....",
  "..owwswwswwo....",
  "..owwwwwwwwo....",
  "..oswwwwwwso....",
  "...owwwwwwo.....",
  "...oswwwso......",
  "....owwwwo......",
  "....oswwwwo.....",
  ".....owwwwo.....",
  ".....oswwwo.....",
  "....owwwwo......",
  "...owwoswwo.....",
  "..owo..oswwo....",
  ".oo......owwo...",
  ".o.........oo...",
  "bbbbbbbbbbbbbbbb",
  "bkbbkbbkbbkbbkbb",
]);
