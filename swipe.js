// swipe.js — optimized ESM: swipe gestures with hold-to-pin
import { pt, clamp, model, renderAll, bootBehaviors, FLAGS, gesture } from './core.js';

// Tuning constants
const SWIPE = {
  FLING_VX: 0.95,
  FLING_MIN: 34,
  FLING_EXPIRE: 60,
  SNAP_MS: 120,
  EXEC_MS: 120,
  VERTICAL_GUARD: 10,
};

const THRESH = {
  SNAP_FRAC: 0.30,
  EXEC_FRAC: 1.5,
  EXEC_ADD: 30,
  EXEC_MIN: 140,
  PIN_HOLD_MS: 400,
  PIN_MIN_DIST: 30,
};

export function enableSwipe() {
  if (!FLAGS.swipeGestures) return;
  
  patchCSSOnce();
  document.querySelectorAll('.swipe-wrap').forEach(attachSwipe);
  
  // Global click prevention (once per page)
  const app = document.getElementById('app') || document;
  if (!app._swipeClickBound) {
    app.addEventListener('click', (e) => {
      if (e.target.closest('.action')) e.stopPropagation();
    });
    app._swipeClickBound = true;
  }
}

function attachSwipe(wrap) {
  const row = wrap.querySelector('.subtask');
  const actions = wrap.querySelector('.swipe-actions');
  const leftZone = actions.querySelector('.zone.left');
  const rightZone = actions.querySelector('.zone.right');

  // State
  let startX = 0, startY = 0, dx = 0, dy = 0, openX = 0;
  let tracking = false, captured = false, lastT = 0, lastX = 0, vx = 0;
  let scrollYAtDown = 0, pinTimer = null, pinned = false, lastMoveTime = 0;
  let unlockScroll = null;

  // Helper functions
  const OPEN_L = () => leftZone.getBoundingClientRect().width;
  const OPEN_R = () => rightZone.getBoundingClientRect().width;
  const EXEC_L = () => Math.max(THRESH.EXEC_MIN, OPEN_L() * THRESH.EXEC_FRAC + THRESH.EXEC_ADD);
  const EXEC_R = () => Math.max(THRESH.EXEC_MIN, OPEN_R() * THRESH.EXEC_FRAC + THRESH.EXEC_ADD);
  
  const setX = (x) => row.style.transform = `translate3d(${Math.round(x)}px,0,0)`;
  const haptics = () => navigator.vibrate?.(8);
  const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lockScroll() {
    if (unlockScroll) return;
    document.body.classList.add('lock-scroll');
    const preventScroll = (ev) => ev.preventDefault();
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('wheel', preventScroll, { passive: false });
    unlockScroll = () => {
      window.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('wheel', preventScroll);
      document.body.classList.remove('lock-scroll');
      unlockScroll = null;
    };
  }

  function cleanup() {
    gesture.swipe = false;
    tracking = false;
    captured = false;
    dx = dy = 0;
    setVisuals(openX);
    if (openX === 0) wrap.classList.remove('swiping', 'pinned');
    unlockScroll?.();
  }

  function reset() {
    setX(0);
    openX = 0;
    row.style.opacity = 1;
    setVisuals(0);
    wrap.classList.remove('swiping', 'pinned');
  }

  // Resistance when over-pulling
  function resist(x) {
    const maxL = OPEN_L() * 1.25;
    const maxR = OPEN_R() * 1.25;
    if (x > maxL) return maxL + (x - maxL) * 0.35;
    if (x < -maxR) return -maxR + (x + maxR) * 0.35;
    return x;
  }

  // Pin functionality
  function clearPin() {
    if (pinTimer) {
      clearTimeout(pinTimer);
      pinTimer = null;
    }
  }

  function schedulePin() {
    clearPin();
    lastMoveTime = performance.now();
    pinTimer = setTimeout(() => {
      if (performance.now() - lastMoveTime >= THRESH.PIN_HOLD_MS * 0.8) {
        tryPin();
      }
    }, THRESH.PIN_HOLD_MS);
  }

  function tryPin() {
    if (!captured) return;
    const x = openX + dx;
    if (Math.abs(x) < THRESH.PIN_MIN_DIST) return;

    pinned = true;
    const target = x > 0 ? OPEN_L() : -OPEN_R();
    animateTo(target);
    openX = target;
    haptics();
    pulse(x > 0 ? leftZone : rightZone);
    wrap.classList.add('pinned');
  }

  // Visual updates
  function setVisuals(x) {
    const l = clamp(x / Math.max(OPEN_L(), 1), 0, 1) || 0;
    const r = clamp(-x / Math.max(OPEN_R(), 1), 0, 1) || 0;
    leftZone.style.setProperty('--reveal', l.toFixed(3));
    rightZone.style.setProperty('--reveal', r.toFixed(3));
  }

  function pulse(zone) {
    zone.style.setProperty('--pulse', '1.12');
    setTimeout(() => zone.style.setProperty('--pulse', '1'), 180);
  }

  // Event handlers
  function onDown(e) {
    if (gesture.drag || gesture.swipe || 
        e.target.closest('.sub-handle') || 
        e.target.closest('a,button,input,textarea,select,label,[contenteditable="true"]')) return;

    pinned = false;
    clearPin();

    const p = pt(e);
    startX = p.x;
    startY = p.y;
    dx = dy = 0;
    tracking = true;
    captured = false;
    gesture.swipe = true;
    lastT = performance.now();
    lastX = startX;
    vx = 0;
    scrollYAtDown = (document.scrollingElement || document.documentElement).scrollTop || 0;

    wrap.classList.add('swiping');
    setVisuals(0);

    try { row.setPointerCapture?.(e.pointerId); } catch {}
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function onMove(e) {
    if (!tracking) return;

    const samples = e.getCoalescedEvents?.() || [e];
    const p = pt(samples[samples.length - 1]);
    dx = p.x - startX;
    dy = p.y - startY;
    lastMoveTime = performance.now();

    // Update velocity
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) {
      vx = vx * 0.75 + ((p.x - lastX) / dt) * 0.25;
      lastT = now;
      lastX = p.x;
    }

    // Capture decision
    if (!captured) {
      const scrolled = Math.abs(((document.scrollingElement || document.documentElement).scrollTop || 0) - scrollYAtDown) > 2;
      if (Math.abs(dy) > SWIPE.VERTICAL_GUARD || scrolled) {
        cleanup();
        return;
      }
      if (Math.abs(dx) > Math.max(10, Math.abs(dy))) {
        captured = true;
        lockScroll();
        e.preventDefault();
      } else return;
    }

    e.preventDefault();
    clearPin();

    const x = resist(openX + dx);
    setX(x);
    setVisuals(x);

    // Schedule pin if in reasonable range
    if (Math.abs(x) >= THRESH.PIN_MIN_DIST && Math.abs(x) <= Math.max(OPEN_L(), OPEN_R()) * 0.8) {
      schedulePin();
    }
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    tracking = false;
    clearPin();

    if (pinned) {
      gesture.swipe = false;
      unlockScroll?.();
      return;
    }

    const x = openX + dx;
    const revealAmount = Math.max(Math.abs(x) / OPEN_L(), Math.abs(x) / OPEN_R());
    
    // Fling to execute (with accident protection)
    const now = performance.now();
    const fresh = (now - lastT) <= SWIPE.FLING_EXPIRE;
    const v = fresh ? vx : 0;
    const flingThreshold = revealAmount > 0.3 ? SWIPE.FLING_VX * 1.5 : SWIPE.FLING_VX;
    
    if (captured && Math.abs(v) >= flingThreshold && Math.abs(dx) >= SWIPE.FLING_MIN) {
      if (v > 0) {
        haptics(); pulse(leftZone); act('complete'); afterExecute('right');
      } else {
        haptics(); pulse(rightZone); act('delete'); afterExecute('left');
      }
      return cleanup();
    }

    // Distance-based execute (with accident protection)
    const execThresholdL = revealAmount > 0.3 ? EXEC_L() * 1.2 : EXEC_L();
    const execThresholdR = revealAmount > 0.3 ? EXEC_R() * 1.2 : EXEC_R();
    
    if (x >= execThresholdL) {
      haptics(); pulse(leftZone); act('complete'); afterExecute('right');
      return cleanup();
    } else if (-x >= execThresholdR) {
      haptics(); pulse(rightZone); act('delete'); afterExecute('left');
      return cleanup();
    }

    // Snap open/closed
    const snapL = x >= OPEN_L() * THRESH.SNAP_FRAC ? OPEN_L() : 0;
    const snapR = -x >= OPEN_R() * THRESH.SNAP_FRAC ? -OPEN_R() : 0;
    const snap = x > 0 ? snapL : (x < 0 ? snapR : 0);
    
    animateTo(snap);
    openX = snap;
    setVisuals(snap);
    
    gesture.swipe = false;
    unlockScroll?.();
    if (openX === 0) wrap.classList.remove('swiping', 'pinned');
  }

  function animateTo(x) {
    const duration = prefersReducedMotion() ? Math.max(80, SWIPE.SNAP_MS - 40) : SWIPE.SNAP_MS;
    row.style.transition = `transform ${duration}ms ${prefersReducedMotion() ? 'linear' : 'ease'}`;
    setX(x);
    row.addEventListener('transitionend', () => row.style.transition = '', { once: true });
  }

  function afterExecute(side) {
    const dur = prefersReducedMotion() ? Math.max(80, SWIPE.EXEC_MS - 20) : SWIPE.EXEC_MS;
    row.style.transition = `transform ${dur}ms ease, opacity ${dur}ms ease`;
    setX(side === 'right' ? EXEC_L() : -EXEC_R());
    row.style.opacity = 0;
    setTimeout(() => {
      row.style.transition = '';
      reset();
    }, dur + 10);
  }

  function act(name) {
    const mainId = wrap.closest('.task-card').dataset.id;
    const subId = row.dataset.id;
    const m = model.find(x => x.id === mainId);
    if (!m) return;
    const i = m.subtasks.findIndex(s => s.id === subId);
    if (i < 0) return;
    
    const item = m.subtasks[i];
    if (name === 'delete') m.subtasks.splice(i, 1);
    else if (name === 'complete') item.done = !item.done;
    else if (name === 'flag') item.flagged = !item.flagged;
    
    renderAll();
    bootBehaviors();
  }

  function closeActions() {
    if (openX !== 0) {
      animateTo(0);
      openX = 0;
      setVisuals(0);
      wrap.classList.remove('swiping', 'pinned');
      pinned = false;
    }
  }

  // Event bindings
  row.addEventListener('pointerdown', onDown, { passive: true });
  row.addEventListener('click', closeActions);
  
  actions.addEventListener('click', (e) => {
    const btn = e.target.closest('.action');
    if (!btn) return;
    act(btn.dataset.act);
    closeActions();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) closeActions();
  });
}

