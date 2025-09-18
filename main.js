import { setDomRefs, bootBehaviors, cleanup } from './core.js';
import { renderAll } from './rendering.js';
import './drag.js';
import './swipe.js';
import './menu.js';

// Global error handler
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  // Could show a user-friendly message here
});

// Unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  e.preventDefault(); // Prevent console spam
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    setDomRefs();
    renderAll();
    bootBehaviors();
  } catch (error) {
    console.error('App initialization failed:', error);
    // Show fallback UI
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div class="empty">App failed to load. Please refresh the page.</div>';
    }
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);