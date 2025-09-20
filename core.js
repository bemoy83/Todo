// core.js – ES Module updated with TaskOperations

import { bindCrossSortContainer } from './drag.js';
import { enableSwipe, cleanupSwipeListeners } from './swipe.js';
import { bindMenu } from './menu.js';
import { debounce, safeExecute } from './utils.js';
import { model, saveModel, uid, syncTaskCompletion, isTaskCompleted, optimisticUpdate } from './state.js';
import { setApp, renderAll } from './rendering.js';
import { startEditMode, startEditTaskTitle } from './editing.js';
import { TaskOperations, focusSubtaskInput } from './taskOperations.js';
import { appEvents } from './events.js';

// ===== Helpers =====
export const $  = (s, root=document) => root.querySelector(s);
export const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
export const pt = e => ({ x: e.clientX, y: e.clientY });

// ---- Feature flags & logging ----
export const FLAGS = (function(){
  try {
    const saved = JSON.parse(localStorage.getItem('flags:swipe') || '{}');
    return { swipeGestures: saved.swipeGestures ?? true };
  } catch(_) { return { swipeGestures: true }; }
})();

const DEV = false;
export function log(){ if(DEV) try{ console.log('[todo]', ...arguments); }catch{} }
export function guard(fn){ return function guarded(){ try { return fn.apply(this, arguments); } catch(e){ if(DEV) console.error(e); } }; }

// ---- Module state ----
let app = null;
let dragLayer = null;
// shared gesture state (used by drag.js & swipe.js)
export const gesture = { drag: false, swipe: false };

// ===== Behavior wiring =====
let crossBound = false;
let keyboardDelegated = false;

function bindKeyboardShortcuts() {
  if (keyboardDelegated) return;
  
  // Use event delegation instead of direct binding
  appEvents.on('keydown', 'body', (e) => {
    // Only handle shortcuts when not typing in an input
    if (e.target.matches('input, textarea, [contenteditable]')) return;
    
    if (e.metaKey || e.ctrlKey) {
      switch(e.key) {
        case 'n':
          e.preventDefault();
          document.getElementById('newTaskTitle')?.focus();
          break;
        case 's':
          e.preventDefault();
          // Force save
          saveModel();
          break;
      }
    }
    
    // Escape to clear focus
    if (e.key === 'Escape') {
      document.activeElement?.blur();
    }
  });
  
  keyboardDelegated = true;
}
// Add this new function after bindKeyboardShortcuts
let delegatedEventsSetup = false;

