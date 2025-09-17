// rendering.js - DOM rendering functionality
import { model, saveModel } from './state.js';
import { safeExecute } from './utils.js';

let app = null;

export function setApp(appElement) {
  app = appElement;
}

export function renderAll(){
  return safeExecute(() => {
	const layer = app ? app.querySelector("#dragLayer") : null;
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
  }, () => {
	console.error('Render failed, showing fallback');
	if(app) app.innerHTML = '<div class="empty">Something went wrong. Please refresh.</div>';
  });
}

function renderCard(m){
  const card = document.createElement("article");
  card.className = "task-card card-swipe-wrap";
  card.dataset.id = m.id;
  
  // Determine if task is completed
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
  
  // Only show badge if there are subtasks
  const badge = card.querySelector(".badge");
  if (m.subtasks.length > 0) {
	badge.textContent = m.subtasks.length;
	badge.style.display = '';
  } else {
	badge.style.display = 'none';
  }

  // Add completed class if task is completed
  if (taskCompleted) {
	card.classList.add('all-completed');
  }

  const list = card.querySelector(".subtask-list");
  for(const st of m.subtasks){
	const wrap = document.createElement("div");
	wrap.className = "swipe-wrap";
	wrap.dataset.id = st.id;
	wrap.dataset.mainId = m.id;
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
	row.dataset.mainId = m.id;
	row.innerHTML = `
	  <div class="sub-handle" aria-label="Drag to move" role="button"></div>
	  <div class="sub-text ${st.done ? 'done' : ''}"></div>
	`;
	row.querySelector(".sub-text").textContent = st.text;
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
	<button class="add-sub-btn" type="submit" aria-label="Add subtask"></button>
  `;
  list.appendChild(addRow);
  return card;
}