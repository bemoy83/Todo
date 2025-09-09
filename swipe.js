// swipe.js — clean ESM (tuned): swipe gestures (complete / flag / delete)
// Now with: reveal-on-swipe + circular action buttons + subtle swell + slight cascade on right side

import { pt, clamp, model, renderAll, bootBehaviors, FLAGS, gesture } from './core.js';

// Centralized swipe tuning (safe for 60–120 Hz displays)
const SWIPE = {
  FLING_VX: 0.95,     // px/ms (~950 px/s)
  FLING_MIN: 34,      // px min travel to qualify as fling
  FLING_EXPIRE: 60,   // ms – fresher velocity sample on 120 Hz
  SNAP_MS: 120,       // ms snap animation
  EXEC_MS: 120,       // ms execute animation
  VERTICAL_GUARD: 8,  // px vertical before we cancel for scrolling
};

export function enableSwipe() {
  if (!FLAGS.swipeGestures) return;

  patchCSSOnce();

  const wraps = Array.from(document.querySelectorAll('.swipe-wrap'));
  for (const w of wraps) attachSwipe(w);

  // Prevent clicks on action buttons from bubbling into drag (bind once per page)
  const appEl = document.getElementById('app') || document;
  if (!appEl._swipeClickBound) {
    appEl.addEventListener('click', (e) => {
      const act = e.target.closest('.action');
      if (!act) return;
      e.stopPropagation();
    });
    appEl._swipeClickBound = true;
  }
}