function setupDelegatedEvents() {
  if (delegatedEventsSetup) return;
  
  // Handle action buttons (complete, edit, delete) for both tasks and subtasks
  appEvents.on('click', '.action', async (e, button) => {
    e.stopPropagation();
    e.preventDefault();
    
    const action = button.dataset.act;
    const wrap = button.closest('.swipe-wrap, .card-swipe-wrap');
    
    if (!action || !wrap) return;
    
    try {
      await handleAction(action, wrap);
    } catch (error) {
      console.error('Action failed:', error);
    }
  });
  
  // Main task form submission
  appEvents.on('submit', '#addMainForm', async (e, form) => {
    e.preventDefault();
    const inp = document.getElementById('newTaskTitle');
    const title = (inp?.value || '').trim();
    if (!title) return;
    
    try {
      const task = await TaskOperations.task.create(title);
      inp.value = '';
      
      if (task) {
        focusSubtaskInput(task.id);
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  });
  
  // Subtask form submission (delegated for all forms)
  appEvents.on('submit', '.add-subtask-form', async (e, form) => {
    e.preventDefault();
    
    const mainId = form.dataset.mainId;
    const input = form.querySelector('input[name="subtask"]');
    const text = (input.value || '').trim();
    if (!text) return;
    
    try {
      await TaskOperations.subtask.create(mainId, text);
      input.value = '';
      
      // Restore focus after re-render
      setTimeout(() => {
        const taskCard = document.querySelector(`.task-card[data-id="${mainId}"]`);
        const subtaskInput = taskCard?.querySelector('.add-sub-input');
        if (subtaskInput) {
          subtaskInput.focus();
        }
      }, 50);
    } catch (error) {
      console.error('Failed to create subtask:', error);
    }
  });
  
  delegatedEventsSetup = true;
}

// Add this helper function for handling actions
async function handleAction(action, wrap) {
  const isTask = wrap.classList.contains('card-swipe-wrap');
  
  if (isTask) {
    const taskId = wrap.closest('.task-card').dataset.id;
    
    switch(action) {
      case 'complete-all':
        await TaskOperations.task.toggleCompletion(taskId);
        break;
      case 'edit-title':
        const { startEditTaskTitle } = await import('./editing.js');
        startEditTaskTitle(wrap.querySelector('.card-row'));
        break;
      case 'delete-task':
        await TaskOperations.task.delete(taskId);
        break;
    }
  } else {
    const mainId = wrap.dataset.mainId;
    const subId = wrap.dataset.id;
    
    switch(action) {
      case 'complete':
        await TaskOperations.subtask.toggle(mainId, subId);
        break;
      case 'edit':
        const { startEditMode } = await import('./editing.js');
        startEditMode(wrap.querySelector('.subtask'));
        break;
      case 'delete':
        await TaskOperations.subtask.delete(mainId, subId);
        break;
    }
  }
}

export function bootBehaviors(){
  if(!crossBound){ 
    bindCrossSortContainer(); 
    crossBound = true; 
  }
  
  enableSwipe();
  bindAdders();
  bindMenu();
  bindKeyboardShortcuts();
  setupDelegatedEvents();  // ADD THIS LINE
}

// Add these variables BEFORE the function
let addersbound = false;
let mainFormHandler = null;
let appSubmitHandler = null;

// We can remove the variables we added earlier since we're using delegation now
function bindAdders(){
  // This function is now empty because we use event delegation
  // We keep it for backwards compatibility
  // All the work is done in setupDelegatedEvents()
}

// ===== Shared util for swipe/drag =====
export function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }

// Expose start helper so main.js can assign DOM refs
export function setDomRefs(){
  app = document.getElementById('app');
  dragLayer = document.getElementById('dragLayer');
  // Pass app to rendering module
  setApp(app);
}

// ===== Robust scroll locking for iOS compatibility =====
let scrollLockState = { locked: false, originalScrollY: 0, touchPreventHandler: null };

// Enhanced scroll lock that allows edge-based auto-scroll for drag operations
export function lockScrollWithEdgeScroll() {
  if (scrollLockState.locked) return;
  
  // Store original scroll position
  const scrollingElement = document.scrollingElement || document.documentElement;
  scrollLockState.originalScrollY = scrollingElement.scrollTop || window.scrollY || 0;
  
  // Apply CSS lock
  document.body.classList.add('lock-scroll');
  document.body.style.top = `-${scrollLockState.originalScrollY}px`;
  
  // Create a more refined touch handler that allows edge auto-scroll
  scrollLockState.touchPreventHandler = (e) => {
    // During drag operations, allow edge scrolling
    if (window.dragEdgeScroll && window.dragEdgeScroll.shouldAllowScroll(e)) {
      return; // Don't prevent - allow edge auto-scroll
    }
    
    // Otherwise prevent all scrolling
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Add event listeners
  document.addEventListener('touchstart', scrollLockState.touchPreventHandler, { capture: true, passive: false });
  document.addEventListener('touchmove', scrollLockState.touchPreventHandler, { capture: true, passive: false });
  document.addEventListener('touchend', scrollLockState.touchPreventHandler, { capture: true, passive: false });
  document.addEventListener('wheel', scrollLockState.touchPreventHandler, { capture: true, passive: false });
  
  scrollLockState.locked = true;
}

export function lockScrollRobust() {
  if (scrollLockState.locked) return;
  
  // Capture current scroll position
  const scrollingElement = document.scrollingElement || document.documentElement;
  scrollLockState.originalScrollY = scrollingElement.scrollTop || window.pageYOffset || 0;
  scrollLockState.locked = true;
  
  // Apply CSS lock with position fixed and top offset to maintain visual position
  document.body.classList.add('lock-scroll');
  document.body.style.top = `-${scrollLockState.originalScrollY}px`;
  
  // Aggressive touch event prevention for iOS
  scrollLockState.touchPreventHandler = (e) => {
    // Only prevent if we're in a locked state
    if (scrollLockState.locked) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  
  // Add comprehensive touch prevention
  document.addEventListener('touchstart', scrollLockState.touchPreventHandler, { passive: false, capture: true });
  document.addEventListener('touchmove', scrollLockState.touchPreventHandler, { passive: false, capture: true });
  document.addEventListener('touchend', scrollLockState.touchPreventHandler, { passive: false, capture: true });
  document.addEventListener('wheel', scrollLockState.touchPreventHandler, { passive: false, capture: true });
}

export function unlockScrollRobust() {
  if (!scrollLockState.locked) return;
  
  // Remove CSS lock
  document.body.classList.remove('lock-scroll');
  document.body.style.top = '';
  
  // Remove touch event prevention
  if (scrollLockState.touchPreventHandler) {
    document.removeEventListener('touchstart', scrollLockState.touchPreventHandler, { capture: true });
    document.removeEventListener('touchmove', scrollLockState.touchPreventHandler, { capture: true });
    document.removeEventListener('touchend', scrollLockState.touchPreventHandler, { capture: true });
    document.removeEventListener('wheel', scrollLockState.touchPreventHandler, { capture: true });
    scrollLockState.touchPreventHandler = null;
  }
  
  // Restore original scroll position
  const scrollingElement = document.scrollingElement || document.documentElement;
  scrollingElement.scrollTop = scrollLockState.originalScrollY;
  window.scrollTo(0, scrollLockState.originalScrollY);
  
  scrollLockState.locked = false;
  scrollLockState.originalScrollY = 0;
}

// Global cleanup function
export function cleanup() {
  // Destroy all delegated events
  appEvents.destroy();
  
  // Reset delegation flags
  keyboardDelegated = false;
  delegatedEventsSetup = false;
  
  // Clean up swipe (still needs individual cleanup)
  if (typeof cleanupSwipeListeners === 'function') {
    cleanupSwipeListeners();
  }
  
  // Remove any global event listeners
  if (window._resizeHandler) {
    window.removeEventListener('resize', window._resizeHandler);
  }
  
  // Clear any timers
  if (window._resizeTimer) {
    clearTimeout(window._resizeTimer);
  }
  
  // Reset gesture state
  gesture.drag = false;
  gesture.swipe = false;
  
  // Reset bound flags
  crossBound = false;
}

export { renderAll } from './rendering.js';