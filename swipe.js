// swipe.js — simplified swipe gestures with reliable hold-to-pin
// Copy this file to replace your existing swipe.js
import { pt, clamp, model, renderAll, bootBehaviors, FLAGS, gesture } from './core.js';

// Simplified tuning constants
const SWIPE = {
  FLING_VELOCITY: 0.6,     // Minimum velocity for fling
  FLING_MIN_DISTANCE: 20,  // Minimum distance for fling
  FLING_TIME_LIMIT: 80,    // Max time since last move for fling
  HOLD_TIME: 250,          // Time to register as hold (was 350-400)
  HOLD_TOLERANCE: 8,       // Max movement during hold (pixels)
  SNAP_DURATION: 120,
  EXEC_DURATION: 120,
  VERTICAL_GUARD: 15,
};

const THRESH = {
  SNAP_FRACTION: 0.25,     // When to snap open vs closed
  EXEC_DISTANCE: 80,       // Distance to auto-execute (simple fixed value)
};

export function enableSwipe() {
  if (!FLAGS.swipeGestures) return;
  
  patchCSSOnce();
  document.querySelectorAll('.swipe-wrap').forEach(attachSwipe);
  
  // Global click prevention
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

  // Simplified state
  let startX = 0, startY = 0, currentX = 0;
  let openX = 0; // Current open position
  let tracking = false, captured = false;
  let holdTimer = null, isHolding = false;
  let velocity = 0, lastMoveTime = 0, lastX = 0;
  let scrollYAtStart = 0;
  let unlockScroll = null;

  // Helper functions
  const getLeftWidth = () => leftZone.getBoundingClientRect().width;
  const getRightWidth = () => rightZone.getBoundingClientRect().width;
  const setTransform = (x) => row.style.transform = `translate3d(${Math.round(x)}px,0,0)`;
  const haptic = () => navigator.vibrate?.(8);
  const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lockScroll() {
    if (unlockScroll) return;
    document.body.classList.add('lock-scroll');
    const preventScroll = (e) => e.preventDefault();
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
    clearHoldTimer();
    isHolding = false;
    unlockScroll?.();
  }

  function reset() {
    openX = 0;
    setTransform(0);
    row.style.opacity = 1;
    updateVisuals(0);
    wrap.classList.remove('swiping', 'held');
    cleanup();
  }

  // Resistance for over-pulling
  function applyResistance(x) {
    const maxLeft = getLeftWidth() * 1.3;
    const maxRight = getRightWidth() * 1.3;
    
    if (x > maxLeft) return maxLeft + (x - maxLeft) * 0.3;
    if (x < -maxRight) return -maxRight + (x + maxRight) * 0.3;
    return x;
  }

  // Hold detection
  function startHoldTimer(startPos) {
    clearHoldTimer();
    holdTimer = setTimeout(() => {
      // Check if user hasn't moved too much
      const moveDistance = Math.abs(currentX - startPos);
      if (moveDistance <= SWIPE.HOLD_TOLERANCE && captured) {
        isHolding = true;
        wrap.classList.add('held');
        haptic();
        console.log('Hold detected!');
      }
    }, SWIPE.HOLD_TIME);
  }

  function clearHoldTimer() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  // Visual feedback
  function updateVisuals(x) {
    const leftReveal = clamp(x / Math.max(getLeftWidth(), 1), 0, 1);
    const rightReveal = clamp(-x / Math.max(getRightWidth(), 1), 0, 1);
    
    leftZone.style.setProperty('--reveal', leftReveal.toFixed(3));
    rightZone.style.setProperty('--reveal', rightReveal.toFixed(3));
  }

  function pulseZone(zone) {
    zone.style.setProperty('--pulse', '1.15');
    setTimeout(() => zone.style.setProperty('--pulse', '1'), 180);
  }

  // Event handlers
  function onDown(e) {
    if (gesture.drag || gesture.swipe || 
        e.target.closest('.sub-handle') || 
        e.target.closest('a,button,input,textarea,select,label,[contenteditable="true"]')) return;

    const p = pt(e);
    startX = p.x;
    startY = p.y;
    currentX = startX;
    
    tracking = true;
    captured = false;
    isHolding = false;
    gesture.swipe = true;
    
    velocity = 0;
    lastX = startX;
    lastMoveTime = performance.now();
    scrollYAtStart = (document.scrollingElement || document.documentElement).scrollTop || 0;

    wrap.classList.add('swiping');
    
    try { row.setPointerCapture?.(e.pointerId); } catch {}
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function onMove(e) {
    if (!tracking) return;
    
    const samples = e.getCoalescedEvents?.() || [e];
    const p = pt(samples[samples.length - 1]);
    const dx = p.x - startX;
    const dy = p.y - startY;
    
    currentX = p.x;
    const now = performance.now();
    
    // Update velocity (simple calculation)
    if (now - lastMoveTime > 0) {
      velocity = (p.x - lastX) / (now - lastMoveTime);
      lastX = p.x;
      lastMoveTime = now;
    }

    // Capture decision
    if (!captured) {
      const scrolled = Math.abs(((document.scrollingElement || document.documentElement).scrollTop || 0) - scrollYAtStart) > 2;
      
      if (Math.abs(dy) > SWIPE.VERTICAL_GUARD || scrolled) {
        cleanup();
        return;
      }
      
      if (Math.abs(dx) > Math.max(10, Math.abs(dy))) {
        captured = true;
        lockScroll();
        e.preventDefault();
        
        // Start hold timer once we've captured
        startHoldTimer(currentX);
      } else {
        return;
      }
    }

    e.preventDefault();
    
    // If we're moving too much, cancel hold
    if (!isHolding) {
      const moveFromStart = Math.abs(currentX - startX);
      if (moveFromStart > SWIPE.HOLD_TOLERANCE) {
        clearHoldTimer();
      }
    }
    
    const newX = applyResistance(openX + dx);
    setTransform(newX);
    updateVisuals(newX);
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    tracking = false;
    clearHoldTimer();
    
    if (!captured) {
      cleanup();
      return;
    }
    
    const dx = currentX - startX;
    const finalX = openX + dx;
    const timeSinceLastMove = performance.now() - lastMoveTime;
    const isFreshVelocity = timeSinceLastMove <= SWIPE.FLING_TIME_LIMIT;
    
    // HOLD: Keep drawer open at appropriate position
    if (isHolding) {
      console.log('Hold completed - keeping drawer open');
      const targetX = finalX > 0 ? getLeftWidth() : -getRightWidth();
      animateTo(targetX);
      openX = targetX;
      updateVisuals(targetX);
      cleanup();
      return;
    }
    
    // FLING: Immediate execution
    if (isFreshVelocity && 
        Math.abs(velocity) >= SWIPE.FLING_VELOCITY && 
        Math.abs(dx) >= SWIPE.FLING_MIN_DISTANCE) {
      
      console.log('Fling detected - executing');
      if (velocity > 0) {
        executeAction('complete', leftZone);
      } else {
        executeAction('delete', rightZone);
      }
      return;
    }
    
    // SWIPE: Distance-based execution or snap
    if (Math.abs(finalX) >= THRESH.EXEC_DISTANCE) {
      console.log('Distance execution');
      if (finalX > 0) {
        executeAction('complete', leftZone);
      } else {
        executeAction('delete', rightZone);
      }
      return;
    }
    
    // SNAP: Open or close based on reveal amount
    const leftWidth = getLeftWidth();
    const rightWidth = getRightWidth();
    let snapTarget = 0;
    
    if (finalX > 0 && finalX >= leftWidth * THRESH.SNAP_FRACTION) {
      snapTarget = leftWidth;
    } else if (finalX < 0 && Math.abs(finalX) >= rightWidth * THRESH.SNAP_FRACTION) {
      snapTarget = -rightWidth;
    }
    
    animateTo(snapTarget);
    openX = snapTarget;
    updateVisuals(snapTarget);
    
    if (snapTarget === 0) {
      wrap.classList.remove('swiping', 'held');
    }
    
    cleanup();
  }

  function executeAction(actionName, zone) {
    haptic();
    pulseZone(zone);
    performAction(actionName);
    afterExecute(actionName === 'complete' ? 'right' : 'left');
    cleanup();
  }

  function animateTo(targetX) {
    const duration = prefersReducedMotion() ? 80 : SWIPE.SNAP_DURATION;
    row.style.transition = `transform ${duration}ms ease`;
    setTransform(targetX);
    row.addEventListener('transitionend', () => row.style.transition = '', { once: true });
  }

  function afterExecute(direction) {
    const duration = prefersReducedMotion() ? 80 : SWIPE.EXEC_DURATION;
    const distance = direction === 'right' ? getLeftWidth() * 1.2 : -getRightWidth() * 1.2;
    
    row.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
    setTransform(distance);
    row.style.opacity = 0;
    
    setTimeout(() => {
      row.style.transition = '';
      reset();
    }, duration + 10);
  }

  function performAction(actionName) {
    const mainId = wrap.closest('.task-card').dataset.id;
    const subId = row.dataset.id;
    const task = model.find(x => x.id === mainId);
    
    if (!task) return;
    
    const subtaskIndex = task.subtasks.findIndex(s => s.id === subId);
    if (subtaskIndex < 0) return;
    
    const subtask = task.subtasks[subtaskIndex];
    
    switch (actionName) {
      case 'delete':
        task.subtasks.splice(subtaskIndex, 1);
        break;
      case 'complete':
        subtask.done = !subtask.done;
        break;
      case 'flag':
        subtask.flagged = !subtask.flagged;
        break;
    }
    
    renderAll();
    bootBehaviors();
  }

  function closeDrawer() {
    if (openX !== 0) {
      animateTo(0);
      openX = 0;
      updateVisuals(0);
      wrap.classList.remove('swiping', 'held');
      isHolding = false;
    }
  }

  // Event bindings
  row.addEventListener('pointerdown', onDown, { passive: true });
  row.addEventListener('click', closeDrawer);
  
  actions.addEventListener('click', (e) => {
    const button = e.target.closest('.action');
    if (!button) return;
    performAction(button.dataset.act);
    closeDrawer();
  });

  // Close drawer when clicking outside
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) closeDrawer();
  });
}

