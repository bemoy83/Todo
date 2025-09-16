// drag-enhanced.js - Simplified drag system using gestureManager
import { gestureManager, UnifiedPointerHandler } from './gestureManager.js';
import { TaskOperations } from './taskOperations.js';
import { DRAG } from './constants.js';

export function bindCrossSortContainer() {
  const app = document.getElementById('app');
  const dragLayer = document.getElementById('dragLayer');
  if (!app || !dragLayer) return;

  // Clean up any existing handlers
  app.querySelectorAll('[data-gesture-handler]').forEach(el => {
    if (el._gestureHandler) {
      el._gestureHandler.destroy();
    }
  });

  // Bind to all draggable elements
  bindDragHandlers();
}

function bindDragHandlers() {
  const app = document.getElementById('app');
  
  // Subtask drag handlers
  app.querySelectorAll('.swipe-wrap').forEach(wrap => {
    if (wrap.dataset.gestureHandler) return; // Already bound
    
    wrap.dataset.gestureHandler = 'true';
    wrap._gestureHandler = new UnifiedPointerHandler(wrap, {
      onDragStart: (e, startPoint) => startSubtaskDrag(wrap, e, startPoint),
      onDragMove: (e, startPoint) => handleSubtaskDragMove(e),
      onDragEnd: (e, startPoint) => endSubtaskDrag(e)
    });
  });

  // Task card drag handlers  
  app.querySelectorAll('.task-card').forEach(card => {
    if (card.dataset.gestureHandler) return; // Already bound
    
    card.dataset.gestureHandler = 'true';
    card._gestureHandler = new UnifiedPointerHandler(card, {
      onDragStart: (e, startPoint) => startTaskDrag(card, e, startPoint),
      onDragMove: (e, startPoint) => handleTaskDragMove(e),
      onDragEnd: (e, startPoint) => endTaskDrag(e)
    });
  });
}

// Subtask drag state
let subtaskDrag = {
  element: null,
  ghost: null,
  placeholder: null,
  sourceMainId: null,
  anchorY: 0,
  railLeft: 0,
  targetY: 0,
  smoothY: 0
};

// Task drag state
let taskDrag = {
  element: null,
  ghost: null,
  placeholder: null,
  anchorY: 0,
  railLeft: 0,
  targetY: 0,
  smoothY: 0
};

// Subtask drag functions
function startSubtaskDrag(wrap, e, startPoint) {
  const subtaskElement = wrap.querySelector('.subtask');
  if (!subtaskElement) return;

  console.log('🎯 Starting subtask drag');
  
  subtaskDrag.element = subtaskElement;
  subtaskDrag.sourceMainId = wrap.closest('.task-card').dataset.id;
  
  // Add dragging class for CSS styling
  subtaskElement.classList.add('dragging');
  document.body.classList.add('ios-gesture-active');
  
  createSubtaskGhost(subtaskElement, e);
  createSubtaskPlaceholder(wrap);
  
  // Start animation loop
  requestAnimationFrame(updateSubtaskDrag);
}

function createSubtaskGhost(element, e) {
  const dragLayer = document.getElementById('dragLayer');
  const rect = element.getBoundingClientRect();
  const appRect = document.getElementById('app').getBoundingClientRect();
  
  // Create ghost
  subtaskDrag.ghost = element.cloneNode(true);
  subtaskDrag.ghost.classList.add('drag-ghost');
  subtaskDrag.ghost.style.cssText = `
    position: absolute;
    top: 0;
    left: ${rect.left - appRect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    transform: translate3d(0, ${rect.top - appRect.top}px, 0);
    pointer-events: none;
    z-index: 1000;
    opacity: 0.95;
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
  `;
  
  // Store positioning data
  subtaskDrag.anchorY = e.clientY - rect.top;
  subtaskDrag.railLeft = rect.left - appRect.left;
  subtaskDrag.targetY = subtaskDrag.smoothY = rect.top - appRect.top;
  
  dragLayer.appendChild(subtaskDrag.ghost);
}

function createSubtaskPlaceholder(wrap) {
  const rect = wrap.getBoundingClientRect();
  subtaskDrag.placeholder = document.createElement('div');
  subtaskDrag.placeholder.className = 'placeholder';
  subtaskDrag.placeholder.style.height = `${rect.height}px`;
  
  wrap.style.display = 'none';
  wrap.parentNode.insertBefore(subtaskDrag.placeholder, wrap);
}

function handleSubtaskDragMove(e) {
  if (!subtaskDrag.ghost) return;
  
  const appRect = document.getElementById('app').getBoundingClientRect();
  const pointerY = e.clientY - appRect.top;
  subtaskDrag.targetY = pointerY - subtaskDrag.anchorY;
  
  // Update drop target
  updateSubtaskDropTarget();
}

