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
    Renderer.draw(UI.ctx, Game);
    UI.refreshHud();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// unlock audio on first interaction
window.addEventListener('pointerdown', () => Sound.ensure(), { once: true });
