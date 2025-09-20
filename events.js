// events.js - NEW FILE - Centralized event delegation
export class EventDelegator {
  constructor(rootElement) {
	this.root = rootElement || document;
	this.handlers = new Map();
	this.boundHandler = this.handleEvent.bind(this);
	this.initialized = false;
  }
  
  // Initialize the delegator
  init() {
	if (this.initialized) return;
	
	// Add single listeners for each event type we care about
	['click', 'submit', 'pointerdown', 'keydown'].forEach(eventType => {
	  this.root.addEventListener(eventType, this.boundHandler, true);
	});
	
	this.initialized = true;
  }
  
  // Main event handler
  handleEvent(event) {
	const handlers = this.handlers.get(event.type);
	if (!handlers) return;
	
	// Check each registered handler
	for (const [selector, callback] of handlers) {
	  const target = event.target.closest(selector);
	  if (target && this.root.contains(target)) {
		// Call handler with target as context
		callback.call(target, event, target);
	  }
	}
  }
  
  // Register a delegated event handler
  on(eventType, selector, callback) {
	if (!this.handlers.has(eventType)) {
	  this.handlers.set(eventType, new Map());
	}
	
	this.handlers.get(eventType).set(selector, callback);
	
	// Initialize if not already done
	this.init();
  }
  
  // Remove a delegated handler
  off(eventType, selector) {
	const typeHandlers = this.handlers.get(eventType);
	if (typeHandlers) {
	  typeHandlers.delete(selector);
	}
  }
  
  // Clean up everything
  destroy() {
	['click', 'submit', 'pointerdown', 'keydown'].forEach(eventType => {
	  this.root.removeEventListener(eventType, this.boundHandler, true);
	});
	
	this.handlers.clear();
	this.initialized = false;
  }
}

// Create singleton instance
export const appEvents = new EventDelegator();

// ADD THIS LINE - Expose for debugging/testing only
if (typeof window !== 'undefined') {
  window.appEvents = appEvents;
}