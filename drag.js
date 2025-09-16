// drag.js — Simplified: let browser handle scroll naturally

import { $, $$, pt, clamp } from './core.js';
import { model } from './state.js';
import { TaskOperations } from './taskOperations.js';
import { gestureManager } from './gestureManager.js';
import { DRAG } from './constants.js';
const { HOLD_MS, JITTER_PX, GATE, FORCE, FOLLOW_MIN, FOLLOW_MAX, SPEED_GAIN, GAP_GAIN, SNAP_EPS } = DRAG;

export function bindCrossSortContainer() {
const app = document.getElementById('app');
const dragLayer = document.getElementById('dragLayer');
if (!app || !dragLayer) return;

patchCSSOnce();

// Helpers
const getRows = (list) => Array.from(list.children).filter(n => n.classList?.contains('swipe-wrap'));
const tailAnchor = (list) => list.querySelector('.add-subtask-form');

// Simple autoscroll using native browser capabilities
function performAutoscroll(ghostElement) {
  try {
    if (!ghostElement) return false;
    
    const ghostRect = ghostElement.getBoundingClientRect();
    const viewport = {
      top: 0,
      bottom: window.innerHeight,
      height: window.innerHeight
    };
    
    // Autoscroll settings
    const EDGE_THRESHOLD = 100;  // Pixels from edge to start scrolling
    const SCROLL_SPEED = 15;     // Pixels per frame
    
    let scrollAmount = 0;
    let shouldScroll = false;
    
    // Check if ghost is near top edge (scroll up)
    const topDistance = ghostRect.top;
    if (topDistance < EDGE_THRESHOLD) {
      const intensity = (EDGE_THRESHOLD - topDistance) / EDGE_THRESHOLD;
      scrollAmount = -SCROLL_SPEED * intensity;
      shouldScroll = true;
      console.log(`🔼 Autoscroll up: ${Math.round(scrollAmount)}px`);
    }
    
    // Check if ghost is near bottom edge (scroll down)
    const bottomDistance = viewport.bottom - ghostRect.bottom;
    if (bottomDistance < EDGE_THRESHOLD) {
      const intensity = (EDGE_THRESHOLD - bottomDistance) / EDGE_THRESHOLD;
      scrollAmount = SCROLL_SPEED * intensity;
      shouldScroll = true;
      console.log(`🔽 Autoscroll down: ${Math.round(scrollAmount)}px`);
    }
    
    // Use browser's native scroll - simple and reliable
    if (shouldScroll && Math.abs(scrollAmount) > 1) {
      window.scrollBy(0, Math.round(scrollAmount));
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('Autoscroll failed:', error);
    return false;
  }
}

// ----- Subtask drag state -----
let drag = null, ghost = null, ph = null;
let start = null, hold = false, armedAt = null, timer = null, started = false;
let anchorY = 0, railLeft = 0, sourceMainId = null, gw = 0, gh = 0;
let targetY = 0, smoothY = 0, ticking = false, prevTargetY = 0, prevStepY = 0;
let slotOriginCenterY = 0, lastFrameT = 0;

// ----- Card drag state -----
let cdrag = null, cghost = null, cph = null;
let cstart = null, chold = false, cstarted = false, carmedAt = null, ctimer = null;
let csmoothY = 0, ctargetY = 0, cprevTargetY = 0, cslotOriginCenterY = 0, canchorY = 0;
let cgw = 0, cgh = 0, crailLeft = 0, cardTicking = false, clastSwapY = null;
let cintent = 0, cintentStartY = 0;
const CARD_STICKY = 16, CARD_SWAP_PX = 56, CARD_EDGE_FRAC = 0.25;

// UNIFIED event handler
app.addEventListener('pointerdown', onUnifiedPointerDown, { passive: false });

function onUnifiedPointerDown(e) {
   if (gestureManager.hasActiveGesture()) return;
   
   // Skip if clicking on interactive elements
   if (e.target.closest('input, textarea, button, select, label, [contenteditable="true"]') ||
       e.target.closest('.action')) {
     return;
   }
 
   // Check for main-task first (higher priority)
   const cardRow = e.target.closest('.main-task');
   const card = e.target.closest('.task-card');
   
   if (cardRow && card) {
     if (card.querySelector('.task-title-edit-input')) return;
     console.log('🎯 Card drag detected on:', e.target);
     startCardDragSequence(e, cardRow, card);
     return;
   }
 
   // Check for subtask
   const subtask = e.target.closest('.subtask');
   if (subtask) {
     if (subtask.querySelector('.subtask-edit-input')) return;
     console.log('🎯 Subtask drag detected on:', e.target);
     startSubtaskDragSequence(e, subtask);
     return;
   }
 }

// Subtask drag sequence
function startSubtaskDragSequence(e, row) {
  drag = row; 
  start = pt(e);
  hold = false; 
  started = false; 
  armedAt = null; 
  sourceMainId = row.closest('.task-card').dataset.id;

  console.log('⏰ Starting subtask hold timer...');
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!drag) return;
    console.log('✅ Subtask hold timer fired!');
    hold = true; 
    armedAt = pt(e);
    row.classList.add('armed');
    
    // DON'T lock scroll for drag - let autoscroll work naturally
    
    if (navigator.vibrate) navigator.vibrate(5);
  }, HOLD_MS);

  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { once: true });
  window.addEventListener('pointercancel', onPointerUp, { once: true });
}