function attachSwipe(wrap) {
  const row = wrap.querySelector('.subtask');
  const actions = wrap.querySelector('.swipe-actions');
  const leftZone = actions.querySelector('.zone.left');
  const rightZone = actions.querySelector('.zone.right');

  let startX = 0, startY = 0, dx = 0, dy = 0, openX = 0;
  let tracking = false, captured = false, lastT = 0, lastX = 0, vx = 0;
  let scrollYAtDown = 0;

  const OPEN_L = () => leftZone.getBoundingClientRect().width;
  const OPEN_R = () => rightZone.getBoundingClientRect().width;

  const EXEC_L = () => Math.max(110, OPEN_L() + 24);
  const EXEC_R = () => Math.max(110, OPEN_R() + 24);

  function setX(x) { row.style.transform = `translate3d(${Math.round(x)}px,0,0)`; }
  function reset() { setX(0); openX = 0; row.style.opacity = 1; setVisuals(0); wrap.classList.remove('swiping'); }
  function haptics() { if (navigator.vibrate) navigator.vibrate(8); }
  function cleanup() { gesture.swipe = false; tracking = false; captured = false; dx = dy = 0; setVisuals(openX); if(openX===0) wrap.classList.remove('swiping'); }

  // Reveal math → write CSS variables on each zone so CSS can animate scale/opacity
  function setVisuals(x){
    const l = clamp(x / Math.max(OPEN_L(), 1), 0, 1) || 0;
    const r = clamp(-x / Math.max(OPEN_R(), 1), 0, 1) || 0;
    leftZone.style.setProperty('--reveal', l.toFixed(3));
    rightZone.style.setProperty('--reveal', r.toFixed(3));
  }

  // Brief pulse (size swell) by nudging a CSS variable, avoids transform overrides
  function pulse(zone){
    zone.style.setProperty('--pulse', '1.12');
    setTimeout(()=> zone.style.setProperty('--pulse', '1'), 180);
  }

  function isInteractiveTarget(t){
    return !!t.closest('a,button,input,textarea,select,label,[contenteditable="true"]');
  }

  function onDown(e) {
    if (gesture.drag || gesture.swipe) return;
    if (e.target.closest('.sub-handle')) return; // don't steal from drag handle
    if (isInteractiveTarget(e.target)) return;   // let native controls win

    const p = pt(e);
    startX = p.x; startY = p.y; dx = 0; dy = 0;
    tracking = true; captured = false; gesture.swipe = true;
    lastT = performance.now(); lastX = startX; vx = 0;
    scrollYAtDown = (document.scrollingElement || document.documentElement).scrollTop || 0;

    wrap.classList.add('swiping');
    setVisuals(0);

    try { row.setPointerCapture?.(e.pointerId); } catch {}
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function onMove(e) {
    if (!tracking) return;

    // Coalesced events give smoother traces on high-Hz devices (iOS/Safari)
    const samples = e.getCoalescedEvents?.() || [e];
    const last = samples[samples.length - 1];
    const p = pt(last);

    dx = p.x - startX; dy = p.y - startY;

    // Velocity sample (EMA) for fling
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) {
      const inst = (p.x - lastX) / dt; // px/ms
      vx = vx * 0.75 + inst * 0.25;    // smooth
      lastT = now; lastX = p.x;
    }

    // Decide capture
    if (!captured) {
      const scrolled = Math.abs(((document.scrollingElement || document.documentElement).scrollTop || 0) - scrollYAtDown) > 2;
      if (Math.abs(dy) > SWIPE.VERTICAL_GUARD || scrolled) { cleanup(); return; }
      if (Math.abs(dx) > Math.max(10, Math.abs(dy))) { captured = true; e.preventDefault(); }
      else return;
    }

    e.preventDefault();
    const raw = openX + dx;
    const x = resist(raw);
    setX(x);
    setVisuals(x);
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    tracking = false;

    const x = openX + dx;
    const dir = x > 0 ? 'right' : (x < 0 ? 'left' : 'none');

    // --- FLING TO EXECUTE ---
    {
      const now = performance.now();
      const fresh = (now - lastT) <= SWIPE.FLING_EXPIRE;
      const v = fresh ? vx : 0;
      if (captured && Math.abs(v) >= SWIPE.FLING_VX && Math.abs(dx) >= SWIPE.FLING_MIN) {
        if (v > 0) { haptics(); pulse(leftZone); act('complete'); afterExecute('right'); return cleanup(); }
        else       { haptics(); pulse(rightZone); act('delete');   afterExecute('left');  return cleanup(); }
      }
    }

    // --- Distance-based execute ---
    if (dir === 'right' && x >= EXEC_L()) {
      haptics(); pulse(leftZone); act('complete'); afterExecute('right'); return cleanup();
    } else if (dir === 'left' && -x >= EXEC_R()) {
      haptics(); pulse(rightZone); act('delete'); afterExecute('left'); return cleanup();
    }

    // --- Snap open/closed ---
    if (dir === 'right') {
      const snap = x >= OPEN_L() / 2 ? OPEN_L() : 0;
      animateTo(snap); openX = snap; setVisuals(snap);
    } else if (dir === 'left') {
      const snap = -x >= OPEN_R() / 2 ? -OPEN_R() : 0;
      animateTo(snap); openX = snap; setVisuals(snap);
    } else {
      animateTo(0); openX = 0; setVisuals(0);
    }
    gesture.swipe = false;
    if (openX === 0) wrap.classList.remove('swiping');
  }

  function animateTo(x) {
    row.style.transition = prefersReducedMotion() ? `transform ${Math.max(80, SWIPE.SNAP_MS - 40)}ms linear` : `transform ${SWIPE.SNAP_MS}ms ease`;
    setX(x);
    row.addEventListener('transitionend', () => { row.style.transition = ''; }, { once: true });
  }

  function afterExecute(side) {
    const dur = prefersReducedMotion() ? Math.max(80, SWIPE.EXEC_MS - 20) : SWIPE.EXEC_MS;
    row.style.transition = `transform ${dur}ms ease, opacity ${dur}ms ease`;
    setX(side === 'right' ? EXEC_L() : -EXEC_R());
    row.style.opacity = 0;
    setTimeout(() => { row.style.transition = ''; reset(); }, dur + 10);
  }

  function prefersReducedMotion(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Gentle resistance when over-pulling beyond action zones
  function resist(x) {
    const maxL = OPEN_L() * 1.25;
    const maxR = OPEN_R() * 1.25;
    if (x > maxL) return maxL + (x - maxL) * 0.35;
    if (x < -maxR) return -maxR + (x + maxR) * 0.35;
    return x;
  }

  // Buttons still work
  actions.addEventListener('click', (e) => {
    const btn = e.target.closest('.action'); if (!btn) return;
    const actName = btn.dataset.act; act(actName);
    animateTo(0); openX = 0; setVisuals(0); wrap.classList.remove('swiping');
  });

  // TAP TO CANCEL (tap the same row to close if open)
  row.addEventListener('click', () => { if (openX !== 0) { animateTo(0); openX = 0; setVisuals(0); wrap.classList.remove('swiping'); } });

  // Close when tapping outside the row (per-row binding keeps scope simple)
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) {
      if (openX !== 0) { animateTo(0); openX = 0; setVisuals(0); wrap.classList.remove('swiping'); }
    }
  });

  function act(name) {
    const mainId = wrap.closest('.task-card').dataset.id;
    const subId = row.dataset.id;
    const m = model.find(x => x.id === mainId); if (!m) return;
    const i = m.subtasks.findIndex(s => s.id === subId); if (i < 0) return;
    const item = m.subtasks[i];
    if (name === 'delete') m.subtasks.splice(i, 1);
    else if (name === 'complete') item.done = !item.done;
    else if (name === 'flag') item.flagged = !item.flagged;
    renderAll(); bootBehaviors();
  }

  row.addEventListener('pointerdown', onDown, { passive: true });
}