function patchCSSOnce() {
  if (document.getElementById('swipePatch')) return;
  
  const style = document.createElement('style');
  style.id = 'swipePatch';
  style.textContent = `
    .subtask { 
      will-change: transform; 
      touch-action: pan-y; 
    }
    
    .swipe-wrap.swiping .subtask { 
      touch-action: none; 
    }
    
    body.lock-scroll { 
      overflow: hidden; 
      overscroll-behavior: none; 
    }
    
    .swipe-actions { 
      position: absolute; 
      inset: 0; 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      pointer-events: none; 
    }
    
    .swipe-actions .zone { 
      display: flex; 
      align-items: center; 
      padding: 0 12px; 
      gap: 8px; 
      --reveal: 0; 
      --pulse: 1; 
    }
    
    .swipe-actions .zone.left { justify-content: flex-start; }
    .swipe-actions .zone.right { justify-content: flex-end; }
    
    .swipe-actions .action {
      pointer-events: auto; 
      width: 44px; 
      height: 44px;
      min-width: 44px; 
      min-height: 44px; 
      border-radius: 50%;
      flex-shrink: 0; 
      font-size: 20px;
      display: inline-flex; 
      align-items: center; 
      justify-content: center;
      background: var(--bg, #e5e7eb); 
      color: var(--fg, #111827);
      box-shadow: 0 2px 8px rgba(0,0,0,.08); 
      border: none; 
      outline: none;
      opacity: var(--reveal);
      transform: scale(calc((0.8 + var(--reveal) * 0.3) * var(--pulse)));
      transition: transform 140ms ease, opacity 140ms ease;
    }
    
    .swipe-wrap.held .swipe-actions .action {
      box-shadow: 0 0 0 2px rgba(59,130,246,.4), 0 2px 8px rgba(0,0,0,.12);
      transform: scale(calc((0.8 + var(--reveal) * 0.3) * var(--pulse) * 1.05));
    }
    
    .swipe-actions .action.complete { --bg: #16a34a; --fg: white; }
    .swipe-actions .action.flag { --bg: #f59e0b; --fg: white; }
    .swipe-actions .action.delete { --bg: #ef4444; --fg: white; }
    
    @media (prefers-reduced-motion: reduce) {
      .subtask { transition: none !important; }
      .swipe-actions .action { transition: opacity 60ms linear; }
    }
  `;
  
  document.head.appendChild(style);
}