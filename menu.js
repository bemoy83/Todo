// menu.js – Simplified with CSS moved to stylesheet
import { model, uid, saveModel } from './state.js';
import { renderAll } from './rendering.js';
import { TaskOperations } from './taskOperations.js';

let menuBound = false;

export function bindMenu() {
  if (menuBound) return;
  ensureMenuStructure();
  bindMainMenu();
  menuBound = true;
  // No more CSS injection - it's all in styles.css now!
}

function bindMainMenu() {
  const btn  = document.getElementById('menuBtn');
  const menu = document.getElementById('appMenu');
  const file = document.getElementById('importFile');
  if (!btn || !menu) return;

  function openMenu(){ 
    menu.classList.add('open'); 
    btn.setAttribute('aria-expanded','true'); 
    menu.setAttribute('aria-hidden','false'); 
  }
  
  function closeMenu(){ 
    menu.classList.remove('open'); 
    btn.setAttribute('aria-expanded','false'); 
    menu.setAttribute('aria-hidden','true'); 
  }
  
  function toggleMenu(){ 
    menu.classList.contains('open') ? closeMenu() : openMenu(); 
  }

  btn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    toggleMenu(); 
  });
  
  document.addEventListener('pointerdown', (e) => { 
    if(!menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); 
  });

  menu.addEventListener('click', (e) => {
    const el = e.target.closest('[data-menu]'); 
    if(!el) return;
    const act = el.dataset.menu;
    if (act === 'clear') return clearAllData();
    if (act === 'export') return exportBackup();
    if (act === 'import') return file?.click();
  });

  // Import handler using TaskOperations
  file?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; 
    if(!f) return;
    
    try{
      const text = await f.text();
      const success = await TaskOperations.bulk.import(text);
      
      if (!success) {
        alert('Import failed: Invalid backup file format');
      } else {
        closeMenu();
        console.log('Import successful');
      }
    } catch(err){
      alert('Import failed: ' + (err?.message || err));
      console.error('Import error:', err);
    } finally {
      e.target.value = '';
    }
  });

  // Clear all data using consistent approach
  async function clearAllData(){
    if (!confirm('Delete all tasks? This cannot be undone.')) return;
    
    try { 
      localStorage.removeItem('todo:model'); 
    } catch {}
    
    // Clear model and use TaskOperations approach for consistency
    model.length = 0;
    saveModel();
    renderAll();
    
    // Re-bind behaviors after clearing
    import('./core.js').then(({ bootBehaviors }) => {
      bootBehaviors();
    });
    
    closeMenu();
    console.log('All data cleared');
  }

  // Export using TaskOperations
  function exportBackup() {
    try {
      const dataStr = TaskOperations.bulk.export();
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      closeMenu();
      console.log('Export successful');
    } catch (err) {
      alert('Export failed: ' + (err?.message || err));
      console.error('Export error:', err);
    }
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

// CSS injection functions REMOVED - styles are now in styles.css
// injectTopbarStyles() - DELETED
// injectMenuStyles() - DELETED