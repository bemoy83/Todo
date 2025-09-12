// core.js – ES Module (clean, no window bridges)
// Exports: setDomRefs, renderAll, bootBehaviors, uid, clamp, model, saveModel
// Imports binder functions so bootBehaviors wires everything without globals.

import { bindCrossSortContainer } from './drag.js';
import { enableSwipe } from './swipe.js';
import { bindMenu } from './menu.js';

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

// ===== Model & persistence =====
const DEFAULT_MODEL = [];
export function uid(prefix='id'){ return `${prefix}-${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-2)}`; }

// Helper function to sync task completion with subtasks
export function syncTaskCompletion(task) {
  if (task.subtasks.length === 0) {
    // No subtasks - keep task.completed as is
    return;
  }
  
  // Has subtasks - derive completion from subtask state
  const allSubtasksDone = task.subtasks.every(st => st.done);
  task.completed = allSubtasksDone;
}

// Helper function to get current completion state
export function isTaskCompleted(task) {
  return task.completed || false;
}

// ===== Targeted DOM Update Functions =====

// Update task completion state without full re-render
export function updateTaskCompletion(taskId) {
  const task = model.find(x => x.id === taskId);
  if (!task) return;
  
  const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
  if (!card) return;
  
  const taskCompleted = task.completed || (task.subtasks.length > 0 && task.subtasks.every(st => st.done));
  
  // Update visual state
  if (taskCompleted) {
    card.classList.add('all-completed');
  } else {
    card.classList.remove('all-completed');
  }
  
  // Update complete button state
  const completeBtn = card.querySelector('.action.complete[data-act="complete-all"]');
  if (completeBtn) {
    completeBtn.title = taskCompleted ? 'Mark incomplete' : 'Complete task';
  }
  
  saveModel();
}

// Update subtask completion state
export function updateSubtaskCompletion(taskId, subtaskId) {
  const task = model.find(x => x.id === taskId);
  if (!task) return;
  
  const subtask = task.subtasks.find(s => s.id === subtaskId);
  if (!subtask) return;
  
  // Update subtask visual state
  const subtaskEl = document.querySelector(`.subtask[data-id="${subtaskId}"][data-main-id="${taskId}"]`);
  if (subtaskEl) {
    const textEl = subtaskEl.querySelector('.sub-text');
    if (textEl) {
      if (subtask.done) {
        textEl.classList.add('done');
      } else {
        textEl.classList.remove('done');
      }
    }
  }
  
  // Update parent task completion state
  syncTaskCompletion(task);
  updateTaskCompletion(taskId);
}

// Add new subtask to DOM without full re-render
export function addSubtaskToDOM(taskId, subtask) {
  const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
  if (!card) return;
  
  const list = card.querySelector('.subtask-list');
  const addForm = list?.querySelector('.add-subtask-form');
  if (!list || !addForm) return;
  
  // Create new subtask element
  const wrap = document.createElement("div");
  wrap.className = "swipe-wrap";
  wrap.dataset.id = subtask.id;
  wrap.dataset.mainId = taskId;
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
  row.dataset.id = subtask.id;
  row.dataset.mainId = taskId;
  row.innerHTML = `
    <div class="sub-handle" aria-label="Drag to move" role="button">⋮⋮</div>
    <div class="sub-text ${subtask.done ? 'done' : ''}"></div>
  `;
  $(".sub-text", row).textContent = subtask.text;
  wrap.appendChild(row);
  
  // Insert before the add form
  list.insertBefore(wrap, addForm);
  
  // Update badge count
  updateTaskBadge(taskId);
  
  // Re-enable swipe for the new element
  if (FLAGS.swipeGestures) {
    import('./swipe.js').then(({ attachSubtaskSwipe }) => {
      attachSubtaskSwipe?.(wrap);
    }).catch(() => {
      enableSwipe();
    });
  }
}

// Remove subtask from DOM
export function removeSubtaskFromDOM(taskId, subtaskId) {
  const wrap = document.querySelector(`.swipe-wrap[data-id="${subtaskId}"][data-main-id="${taskId}"]`);
  if (wrap) {
    wrap.remove();
    updateTaskBadge(taskId);
  }
}

