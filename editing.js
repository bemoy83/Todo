// editing.js - Edit functionality for tasks and subtasks
import { model, saveModel } from './state.js';

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
	  console.log('Saved and re-rendering');
	  // Import these when needed to avoid circular dependency
	  import('./rendering.js').then(({ renderAll }) => {
		renderAll().then(() => {
		  import('./core.js').then(({ bootBehaviors }) => {
			bootBehaviors();
		  });
		});
	  });
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
	  // Import these when needed to avoid circular dependency
	  import('./rendering.js').then(({ renderAll }) => {
		renderAll().then(() => {
		  import('./core.js').then(({ bootBehaviors }) => {
			bootBehaviors();
		  });
		});
	  });
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