// Card drag sequence  
function startCardDragSequence(e, cardRow, card) {
  cdrag = card; 
  cstart = pt(e);
  chold = false; 
  cstarted = false; 
  carmedAt = null;
  
  console.log('⏰ Starting card hold timer...');
  clearTimeout(ctimer);
  ctimer = setTimeout(() => {
    if (!cdrag) return;
    console.log('✅ Card hold timer fired!');
    chold = true; 
    carmedAt = pt(e);
    cdrag.classList.add('armed');
    
    // DON'T lock scroll for drag - let autoscroll work naturally
    
    if (navigator.vibrate) navigator.vibrate(5);
  }, HOLD_MS);
  
  window.addEventListener('pointermove', onCardPointerMove, { passive: false });
  window.addEventListener('pointerup', onCardPointerUp, { once: true });
  window.addEventListener('pointercancel', onCardPointerUp, { once: true });
}

function onPointerMove(e) {
  if (!drag) return;
  
  const samples = e.getCoalescedEvents?.() || [e];
  const last = samples[samples.length - 1];
  const p = pt(last);
  
  const dpr = window.devicePixelRatio || 1;
  const jitter = Math.max(JITTER_PX, 6 * dpr);
  const dx0 = Math.abs(p.x - start.x), dy0 = Math.abs(p.y - start.y);
  
  if (!hold) {
    if (dx0 > jitter || dy0 > jitter) {
      clearTimeout(timer);
      drag.classList.remove('armed');
      cleanupNoDrag();
    }
    return;
  }
  
  // Prevent default when hold is active
  e.preventDefault();
  e.stopPropagation();
    
  if (hold && !started) {
    const dx = Math.abs(p.x - armedAt.x), dy = Math.abs(p.y - armedAt.y);
    if (dx + dy > 2) startDrag(p); else return;
  } else if (!hold) return;
  
  const appRect = app.getBoundingClientRect();
  const pointerCY = p.y - appRect.top;
  prevTargetY = targetY;
  targetY = pointerCY - anchorY;
}
  
