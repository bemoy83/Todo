import { setDomRefs, bootBehaviors, cleanup } from './core.js';
import { renderAll } from './rendering.js';
import './drag.js';
import './swipe.js';
import './menu.js';
import { performanceMonitor, withTiming } from './performance.js'; // ADD THIS
import { offlineManager } from './offline.js'; // ADD this line

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

// ADD this at the very end of main.js:

// REPLACE the service worker registration in main.js with:
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')  // Changed from '/sw.js' to './sw.js'
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}