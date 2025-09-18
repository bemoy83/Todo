import { setDomRefs, bootBehaviors, cleanup } from './core.js';
import { renderAll } from './rendering.js';
import './drag.js';
import './swipe.js';
import './menu.js';
import { performanceMonitor, withTiming } from './performance.js'; // ADD THIS

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

// REPLACE the DOMContentLoaded handler in main.js with this:
document.addEventListener('DOMContentLoaded', () => {
  const initApp = withTiming('app-initialization', () => {
    setDomRefs();
    renderAll();
    bootBehaviors();
  });

  try {
    initApp();
    console.log('App initialized successfully');
  } catch (error) {
    console.error('App initialization failed:', error);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div class="empty">App failed to load. Please refresh the page.</div>';
    }
  }
});

// Cleanup on page unload
// REPLACE the cleanup handler in main.js:
window.addEventListener('beforeunload', () => {
  cleanup();
  performanceMonitor.cleanup(); // ADD THIS
});