function onCardPointerMove(e) {
  if (!cdrag) return;
  const samples = e.getCoalescedEvents?.() || [e];
  const p = pt(samples[samples.length - 1]);

  const dpr = window.devicePixelRatio || 1;
  const jitter = Math.max(JITTER_PX, 6 * dpr);
  const dx0 = Math.abs(p.x - cstart.x), dy0 = Math.abs(p.y - cstart.y);
  
  if (!chold) {
    if (dx0 > jitter || dy0 > jitter) {
      clearTimeout(ctimer);
      cdrag.classList.remove('armed');
      cleanupCardNoDrag();
    }
    return;
  }
  
  e.preventDefault();
  e.stopPropagation();
  
  if (chold && !cstarted) {
    const dx = Math.abs(p.x - carmedAt.x), dy = Math.abs(p.y - carmedAt.y);
    if (dx + dy > 2) startCardDrag(p); else return;
  } else if (!chold) return;

  const appRect = app.getBoundingClientRect();
  const pointerCY = p.y - appRect.top;
  cprevTargetY = ctargetY;
  ctargetY = pointerCY - canchorY;
}

function startDrag(p) {
  started = true; 
  drag.classList.remove('armed'); 
  
  // Request drag gesture - but DON'T lock scroll
  if (!gestureManager.requestGesture('drag', drag)) {
    cleanupNoDrag();
    return;
  }

  const r = drag.getBoundingClientRect();
  const appRect = app.getBoundingClientRect();

  ghost = drag.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.setProperty('--ghost-w', r.width);
  ghost.style.setProperty('--ghost-h', r.height);
  ghost.style.width = r.width + 'px';
  ghost.style.height = r.height + 'px';
  ghost.style.willChange = 'transform, opacity';
  gw = r.width; gh = r.height;

  const wrap = drag.closest('.swipe-wrap');
  ph = document.createElement('div');
  ph.className = 'placeholder';
  ph.style.height = r.height + 'px';
  wrap.insertAdjacentElement('afterend', ph);
  wrap.remove();

  const pointerCY = (p.y - appRect.top);
  const cardTopCY = r.top - appRect.top;
  anchorY = pointerCY - cardTopCY;

  railLeft = (r.left - appRect.left);
  ghost.style.left = railLeft + 'px';

  targetY = smoothY = pointerCY - anchorY;
  prevTargetY = targetY; prevStepY = smoothY;
  ghost.style.transform = `translate3d(0,${smoothY}px,0)`;
  dragLayer.appendChild(ghost);
  ghost.style.visibility = 'visible';

  const phr = ph.getBoundingClientRect();
  slotOriginCenterY = (phr.top - appRect.top) + phr.height / 2;

  lastFrameT = performance.now();
  if (!ticking) { ticking = true; requestAnimationFrame(step); }
  
  console.log(`🎯 Drag started - scroll remains enabled for autoscroll`);
}

function insertIntoListByGate(targetList, ghostCenterY, appRect){
  const anchor = tailAnchor(targetList);
  const rows = getRows(targetList);

  if (rows.length === 0) {
    anchor ? targetList.insertBefore(ph, anchor) : targetList.appendChild(ph);
    return;
  }

  let placed = false;
  for (const n of rows) {
    const content = n.querySelector('.subtask');
    const r = content.getBoundingClientRect();
    const gateTop = (r.top - appRect.top) + r.height * GATE;
    const gateBot = (r.bottom - appRect.top) - r.height * GATE;
    if (ghostCenterY <= gateTop) { targetList.insertBefore(ph, n); placed = true; break; }
    if (ghostCenterY >= gateBot) { continue; }
  }

  if (!placed) {
    anchor ? targetList.insertBefore(ph, anchor) : targetList.appendChild(ph);
  }
}