function patchCSSOnce() {
  if (document.getElementById('swipePerfPatch')) return;
  
  const style = document.createElement('style');
  style.id = 'swipePerfPatch';
  style.textContent = `
    .subtask { will-change: transform; touch-action: pan-y; }
    .swipe-wrap.swiping .subtask { touch-action: none; }
    
    body.lock-scroll { overflow: hidden; overscroll-behavior: none; }
    
    .swipe-actions { 
      position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; 
      pointer-events: none; 
    }
    .swipe-actions .zone { 
      display: flex; align-items: center; padding: 0 12px; gap: 8px; 
      --reveal: 0; --pulse: 1; --act: 44px; 
    }
    .swipe-actions .zone.left { justify-content: flex-start; }
    .swipe-actions .zone.right { justify-content: flex-end; }
    
    .swipe-actions .action {
      pointer-events: auto; width: var(--act); height: var(--act);
      min-width: var(--act); min-height: var(--act); border-radius: 50%;
      flex-shrink: 0; box-sizing: border-box; font-size: 20px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--bg, #e5e7eb); color: var(--fg, #111827);
      box-shadow: 0 2px 8px rgba(0,0,0,.08); border: none; outline: none;
      opacity: calc(var(--reveal));
      transform: scale(calc((0.85 + var(--reveal) * 0.25) * var(--pulse)));
      transition: transform 140ms ease, opacity 140ms ease, background-color 140ms ease;
    }
    
    .swipe-wrap.pinned .swipe-actions .action {
      box-shadow: 0 0 0 2px rgba(59,130,246,.3), 0 2px 8px rgba(0,0,0,.08);
    }
    
    .swipe-actions .action.complete { --bg: #16a34a; --fg: white; }
    .swipe-actions .action.flag { --bg: #f59e0b; --fg: white; }
    .swipe-actions .action.delete { --bg: #ef4444; --fg: white; }
    
    .swipe-actions .zone.right .action:nth-child(1) { transition-delay: 40ms; }
    
    @media (prefers-reduced-motion: reduce) {
      .subtask { transition: none !important; }
      .swipe-actions .action { transition: opacity 80ms linear; }
    }
  `;
  document.head.appendChild(style);
}