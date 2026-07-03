/* ===== bootstrap + main loop ===== */
'use strict';

Progress.load();
UI.init();

let lastT = performance.now();

function frame(now) {
  const raw = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (Game.running || Game.over) {
    // multiple fixed-ish substeps for fast-forward stability
    const steps = Game.speed;
    for (let i = 0; i < steps; i++) Game.update(raw);
    if (!Game.paused) Renderer.updateTrains(raw); // MRT trains keep rolling
    Renderer.draw(UI.ctx, Game);
    UI.refreshHud();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// unlock audio on first interaction
window.addEventListener('pointerdown', () => Sound.ensure(), { once: true });

// dev helpers: ?autostart=LEVEL,MODE jumps into a level;
// ?dev3stars=N grants ★★★ up to level N; ?showmodes=N opens the mode picker;
// ?showarmory=1&merits=200 opens the Armory (optionally with merits to spend)
const _qs = new URLSearchParams(location.search);
if (_qs.get('dev3stars') !== null) {
  const upTo = parseInt(_qs.get('dev3stars')) || 0;
  for (let i = 0; i <= upTo; i++) Progress.complete(i, 3);
}
const _auto = _qs.get('autostart');
if (_auto) {
  const [li, mode] = _auto.split(',');
  Sound.muted = true;
  UI.startLevel(parseInt(li) || 0, mode || 'campaign');
} else if (_qs.get('showmodes') !== null) {
  Sound.muted = true;
  UI.show('levels'); UI.renderLevels();
  UI.showModePicker(parseInt(_qs.get('showmodes')) || 0);
} else if (_qs.get('screen')) {
  UI.show(_qs.get('screen'));   // dev: ?screen=help|menu|levels|armory
} else if (_qs.get('showarmory') !== null) {
  Sound.muted = true;
  if (_qs.get('merits')) { Progress.data.merits = parseInt(_qs.get('merits')) || 0; }
  UI.show('armory'); UI.renderArmory();
}
