// swipe.js – swipe gestures for both subtasks and task cards
import { pt, clamp, model, renderAll, bootBehaviors, FLAGS, gesture, startEditMode, startEditTaskTitle, syncTaskCompletion, optimisticUpdate } from './core.js';
import { SWIPE, ANIM } from './constants.js';
import { throttle } from './utils.js';

export function enableSwipe() {
  if (!FLAGS.swipeGestures) return;
  
  patchCSSOnce();
  
  // Attach swipe to both subtasks and task cards
  const subtaskWraps = document.querySelectorAll('.swipe-wrap');
  const cardWraps = document.querySelectorAll('.card-swipe-wrap');
  
  subtaskWraps.forEach(wrap => attachSubtaskSwipe(wrap));
  cardWraps.forEach(wrap => attachTaskSwipe(wrap));
  
  // Global click prevention
  const app = document.getElementById('app') || document;
  if (!app._swipeClickBound) {
    app.addEventListener('click', (e) => {
      if (e.target.closest('.action')) e.stopPropagation();
    });
    app._swipeClickBound = true;
  }
}

function attachSubtaskSwipe(wrap) {
  const row = wrap.querySelector('.subtask');
  const actions = wrap.querySelector('.swipe-actions');
  const leftZone = actions?.querySelector('.zone.left');
  const rightZone = actions?.querySelector('.zone.right');

  if (!row || !actions || !leftZone || !rightZone) return;

  // Dynamically align action buttons with subtask row height (same as task cards)
  const alignActions = () => {
    const rowRect = row.getBoundingClientRect();
    actions.style.height = `${rowRect.height}px`;
    actions.style.setProperty('--subtask-row-height', `${rowRect.height}px`);
  };
  
  alignActions();
  window.addEventListener('resize', alignActions);

  attachSwipeToElement(wrap, row, actions, leftZone, rightZone, 'subtask');
}

function attachTaskSwipe(wrap) {
  const row = wrap.querySelector('.card-row');
  const actions = wrap.querySelector('.card-swipe-actions');
  const leftZone = actions?.querySelector('.zone.left');
  const rightZone = actions?.querySelector('.zone.right');

  if (!row || !actions || !leftZone || !rightZone) return;

  // Dynamically align action buttons with card-row height
  const alignActions = () => {
    const rowRect = row.getBoundingClientRect();
    actions.style.height = `${rowRect.height}px`;
    actions.style.setProperty('--card-row-height', `${rowRect.height}px`);
  };
  
  alignActions();
  window.addEventListener('resize', alignActions);

  attachSwipeToElement(wrap, row, actions, leftZone, rightZone, 'task');
}

