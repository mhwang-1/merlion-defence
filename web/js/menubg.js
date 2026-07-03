/* ===== MenuBG: animated pixel-art Singapore scene behind the menus =====
   Sega-attract-mode vibes: drifting clouds, a national-day flypast,
   rotating Singapore Flyer, MRT train, Marina Bay Sands, pastel HDB
   blocks with laundry, the Merlion spouting into the bay, a bumboat,
   bobbing otters — and a hantu parade marching along the promenade
   with Sang Nila Utama in pursuit. Drawn on a 480×300 buffer, scaled
   up pixelated to cover the window. Animates only on menu screens.   */
'use strict';

const MenuBG = {
  W: 480, H: 300, t: 0,

  clouds: [
    { x: 40,  y: 22, s: 1.6, v: 4.0 },
    { x: 190, y: 46, s: 1.0, v: 6.5 },
    { x: 310, y: 14, s: 1.3, v: 5.0 },
    { x: 430, y: 58, s: 0.8, v: 8.5 },
  ],

  init() {
    this.cv = document.getElementById('menu-bg');
    if (!this.cv) return;
    this.ctx = this.cv.getContext('2d');
    this.buf = document.createElement('canvas');
    this.buf.width = this.W; this.buf.height = this.H;
    this.g = this.buf.getContext('2d');
    const fit = () => { this.cv.width = innerWidth; this.cv.height = innerHeight; };
    window.addEventListener('resize', fit); fit();
    this.last = performance.now();
    requestAnimationFrame(ts => this.frame(ts));
  },

  active() {
    const s = document.querySelector('.screen.active');
    return s && s.id !== 'screen-game';
  },

  frame(ts) {
    requestAnimationFrame(t2 => this.frame(t2));
    if (ts - this.last < 33) return;               // ~30fps is plenty
    const dt = Math.min(0.1, (ts - this.last) / 1000);
    this.last = ts;
    if (!this.active()) return;
    this.t += dt;
    for (const c of this.clouds) { c.x -= c.v * dt; if (c.x < -80) c.x = 500; }
    this.draw();
    const cv = this.cv, ctx = this.ctx;
    const s = Math.max(cv.width / this.W, cv.height / this.H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, (cv.width - this.W * s) / 2, (cv.height - this.H * s) / 2,
      this.W * s, this.H * s);
  },

  px(x, y, w, h, c) { this.g.fillStyle = c; this.g.fillRect(x | 0, y | 0, w, h); },
  line(x0, y0, x1, y1, c, s = 1) {
    const n = (Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0) || 1;
    for (let i = 0; i <= n; i++)
      this.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, s, s, c);
  },

  cloud(x, y, s) {
    this.px(x, y, 30 * s, 9 * s, '#ffffff');
    this.px(x + 6 * s, y - 5 * s, 16 * s, 6 * s, '#ffffff');
    this.px(x + 19 * s, y - 3 * s, 10 * s, 5 * s, '#ffffff');
    this.px(x + 2 * s, y + 7 * s, 26 * s, 3 * s, '#dceef8');
  },

  hdb(x, w, h, body, trim) {
    const top = 200 - h;
    this.px(x, top, w, h, body);
    this.px(x, top, w, 3, trim);                       // roof band
    this.px(x, 191, w, 9, trim);                       // void deck
    for (let yy = top + 7; yy < 186; yy += 9) {
      for (let xx = x + 4; xx < x + w - 5; xx += 8) {
        const lit = ((xx * 7 + yy * 13) % 17) === 0;
        this.px(xx, yy, 3, 4, lit ? '#ffd977' : '#5f7a8a');
        if (((xx * 5 + yy * 3) % 23) === 0) {          // laundry pole
          this.px(xx - 1, yy + 5, 6, 1, '#8a5a2a');
          this.px(xx, yy + 6, 2, 2, '#e05a4a');
          this.px(xx + 3, yy + 6, 2, 2, '#4aa8d8');
        }
      }
    }
  },

  tree(x) {
    this.px(x + 3, 188, 3, 10, '#8a5a2a');
    this.px(x - 2, 179, 13, 10, '#4c9a4c');
    this.px(x, 180, 5, 4, '#7cc47c');
  },

  palm(x) {
    this.px(x, 180, 2, 20, '#8a5a2a');
    this.line(x + 1, 181, x - 7, 174, '#3f8a34', 2);
    this.line(x + 1, 181, x + 9, 174, '#3f8a34', 2);
    this.line(x + 1, 180, x - 4, 170, '#4fae44', 2);
    this.line(x + 1, 180, x + 6, 170, '#4fae44', 2);
  },

  draw() {
    const t = this.t, p = this.px.bind(this), ln = this.line.bind(this);
    const mix = (a, b, f) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;

    /* --- sky, in chunky bands --- */
    const skyA = [159, 220, 242], skyB = [253, 242, 214];
    for (let y = 0; y < 200; y += 4) p(0, y, 480, 4, mix(skyA, skyB, y / 200));

    /* --- sun --- */
    const sr = 11 + Math.sin(t * 1.4) * 0.8;
    for (let dy = -sr; dy <= sr; dy++) {
      const hw = Math.sqrt(Math.max(0, sr * sr - dy * dy));
      p(62 - hw, 44 + dy, hw * 2, 1, '#ffdf8a');
    }
    p(58, 40, 6, 5, '#fff3c8');

    /* --- clouds --- */
    for (const c of this.clouds) this.cloud(c.x, c.y, c.s);

    /* --- national-day flypast (plane towing the flag) --- */
    const fx = ((t * 30) % 900) - 80;
    if (fx < 540) {
      ln(fx - 18, 33, fx - 2, 33, '#98a4ac');
      p(fx - 44, 29, 26, 4, '#e04040');
      p(fx - 44, 33, 26, 4, '#ffffff');
      p(fx - 42, 30, 2, 2, '#ffffff');                 // crescent hint
      p(fx, 30, 20, 5, '#eef4f6');                     // fuselage
      p(fx + 20, 31, 3, 3, '#cdd6e0');                 // nose
      p(fx + 7, 26, 5, 4, '#cdd6e0');                  // tail fin
      p(fx + 6, 35, 9, 2, '#cdd6e0');                  // wing
    }

    /* --- Singapore Flyer (rotating!) --- */
    const cx = 297, cy = 132, r = 26, rot = t * 0.18;
    ln(cx - 10, 197, cx, cy, '#9ab4c4', 2);
    ln(cx + 10, 197, cx, cy, '#9ab4c4', 2);
    for (let a = 0; a < 36; a++) {
      const an = a / 36 * Math.PI * 2;
      p(cx + Math.cos(an) * r - 1, cy + Math.sin(an) * r - 1, 2, 2, '#7ea8c0');
    }
    for (let i = 0; i < 8; i++) {
      const an = rot + i * Math.PI / 4;
      ln(cx, cy, cx + Math.cos(an) * (r - 2), cy + Math.sin(an) * (r - 2), '#aac8d8');
      p(cx + Math.cos(an) * r - 2, cy + Math.sin(an) * r - 1, 4, 3, i % 2 ? '#e05a4a' : '#f6c945');
    }
    p(cx - 2, cy - 2, 4, 4, '#5f7a8a');

    /* --- CBD skyline silhouette --- */
    for (const [x, w, h] of [[150, 16, 66], [168, 13, 84], [184, 20, 58], [206, 15, 92], [222, 14, 70], [268, 16, 72], [286, 12, 56], [300, 10, 40]]) {
      p(x, 200 - h, w, h, '#b9d6e6');
      if (h > 70) p(x + (w >> 1), 192 - h, 1, 8, '#b9d6e6');
    }

    /* --- MRT viaduct + passing train (hidden by the tower at x=240) --- */
    p(0, 174, 252, 3, '#8a9aa4');
    for (let x = 8; x < 250; x += 30) p(x, 177, 3, 23, '#9ab0ba');
    const trx = -70 + ((t * 46) % 480);
    for (let c = 0; c < 3; c++) {
      const cxx = trx + c * 20;
      if (cxx > -20 && cxx < 248) {
        p(cxx, 166, 18, 8, '#eef4f6');
        p(cxx, 170, 18, 2, '#4c9a3c');
        for (let wx = 2; wx < 15; wx += 5) p(cxx + wx, 167, 3, 2, '#37474f');
      }
    }

    /* --- office tower that swallows the train --- */
    p(238, 86, 30, 3, '#88a4b8');
    p(240, 89, 26, 111, '#9fbcd0');
    for (let yy = 94; yy < 194; yy += 8)
      for (let xx = 244; xx < 262; xx += 6) p(xx, yy, 3, 4, '#7ea4bc');
    p(252, 78, 2, 8, '#88a4b8');

    /* --- Marina Bay Sands --- */
    for (const tx of [326, 350, 374]) {
      p(tx, 116, 16, 84, '#b4d0de');
      p(tx + 7, 116, 2, 84, '#9cbccc');
    }
    p(318, 108, 80, 8, '#8fb2c4');
    p(316, 110, 2, 4, '#8fb2c4'); p(398, 110, 2, 4, '#8fb2c4');
    for (let x = 322; x < 396; x += 8) p(x, 105, 3, 3, '#5aa06a');

    /* --- pastel HDB blocks --- */
    this.hdb(6, 42, 66, '#f7ddd2', '#e0988a');
    this.hdb(52, 38, 88, '#d8e8f6', '#86aed6');
    this.hdb(94, 46, 58, '#d6eed6', '#7cbc8a');

    this.tree(46); this.tree(88); this.tree(143); this.tree(312);

    /* --- promenade --- */
    p(0, 200, 412, 10, '#eadfbe');
    p(0, 200, 412, 2, '#d4c49a');
    this.palm(210); this.palm(258);

    /* --- the bay --- */
    const seaA = [147, 220, 214], seaB = [79, 178, 192];
    for (let y = 210; y < 300; y += 6) p(0, y, 480, 6, mix(seaA, seaB, (y - 210) / 90));

    /* --- bumboat --- */
    const bx = 520 - ((t * 13) % 640);
    p(bx - 2, 238, 38, 3, '#c53030');
    p(bx, 241, 34, 6, '#a05a30');
    p(bx + 7, 231, 20, 7, '#f0e0c0');
    p(bx + 7, 229, 20, 2, '#2e7a4a');
    p(bx + 31, 242, 2, 2, '#ffffff');
    p(bx + 38, 245, 9, 1, '#cff2ec');

    /* --- otter family --- */
    const ox = ((t * 10) % 560) - 40;
    for (let i = 0; i < 3; i++) {
      if (Math.sin(t * 0.8 + i * 1.9) > -0.35) {
        p(ox - i * 11, 273, 5, 4, '#7a5230');
        p(ox - i * 11 + 4, 274, 2, 2, '#5a3a20');
        p(ox - i * 11 - 3, 278, 11, 1, '#bfeee8');
      }
    }

    /* --- Merlion on its pedestal, spouting into the bay --- */
    p(414, 196, 48, 20, '#dfe8ec');
    p(414, 196, 48, 2, '#b8c8d0');
    if (typeof Sprites !== 'undefined' && Sprites.get('merlion'))
      Sprites.draw(this.g, 'merlion', 438, 180, 2);
    for (let i = 0; i < 20; i++) {
      const xa = 424 - i * 3.2;
      const ya = 168 - i * 1.8 + 0.22 * i * i + Math.sin(t * 7 - i) * 0.7;
      p(xa, ya, 2, 2, i % 3 ? '#a8e6f2' : '#e8fbff');
    }
    const sp = 1 + Math.abs(Math.sin(t * 5)) * 3;      // splash
    p(360 - sp, 212, 2, 2, '#e8fbff'); p(360 + sp, 212, 2, 2, '#e8fbff');
    p(360, 210, 2, 2, '#ffffff');

    /* --- hantu parade, pursued along the promenade --- */
    if (typeof Sprites !== 'undefined' && Sprites.get('toyol')) {
      const base = ((t * 26) % 760) - 100;
      ['toyol', 'pocong', 'kuntilanakSwarm', 'jiangshi'].forEach((n, i) => {
        const x = base - i * 36;
        if (x > -24 && x < 504) {
          const hop = n === 'jiangshi' || n === 'pocong'
            ? -Math.abs(Math.sin(t * 5 + i)) * 3.5
            : Math.sin(t * 9 + i * 1.7) * 1.5;
          Sprites.draw(this.g, n, x, 191 + hop, 1.4);
        }
      });
      const hx = base - 4 * 36 - 6;
      if (hx > -24 && hx < 504)
        Sprites.draw(this.g, 'h_utama', hx, 190 + Math.sin(t * 10) * 1.5, 1.5);
    }

    /* --- wave dashes + sparkles --- */
    for (const [row, yw] of [[0, 218], [1, 232], [2, 250], [3, 268], [4, 288]]) {
      for (let x = -24; x < 500; x += 24) {
        const xx = x + ((row * 13) % 24) + Math.sin(t * 1.1 + row * 1.7) * 6;
        p(xx, yw, 11, 2, '#c8f2ec');
      }
    }
    for (let k = 0; k < 26; k++) {
      if (Math.sin(t * 2.5 + k * 2.7) > 0.84)
        p((k * 97 + 31) % 480, 214 + (k * 61) % 82, 2, 2, '#ffffff');
    }
  },
};

MenuBG.init();
