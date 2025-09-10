// menu.js — clean ESM: menu interactions + more dropdown
import { model, uid, renderAll, bootBehaviors, saveModel } from './core.js';

let menuBound = false;
let currentMoreDropdown = null;

export function bindMenu() {
  if (menuBound) return;
  ensureMenuStructure();
  injectTopbarStyles();
  injectMenuStyles();
  bindMainMenu();
  bindMoreDropdowns();
  menuBound = true;
}

function bindMainMenu() {
  const btn  = document.getElementById('menuBtn');
  const menu = document.getElementById('appMenu');
  const file = document.getElementById('importFile');
  if (!btn || !menu) return;

  function openMenu(){ menu.classList.add('open'); btn.setAttribute('aria-expanded','true'); menu.setAttribute('aria-hidden','false'); }
  function closeMenu(){ menu.classList.remove('open'); btn.setAttribute('aria-expanded','false'); menu.setAttribute('aria-hidden','true'); }
  function toggleMenu(){ menu.classList.contains('open') ? closeMenu() : openMenu(); }

  btn.addEventListener('click', (e)=>{ e.preventDefault(); toggleMenu(); });
  document.addEventListener('pointerdown', (e)=>{ 
    if(!menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); 
    // Also close more dropdown when clicking outside
    if(currentMoreDropdown && !currentMoreDropdown.contains(e.target)) {
      closeMoreDropdown();
    }
  });

  menu.addEventListener('click', (e)=>{
    const el = e.target.closest('[data-menu]'); if(!el) return;
    const act = el.dataset.menu;
    if (act === 'clear') return clearAllData();
    if (act === 'export') return exportBackup();
    if (act === 'import') return file?.click();
  });

  file?.addEventListener('change', async (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    try{
      const text = await f.text();
      const data = JSON.parse(text);
      if(!Array.isArray(data)) throw new Error('Invalid backup file');
      const normalized = data.map(x=>({
        id: x.id || uid('m'),
        title: String(x.title || 'Untitled'),
        subtasks: Array.isArray(x.subtasks)
          ? x.subtasks.map(s=>({ id:s.id||uid('s'), text:String(s.text||''), done:!!s.done }))
          : []
      }));
      model.splice(0, model.length, ...normalized);
      saveModel();
      renderAll(); bootBehaviors();
    } catch(err){
      alert('Import failed: ' + (err?.message || err));
    } finally {
      e.target.value = '';
    }
  });

  function clearAllData(){
    if (!confirm('Delete all tasks? This cannot be undone.')) return;
    try { localStorage.removeItem('todo:model'); } catch {}
    model.length = 0;
    saveModel();
    renderAll(); bootBehaviors();
    closeMenu();
  }
}

function bindMoreDropdowns() {
  // Delegate for all "more" button clicks
  document.addEventListener('click', (e) => {
    const moreButton = e.target.closest('.action.more');
    if (!moreButton) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const wrap = moreButton.closest('.swipe-wrap');
    if (!wrap) return;
    
    showMoreDropdown(wrap, moreButton);
  });
}

export function showMoreDropdown(wrap, moreButton) {
  closeMoreDropdown(); // Close any existing dropdown
  
  const dropdown = document.createElement('div');
  dropdown.className = 'more-dropdown show';
  dropdown.innerHTML = `
    <div class="more-item" data-action="edit">
      <span class="more-icon">✏️</span>
      <span class="more-label">Edit</span>
    </div>
  `;
  
  // Position relative to the more button
  const buttonRect = moreButton.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  
  dropdown.style.position = 'absolute';
  dropdown.style.top = '50%';
  dropdown.style.right = '60px'; // Just left of the more button
  dropdown.style.transform = 'translateY(-50%)';
  dropdown.style.zIndex = '1000';
  
  wrap.appendChild(dropdown);
  currentMoreDropdown = dropdown;
  
  // Handle dropdown clicks
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.more-item');
    if (!item) return;
    
    const action = item.dataset.action;
    if (action === 'edit') {
      startEditMode(wrap);
    }
    
    closeMoreDropdown();
  });
}

export function closeMoreDropdown() {
  if (currentMoreDropdown) {
    currentMoreDropdown.remove();
    currentMoreDropdown = null;
  }
}

