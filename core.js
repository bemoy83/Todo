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

// ADD THIS AFTER IMPORTS in core.js

class EventManager {
  constructor() {
    this.controllers = new Set();
    this.timers = new Set();
    this.observers = new Set();
  }

  addListener(element, event, handler, options = {}) {
    const controller = new AbortController();
    this.controllers.add(controller);
    
    element.addEventListener(event, handler, {
      ...options,
      signal: controller.signal
    });
    
    return () => {
      controller.abort();
      this.controllers.delete(controller);
    };
  }

  addTimer(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    
    this.timers.add(timer);
    return timer;
  }

  addInterval(callback, delay) {
    const interval = setInterval(callback, delay);
    this.timers.add(interval);
    return interval;
  }

  addObserver(observer) {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  cleanup() {
    // Abort all event listeners
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
    
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    
    // Disconnect all observers
    this.observers.forEach(observer => {
      if (observer.disconnect) observer.disconnect();
    });
    this.observers.clear();
  }
}

export const eventManager = new EventManager();
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

// REPLACE bindKeyboardShortcuts function in core.js:
function bindKeyboardShortcuts() {
  if (document._keyboardBound) return;
  
  eventManager.addListener(document, 'keydown', (e) => {
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

// Global cleanup function
// REPLACE the existing cleanup() function in core.js with this:
export function cleanup() {
  eventManager.cleanup();
  
  // Reset gesture state
  gesture.drag = false;
  gesture.swipe = false;
  
  // Clear any remaining RAF callbacks
  if (window._rafCallbacks) {
    window._rafCallbacks.clear();
  }
}

export { renderAll } from './rendering.js';