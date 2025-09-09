// menu.js — clean ESM: menu interactions + styling
import { model, uid, renderAll, bootBehaviors, saveModel } from './core.js';

let menuBound = false;

export function bindMenu() {
  if (menuBound) return;
  ensureMenuStructure();
  injectTopbarStyles();
  injectMenuStyles();

  const btn  = document.getElementById('menuBtn');
  const menu = document.getElementById('appMenu');
  const file = document.getElementById('importFile');
  if (!btn || !menu) return;

  menuBound = true;

  function openMenu(){ menu.classList.add('open'); btn.setAttribute('aria-expanded','true'); menu.setAttribute('aria-hidden','false'); }
  function closeMenu(){ menu.classList.remove('open'); btn.setAttribute('aria-expanded','false'); menu.setAttribute('aria-hidden','true'); }
  function toggleMenu(){ menu.classList.contains('open') ? closeMenu() : openMenu(); }

  btn.addEventListener('click', (e)=>{ e.preventDefault(); toggleMenu(); });
  document.addEventListener('pointerdown', (e)=>{ if(!menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); });

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
          ? x.subtasks.map(s=>({ id:s.id||uid('s'), text:String(s.text||''), done:!!s.done, flagged:!!s.flagged }))
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
      appearance:none; border:1px solid var(--border); background:#fff; border-radius:12px;
      min-width:44px; min-height:44px; display:flex; align-items:center; justify-content:center;
      font-size:20px; font-weight:800; box-shadow:0 4px 10px rgba(0,0,0,.08);
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
      position:fixed; top: calc(env(safe-area-inset-top) + 12px + var(--topbar-h)); right:12px;
      background:#fff; border:1px solid var(--border); border-radius:14px; padding:8px;
      box-shadow: 0 10px 24px rgba(0,0,0,.14);
      width:min(260px, calc(100% - 24px));
      opacity:0; transform: translateY(-6px) scale(.98); pointer-events:none;
      transition: opacity 120ms ease, transform 120ms ease;
    }
    .menu.open{ opacity:1; transform: translateY(0) scale(1); pointer-events:auto; }
    .menu-item{
      display:flex; width:100%; align-items:center; gap:10px; padding:12px 14px; border:none;
      background:transparent; border-radius:10px; font-weight:700; font-size:16px; color:var(--text);
    }
    .menu-item:hover{ background:#f8f9fa; }
    .menu-item.danger{ color:var(--red); }
  `;
  const style = document.createElement('style');
  style.id = 'menuStylePatch';
  style.textContent = css;
  document.head.appendChild(style);
}
