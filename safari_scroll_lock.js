// Enhanced scroll locking specifically for Safari iOS
// Add this to your core.js file, replacing the existing scroll lock functions

let scrollLockState = { 
  locked: false, 
  originalScrollY: 0, 
  touchPreventHandler: null,
  preventDocumentScroll: null,
  isEdgeScrolling: false,
  dragElement: null
};

// Enhanced iOS Safari-specific scroll locking
export function lockScrollForSafari() {
  if (scrollLockState.locked) return;
  
  console.log('🔒 Locking scroll for Safari...');
  
  // Store original scroll position
  const scrollingElement = document.scrollingElement || document.documentElement;
  scrollLockState.originalScrollY = scrollingElement.scrollTop || window.pageYOffset || 0;
  
  // Apply aggressive CSS-based scroll prevention
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.top = `-${scrollLockState.originalScrollY}px`;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  // Add CSS class for additional styling
  document.body.classList.add('lock-scroll');
  
  // Safari iOS specific: Prevent document-level scrolling
  scrollLockState.preventDocumentScroll = (e) => {
    // Always prevent default scrolling on document
    if (e.cancelable) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    return false;
  };
  
  // Ultra-aggressive event prevention for Safari
  scrollLockState.touchPreventHandler = (e) => {
    if (!scrollLockState.locked) return;
    
    // Check if this is edge scrolling during drag
    if (scrollLockState.isEdgeScrolling) {
      return; // Allow edge scrolling
    }
    
    // Prevent all other scrolling
    if (e.cancelable) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
    return false;
  };
  
  // Add multiple layers of scroll prevention
  const options = { passive: false, capture: true };
  
  // Document level - highest priority
  document.addEventListener('touchstart', scrollLockState.preventDocumentScroll, options);
  document.addEventListener('touchmove', scrollLockState.preventDocumentScroll, options);
  document.addEventListener('touchend', scrollLockState.preventDocumentScroll, options);
  
  // Window level
  window.addEventListener('touchmove', scrollLockState.touchPreventHandler, options);
  window.addEventListener('wheel', scrollLockState.touchPreventHandler, options);
  window.addEventListener('scroll', scrollLockState.touchPreventHandler, options);
  
  // Body level
  document.body.addEventListener('touchmove', scrollLockState.touchPreventHandler, options);
  
  scrollLockState.locked = true;
  
  console.log('✅ Scroll locked successfully');
}

export function unlockScrollForSafari() {
  if (!scrollLockState.locked) return;
  
  console.log('🔓 Unlocking scroll...');
  
  // Remove CSS locks
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.height = '';
  document.body.style.top = '';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.classList.remove('lock-scroll');
  
  // Remove all event listeners
  if (scrollLockState.touchPreventHandler) {
    window.removeEventListener('touchmove', scrollLockState.touchPreventHandler, { capture: true });
    window.removeEventListener('wheel', scrollLockState.touchPreventHandler, { capture: true });
    window.removeEventListener('scroll', scrollLockState.touchPreventHandler, { capture: true });
    document.body.removeEventListener('touchmove', scrollLockState.touchPreventHandler, { capture: true });
  }
  
  if (scrollLockState.preventDocumentScroll) {
    document.removeEventListener('touchstart', scrollLockState.preventDocumentScroll, { capture: true });
    document.removeEventListener('touchmove', scrollLockState.preventDocumentScroll, { capture: true });
    document.removeEventListener('touchend', scrollLockState.preventDocumentScroll, { capture: true });
  }
  
  // Restore scroll position
  const scrollingElement = document.scrollingElement || document.documentElement;
  scrollingElement.scrollTop = scrollLockState.originalScrollY;
  window.scrollTo(0, scrollLockState.originalScrollY);
  
  // Reset state
  scrollLockState.locked = false;
  scrollLockState.originalScrollY = 0;
  scrollLockState.touchPreventHandler = null;
  scrollLockState.preventDocumentScroll = null;
  scrollLockState.isEdgeScrolling = false;
  scrollLockState.dragElement = null;
  
  console.log('✅ Scroll unlocked successfully');
}