function attachSwipeToElement(wrap, row, actions, leftZone, rightZone, type) {
  if (!row || !actions || !leftZone || !rightZone) return;

  // Gesture state
  let startX = 0, startY = 0, currentX = 0;
  let openX = 0; // Current open position
  let tracking = false, captured = false;
  let holdTimer = null, isHolding = false;
  let scrollYAtStart = 0;
  let unlockScroll = null;
  
  // Velocity tracking for fling detection
  let velocityTracker = [];

  // Helper functions
  const getLeftWidth = () => leftZone.getBoundingClientRect().width;
  const getRightWidth = () => rightZone.getBoundingClientRect().width;
  const setTransform = (x) => row.style.transform = `translate3d(${Math.round(x)}px,0,0)`;
  const haptic = () => navigator.vibrate?.(8);
  const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Velocity tracking
  function trackVelocity(x, time) {
    velocityTracker.push({ x, time });
    const cutoff = time - SWIPE.FLING_EXPIRE;
    velocityTracker = velocityTracker.filter(s => s.time >= cutoff);
  }

  function getVelocity() {
    if (velocityTracker.length < 2) return 0;
    const latest = velocityTracker[velocityTracker.length - 1];
    const earliest = velocityTracker[0];
    const dt = latest.time - earliest.time;
    if (dt <= 0) return 0;
    return Math.abs(latest.x - earliest.x) / dt; // px/ms
  }

  function isFling() {
    const velocity = getVelocity();
    const distance = Math.abs(currentX - startX);
    return velocity >= SWIPE.FLING_VX && distance >= SWIPE.FLING_MIN;
  }

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

  function applyResistance(x) {
    const maxLeft = getLeftWidth() * SWIPE.MAX_OVEREXTEND;
    const maxRight = getRightWidth() * SWIPE.MAX_OVEREXTEND;
    
    if (x > maxLeft) return maxLeft + (x - maxLeft) * SWIPE.RESISTANCE_FACTOR;
    if (x < -maxRight) return -maxRight + (x + maxRight) * SWIPE.RESISTANCE_FACTOR;
    return x;
  }

  function startHoldTimer() {
    clearHoldTimer();
    holdTimer = setTimeout(() => {
      if (captured && tracking) {
        isHolding = true;
        wrap.classList.add('held');
        wrap.style.setProperty('--hold-feedback', '1');
        haptic();
      }
    }, SWIPE.HOLD_MS);
  }

  function clearHoldTimer() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

const updateVisuals = throttle((x) => {
    const leftReveal = clamp(x / Math.max(getLeftWidth(), 1), 0, 1);
    const rightReveal = clamp(-x / Math.max(getRightWidth(), 1), 0, 1);
    
    leftZone.style.setProperty('--reveal', leftReveal.toFixed(3));
    rightZone.style.setProperty('--reveal', rightReveal.toFixed(3));
  }, 16); // Throttle to ~60fps

  function pulseZone(zone) {
    zone.style.setProperty('--pulse', '1.15');
    setTimeout(() => zone.style.setProperty('--pulse', '1'), 180);
  }

  function onDown(e) {
    if (gesture.drag || gesture.swipe || 
        e.target.closest('.sub-handle') || 
        e.target.closest('.card-handle') ||
        e.target.closest('a,button,input,textarea,select,label,[contenteditable="true"]')) return;

    const p = pt(e);
    startX = p.x;
    startY = p.y;
    currentX = p.x;
    
    tracking = true;
    captured = false;
    isHolding = false;
    gesture.swipe = true;
    
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
    const now = performance.now();
    
    currentX = p.x;

    if (!captured) {
      const scrolled = Math.abs(((document.scrollingElement || document.documentElement).scrollTop || 0) - scrollYAtStart) > 2;
      
      if (Math.abs(dy) > SWIPE.VERTICAL_GUARD || scrolled) {
        cleanup();
        return;
      }
      
      if (Math.abs(dx) >= SWIPE.MIN_INTENT_DISTANCE) {
        captured = true;
        lockScroll();
        e.preventDefault();
        startHoldTimer();
      } else {
        return;
      }
    }

    e.preventDefault();
    trackVelocity(p.x, now);
    
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
    
    if (isFling()) {
      if (dx > 0) {
        executeAction(type === 'task' ? 'complete-all' : 'complete', leftZone);
      } else {
        executeAction(type === 'task' ? 'delete-task' : 'delete', rightZone);
      }
      return;
    }
    
    if (isHolding) {
      const targetX = dx > 0 ? getLeftWidth() : -getRightWidth();
      animateTo(targetX);
      openX = targetX;
      updateVisuals(targetX);
      wrap.style.removeProperty('--hold-feedback');
      cleanup();
      return;
    }
    
    const distance = Math.abs(dx);
    if (distance >= SWIPE.DELIBERATE_MIN) {
      if (dx > 0) {
        executeAction(type === 'task' ? 'complete-all' : 'complete', leftZone);
      } else {
        executeAction(type === 'task' ? 'delete-task' : 'delete', rightZone);
      }
      return;
    }
    
    animateTo(0);
    openX = 0;
    updateVisuals(0);
    cleanup();
  }

  function executeAction(actionName, zone) {
    haptic();
    pulseZone(zone);
    performAction(actionName);
    afterExecute(actionName.includes('complete') ? 'right' : 'left');
    cleanup();
  }

  function animateTo(targetX) {
    const duration = prefersReducedMotion() ? 80 : SWIPE.SNAP_MS;
    row.style.transition = `transform ${duration}ms ease`;
    setTransform(targetX);
    row.addEventListener('transitionend', () => row.style.transition = '', { once: true });
  }

  function afterExecute(direction) {
    const duration = prefersReducedMotion() ? 80 : SWIPE.EXEC_MS;
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
    if (type === 'subtask') {
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
          renderAll();
          bootBehaviors();
          break;
        case 'complete':
          subtask.done = !subtask.done;
          renderAll();
          bootBehaviors();
          break;
        case 'edit':
          closeDrawer();
          startEditMode(row);
          break;
      }
    } else if (type === 'task') {
      const taskId = wrap.closest('.task-card').dataset.id;
      const task = model.find(x => x.id === taskId);
      
      if (!task) return;
      
      switch (actionName) {
        case 'complete-all':
          if (task.subtasks.length > 0) {
            const allCompleted = task.subtasks.every(st => st.done);
            task.subtasks.forEach(st => st.done = !allCompleted);
          } else {
            task.completed = !task.completed;
          }
          renderAll();
          bootBehaviors();
          break;
        case 'edit-title':
          closeDrawer();
          startEditTaskTitle(row);
          break;
        case 'delete-task':
          if (confirm(`Delete "${task.title}" and all its subtasks?`)) {
            const taskIndex = model.findIndex(x => x.id === taskId);
            if (taskIndex >= 0) {
              model.splice(taskIndex, 1);
              renderAll();
              bootBehaviors();
            }
          }
          break;
      }
    }
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
    
    if (button.dataset.act !== 'edit' && button.dataset.act !== 'edit-title') {
      closeDrawer();
    }
  });
  
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) closeDrawer();
  });
}

