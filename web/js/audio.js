/* ===== tiny WebAudio sound effects (no assets needed) ===== */
'use strict';

const Sound = {
  ctx: null,
  muted: false,

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, dur, type, vol, slide) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },

  noise(dur, vol) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.1;
    src.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },

  shoot()   { this.tone(880, 0.07, 'square', 0.04, -300); },
  splash()  { this.noise(0.22, 0.12); this.tone(90, 0.25, 'sine', 0.15, -40); },
  magic()   { this.tone(1200, 0.18, 'sine', 0.05, 500); },
  build()   { this.tone(300, 0.12, 'square', 0.08, 200); this.noise(0.1, 0.06); },
  sell()    { this.tone(700, 0.15, 'triangle', 0.08, -300); },
  die()     { this.tone(200, 0.2, 'sawtooth', 0.06, -120); },
  leak()    { this.tone(180, 0.4, 'sawtooth', 0.12, -100); },
  wave()    { this.tone(520, 0.14, 'square', 0.08, 0); this.tone(660, 0.2, 'square', 0.08, 0); },
  win()     { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.28, 'triangle', 0.1), i * 140)); },
  lose()    { [400, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.08), i * 180)); },
  coin()    { this.tone(1300, 0.08, 'square', 0.05, 300); },
};
