// gestureManager.js - Simple gesture coordination for iOS
import { DRAG, SWIPE, FEEDBACK } from './constants.js';

class GestureManager {
  constructor() {
    this.activeGesture = null; // 'drag', 'swipe', null
    this.iosScrollLocked = false;
    this.preventTouch = null;
    this.setupIOSOptimizations();
  }

  setupIOSOptimizations() {
    // Disable iOS-specific behaviors globally
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('gesturechange', e => e.preventDefault());
    document.addEventListener('gestureend', e => e.preventDefault());
  }

  // Check if any gesture is active
  hasActiveGesture() {
    return this.activeGesture !== null;
  }

  // Request gesture lock - returns true if granted
  requestGesture(type, element) {
    if (this.activeGesture) {
      return false; // Another gesture is active
    }
    
    this.activeGesture = type;
    console.log(`🎯 Gesture locked: ${type}`);
    return true;
  }

  // Release gesture
  releaseGesture(type) {
    if (this.activeGesture === type) {
      console.log(`🔓 Gesture released: ${type}`);
      this.activeGesture = null;
      this.unlockIOSScroll();
    }
  }

  // iOS-specific scroll locking
  lockIOSScroll() {
    if (this.iosScrollLocked) return;
    this.iosScrollLocked = true;
    
    // Comprehensive iOS touch prevention
    this.preventTouch = (e) => {
      if (this.hasActiveGesture()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    // Use passive: false for iOS compatibility
    const options = { passive: false, capture: true };
    document.addEventListener('touchstart', this.preventTouch, options);
    document.addEventListener('touchmove', this.preventTouch, options);
    document.addEventListener('touchend', this.preventTouch, options);
    document.addEventListener('wheel', this.preventTouch, options);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.classList.add('lock-scroll');
  }

  unlockIOSScroll() {
    if (!this.iosScrollLocked) return;
    this.iosScrollLocked = false;
    
    // Remove touch prevention
    if (this.preventTouch) {
      document.removeEventListener('touchstart', this.preventTouch, true);
      document.removeEventListener('touchmove', this.preventTouch, true);
      document.removeEventListener('touchend', this.preventTouch, true);
      document.removeEventListener('wheel', this.preventTouch, true);
      this.preventTouch = null;
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.classList.remove('lock-scroll');
  }

  // Haptic feedback
  haptic(intensity = 'medium') {
    if (!navigator.vibrate) return;
    
    const patterns = {
      light: FEEDBACK.HAPTIC_LIGHT || 5,
      medium: FEEDBACK.HAPTIC_MEDIUM || 8,
      success: FEEDBACK.HAPTIC_SUCCESS || 15
    };
    
    navigator.vibrate(patterns[intensity] || patterns.medium);
  }

  // Cleanup all gestures
  cleanup() {
    this.activeGesture = null;
    this.unlockIOSScroll();
  }
}

// Create singleton instance
export const gestureManager = new GestureManager();