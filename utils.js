// utils.js - Shared utility functions

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
	const later = () => {
	  clearTimeout(timeout);
	  func(...args);
	};
	clearTimeout(timeout);
	timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function() {
	const args = arguments;
	const context = this;
	if (!inThrottle) {
	  func.apply(context, args);
	  inThrottle = true;
	  setTimeout(() => inThrottle = false, limit);
	}
  }
}

export function safeExecute(fn, fallback = () => {}) {
  try {
	return fn();
  } catch (error) {
	console.error('Safe execute failed:', error);
	return fallback();
  }
}

// ADD this function to utils.js:

export function createWeakCache(maxSize = 100) {
  const cache = new Map();
  const accessOrder = new Set();

  return {
	get(key) {
	  if (cache.has(key)) {
		// Move to end (most recent)
		accessOrder.delete(key);
		accessOrder.add(key);
		return cache.get(key);
	  }
	  return undefined;
	},

	set(key, value) {
	  if (cache.has(key)) {
		// Update existing
		cache.set(key, value);
		accessOrder.delete(key);
		accessOrder.add(key);
	  } else {
		// Add new
		if (cache.size >= maxSize) {
		  // Remove least recently used
		  const firstKey = accessOrder.values().next().value;
		  accessOrder.delete(firstKey);
		  cache.delete(firstKey);
		}
		cache.set(key, value);
		accessOrder.add(key);
	  }
	},

	clear() {
	  cache.clear();
	  accessOrder.clear();
	},

	size() {
	  return cache.size;
	}
  };
}