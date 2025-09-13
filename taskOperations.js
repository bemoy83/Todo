// taskOperations.js - Centralized task manipulation
import { model, saveModel, uid } from './state.js';

// Helper to refresh UI after operations
const refreshUI = async () => {
  const { renderAll } = await import('./rendering.js');
  const { bootBehaviors } = await import('./core.js');
  renderAll();
  bootBehaviors();
};

export const TaskOperations = {
  // Task-level operations
  task: {
	async create(title) {
	  const task = { id: uid('m'), title: title.trim(), subtasks: [] };
	  model.unshift(task);
	  saveModel();
	  await refreshUI();
	  return task;
	},

	async delete(taskId) {
	  const index = model.findIndex(x => x.id === taskId);
	  if (index >= 0) {
		const task = model[index];
		if (confirm(`Delete "${task.title}" and all its subtasks?`)) {
		  model.splice(index, 1);
		  saveModel();
		  await refreshUI();
		  return true;
		}
	  }
	  return false;
	},

	async update(taskId, changes) {
	  const task = model.find(x => x.id === taskId);
	  if (task) {
		Object.assign(task, changes);
		saveModel();
		await refreshUI();
		return task;
	  }
	  return null;
	},

	async move(fromIndex, toIndex) {
	  if (fromIndex >= 0 && toIndex >= 0 && fromIndex < model.length) {
		const [task] = model.splice(fromIndex, 1);
		model.splice(toIndex, 0, task);
		saveModel();
		await refreshUI();
		return true;
	  }
	  return false;
	},

	async toggleCompletion(taskId) {
	  const task = model.find(x => x.id === taskId);
	  if (!task) return false;

	  if (task.subtasks.length > 0) {
		const allCompleted = task.subtasks.every(st => st.done);
		task.subtasks.forEach(st => st.done = !allCompleted);
	  } else {
		task.completed = !task.completed;
	  }
	  
	  saveModel();
	  await refreshUI();
	  return true;
	}
  },

  // Subtask operations
  subtask: {
	async create(taskId, text) {
	  const task = model.find(x => x.id === taskId);
	  if (!task) return null;

	  const subtask = { id: uid('s'), text: text.trim(), done: false };
	  task.subtasks.push(subtask);
	  saveModel();
	  await refreshUI();
	  return subtask;
	},

	async delete(taskId, subtaskId) {
	  const task = model.find(x => x.id === taskId);
	  if (!task) return false;

	  const index = task.subtasks.findIndex(s => s.id === subtaskId);
	  if (index >= 0) {
		task.subtasks.splice(index, 1);
		saveModel();
		await refreshUI();
		return true;
	  }
	  return false;
	},

	async update(taskId, subtaskId, changes) {
	  const task = model.find(x => x.id === taskId);
	  if (!task) return null;

	  const subtask = task.subtasks.find(s => s.id === subtaskId);
	  if (subtask) {
		Object.assign(subtask, changes);
		saveModel();
		await refreshUI();
		return subtask;
	  }
	  return null;
	},

	async toggle(taskId, subtaskId) {
	  const task = model.find(x => x.id === taskId);
	  if (!task) return false;

	  const subtask = task.subtasks.find(s => s.id === subtaskId);
	  if (subtask) {
		subtask.done = !subtask.done;
		saveModel();
		await refreshUI();
		return true;
	  }
	  return false;
	},

	async move(fromTaskId, subtaskId, toTaskId, toIndex) {
	  const fromTask = model.find(x => x.id === fromTaskId);
	  const toTask = model.find(x => x.id === toTaskId);
	  
	  if (!fromTask || !toTask) return false;

	  const subtaskIndex = fromTask.subtasks.findIndex(s => s.id === subtaskId);
	  if (subtaskIndex < 0) return false;

	  const [subtask] = fromTask.subtasks.splice(subtaskIndex, 1);
	  toTask.subtasks.splice(toIndex, 0, subtask);
	  
	  saveModel();
	  await refreshUI();
	  return true;
	}
  },

  // Bulk operations
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

	async markAllComplete() {
	  model.forEach(task => {
		if (task.subtasks.length > 0) {
		  task.subtasks.forEach(st => st.done = true);
		} else {
		  task.completed = true;
		}
	  });
	  saveModel();
	  await refreshUI();
	},

	export() {
	  return JSON.stringify(model, null, 2);
	},

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
  // Wait for DOM to update
  setTimeout(() => {
	const taskCard = document.querySelector(`.task-card[data-id="${taskId}"]`);
	const subtaskInput = taskCard?.querySelector('.add-sub-input');
	subtaskInput?.focus();
  }, 100);
}