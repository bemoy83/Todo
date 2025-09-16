// swipe.js - Simplified with gestureManager integration
import { pt, clamp, FLAGS } from './core.js';
import { startEditMode, startEditTaskTitle } from './editing.js';
import { TaskOperations } from './taskOperations.js';
import { gestureManager } from './gestureManager.js';
import { SWIPE, FEEDBACK, TIMING } from './constants.js';
import { throttle } from './utils.js';

export function enableSwipe() {
  if (!FLAGS.swipeGestures) return;
  
  // Re-query DOM elements every time this is called (after re-renders)
  const subtaskWraps = document.querySelectorAll('.swipe-wrap');
  const cardWraps = document.querySelectorAll('.card-swipe-wrap');
  
  // Remove existing listeners first (prevent duplicates)
  subtaskWraps.forEach(wrap => {
    if (wrap._swipeBound) return;
    attachSubtaskSwipe(wrap);
    wrap._swipeBound = true;
  });
  
  cardWraps.forEach(wrap => {
    if (wrap._swipeBound) return;
    attachTaskSwipe(wrap);
    wrap._swipeBound = true;
  });
  
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

  // Use CSS custom properties instead of direct style manipulation
  const alignActions = () => {
    const rowRect = row.getBoundingClientRect();
    actions.style.setProperty('--subtask-row-height', `${rowRect.height}px`);
  };
  
  alignActions();
  window.addEventListener('resize', alignActions);

  attachSwipeToElement(wrap, row, actions, leftZone, rightZone, 'subtask');
}

function attachTaskSwipe(wrap) {
  const row = wrap.querySelector('.main-task');
  const actions = wrap.querySelector('.card-swipe-actions');
  const leftZone = actions?.querySelector('.zone.left');
  const rightZone = actions?.querySelector('.zone.right');

  if (!row || !actions || !leftZone || !rightZone) return;

  // Use CSS custom properties instead of direct style manipulation
  const alignActions = () => {
    const rowRect = row.getBoundingClientRect();
    actions.style.setProperty('--main-task-height', `${rowRect.height}px`);
  };
  
  alignActions();
  window.addEventListener('resize', alignActions);

  attachSwipeToElement(wrap, row, actions, leftZone, rightZone, 'task');
}

function attachSwipeToElement(wrap, row, actions, leftZone, rightZone, type) {
  if (!row || !actions || !leftZone || !rightZone) return;
  
  // Gesture state - using constants
  let startX = 0, startY = 0, currentX = 0;
  let openX = 0;
  let tracking = false, captured = false;
  let holdTimer = null, isHolding = false;
  let scrollYAtStart = 0;
  let velocityTracker = [];

  // Helper functions using constants
  const getLeftRevealDistance = () => SWIPE.LEFT_REVEAL_DISTANCE || 80;
  const getRightRevealDistance = () => SWIPE.RIGHT_REVEAL_DISTANCE || 120;
  const setTransform = (x) => row.style.transform = `translate3d(${Math.round(x)}px,0,0)`;
  const haptic = () => navigator.vibrate?.(FEEDBACK.HAPTIC_MEDIUM || 8);
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
    return Math.abs(latest.x - earliest.x) / dt;
  }

  function isFling() {
    const velocity = getVelocity();
    const distance = Math.abs(currentX - startX);
    return velocity >= SWIPE.FLING_VX && distance >= SWIPE.FLING_MIN;
  }

  function cleanup() {
    tracking = false;
    captured = false;
    clearHoldTimer();
    isHolding = false;
    
    // Clear velocity tracker
    velocityTracker = [];
    
    // Remove any remaining event listeners
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    
    // Release gesture if we had it
    gestureManager.releaseGesture('swipe');
  }