function patchCSSOnce(){
  if (document.getElementById('swipePerfPatch')) return;
  const style = document.createElement('style');
  style.id = 'swipePerfPatch';
  style.textContent = `
    /* GPU hint + allow vertical panning without delaying horizontal pointer events */
    .subtask { will-change: transform; touch-action: pan-y; }

    /* Reveal-on-swipe visuals: circular buttons hidden at rest, scale in + slight swell */
    .swipe-actions { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; pointer-events: none; }
    .swipe-actions .zone { display: flex; align-items: center; padding: 0 12px; gap: 8px; --reveal: 0; --pulse: 1; --act: 44px; }
    .swipe-actions .zone.left { justify-content: flex-start; }
    .swipe-actions .zone.right { justify-content: flex-end; }

.swipe-actions .action {
    pointer-events: auto; /* clickable when revealed */
    width: var(--act); height: var(--act);
    border-radius: 9999px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--bg, #e5e7eb); color: var(--fg, #111827);
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
    border: none; outline: none;
    opacity: calc(var(--reveal));
    transform-origin: center;
    transform: scale(calc((0.85 + var(--reveal) * 0.25) * var(--pulse)));
    transition: transform 140ms ease, opacity 140ms ease, background-color 140ms ease, box-shadow 140ms ease;
    }
    .swipe-actions .action:focus-visible {
    box-shadow: 0 0 0 3px rgba(59,130,246,.45), 0 2px 8px rgba(0,0,0,.10);
    }
    
    /* Colors per action */
    .swipe-actions .action.complete { --bg: #16a34a; --fg: white; } /* green */
    .swipe-actions .action.flag     { --bg: #f59e0b; --fg: white; } /* amber */
    .swipe-actions .action.delete   { --bg: #ef4444; --fg: white; } /* red */

    /* Subtle cascade on right side (later buttons arrive a beat later) */
    .swipe-actions .zone.right .action:nth-child(2) { transition-delay: 0ms;   transform-origin: right center; }
    .swipe-actions .zone.right .action:nth-child(1) { transition-delay: 40ms;  transform-origin: right center; }
    .swipe-actions .zone.left  .action              { transition-delay: 0ms;   transform-origin: left center; }

    @media (prefers-reduced-motion: reduce) {
      .subtask { transition: none !important; }
      .swipe-actions .action { transition: opacity 80ms linear; }
    }
  `;
  document.head.appendChild(style);
}