function step(now) {
  if (!drag) { ticking = false; return; }

  const dt = Math.max(1, (now || performance.now()) - lastFrameT);
  lastFrameT = (now || performance.now());

  // Adaptive alpha
  const gap = Math.abs(targetY - smoothY);
  const vel = Math.abs(targetY - prevStepY) / dt;
  let alpha = FOLLOW_MIN + GAP_GAIN * gap + SPEED_GAIN * (vel * 1000);
  if (alpha > FOLLOW_MAX) alpha = FOLLOW_MAX;

  smoothY += (targetY - smoothY) * alpha;
  prevStepY = smoothY;

  const renderY = Math.abs(targetY - smoothY) < SNAP_EPS ? targetY : smoothY;
  ghost.style.transform = `translate3d(0,${renderY}px,0)`;

  // Simple autoscroll using native browser scroll
  performAutoscroll(ghost);

  const appRect = app.getBoundingClientRect();
  const ghostCenterY = (renderY) + gh / 2;
  const probeX = railLeft + gw / 2;

  // Find list under ghost center
  let targetList = null;
  for (const ls of $$('.subtask-list', app)) {
    const lr = ls.getBoundingClientRect();
    const lyTop = lr.top - appRect.top, lyBot = lr.bottom - appRect.top;
    const lxLeft = lr.left - appRect.left, lxRight = lr.right - appRect.left;
    if (ghostCenterY >= lyTop && ghostCenterY <= lyBot && probeX >= lxLeft && probeX <= lxRight) {
      targetList = ls; break;
    }
  }
  if (!targetList) { requestAnimationFrame(step); return; }

  const dirDown = targetY >= prevTargetY;
  prevTargetY = targetY;

  if (ph.parentElement !== targetList) {
    insertIntoListByGate(targetList, ghostCenterY, appRect);
    const phr = ph.getBoundingClientRect();
    slotOriginCenterY = (phr.top - appRect.top) + phr.height / 2;
    requestAnimationFrame(step);
    return;
  }

  const before = ph.previousElementSibling?.classList?.contains('swipe-wrap') ? ph.previousElementSibling : null;
  const after  = ph.nextElementSibling?.classList?.contains('swipe-wrap') ? ph.nextElementSibling : null;

  let moved = false;

  if (dirDown && after) {
    const content = after.querySelector('.subtask');
    const ar = content.getBoundingClientRect();
    const gate = (ar.top - appRect.top) + ar.height * GATE;
    const forceGate = slotOriginCenterY + gh * FORCE;
    if (ghostCenterY >= gate || ghostCenterY >= forceGate) {
      const anchor = tailAnchor(targetList);
      const next = after.nextElementSibling;
      const ref = (next && next !== anchor) ? next : anchor;
      targetList.insertBefore(ph, ref);
      moved = true;
    }
  } else if (dirDown && !after) {
    const rows = getRows(targetList);
    const last = rows[rows.length - 1];
    if (last) {
      const lr = last.querySelector('.subtask').getBoundingClientRect();
      const gateEnd = (lr.bottom - appRect.top) - lr.height * GATE;
      const forceGate = slotOriginCenterY + gh * FORCE;
      if (ghostCenterY >= gateEnd || ghostCenterY >= forceGate) {
        const anchor = tailAnchor(targetList);
        targetList.insertBefore(ph, anchor || null);
        moved = true;
      }
    }
  } else if (!dirDown && before) {
    const content = before.querySelector('.subtask');
    const br = content.getBoundingClientRect();
    const gate = (br.bottom - appRect.top) - br.height * GATE;
    const forceGate = slotOriginCenterY - gh * FORCE;
    if (ghostCenterY <= gate || ghostCenterY <= forceGate) {
      targetList.insertBefore(ph, before);
      moved = true;
    }
  }

  if (moved) {
    const phr = ph.getBoundingClientRect();
    slotOriginCenterY = (phr.top - appRect.top) + phr.height / 2;
  }

  requestAnimationFrame(step);
}

async function onPointerUp() {
  clearTimeout(timer);
  if (!started) { cleanupNoDrag(); return; }

  const targetList = ph.parentElement?.classList.contains('subtask-list') ? ph.parentElement : null;
  const targetMainCard = targetList ? targetList.closest('.task-card') : null;
  const targetMainId = targetMainCard ? targetMainCard.dataset.id : null;

  if (targetList && targetMainId) {
    let newIndex = 0;
    for (let n = targetList.firstElementChild; n; n = n.nextElementSibling) {
      if (n === ph) break;
      if (n.classList?.contains('swipe-wrap')) newIndex++;
    }
    
    const subtaskId = drag.dataset.id;
    try {
      await TaskOperations.subtask.move(sourceMainId, subtaskId, targetMainId, newIndex);
    } catch (error) {
      console.error('Subtask drag failed:', error);
    }
  }
  
  cleanupDrag();
}