function reset() {
    openX = 0;
    setTransform(0);
    row.style.opacity = 1;
    row.style.transition = '';
    updateVisuals(0);
    wrap.classList.remove('swiping', 'held');
    wrap.style.removeProperty('--hold-feedback');
    cleanup();
  }

  function applyResistance(x) {
    // Use separate max distances for left and right
    const maxLeft = getLeftRevealDistance() * SWIPE.MAX_OVEREXTEND;
    const maxRight = getRightRevealDistance() * SWIPE.MAX_OVEREXTEND;
    
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

  // Use CSS custom properties instead of direct calculations
  const updateVisuals = throttle((x) => {
    // Use separate distances for left and right zones
    const leftReveal = clamp(x / getLeftRevealDistance(), 0, 1);
    const rightReveal = clamp(-x / getRightRevealDistance(), 0, 1);
    
    leftZone.style.setProperty('--reveal', leftReveal.toFixed(3));
    rightZone.style.setProperty('--reveal', rightReveal.toFixed(3));
  }, 16);

  function pulseZone(zone) {
    zone.style.setProperty('--pulse', SWIPE.PULSE_SCALE || 1.2);
    setTimeout(() => zone.style.setProperty('--pulse', '1'), 180);
  }

  // Event handlers
  function onDown(e) {
    if (gestureManager.hasActiveGesture() || 
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
        // Request swipe gesture from gesture manager
        if (!gestureManager.requestGesture('swipe', wrap)) {
          cleanup();
          return;
        }
        
        captured = true;
        gestureManager.lockIOSScroll();
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
      const targetX = dx > 0 ? getLeftRevealDistance() : -getRightRevealDistance();
      animateTo(targetX);
      openX = targetX;
      updateVisuals(targetX);
      wrap.style.removeProperty('--hold-feedback');
      cleanup();
      return;
    }
    
    const distance = Math.abs(dx);
    const threshold = dx > 0 ? 
      (getLeftRevealDistance() * 0.6) :
      (getRightRevealDistance() * 0.6);
    
    if (distance >= threshold) {
      if (dx > 0) {
        executeAction(type === 'task' ? 'complete-all' : 'complete', leftZone);
      } else {
        executeAction(type === 'task' ? 'delete-task' : 'delete', rightZone);
      }
      return;
    }
    
    // Normal snap back
    animateTo(0);
    openX = 0;
    updateVisuals(0);
    cleanup();
  }

  function executeAction(actionName, zone) {
    haptic();
    pulseZone(zone);
    
    // Perform the action first
    performAction(actionName);
    
    // Then handle the animation and cleanup
    afterExecute(actionName.includes('complete') ? 'right' : 'left');
  }

  function animateTo(targetX) {
    const duration = prefersReducedMotion() ? TIMING.REDUCED_MOTION_DURATION : SWIPE.SNAP_MS;
    row.style.transition = `transform ${duration}ms ease`;
    setTransform(targetX);
    row.addEventListener('transitionend', () => row.style.transition = '', { once: true });
  }

  function afterExecute(direction) {
    const duration = prefersReducedMotion() ? TIMING.REDUCED_MOTION_DURATION : SWIPE.EXEC_MS;
    const distance = direction === 'right' ? getRightRevealDistance() * 1.2 : -getLeftRevealDistance() * 1.2;
    
    row.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
    setTransform(distance);
    row.style.opacity = 0;
    
    setTimeout(() => {
      cleanup();
      
      // Reset everything
      openX = 0;
      setTransform(0);
      row.style.opacity = 1;
      row.style.transition = '';
      updateVisuals(0);
      wrap.classList.remove('swiping', 'held');
      wrap.style.removeProperty('--hold-feedback');
    }, duration + 10);
  }

  // Action handler
  async function performAction(actionName) {
    try {
      if (type === 'subtask') {
        const mainId = wrap.closest('.task-card').dataset.id;
        const subId = row.dataset.id;
        
        switch (actionName) {
          case 'delete':
            await TaskOperations.subtask.delete(mainId, subId);
            break;
          case 'complete':
            await TaskOperations.subtask.toggle(mainId, subId);
            break;
          case 'edit':
            cleanup();
            reset();
            startEditMode(row);
            return;
        }
      } else if (type === 'task') {
        const taskId = wrap.closest('.task-card').dataset.id;
        
        switch (actionName) {
          case 'complete-all':
            await TaskOperations.task.toggleCompletion(taskId);
            break;
          case 'edit-title':
            cleanup();
            reset();
            startEditTaskTitle(row);
            return;
          case 'delete-task':
            await TaskOperations.task.delete(taskId);
            break;
        }
      }
    } catch (error) {
      console.error('Swipe action failed:', error);
      cleanup();
      reset();
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
  
  actions.addEventListener('click', async (e) => {
    const button = e.target.closest('.action');
    if (!button) return;
    
    await performAction(button.dataset.act);
    
    if (button.dataset.act !== 'edit' && button.dataset.act !== 'edit-title') {
      closeDrawer();
    }
  });
  
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) closeDrawer();
  });
}