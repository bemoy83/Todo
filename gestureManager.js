// gestureManager.js - Simplified: only disable scroll during swipes, not drags
import { DRAG, SWIPE, FEEDBACK } from './constants.js';

class GestureManager {
  constructor() {
    this.activeGesture = null; // 'drag', 'swipe', null
    this.scrollLocked = false;
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
    
    // ONLY lock scroll for swipes, NOT for drags
    if (type === 'swipe') {
      this.lockScroll();
    }
    
    return true;
  }

  // Release gesture
  releaseGesture(type) {
    if (this.activeGesture === type) {
      console.log(`🔓 Gesture released: ${type}`);
      this.activeGesture = null;
      
      // Unlock scroll when releasing any gesture
      this.unlockScroll();
    }
  }

  // Simple scroll locking - only prevent touch events that conflict with gestures
  lockScroll() {
    if (this.scrollLocked) return;
    this.scrollLocked = true;
    
    console.log('🔒 Scroll locked for swipe');
    
    // Only prevent touch events that would interfere with swipe gestures
    this.preventTouch = (e) => {
      // Only prevent if we have an active swipe gesture
      if (this.activeGesture === 'swipe') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    // Add touch prevention for iOS
    const options = { passive: false, capture: true };
    document.addEventListener('touchmove', this.preventTouch, options);
    
    // Add CSS class for any additional styling
    document.body.classList.add('gesture-scroll-locked');
  }

  unlockScroll() {
    if (!this.scrollLocked) return;
    this.scrollLocked = false;
    
    console.log('🔓 Scroll unlocked');
    
    // Remove touch prevention
    if (this.preventTouch) {
      document.removeEventListener('touchmove', this.preventTouch, true);
      this.preventTouch = null;
    }
    
    // Remove CSS class
    document.body.classList.remove('gesture-scroll-locked');
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
    this.unlockScroll();
  }
}

// Create singleton instance
export const gestureManager = new GestureManager();