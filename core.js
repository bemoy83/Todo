// core.js – ES Module updated with TaskOperations

import { bindCrossSortContainer } from './drag.js';
import { enableSwipe } from './swipe.js';
import { bindMenu } from './menu.js';
import { debounce, safeExecute } from './utils.js';
import { model, saveModel, uid, syncTaskCompletion, isTaskCompleted, optimisticUpdate } from './state.js';
import { setApp } from './rendering.js';
import { renderAll } from './rendering.js';
import { startEditMode, startEditTaskTitle } from './editing.js';
import { TaskOperations, focusSubtaskInput } from './taskOperations.js';

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
function bindKeyboardShortcuts() {
  if (document._keyboardBound) return;
  
  document.addEventListener('keydown', (e) => {
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
  
  document._keyboardBound = true;
}

export function bootBehaviors(){
  if(!crossBound){ bindCrossSortContainer(); crossBound = true; }
  enableSwipe(); // This needs to run every time to rebind to new DOM elements
  bindAdders();
  bindMenu();
  bindKeyboardShortcuts();
}

function bindAdders(){
  // Main add bar - UPDATED to use TaskOperations
  const form = document.getElementById('addMainForm');
  if(form && !form._bound){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const inp = document.getElementById('newTaskTitle');
      const title = (inp?.value || '').trim();
      if(!title) return;
      
      try {
        // Use TaskOperations instead of direct model manipulation
        const task = await TaskOperations.task.create(title);
        inp.value = '';
        
        // Auto-focus the newly created task's subtask input for rapid entry
        if (task) {
          focusSubtaskInput(task.id);
        }
      } catch (error) {
        console.error('Failed to create task:', error);
        // Optionally show user feedback
      }
    });
    form._bound = true;
  }
  
  // Delegate for per-card subtask add - UPDATED to use TaskOperations
  app?.addEventListener('submit', function(e){
    const f = e.target.closest('.add-subtask-form');
    if(!f) return;
    e.preventDefault();
    
    const mainId = f.dataset.mainId;
    const input = f.querySelector('input[name="subtask"]');
    const text = (input.value || '').trim();
    if(!text) return;
    
    // Use TaskOperations instead of direct model manipulation
    TaskOperations.subtask.create(mainId, text).then(() => {
      // Clear input after successful creation
      input.value = '';
      
      // Restore focus to the same input after re-render for rapid entry
      setTimeout(() => {
        const taskCard = document.querySelector('.task-card[data-id="' + mainId + '"]');
        const subtaskInput = taskCard?.querySelector('.add-sub-input');
        if (subtaskInput) {
          subtaskInput.focus();
        }
      }, 50);
    }).catch(error => {
      console.error('Failed to create subtask:', error);
      // Optionally show user feedback
    });
  }, { once: false });
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
  // Remove form handlers
  const form = document.getElementById('addMainForm');
  if (form && mainFormHandler) {
    form.removeEventListener('submit', mainFormHandler);
    mainFormHandler = null;
  }
  
  if (app && appSubmitHandler) {
    app.removeEventListener('submit', appSubmitHandler);
    appSubmitHandler = null;
  }
  
  // Clean up drag
  if (window._cleanupDrag) {
    window._cleanupDrag();
  }
  
  // Reset crossBound here where it's defined
  crossBound = false;  // <-- ADD THIS LINE
  
  // Clean up swipe
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
  addersbound = false;
  crossBound = false;  // <-- THIS ONE IS ALREADY HERE, GOOD
}

export { renderAll } from './rendering.js';