// taskOperations.js - Simplified with less repetition
import { model, saveModel, uid } from './state.js';

// Single refresh function to avoid repetition
const refreshUI = async () => {
  const [{ renderAll }, { bootBehaviors }] = await Promise.all([
    import('./rendering.js'),
    import('./core.js')
  ]);
  renderAll();
  bootBehaviors();
};

// Base operation class to reduce repetition
class BaseOperation {
  constructor(name) {
    this.name = name;
  }
  
  async execute(operation) {
    try {
      const result = await operation();
      saveModel();
      await refreshUI();
      return result;
    } catch (error) {
      console.error(`${this.name} failed:`, error);
      throw error;
    }
  }
  
  findTask(taskId) {
    const task = model.find(x => x.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    return task;
  }
  
  findSubtask(taskId, subtaskId) {
    const task = this.findTask(taskId);
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask) throw new Error(`Subtask ${subtaskId} not found`);
    return { task, subtask };
  }
}

// Task operations using base class
class TaskOperationsClass extends BaseOperation {
  constructor() {
    super('TaskOperation');
  }

  async create(title) {
    return this.execute(() => {
      const task = { id: uid('m'), title: title.trim(), subtasks: [] };
      model.unshift(task);
      return task;
    });
  }

  async delete(taskId) {
    return this.execute(() => {
      const task = this.findTask(taskId);
      if (!confirm(`Delete "${task.title}" and all its subtasks?`)) {
        return false;
      }
      const index = model.indexOf(task);
      model.splice(index, 1);
      return true;
    });
  }

  async update(taskId, changes) {
    return this.execute(() => {
      const task = this.findTask(taskId);
      Object.assign(task, changes);
      return task;
    });
  }

  async move(fromIndex, toIndex) {
    return this.execute(() => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= model.length) {
        throw new Error('Invalid move indices');
      }
      const [task] = model.splice(fromIndex, 1);
      model.splice(toIndex, 0, task);
      return true;
    });
  }

  async toggleCompletion(taskId) {
    return this.execute(() => {
      const task = this.findTask(taskId);
      
      if (task.subtasks.length > 0) {
        const allCompleted = task.subtasks.every(st => st.done);
        task.subtasks.forEach(st => st.done = !allCompleted);
      } else {
        task.completed = !task.completed;
      }
      
      return true;
    });
  }
}

// Subtask operations
class SubtaskOperationsClass extends BaseOperation {
  constructor() {
    super('SubtaskOperation');
  }

  async create(taskId, text) {
    return this.execute(() => {
      const task = this.findTask(taskId);
      const subtask = { id: uid('s'), text: text.trim(), done: false };
      task.subtasks.push(subtask);
      return subtask;
    });
  }

  async delete(taskId, subtaskId) {
    return this.execute(() => {
      const { task, subtask } = this.findSubtask(taskId, subtaskId);
      const index = task.subtasks.indexOf(subtask);
      task.subtasks.splice(index, 1);
      return true;
    });
  }

  async update(taskId, subtaskId, changes) {
    return this.execute(() => {
      const { subtask } = this.findSubtask(taskId, subtaskId);
      Object.assign(subtask, changes);
      return subtask;
    });
  }

  async toggle(taskId, subtaskId) {
    return this.execute(() => {
      const { subtask } = this.findSubtask(taskId, subtaskId);
      subtask.done = !subtask.done;
      return true;
    });
  }

  async move(fromTaskId, subtaskId, toTaskId, toIndex) {
    return this.execute(() => {
      const fromTask = this.findTask(fromTaskId);
      const toTask = this.findTask(toTaskId);
      
      const subtaskIndex = fromTask.subtasks.findIndex(s => s.id === subtaskId);
      if (subtaskIndex < 0) throw new Error(`Subtask ${subtaskId} not found`);

      const [subtask] = fromTask.subtasks.splice(subtaskIndex, 1);
      toTask.subtasks.splice(toIndex, 0, subtask);
      return true;
    });
  }
}

// Export the operations
export const TaskOperations = {
  task: new TaskOperationsClass(),
  subtask: new SubtaskOperationsClass(),
  
  // Bulk operations (simplified)
  bulk: {
    async clearCompleted() {
      let changed = false;
      model.forEach(task => {
        const originalLength = task.subtasks.length;
        task.subtasks = task.subtasks.filter(st => !st.done);
        if (task.subtasks.length !== originalLength) changed = true;
      });

      if (changed) {
        saveModel();
        await refreshUI();
      }
      return changed;
    },

    export: () => JSON.stringify(model, null, 2),

    async import(data) {
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) throw new Error('Invalid format');
        
        const normalized = parsed.map(x => ({
          id: x.id || uid('m'),
          title: String(x.title || 'Untitled'),
          subtasks: Array.isArray(x.subtasks)
            ? x.subtasks.map(s => ({ 
                id: s.id || uid('s'), 
                text: String(s.text || ''), 
                done: !!s.done 
              }))
            : []
        }));

        model.splice(0, model.length, ...normalized);
        saveModel();
        await refreshUI();
        return true;
      } catch (error) {
        console.error('Import failed:', error);
        return false;
      }
    }
  }
};

// Helper function for auto-focusing subtask input after task creation
export async function focusSubtaskInput(taskId) {
  setTimeout(() => {
    const taskCard = document.querySelector(`.task-card[data-id="${taskId}"]`);
    const subtaskInput = taskCard?.querySelector('.add-sub-input');
    subtaskInput?.focus();
  }, 100);
}