// Add this at the very top of main.js to catch and debug the error

// Error handler to catch require() issues
window.addEventListener('error', (event) => {
  if (event.message.includes('require')) {
    console.error('🔍 Require Error Details:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
    
    // Log the exact line that's causing the problem
    fetch(event.filename)
      .then(response => response.text())
      .then(text => {
        const lines = text.split('\n');
        const problemLine = lines[event.lineno - 1];
        console.error('🔍 Problem line:', problemLine);
      })
      .catch(err => console.error('Could not fetch source:', err));
  }
});

// Your original imports
import { setDomRefs, renderAll, bootBehaviors } from './core.js';
import './drag.js';
import './swipe.js';
import './menu.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 App starting...');
  try {
    setDomRefs();
    renderAll();
    bootBehaviors();
    console.log('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  }
});
