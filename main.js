import { setDomRefs, renderAll, bootBehaviors } from './core.js';
import './drag.js';
import './swipe.js';
import './menu.js';

document.addEventListener('DOMContentLoaded', () => {
  setDomRefs();
  renderAll();
  bootBehaviors();
});