// cleanup.js - NEW FILE - Add this entire file
export class CleanupManager {
  constructor() {
	this.cleanupFunctions = new Map();
  }
  
  register(element, cleanupFn) {
	if (!element || !cleanupFn) return;
	
	if (!this.cleanupFunctions.has(element)) {
	  this.cleanupFunctions.set(element, []);
	}
	this.cleanupFunctions.get(element).push(cleanupFn);
  }
  
  cleanup(element) {
	const cleanups = this.cleanupFunctions.get(element);
	if (cleanups) {
	  cleanups.forEach(fn => {
		try {
		  fn();
		} catch (e) {
		  console.error('Cleanup failed:', e);
		}
	  });
	  this.cleanupFunctions.delete(element);
	}
  }
  
  cleanupAll() {
	for (const [element, cleanups] of this.cleanupFunctions) {
	  cleanups.forEach(fn => {
		try {
		  fn();
		} catch (e) {
		  console.error('Cleanup failed:', e);
		}
	  });
	}
	this.cleanupFunctions.clear();
  }
}

export const cleanupManager = new CleanupManager();