function startEditMode(wrap) {
  const row = wrap.querySelector('.subtask');
  const textEl = row.querySelector('.sub-text');
  if (!textEl) return;
  
  // Get current subtask data
  const mainId = wrap.dataset.mainId;
  const subId = wrap.dataset.id;
  const task = model.find(x => x.id === mainId);
  if (!task) return;
  
  const subtask = task.subtasks.find(s => s.id === subId);
  if (!subtask) return;
  
  const originalText = subtask.text || 'Untitled';
  
  // Create inline editor
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.className = 'subtask-edit-input';
  input.style.cssText = `
    width: 100%;
    border: 2px solid #3b82f6;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: inherit;
    font-family: inherit;
    background: white;
    outline: none;
    margin: 0;
  `;
  
  // Replace text with input
  const parent = textEl.parentNode;
  parent.insertBefore(input, textEl);
  textEl.style.display = 'none';
  
  // Focus and select
  input.focus();
  input.select();
  
  // Save on enter or blur
  const saveEdit = () => {
    const newText = input.value.trim();
    if (newText && newText !== originalText) {
      subtask.text = newText;
      saveModel();
      renderAll();
      bootBehaviors();
    } else {
      // Restore original display if no changes
      textEl.style.display = '';
      input.remove();
    }
  };
  
  const cancelEdit = () => {
    textEl.style.display = '';
    input.remove();
  };
  
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

function ensureMenuStructure(){
  if(!document.getElementById('menuBtn')){
    const header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML = `
      <button id="menuBtn" class="menu-btn" aria-label="Open menu" aria-haspopup="menu"
              aria-expanded="false" aria-controls="appMenu">☰</button>
      <div class="topbar-title">Tasks</div>`;
    document.body.insertBefore(header, document.body.firstChild);
  }
  if(!document.getElementById('appMenu')){
    const nav = document.createElement('nav');
    nav.id = 'appMenu';
    nav.className = 'menu';
    nav.setAttribute('role', 'menu');
    nav.setAttribute('aria-hidden', 'true');
    nav.innerHTML = `
      <button class="menu-item" data-menu="export" role="menuitem">Export backup</button>
      <button class="menu-item" data-menu="import" role="menuitem">Import backup…</button>
      <button class="menu-item danger" data-menu="clear" role="menuitem">Clear all data</button>`;
    document.body.appendChild(nav);
  }
  if(!document.getElementById('importFile')){
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'importFile';
    input.accept = 'application/json';
    input.hidden = true;
    document.body.appendChild(input);
  }
}

function injectTopbarStyles(){
  if(document.getElementById('topbarStylePatch')) return;
  const css = `
    :root{ --topbar-h:56px; }
    .topbar{
      position:sticky; top:0; z-index:1100; display:flex; align-items:center; gap:12px;
      height:var(--topbar-h);
      padding: max(8px, env(safe-area-inset-top)) 12px 8px;
      background: rgba(255,255,255,.92);
      backdrop-filter:saturate(180%) blur(10px);
      border-bottom:1px solid var(--border);
    }
    .menu-btn{
      appearance:none; border:0px solid var(--border); background:#fff; border-radius:12px;
      min-width:44px; min-height:44px; display:flex; align-items:center; justify-content:center;
      font-size:20px; font-weight:800; box-shadow:0 0px 0px rgba(0,0,0,.08);
    }
    .menu-btn:active{ transform: translateY(1px); }
    .topbar-title{ font-weight:800; font-size:18px; }
    .app{ padding-top: calc(var(--topbar-h) + 24px) !important; }
  `;
  const style = document.createElement('style');
  style.id = 'topbarStylePatch';
  style.textContent = css;
  document.head.appendChild(style);
}

function injectMenuStyles(){
  if(document.getElementById('menuStylePatch')) return;
  const css = `
    .menu{
      position:fixed; 
      top: calc(env(safe-area-inset-top) + 12px + var(--topbar-h)); 
      left: 50%; 
      transform: translateX(-50%) translateY(-6px) scale(.98);
      background:#fff; border:1px solid var(--border); border-radius:14px; padding:0;
      box-shadow: 0 10px 24px rgba(0,0,0,.14);
      width:min(260px, calc(100% - 24px));
      opacity:0; pointer-events:none;
      transition: opacity 120ms ease, transform 120ms ease;
    }
    .menu.open{ 
      opacity:1; 
      transform: translateX(-50%) translateY(0) scale(1); 
      pointer-events:auto; 
    }
    .menu-item{
      display:flex; width:100%; align-items:center; gap:10px; padding:12px 14px; border:none;
      background:transparent; border-radius:0; font-weight:700; font-size:16px; color:var(--text);
      position: relative;
    }
    .menu-item:not(:last-child)::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background-color: var(--border, #e5e7eb);
    }
    .menu-item:first-child {
      border-top-left-radius: 14px;
      border-top-right-radius: 14px;
    }
    .menu-item:last-child {
      border-bottom-left-radius: 14px;
      border-bottom-right-radius: 14px;
    }
    .menu-item:hover{ background:#f8f9fa; }
    .menu-item.danger{ color:var(--red); }
    
    /* More dropdown styles */
    .more-dropdown {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #e5e7eb;
      opacity: 0;
      transform: translateY(-50%) scale(0.95);
      transition: opacity 150ms ease, transform 150ms ease;
      pointer-events: none;
    }
    
    .more-dropdown.show {
      opacity: 1;
      transform: translateY(-50%) scale(1);
      pointer-events: auto;
    }
    
    .more-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background-color 150ms ease;
      white-space: nowrap;
      min-width: 120px;
    }
    
    .more-item:hover {
      background-color: #f3f4f6;
    }
    
    .more-item:first-child {
      border-radius: 8px 8px 0 0;
    }
    
    .more-item:last-child {
      border-radius: 0 0 8px 8px;
    }
    
    .more-item:only-child {
      border-radius: 8px;
    }
    
    .more-icon {
      font-size: 16px;
      width: 20px;
      text-align: center;
    }
    
    .more-label {
      font-size: 14px;
      color: #374151;
      font-weight: 500;
    }
  `;
  const style = document.createElement('style');
  style.id = 'menuStylePatch';
  style.textContent = css;
  document.head.appendChild(style);
}