function patchCSSOnce() {
  if (document.getElementById('swipeSimplePatch')) return;
  
  const style = document.createElement('style');
  style.id = 'swipeSimplePatch';
  style.textContent = `
    /* Subtask and task card container positioning */
    .swipe-wrap {
      position: relative;
      border-radius: var(--radius-sm, 10px);
    }
    
    .card-swipe-wrap {
      position: relative;
      overflow: hidden;
    }
    
    /* Subtask swipe styles */
    .subtask { 
      will-change: transform; 
      touch-action: pan-y;
      position: relative;
      background: white;
      transition: transform 140ms ease-out, box-shadow 140ms ease-out;
      border-radius: var(--radius-sm, 10px);
      z-index: 1;
    }
    
    .swipe-wrap.swiping .subtask { 
      touch-action: none; 
    }
    
    /* Task card swipe styles */
    .card-row {
      will-change: transform;
      touch-action: pan-y;
      position: relative;
      background: white;
      transition: transform 140ms ease-out, box-shadow 140ms ease-out;
      border-radius: var(--radius, 12px);
      z-index: 1;
    }
    
    .card-swipe-wrap.swiping .card-row {
      touch-action: none;
    }
    
    .swipe-wrap.swiping .subtask,
    .card-swipe-wrap.swiping .card-row {
      transition: none;
    }
    
    body.lock-scroll { 
      overflow: hidden; 
      overscroll-behavior: none; 
    }
    
    /* Subtask swipe actions - aligned with individual subtask rows */
    .swipe-actions { 
      position: absolute; 
      top: 0;
      left: 0;
      right: 0;
      height: var(--subtask-row-height, 56px);
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      pointer-events: none;
      border-radius: var(--radius-sm, 10px);
      background: #f8f9fa;
      overflow: hidden;
      z-index: 0;
    }
    
    /* Task card swipe actions - aligned with card-row only */
    .card-swipe-actions {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: var(--card-row-height, 60px);
      display: grid;
      grid-template-columns: 1fr 1fr;
      pointer-events: none;
      border-radius: var(--radius, 12px) var(--radius, 12px) 0 0;
      z-index: 0;
      background: #f8f9fa;
      overflow: hidden;
    }
    
    .swipe-actions .zone,
    .card-swipe-actions .zone { 
      display: flex; 
      align-items: center; 
      padding: 0 16px; 
      gap: 8px; 
      --reveal: 0; 
      --pulse: 1;
      min-height: inherit;
      transition: background-color 200ms ease;
    }
    
    .swipe-actions .zone.left,
    .card-swipe-actions .zone.left { 
      justify-content: flex-start;
      background: rgba(22, 163, 74, calc(var(--reveal) * 1.0 * var(--fade, 1)));
      opacity: var(--fade, 1);
      transition: opacity 150ms ease, background-color 150ms ease;
    }
    
    .swipe-actions .zone.right,
    .card-swipe-actions .zone.right { 
      justify-content: flex-end;
      background: rgba(239, 68, 68, calc(var(--reveal) * 1.0 * var(--fade, 1)));
      opacity: var(--fade, 1);
      transition: opacity 150ms ease, background-color 150ms ease;
    }
    
    .swipe-actions .action,
    .card-swipe-actions .action {
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
    
    .swipe-wrap.held .swipe-actions .action,
    .card-swipe-wrap.held .card-swipe-actions .action,
    .swipe-wrap[style*="--hold-feedback"] .swipe-actions .action,
    .card-swipe-wrap[style*="--hold-feedback"] .card-swipe-actions .action {
      box-shadow: 0 0 0 2px rgba(59,130,246,.4), 0 2px 8px rgba(0,0,0,.12);
      transform: scale(calc((0.8 + var(--reveal) * 0.3) * var(--pulse) * 1.05));
    }
    
    .swipe-wrap[style*="--hold-feedback"],
    .card-swipe-wrap[style*="--hold-feedback"] {
      background: rgba(59,130,246,.05);
      border-radius: var(--radius, 12px);
    }
    
    .swipe-actions .action.complete,
    .card-swipe-actions .action.complete { --bg: #16a34a; --fg: white; }
    .swipe-actions .action.edit,
    .card-swipe-actions .action.edit { --bg: #f59e0b; --fg: white; }
    .swipe-actions .action.delete,
    .card-swipe-actions .action.delete { --bg: #ef4444; --fg: white; }
    
    .task-card.all-completed .task-title {
      text-decoration: line-through;
      color: var(--muted, #6b7280);
    }
    
    .task-card.all-completed .badge {
      background: var(--green, #16a34a);
    }
    
    .task-card {
      position: relative;
      overflow: hidden;
    }
    
    @media (prefers-reduced-motion: reduce) {
      .subtask,
      .card-row { 
        transition: none !important; 
        transform: none !important;
      }
      .swipe-actions .action,
      .card-swipe-actions .action { transition: opacity 60ms linear; }
    }
  `;
  
  document.head.appendChild(style);
}