function updateSubtaskDropTarget() {
  if (!subtaskDrag.ghost || !subtaskDrag.placeholder) return;
  
  const ghostRect = subtaskDrag.ghost.getBoundingClientRect();
  const ghostCenterY = ghostRect.top + ghostRect.height / 2;
  const app = document.getElementById('app');
  
  // Find target list
  let targetList = null;
  app.querySelectorAll('.subtask-list').forEach(list => {
    const listRect = list.getBoundingClientRect();
    if (ghostCenterY >= listRect.top && ghostCenterY <= listRect.bottom) {
      targetList = list;
    }
  });
  
  if (!targetList) return;
  
  // Find insertion point
  const rows = Array.from(targetList.children).filter(child => 
    child.classList.contains('swipe-wrap') && child !== subtaskDrag.placeholder
  );
  
  let insertBefore = null;
  for (const row of rows) {
    const rowRect = row.getBoundingClientRect();
    const rowCenter = rowRect.top + rowRect.height / 2;
    if (ghostCenterY < rowCenter) {
      insertBefore = row;
      break;
    }
  }
  
  // Move placeholder
  if (insertBefore) {
    targetList.insertBefore(subtaskDrag.placeholder, insertBefore);
  } else {
    // Insert before the add form
    const addForm = targetList.querySelector('.add-subtask-form');
    if (addForm) {
      targetList.insertBefore(subtaskDrag.placeholder, addForm);
    } else {
      targetList.appendChild(subtaskDrag.placeholder);
    }
  }
}

function updateSubtaskDrag() {
  if (!subtaskDrag.ghost) return;
  
  // Smooth animation
  const alpha = 0.3;
  subtaskDrag.smoothY += (subtaskDrag.targetY - subtaskDrag.smoothY) * alpha;
  
  subtaskDrag.ghost.style.transform = 
    `translate3d(0, ${Math.round(subtaskDrag.smoothY)}px, 0)`;
  
  requestAnimationFrame(updateSubtaskDrag);
}

async function endSubtaskDrag(e) {
  if (!subtaskDrag.element || !subtaskDrag.placeholder) return;
  
  const targetList = subtaskDrag.placeholder.parentElement;
  const targetCard = targetList?.closest('.task-card');
  const targetMainId = targetCard?.dataset.id;
  
  if (targetList && targetMainId) {
    // Calculate new index
    let newIndex = 0;
    for (const child of targetList.children) {
      if (child === subtaskDrag.placeholder) break;
      if (child.classList.contains('swipe-wrap')) newIndex++;
    }
    
    // Perform the move
    const subtaskId = subtaskDrag.element.dataset.id;
    try {
      await TaskOperations.subtask.move(
        subtaskDrag.sourceMainId, 
        subtaskId, 
        targetMainId, 
        newIndex
      );
    } catch (error) {
      console.error('Subtask drag failed:', error);
    }
  }
  
  cleanupSubtaskDrag();
}

function cleanupSubtaskDrag() {
  // Clean up ghost
  if (subtaskDrag.ghost) {
    subtaskDrag.ghost.remove();
    subtaskDrag.ghost = null;
  }
  
  // Clean up placeholder
  if (subtaskDrag.placeholder) {
    subtaskDrag.placeholder.remove();
    subtaskDrag.placeholder = null;
  }
  
  // Restore element
  if (subtaskDrag.element) {
    subtaskDrag.element.classList.remove('dragging');
    const wrap = subtaskDrag.element.closest('.swipe-wrap');
    if (wrap) wrap.style.display = '';
  }
  
  // Clean up body classes
  document.body.classList.remove('ios-gesture-active');
  
  // Reset state
  subtaskDrag = {
    element: null,
    ghost: null,
    placeholder: null,
    sourceMainId: null,
    anchorY: 0,
    railLeft: 0,
    targetY: 0,
    smoothY: 0
  };
}

// Similar implementation for task drag (simplified for brevity)
function startTaskDrag(card, e, startPoint) {
  console.log('🎯 Starting task drag');
  
  taskDrag.element = card;
  card.classList.add('dragging');
  document.body.classList.add('ios-gesture-active');
  
  // Implementation similar to subtask drag...
  createTaskGhost(card, e);
  createTaskPlaceholder(card);
  
  requestAnimationFrame(updateTaskDrag);
}

function createTaskGhost(element, e) {
  // Similar to createSubtaskGhost but for task cards
  // Implementation details...
}

function createTaskPlaceholder(card) {
  // Similar to createSubtaskPlaceholder but for task cards
  // Implementation details...
}

function handleTaskDragMove(e) {
  // Similar to handleSubtaskDragMove but for task cards
  // Implementation details...
}

function updateTaskDrag() {
  // Similar to updateSubtaskDrag but for task cards
  // Implementation details...
}

async function endTaskDrag(e) {
  // Similar to endSubtaskDrag but for task cards
  // Implementation details...
  cleanupTaskDrag();
}

function cleanupTaskDrag() {
  // Similar to cleanupSubtaskDrag but for task cards
  // Implementation details...
}

// Auto-rebind after DOM changes
const observer = new MutationObserver(() => {
  // Debounce the rebinding
  clearTimeout(observer.timeout);
  observer.timeout = setTimeout(bindDragHandlers, 100);
});

observer.observe(document.getElementById('app') || document.body, {
  childList: true,
  subtree: true
});
