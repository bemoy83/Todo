// rendering.js - DOM rendering functionality
import { model, saveModel } from './state.js';
import { safeExecute } from './utils.js';
import { eventManager } from './core.js';

let app = null;
let renderPending = false;
const cardPool = new Map(); // Reuse DOM elements
const subtaskPool = new Map();

export function setApp(appElement) {
  app = appElement;
}

// Optimized renderAll with drag-safe fallback
export function renderAll() {
  // Debounce rapid render calls
  if (renderPending) return;
  renderPending = true;
  
  return safeExecute(() => {
	requestAnimationFrame(() => {
	  performRender();
	  renderPending = false;
	});
  }, () => {
	console.error('Render failed, showing fallback');
	if (app) app.innerHTML = '<div class="empty">Something went wrong. Please refresh.</div>';
	renderPending = false;
  });
}

function performRender() {
  const layer = app ? app.querySelector("#dragLayer") : null;
  if (!app) return;

  // CHECK FOR DRAG OPERATIONS - if any drag is happening, use simple render
  const isDragActive = checkForActiveDrag();
  
  if (isDragActive) {
	// During drag: use simple, non-optimized render to avoid conflicts
	performSimpleRender(layer);
	return;
  }

  // Normal optimized render when no drag is active
  performOptimizedRender(layer);
}

// Check if any drag operation is currently active
function checkForActiveDrag() {
  // Check for drag-related elements in DOM
  const hasPlaceholder = app.querySelector('.placeholder') !== null;
  const hasDragGhost = document.querySelector('.drag-ghost') !== null;
  const hasArmedCard = app.querySelector('.task-card.armed, .subtask.armed') !== null;
  const hasLockScroll = document.body.classList.contains('lock-scroll');
  
  // Check global gesture state if available
  let gestureActive = false;
  try {
	// Try to access gesture from window or global scope
	if (typeof window !== 'undefined' && window.gesture) {
	  gestureActive = window.gesture.drag || window.gesture.swipe;
	}
  } catch (e) {
	// Ignore if gesture is not accessible
  }
  
  return hasPlaceholder || hasDragGhost || hasArmedCard || hasLockScroll || gestureActive;
}

// Simple render without optimization - used during drag operations
function performSimpleRender(layer) {
  // Store the drag layer content
  const dragLayerContent = layer ? layer.innerHTML : '';
  
  // Clear app but preserve any essential drag elements
  const fragment = document.createDocumentFragment();
  
  if (model.length === 0) {
	const empty = document.createElement('div');
	empty.className = 'empty';
	empty.innerHTML = '<div>🎉 All done!</div><div>Add your first task below.</div>';
	fragment.appendChild(empty);
  } else {
	// Simple: just create all cards fresh
	for (const task of model) {
	  const card = renderCard(task);
	  fragment.appendChild(card);
	}
  }
  
  // Replace content
  app.innerHTML = "";
  app.appendChild(fragment);
  
  // Restore drag layer
  if (layer) {
	app.appendChild(layer);
	layer.innerHTML = dragLayerContent;
  }
  
  saveModel();
}

// Optimized render with reuse - only used when no drag is active
function performOptimizedRender(layer) {
  const fragment = document.createDocumentFragment();
  const existingCards = new Map();
  
  // Collect existing cards for reuse
  Array.from(app.querySelectorAll('.task-card')).forEach(card => {
	const id = card.dataset.id;
	if (id) {
	  existingCards.set(id, card);
	}
  });

  if (model.length === 0) {
	const empty = getOrCreateEmptyState();
	fragment.appendChild(empty);
  } else {
	// Process cards with optimization
	for (let i = 0; i < model.length; i++) {
	  const task = model[i];
	  const existingCard = existingCards.get(task.id);
	  
	  if (existingCard && canReuseCard(existingCard, task)) {
		updateExistingCard(existingCard, task);
		fragment.appendChild(existingCard);
		existingCards.delete(task.id);
	  } else {
		const newCard = renderCard(task);
		fragment.appendChild(newCard);
	  }
	}
  }
  
  // Replace content
  app.innerHTML = "";
  app.appendChild(fragment);
  if (layer) app.appendChild(layer);
  
  // Clean up unused cards
  existingCards.forEach(card => recycleCard(card));
  
  saveModel();
}

function canReuseCard(card, task) {
  // Very conservative reuse - only if card is completely clean
  const titleEl = card.querySelector('.task-title');
  const subtaskList = card.querySelector('.subtask-list');
  
  return titleEl && 
		 subtaskList && 
		 card.dataset.id === task.id &&
		 !card.classList.contains('armed') &&
		 !card.style.transform &&
		 !card.style.transition;
}