function cleanupNoDrag() {
  try { if (drag) drag.classList.remove('armed'); } catch {}
  drag = null; hold = false; started = false; start = null; armedAt = null;
  window.removeEventListener('pointermove', onPointerMove);
  // No scroll unlocking needed - it was never locked
}

function cleanupDrag() {
  if (dragLayer) dragLayer.innerHTML = '';
  drag = null; ghost = null; ph = null; hold = false; started = false; start = null; armedAt = null;
  window.removeEventListener('pointermove', onPointerMove);
  gestureManager.releaseGesture('drag');
}

function cleanupCardNoDrag() {
  try { if (cdrag) cdrag.classList.remove('armed'); } catch {}
  cdrag = null; chold = false; cstarted = false; cstart = null; carmedAt = null; cintent = 0; clastSwapY = null;
  window.removeEventListener('pointermove', onCardPointerMove);
  // No scroll unlocking needed - it was never locked
}

function cleanupCardDrag() {
  if (dragLayer) dragLayer.innerHTML = '';
  cdrag = null; cghost = null; cph = null; chold = false; cstarted = false; cstart = null; carmedAt = null; cintent = 0; clastSwapY = null;
  window.removeEventListener('pointermove', onCardPointerMove);
  gestureManager.releaseGesture('drag');
}

function startCardDrag(p) {
  cstarted = true; 
  cdrag.classList.remove('armed'); 
  
  // Request drag gesture - but DON'T lock scroll
  if (!gestureManager.requestGesture('drag', cdrag)) {
    cleanupCardNoDrag();
    return;
  }

  const r = cdrag.getBoundingClientRect();
  const appRect = app.getBoundingClientRect();

  cghost = cdrag.cloneNode(true);
  cghost.classList.add('drag-ghost');
  cghost.style.setProperty('--ghost-w', r.width);
  cghost.style.setProperty('--ghost-h', r.height);
  cghost.style.width = r.width + 'px'; cghost.style.height = r.height + 'px';
  cghost.style.willChange = 'transform, opacity';
  cgw = r.width; cgh = r.height;

  cph = document.createElement('div');
  cph.className = 'placeholder';
  cph.style.height = r.height + 'px';
  cdrag.insertAdjacentElement('afterend', cph);
  cdrag.remove();

  const appRect2 = app.getBoundingClientRect();
  const pointerCY = (p.y - appRect2.top);
  const cardTopCY = r.top - appRect2.top;
  canchorY = pointerCY - cardTopCY;
  crailLeft = (r.left - appRect2.left);
  cghost.style.left = crailLeft + 'px';
  ctargetY = csmoothY = pointerCY - canchorY;
  cprevTargetY = ctargetY;
  cghost.style.transform = `translate3d(0,${csmoothY}px,0)`;
  dragLayer.appendChild(cghost);
  cghost.style.visibility = 'visible';

  const phr = cph.getBoundingClientRect();
  cslotOriginCenterY = (phr.top - appRect2.top) + phr.height / 2;

  if (!cardTicking) { cardTicking = true; requestAnimationFrame(cardStep); }
  
  console.log(`🃏 Card drag started - scroll remains enabled for autoscroll`);
}

