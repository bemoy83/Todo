// state.js - Model and state management
import { debounce } from './utils.js';

const DEFAULT_MODEL = [];

export function uid(prefix='id'){ 
  return `${prefix}-${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-2)}`; 
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

export const debouncedSave = debounce(() => {
  try { 
    localStorage.setItem('todo:model', JSON.stringify(model)); 
  } catch(e) {
    console.error('Failed to save model:', e);
  }
}, 300);

export function saveModel(){ 
  debouncedSave();
}

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

// Optimistic updates for better perceived performance
export function optimisticUpdate(taskId, changes) {
  const task = model.find(x => x.id === taskId);
  if (task) {
    Object.assign(task, changes);
    return task;
  }
}