// Update task badge count
export function updateTaskBadge(taskId) {
  const task = model.find(x => x.id === taskId);
  if (!task) return;
  
  const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
  if (!card) return;
  
  const badge = card.querySelector('.badge');
  if (badge) {
    if (task.subtasks.length > 0) {
      badge.textContent = task.subtasks.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Add new task to DOM
export function addTaskToDOM(task) {
  if (!app) return;
  
  // Remove empty state if it exists
  const empty = app.querySelector('.empty');
  if (empty) {
    empty.remove();
  }
  
  // Create and prepend new task card
  const card = renderCard(task);
  app.insertBefore(card, app.firstChild);
  
  // Re-enable behaviors for the new card
  if (FLAGS.swipeGestures) {
    import('./swipe.js').then(({ attachTaskSwipe, attachSubtaskSwipe }) => {
      attachTaskSwipe?.(card);
      const subtaskWraps = card.querySelectorAll('.swipe-wrap');
      subtaskWraps.forEach(wrap => attachSubtaskSwipe?.(wrap));
    }).catch(() => {
      enableSwipe();
    });
  }
}

// Remove task from DOM
export function removeTaskFromDOM(taskId) {
  const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
  if (card) {
    card.remove();
    
    // Show empty state if no tasks remain
    if (model.length === 0 && app) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = '<div>🎉 All done!</div><div>Add your first task below.</div>';
      app.appendChild(empty);
    }
  }
}

// Update task title in DOM
export function updateTaskTitle(taskId, newTitle) {
  const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
  if (!card) return;
  
  const titleEl = card.querySelector('.task-title');
  if (titleEl) {
    titleEl.textContent = newTitle;
  }
  
  // Update aria-label for add subtask input
  const addInput = card.querySelector('.add-sub-input');
  if (addInput) {
    addInput.setAttribute('aria-label', `Add subtask to ${newTitle}`);
  }
}

// Update subtask text in DOM
export function updateSubtaskText(taskId, subtaskId, newText) {
  const subtaskEl = document.querySelector(`.subtask[data-id="${subtaskId}"][data-main-id="${taskId}"]`);
  if (!subtaskEl) return;
  
  const textEl = subtaskEl.querySelector('.sub-text');
  if (textEl) {
    textEl.textContent = newText;
  }
}

export function loadModel(){
  try{
    const raw = localStorage.getItem('todo:model');
    if(raw){
      const data = JSON.parse(raw);
      // One-time cleanup of old demo dataset
      const looksLikeDemo = Array.isArray(data) && data.some(t => t && typeof t.title === 'string' && (
        t.title === 'Ship mobilapp v1.2' || t.title === 'Skriv lanseringsblogg' || t.title === 'Planlegg sprint'
      ));
      if(looksLikeDemo){ try{ localStorage.removeItem('todo:model'); }catch{}; return []; }
      return data;
    }
  }catch{}
  return structuredClone(DEFAULT_MODEL);
}
export let model = loadModel();
export function saveModel(){ try{ localStorage.setItem('todo:model', JSON.stringify(model)); }catch{} }

// ===== Edit functionality =====
export function startEditMode(subtaskElement) {
  console.log('Starting edit mode for subtask');
  
  const wrap = subtaskElement.closest('.swipe-wrap');
  const textEl = subtaskElement.querySelector('.sub-text');
  if (!textEl || !wrap) {
    console.log('Missing required elements');
    return;
  }
  
  // Get IDs from data attributes
  const mainId = wrap.dataset.mainId;
  const subId = wrap.dataset.id;
  
  console.log('Edit - mainId:', mainId, 'subId:', subId);
  
  // Find the task and subtask in the model
  const task = model.find(x => x.id === mainId);
  if (!task) {
    console.log('Task not found in model');
    return;
  }
  
  const subtask = task.subtasks.find(s => s.id === subId);
  if (!subtask) {
    console.log('Subtask not found in model');
    return;
  }
  
  const originalText = subtask.text || 'Untitled';
  console.log('Original text:', originalText);
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.className = 'subtask-edit-input';
  input.style.cssText = `
    width: 100%;
    border: 2px solid #3b82f6;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: inherit;
    font-family: inherit;
    background: white;
    outline: none;
    margin: 0;
    box-sizing: border-box;
    -webkit-user-select: text;
    user-select: text;
  `;
  
  // Replace text element with input
  textEl.style.display = 'none';
  textEl.parentNode.insertBefore(input, textEl);
  
  // Focus and select all text
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
  
  // Save function
  const saveEdit = () => {
    const newText = input.value.trim();
    console.log('Saving edit - new text:', newText);
    
    if (newText && newText !== originalText) {
      subtask.text = newText;
      saveModel();
      // Use targeted update instead of full re-render
      updateSubtaskText(mainId, subId, newText);
      textEl.style.display = '';
      input.remove();
    } else {
      console.log('No changes, restoring original');
      // Just restore the original display
      textEl.style.display = '';
      input.remove();
    }
  };
  
  // Cancel function
  const cancelEdit = () => {
    console.log('Canceling edit');
    textEl.style.display = '';
    input.remove();
  };
  
  // Event listeners
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
  
  input.addEventListener('blur', saveEdit);
}

export function startEditTaskTitle(taskElement) {
  console.log('Starting edit mode for task title');
  
  const card = taskElement.closest('.task-card');
  const titleEl = card.querySelector('.task-title');
  if (!titleEl || !card) {
    console.log('Missing required elements for task edit');
    return;
  }
  
  // Get task ID from data attribute
  const taskId = card.dataset.id;
  
  console.log('Edit task - taskId:', taskId);
  
  // Find the task in the model
  const task = model.find(x => x.id === taskId);
  if (!task) {
    console.log('Task not found in model');
    return;
  }
  
  const originalTitle = task.title || 'Untitled';
  console.log('Original title:', originalTitle);
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalTitle;
  input.className = 'task-title-edit-input';
  input.style.cssText = `
    width: 100%;
    border: 2px solid #3b82f6;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: inherit;
    font-family: inherit;
    font-weight: 800;
    background: white;
    outline: none;
    margin: 0;
    box-sizing: border-box;
    -webkit-user-select: text;
    user-select: text;
  `;
  
  // Replace title element with input
  titleEl.style.display = 'none';
  titleEl.parentNode.insertBefore(input, titleEl);
  
  // Focus and select all text
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
  
  // Save function
const saveEdit = () => {
    const newTitle = input.value.trim();
    
    if (newTitle && newTitle !== originalTitle) {
      task.title = newTitle;
      saveModel();
      // Use targeted update instead of full re-render
      updateTaskTitle(taskId, newTitle);
      titleEl.style.display = '';
      input.remove();
    } else {
      // Just restore the original display
      titleEl.style.display = '';
      input.remove();
    }
  };
  
  // Cancel function
  const cancelEdit = () => {
    titleEl.style.display = '';
    input.remove();
  };
  
  // Event listeners
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
  
  input.addEventListener('blur', saveEdit);
}

// ===== Rendering =====
export function renderAll(){
  const layer = app ? $("#dragLayer", app) : null;
  if(app) app.innerHTML = "";
  if(!app) return;
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
}

function renderCard(m){
  const card = document.createElement("article");
  card.className = "task-card card-swipe-wrap";  // Add card-swipe-wrap class to existing task-card
  card.dataset.id = m.id;
  
  // Determine if task is completed (either has completed property OR all subtasks are done)
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

  $(".task-title", card).textContent = m.title;
  
  // Only show badge if there are subtasks
  const badge = $(".badge", card);
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

  const list = $(".subtask-list", card);
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
    $(".sub-text", row).textContent = st.text;
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

// ===== Behavior wiring =====
let crossBound = false;
export function bootBehaviors(){
  if(!crossBound){ bindCrossSortContainer(); crossBound = true; }
  enableSwipe();
  bindAdders();
  bindMenu();
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
    
    // Use targeted DOM update instead of full re-render
    addTaskToDOM(task);
    saveModel();
    
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
    
    const newSubtask = { id: uid('s'), text, done:false };
    m.subtasks.push(newSubtask);
    input.value = '';
    
    // Use targeted DOM update instead of full re-render
    addSubtaskToDOM(mainId, newSubtask);
    saveModel();
    
    // Restore focus to the same input after adding for rapid entry
    setTimeout(() => {
      const taskCard = document.querySelector('.task-card[data-id="' + mainId + '"]');
      const subtaskInput = taskCard?.querySelector('.add-sub-input');
      if (subtaskInput) {
        subtaskInput.focus();
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
}