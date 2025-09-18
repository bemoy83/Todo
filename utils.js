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