// Enhanced edge scrolling system that works within the locked context
export function createSafariEdgeScroll() {
  return {
    EDGE_SIZE: 80, // Larger edge zone for easier triggering
    SCROLL_SPEED: 4, // Slower, smoother scrolling
    SCROLL_ACCELERATION: 1.2, // Gradual acceleration
    isScrolling: false,
    scrollAnimation: null,
    
    startEdgeScroll(clientY, dragElement) {
      if (this.isScrolling) return;
      
      const screenHeight = window.innerHeight;
      const isNearTop = clientY < this.EDGE_SIZE;
      const isNearBottom = clientY > (screenHeight - this.EDGE_SIZE);
      
      if (!isNearTop && !isNearBottom) return;
      
      this.isScrolling = true;
      scrollLockState.isEdgeScrolling = true;
      scrollLockState.dragElement = dragElement;
      
      const direction = isNearTop ? -1 : 1;
      const intensity = isNearTop ? 
        (this.EDGE_SIZE - clientY) / this.EDGE_SIZE :
        (clientY - (screenHeight - this.EDGE_SIZE)) / this.EDGE_SIZE;
      
      this.performEdgeScroll(direction, intensity);
    },
    
    performEdgeScroll(direction, intensity) {
      if (!scrollLockState.locked) return;
      
      // Temporarily unlock body positioning for smooth scrolling
      const originalTop = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      
      const scrollAmount = this.SCROLL_SPEED * intensity * this.SCROLL_ACCELERATION;
      const scrollingElement = document.scrollingElement || document.documentElement;
      
      if (direction < 0) {
        // Scroll up
        const newScrollTop = Math.max(0, scrollingElement.scrollTop - scrollAmount);
        scrollingElement.scrollTop = newScrollTop;
      } else {
        // Scroll down
        const maxScroll = scrollingElement.scrollHeight - scrollingElement.clientHeight;
        const newScrollTop = Math.min(maxScroll, scrollingElement.scrollTop + scrollAmount);
        scrollingElement.scrollTop = newScrollTop;
      }
      
      // Update the stored scroll position
      scrollLockState.originalScrollY = scrollingElement.scrollTop;
      
      // Re-lock with new position
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollLockState.originalScrollY}px`;
      
      // Continue scrolling if still in edge zone
      this.scrollAnimation = requestAnimationFrame(() => {
        if (this.isScrolling && scrollLockState.dragElement) {
          const rect = scrollLockState.dragElement.getBoundingClientRect();
          const dragY = rect.top + rect.height / 2;
          
          if (dragY < this.EDGE_SIZE || dragY > (window.innerHeight - this.EDGE_SIZE)) {
            this.performEdgeScroll(direction, intensity);
          } else {
            this.stopEdgeScroll();
          }
        }
      });
    },
    
    stopEdgeScroll() {
      this.isScrolling = false;
      scrollLockState.isEdgeScrolling = false;
      scrollLockState.dragElement = null;
      
      if (this.scrollAnimation) {
        cancelAnimationFrame(this.scrollAnimation);
        this.scrollAnimation = null;
      }
    }
  };
}

// Create the edge scroll instance
const safariEdgeScroll = createSafariEdgeScroll();

// Export the edge scroll functions
export function startEdgeScroll(clientY, dragElement) {
  safariEdgeScroll.startEdgeScroll(clientY, dragElement);
}

export function stopEdgeScroll() {
  safariEdgeScroll.stopEdgeScroll();
}

// Backwards compatibility - replace your existing functions with these
export const lockScrollRobust = lockScrollForSafari;
export const unlockScrollRobust = unlockScrollForSafari;
export const lockScrollWithEdgeScroll = lockScrollForSafari;