function cardStep() {
  if (!cghost) { cardTicking = false; return; }

  const gap = Math.abs(ctargetY - csmoothY);
  const vel = Math.abs(ctargetY - (csmoothY)) / 16;
  let alpha = FOLLOW_MIN + GAP_GAIN * gap + SPEED_GAIN * (vel * 1000);
  if (alpha > FOLLOW_MAX) alpha = FOLLOW_MAX;
  csmoothY += (ctargetY - csmoothY) * alpha;

  const renderY = Math.abs(ctargetY - csmoothY) < SNAP_EPS ? ctargetY : csmoothY;
  cghost.style.transform = `translate3d(0,${renderY}px,0)`;

  // Simple autoscroll for card dragging
  performAutoscroll(cghost);

  const appRect = app.getBoundingClientRect();
  const ghostCenterY = renderY + cgh / 2;

  const dirDown = ctargetY >= cprevTargetY;
  const currentSign = dirDown ? 1 : -1;
  if (cintent === 0) { cintent = currentSign; cintentStartY = renderY; }
  else if (cintent !== currentSign) {
    if (Math.abs(renderY - cintentStartY) > CARD_STICKY) { cintent = currentSign; cintentStartY = renderY; }
  }
  cprevTargetY = ctargetY;

  const before = cph.previousElementSibling?.classList?.contains('task-card') ? cph.previousElementSibling : null;
  const after  = cph.nextElementSibling?.classList?.contains('task-card') ? cph.nextElementSibling : null;

  let moved = false;
  if (cintent > 0 && after) {
    const ar = after.getBoundingClientRect();
    const afterTopCY = (ar.top - appRect.top);
    const confirmCY = afterTopCY + ar.height * CARD_EDGE_FRAC;
    const ghostBottom = renderY + cgh;
    const trigger = (ghostBottom - CARD_SWAP_PX >= confirmCY);
    const passedSticky = (clastSwapY === null) || (Math.abs(ghostCenterY - clastSwapY) > CARD_STICKY);
    if (trigger && passedSticky) { app.insertBefore(cph, after.nextSibling); moved = true; clastSwapY = ghostCenterY; }
  } else if (cintent < 0 && before) {
    const br = before.getBoundingClientRect();
    const beforeBottomCY = (br.bottom - appRect.top);
    const confirmCY = beforeBottomCY - br.height * CARD_EDGE_FRAC;
    const ghostTop = renderY;
    const trigger = (ghostTop + CARD_SWAP_PX <= confirmCY);
    const passedSticky = (clastSwapY === null) || (Math.abs(ghostCenterY - clastSwapY) > CARD_STICKY);
    if (trigger && passedSticky) { app.insertBefore(cph, before); moved = true; clastSwapY = ghostCenterY; }
  }

  if (moved) {
    const phr = cph.getBoundingClientRect();
    cslotOriginCenterY = (phr.top - appRect.top) + phr.height / 2;
  }

  requestAnimationFrame(cardStep);
}

async function onCardPointerUp() {
  clearTimeout(ctimer);
  if (!cstarted) { cleanupCardNoDrag(); return; }

  let newIndex = 0;
  for (let n = app.firstElementChild; n; n = n.nextElementSibling) {
    if (n === cph) break;
    if (n.classList?.contains('task-card')) newIndex++;
  }

  const movingId = cdrag.dataset.id;
  const oldIndex = model.findIndex(x => x.id === movingId);
  
  if (oldIndex !== -1) {
    try {
      await TaskOperations.task.move(oldIndex, newIndex);
    } catch (error) {
      console.error('Task drag failed:', error);
    }
  }

  cleanupCardDrag();
}
}

function patchCSSOnce() {
  if (document.getElementById('dragPerfPatch')) return;
  const style = document.createElement('style');
  style.id = 'dragPerfPatch';
  style.textContent = `
    .drag-ghost {
      will-change: transform, opacity;
      transform: translateZ(0);
      box-shadow: 0 6px 14px rgba(0,0,0,.12);
    }

    .subtask,
    .main-task,
    .swipe-wrap {
      touch-action: manipulation;
      -ms-touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }

    .sub-handle, .card-handle { 
      touch-action: none; 
    }

    /* Only lock scroll when specifically needed for swipes */
    .gesture-scroll-locked {
      /* Let browser handle this naturally */
    }
  `;
  document.head.appendChild(style);
}