function updateExistingCard(card, task) {
  // Update title
  const titleEl = card.querySelector('.task-title');
  if (titleEl && titleEl.textContent !== task.title) {
	titleEl.textContent = task.title;
  }

  // Update badge
  const badge = card.querySelector('.badge');
  if (badge) {
	if (task.subtasks.length > 0) {
	  badge.textContent = task.subtasks.length;
	  badge.style.display = '';
	} else {
	  badge.style.display = 'none';
	}
  }

  // Update completion state
  const taskCompleted = task.completed || (task.subtasks.length > 0 && task.subtasks.every(st => st.done));
  if (taskCompleted) {
	card.classList.add('all-completed');
  } else {
	card.classList.remove('all-completed');
  }

  // For subtasks, always rebuild to avoid complexity during optimization
  const subtaskList = card.querySelector('.subtask-list');
  const existingWraps = Array.from(subtaskList.querySelectorAll('.swipe-wrap'));
  
  // Clear and rebuild subtasks
  existingWraps.forEach(wrap => {
	recycleSubtask(wrap);
	wrap.remove();
  });
  
  // Add all subtasks fresh
  const subtaskFragment = document.createDocumentFragment();
  for (const st of task.subtasks) {
	const wrap = createSubtaskWrap(st, task.id);
	subtaskFragment.appendChild(wrap);
  }
  
  // Insert before the add form
  const addForm = subtaskList.querySelector('.add-subtask-form');
  if (addForm) {
	subtaskList.insertBefore(subtaskFragment, addForm);
	addForm.dataset.mainId = task.id;
	const input = addForm.querySelector('.add-sub-input');
	if (input) {
	  input.setAttribute('aria-label', `Add subtask to ${task.title}`);
	}
  } else {
	subtaskList.appendChild(subtaskFragment);
  }
}

function createSubtaskWrap(st, mainId) {
  const wrap = document.createElement("div");
  wrap.className = "swipe-wrap";
  wrap.dataset.id = st.id;
  wrap.dataset.mainId = mainId;
  wrap.innerHTML = `
	<div class="swipe-actions" aria-hidden="true">
	  <div class="zone left">
		<button class="action complete" data-act="complete" title="Complete"></button>
	  </div>
	  <div class="zone right">
		<button class="action edit" data-act="edit" title="Edit"></button>
		<button class="action delete" data-act="delete" title="Delete"></button>
	  </div>
	</div>`;

  const row = document.createElement("div");
  row.className = "subtask";
  row.dataset.id = st.id;
  row.dataset.mainId = mainId;
  row.innerHTML = `
	<div class="sub-handle" aria-label="Drag to move" role="button"></div>
	<div class="sub-text ${st.done ? 'done' : ''}"></div>
  `;
  row.querySelector(".sub-text").textContent = st.text;
  wrap.appendChild(row);
  
  return wrap;
}

function getOrCreateEmptyState() {
  let empty = cardPool.get('empty');
  if (!empty) {
	empty = document.createElement('div');
	empty.className = 'empty';
	empty.innerHTML = '<div>🎉 All done!</div><div>Add your first task below.</div>';
	cardPool.set('empty', empty);
  }
  return empty;
}

function recycleCard(card) {
  if (card._swipeCleanup) {
	card._swipeCleanup();
  }
  
  const id = card.dataset.id;
  if (id && cardPool.size < 20) {
	cardPool.set(id, card);
  }
}

function recycleSubtask(wrap) {
  if (wrap._swipeCleanup) {
	wrap._swipeCleanup();
  }
  
  const id = wrap.dataset.id;
  if (id && subtaskPool.size < 50) {
	subtaskPool.set(id, wrap);
  }
}

// Original renderCard function - unchanged and reliable
function renderCard(m) {
  const card = document.createElement("article");
  card.className = "task-card card-swipe-wrap";
  card.dataset.id = m.id;
  
  const taskCompleted = m.completed || (m.subtasks.length > 0 && m.subtasks.every(st => st.done));
  
  card.innerHTML = `
	<div class="card-swipe-actions" aria-hidden="true">
	  <div class="zone left">
		<button class="action complete" data-act="complete-all" title="${taskCompleted ? 'Mark incomplete' : 'Complete task'}"></button>
	  </div>
	  <div class="zone right">
		<button class="action edit" data-act="edit-title" title="Edit task"></button>
		<button class="action delete" data-act="delete-task" title="Delete task"></button>
	  </div>
	</div>
	<div class="card-row">
	  <div class="card-handle" aria-label="Move task" role="button"></div>
	  <div class="task-title"></div>
	  <span class="badge"></span>
	</div>
	<div class="subtask-list"></div>`;

  card.querySelector(".task-title").textContent = m.title;
  
  const badge = card.querySelector(".badge");
  if (m.subtasks.length > 0) {
	badge.textContent = m.subtasks.length;
	badge.style.display = '';
  } else {
	badge.style.display = 'none';
  }

  if (taskCompleted) {
	card.classList.add('all-completed');
  }

  const list = card.querySelector(".subtask-list");
  const subtaskFragment = document.createDocumentFragment();
  
  for (const st of m.subtasks) {
	const wrap = createSubtaskWrap(st, m.id);
	subtaskFragment.appendChild(wrap);
  }

  list.appendChild(subtaskFragment);

  const addRow = document.createElement('form');
  addRow.className = 'add-subtask-form add-subtask-row';
  addRow.dataset.mainId = m.id;
  addRow.autocomplete = 'off';
  addRow.innerHTML = `
	<input class="add-sub-input" name="subtask" type="text" inputmode="text" placeholder="Add subtask…" aria-label="Add subtask to ${m.title}" maxlength="140" />
	<button class="add-sub-btn" type="submit" aria-label="Add subtask"></button>
  `;
  list.appendChild(addRow);
  
  return card;
}