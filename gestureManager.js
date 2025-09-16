// gestureManager.js - Fixed scroll locking to prevent screen jumps
import { DRAG, SWIPE, FEEDBACK } from './constants.js';

class GestureManager {
  constructor() {
    this.activeGesture = null; // 'drag', 'swipe', null
    this.iosScrollLocked = false;
    this.preventTouch = null;
    this.scrollPosition = 0; // Store scroll position before locking
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

  // FIXED: Smart iOS scroll locking that preserves position
  lockIOSScroll() {
    if (this.iosScrollLocked) return;
    this.iosScrollLocked = true;
    
    // Store current scroll position BEFORE locking
    this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop || 0;
    
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
    
    // FIXED: Smarter body scroll prevention that maintains position
    const body = document.body;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // Apply styles that prevent scrolling but maintain position
    body.style.overflow = 'hidden';
    body.style.paddingRight = `${scrollbarWidth}px`; // Prevent layout shift
    body.style.top = `-${this.scrollPosition}px`;
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.classList.add('lock-scroll');
    
    console.log(`📍 Locked scroll at position: ${this.scrollPosition}`);
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
    
    // FIXED: Restore body scroll and position smoothly
    const body = document.body;
    body.style.overflow = '';
    body.style.paddingRight = '';
    body.style.top = '';
    body.style.position = '';
    body.style.width = '';
    body.classList.remove('lock-scroll');
    
    // Restore scroll position smoothly
    if (this.scrollPosition > 0) {
      // Use requestAnimationFrame for smooth restoration
      requestAnimationFrame(() => {
        window.scrollTo(0, this.scrollPosition);
        console.log(`📍 Restored scroll to position: ${this.scrollPosition}`);
      });
    }
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