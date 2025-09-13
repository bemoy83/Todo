// core.js – ES Module

import { bindCrossSortContainer } from './drag.js';
import { enableSwipe } from './swipe.js';
import { bindMenu } from './menu.js';
import { model, saveModel, uid, syncTaskCompletion, isTaskCompleted, optimisticUpdate } from './state.js';
import { safeExecute } from './utils.js';
// Remove the rendering.js import temporarily

// Add renderAll back to core.js temporarily
export function renderAll(){
  return safeExecute(() => {
    const layer = app ? app.querySelector("#dragLayer") : null;
    if(app) app.innerHTML = "";
    if(!app) return Promise.resolve();
    
    if(model.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = '<div>🎉 All done!</div><div>Add your first task below.</div>';
      app.appendChild(empty);
    } else {
      for(const m of model) app.appendChild(renderCard(m));
    }
    if(layer) app.appendChild(layer);
    saveModel();
    
    return Promise.resolve();
  }, () => {
    console.error('Render failed, showing fallback');
    if(app) app.innerHTML = '<div class="empty">Something went wrong. Please refresh.</div>';
    return Promise.resolve();
  });
}

function renderCard(m){
  const card = document.createElement("article");
  card.className = "task-card card-swipe-wrap";
  card.dataset.id = m.id;
  
  // Determine if task is completed
  const taskCompleted = m.completed || (m.subtasks.length > 0 && m.subtasks.every(st => st.done));
  
  card.innerHTML = `
    <div class="card-swipe-actions" aria-hidden="true">
      <div class="zone left">
        <button class="action complete" data-act="complete-all" title="${taskCompleted ? 'Mark incomplete' : 'Complete task'}">✓</button>
      </div>
      <div class="zone right">
        <button class="action edit" data-act="edit-title" title="Edit task">✏</button>
        <button class="action delete" data-act="delete-task" title="Delete task">×</button>
      </div>
    </div>
    <div class="card-row">
      <div class="card-handle" aria-label="Move task" role="button">⋮⋮</div>
      <div class="task-title"></div>
      <span class="badge"></span>
    </div>
    <div class="subtask-list"></div>`;

  card.querySelector(".task-title").textContent = m.title;
  
  // Only show badge if there are subtasks
  const badge = card.querySelector(".badge");
  if (m.subtasks.length > 0) {
    badge.textContent = m.subtasks.length;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  // Add completed class if task is completed
  if (taskCompleted) {
    card.classList.add('all-completed');
  }

  const list = card.querySelector(".subtask-list");
  for(const st of m.subtasks){
    const wrap = document.createElement("div");
    wrap.className = "swipe-wrap";
    wrap.dataset.id = st.id;
    wrap.dataset.mainId = m.id;
    wrap.innerHTML = `
      <div class="swipe-actions" aria-hidden="true">
        <div class="zone left">
          <button class="action complete" data-act="complete" title="Complete">✓</button>
        </div>
        <div class="zone right">
          <button class="action edit" data-act="edit" title="Edit">✏</button>
          <button class="action delete" data-act="delete" title="Delete">×</button>
        </div>
      </div>`;

    const row = document.createElement("div");
    row.className = "subtask";
    row.dataset.id = st.id;
    row.dataset.mainId = m.id;
    row.innerHTML = `
      <div class="sub-handle" aria-label="Drag to move" role="button">⋮⋮</div>
      <div class="sub-text ${st.done ? 'done' : ''}"></div>
    `;
    row.querySelector(".sub-text").textContent = st.text;
    wrap.appendChild(row);
    list.appendChild(wrap);
  }

  // Inline add-subtask form
  const addRow = document.createElement('form');
  addRow.className = 'add-subtask-form add-subtask-row';
  addRow.dataset.mainId = m.id;
  addRow.autocomplete = 'off';
  addRow.innerHTML = `
    <input class="add-sub-input" name="subtask" type="text" inputmode="text" placeholder="Add subtask…" aria-label="Add subtask to ${m.title}" maxlength="140" />
    <button class="add-sub-btn" type="submit" aria-label="Add subtask">＋</button>
  `;
  list.appendChild(addRow);
  return card;
}

export function setApp(appElement) {
  // This function can stay simple for now
}

import { startEditMode, startEditTaskTitle } from './editing.js';

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
  enableSwipe();
  bindAdders();
  bindMenu();
  bindKeyboardShortcuts(); // Add this line
}

function bindAdders(){
  // Main add bar
  const form = document.getElementById('addMainForm');
  if(form && !form._bound){
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const inp = document.getElementById('newTaskTitle');
      const title = (inp?.value || '').trim();
      if(!title) return;
      const task = { id: uid('m'), title, subtasks: [] };
      model.unshift(task);
      inp.value = '';
      renderAll().then(() => {
        bootBehaviors();
      });
      
      // Auto-focus the newly created task's subtask input for rapid entry
      setTimeout(() => {
        const newTaskCard = document.querySelector('.task-card[data-id="' + task.id + '"]');
        const subtaskInput = newTaskCard?.querySelector('.add-sub-input');
        subtaskInput?.focus();
      }, 100);
    });
    form._bound = true;
  }
  
  // Delegate for per-card subtask add with focus retention
  app?.addEventListener('submit', function(e){
    const f = e.target.closest('.add-subtask-form');
    if(!f) return;
    e.preventDefault();
    const mainId = f.dataset.mainId;
    const input = f.querySelector('input[name="subtask"]');
    const text = (input.value || '').trim();
    if(!text) return;
    const m = model.find(x=>x.id===mainId); if(!m) return;
    m.subtasks.push({ id: uid('s'), text, done:false });
    const oldValue = input.value; // Store for potential restoration
    input.value = '';
    renderAll().then(() => {
      bootBehaviors();
    });
    
    // Restore focus to the same input after re-render for rapid entry
    setTimeout(() => {
      const taskCard = document.querySelector('.task-card[data-id="' + mainId + '"]');
      const subtaskInput = taskCard?.querySelector('.add-sub-input');
      if (subtaskInput) {
        subtaskInput.focus();
        // Optionally restore partial input if user was typing
        // subtaskInput.value = oldValue.replace(text, '').trim();
      }
    }, 50);
  }, { once:false });
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
export function cleanup() {
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
}