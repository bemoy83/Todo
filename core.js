// core.js — ES Module (clean, no window bridges)
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
  card.className = "task-card";
  card.dataset.id = m.id;
  card.innerHTML = `
    <div class="card-row">
      <div class="card-handle" aria-label="Move task" role="button">⋮⋮</div>
      <div class="task-title"></div>
      <span class="badge"></span>
    </div>
    <div class="subtask-list"></div>`;

  $(".task-title", card).textContent = m.title;
  $(".badge", card).textContent = m.subtasks.length;

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
          <button class="action flag" data-act="flag" title="Flag">⚑</button>
          <button class="action delete" data-act="delete" title="Delete">x</button>
        </div>
      </div>`;

    const row = document.createElement("div");
    row.className = "subtask";
    row.dataset.id = st.id;
    row.dataset.mainId = m.id;
    row.innerHTML = `
      <div class="sub-handle" aria-label="Drag to move" role="button">⋮⋮</div>
      <div class="sub-text ${st.done ? 'done' : ''}"></div>
      ${st.flagged ? '<div class="flag-dot" aria-hidden="true"></div>' : ''}
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
      renderAll(); bootBehaviors();
    });
    form._bound = true;
  }
  // Delegate for per-card subtask add
  app?.addEventListener('submit', function(e){
    const f = e.target.closest('.add-subtask-form');
    if(!f) return;
    e.preventDefault();
    const mainId = f.dataset.mainId;
    const input = f.querySelector('input[name="subtask"]');
    const text = (input.value || '').trim();
    if(!text) return;
    const m = model.find(x=>x.id===mainId); if(!m) return;
    m.subtasks.push({ id: uid('s'), text, done:false, flagged:false });
    input.value = '';
    renderAll(); bootBehaviors();
  }, { once:false });
}

// ===== Shared util for swipe/drag =====
export function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }

// Expose start helper so main.js can assign DOM refs
export function setDomRefs(){
  app = document.getElementById('app');
  dragLayer = document.getElementById('dragLayer');
}
