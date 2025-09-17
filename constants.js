// constants.js – Centralized configuration for the entire app
// Import like: import { DRAG, SWIPE, UI, TIMING, STORAGE, FEEDBACK } from './constants.js'

// ---- Drag thresholds & smoothing ----
export const DRAG = {
  HOLD_MS: 350,
  JITTER_PX: 8,
  GATE: 0.30,
  FORCE: 0.70,
  // Adaptive follower (used by drag.js)
  FOLLOW_MIN: 0.38,   // Lower = smoother, higher = tighter
  FOLLOW_MAX: 0.86,   // Cap so it doesn't overshoot
  SPEED_GAIN: 0.012,  // Velocity influence
  GAP_GAIN: 0.020,    // Distance influence
  SNAP_EPS: 0.25,     // Sub-pixel snap threshold
  
  // Card-specific drag constants (from drag.js)
  CARD_STICKY: 16,        // Sticky threshold for card swapping
  CARD_SWAP_PX: 56,       // Distance needed to trigger card swap
  CARD_EDGE_FRAC: 0.25,   // Edge fraction for card swap detection
  
  // Auto-scroll during drag
  AUTOSCROLL_EDGE: 56,    // Pixels from edge to start scrolling
  AUTOSCROLL_MAX: 18,     // Maximum scroll speed
};

// ---- Swipe thresholds (industry-standard tuning for 60-120 Hz displays) ----
export const SWIPE = {
  // === Gesture Recognition ===
  HOLD_MS: 600,              
  MIN_INTENT_DISTANCE: 40,   
  VERTICAL_GUARD: 12,        
  
  // === Velocity-Based Fling Detection ===
  FLING_VX: 0.8,             
  FLING_MIN: 32,             
  FLING_EXPIRE: 80,          
  
  // === Deliberate Gesture Threshold ===
  DELIBERATE_MIN: 80,        
  
  // === Animation Timing ===
  SNAP_MS: 150,              
  EXEC_MS: 140,              
  
  // === Resistance & Feel ===
  RESISTANCE_FACTOR: 0.3,    
  MAX_OVEREXTEND: 1.3,       
  
  // === NEW: Separate Reveal Distances ===
  LEFT_REVEAL_DISTANCE: 80,   // Distance to reveal left actions (complete)
  RIGHT_REVEAL_DISTANCE: 120, // Distance to reveal right actions (edit + delete)
  
  // === Action Button Constants ===
  
};

// Alternative: More sensitive settings
export const SWIPE_SENSITIVE = {
  HOLD_MS: 400,              // Even quicker hold
  DELIBERATE_MIN: 50,        // Much easier snap
  ACTION_REVEAL_DISTANCE: 60, // Very quick reveal
  FLING_VX: 0.5,             // Easier fling
};

// Alternative: Less sensitive settings  
export const SWIPE_CONSERVATIVE = {
  HOLD_MS: 700,              // Longer hold required
  DELIBERATE_MIN: 90,        // Further swipe needed
  ACTION_REVEAL_DISTANCE: 90, // More pull needed
  FLING_VX: 1.0,             // Harder fling
};

// ---- UI Layout & Spacing ----
export const UI = {
  // Layout
  TOPBAR_H: 56,              // px - Top bar height
  MAX_APP_WIDTH: 680,        // px - Maximum app container width
  APP_PADDING: 16,           // px - App container padding
  CARD_GAP: 16,              // px - Gap between task cards
  
  // Card dimensions
  CARD_MIN_HEIGHT: 60,       // px - Minimum card height
  SUBTASK_MIN_HEIGHT: 56,    // px - Minimum subtask height
  
  // Border radius
  RADIUS: 12,                // px - Standard border radius
  RADIUS_SM: 10,             // px - Small border radius
  RADIUS_FULL: 999,          // px - Full border radius (pills)
  
  // Input sizing
  INPUT_HEIGHT: 44,          // px - Standard input height
  INPUT_HEIGHT_SM: 40,       // px - Small input height
  BUTTON_MIN_SIZE: 32,       // px - Minimum button size
  
  // Spacing scale
  SPACE_XS: 4,               // px
  SPACE_SM: 8,               // px  
  SPACE_MD: 12,              // px
  SPACE_LG: 16,              // px
  SPACE_XL: 24,              // px
  SPACE_XXL: 32,             // px
  
  // Safe areas
  SAFE_AREA_BOTTOM: 'env(safe-area-inset-bottom)',
  SAFE_AREA_TOP: 'env(safe-area-inset-top)',
};

// ---- Animation & Timing ----
export const TIMING = {
  // Standard durations
  INSTANT: 0,
  FAST: 140,
  NORMAL: 200,
  SLOW: 300,
  VERY_SLOW: 500,
  
  // Specific animation durations
  CARD_TRANSITION: 140,      // Task card state changes
  SUBTASK_TRANSITION: 140,   // Subtask state changes
  SWIPE_SNAP: 150,          // Swipe snap back
  SWIPE_EXECUTE: 140,       // Swipe action execution
  MENU_TRANSITION: 120,     // Menu open/close
  
  // Easing functions
  EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
  EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  SPRING: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  
  // Reduced motion
  REDUCED_MOTION_DURATION: 80,
  
  // Delays
  FOCUS_DELAY: 50,           // Delay before focusing inputs
  AUTO_SAVE_DELAY: 300,      // Debounce delay for saving
  RETRY_DELAY: 1000,         // Delay before retrying failed operations
};
export const ANIM = {
  DURATION_FAST: 140,
  DURATION_NORMAL: 200,
  DURATION_SLOW: 300,
  EASING: 'ease-out',
  REDUCED_MOTION_DURATION: 80,
};

// ---- Storage & State ----
export const STORAGE = {
  MODEL_KEY: 'todo:model',
  FLAGS_KEY: 'flags:swipe',
  BACKUP_PREFIX: 'tasks-backup-',
  
  // Data validation
  MAX_TITLE_LENGTH: 180,
  MAX_SUBTASK_LENGTH: 140,
  MAX_TASKS: 1000,           // Reasonable limit for performance
  MAX_SUBTASKS_PER_TASK: 50, // Reasonable limit for UX
};

// ---- User Feedback ----
export const FEEDBACK = {
  // Haptic feedback durations (ms)
  HAPTIC_LIGHT: 5,          // Light tap for drag start
  HAPTIC_MEDIUM: 8,         // Medium tap for swipe actions
  HAPTIC_SUCCESS: 15,       // Success feedback
  
  // Visual feedback
  PULSE_SCALE: 1.15,        // Scale factor for pulse animations
  HOLD_SCALE: 1.05,         // Scale factor during hold state
  SUCCESS_SCALE: 1.02,      // Scale factor for success state
  
  // Loading states
  LOADING_OPACITY: 0.7,     // Opacity during loading
  
  // Toast/notification timing (if implemented)
  TOAST_DURATION: 3000,     // ms
  ERROR_TOAST_DURATION: 5000, // ms
};

// ---- Keyboard Shortcuts ----
export const KEYS = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  SPACE: ' ',
  
  // Command shortcuts (with modifiers)
  NEW_TASK: 'n',            // Cmd/Ctrl + N
  SAVE: 's',                // Cmd/Ctrl + S
  SEARCH: 'f',              // Cmd/Ctrl + F (future feature)
  UNDO: 'z',                // Cmd/Ctrl + Z (future feature)
};

// ---- Breakpoints (for future responsive improvements) ----
export const BREAKPOINTS = {
  SM: 640,   // Small tablets
  MD: 768,   // Tablets  
  LG: 1024,  // Small desktops
  XL: 1280,  // Large desktops
};

// ---- Performance & Optimization ----
export const PERFORMANCE = {
  THROTTLE_RATE: 16,        // ms - ~60fps for smooth animations
  DEBOUNCE_SEARCH: 150,     // ms - Search input debouncing
  VIRTUAL_SCROLL_THRESHOLD: 50, // Number of items before virtualization
  MAX_VELOCITY_SAMPLES: 5,  // Maximum velocity tracking samples
  
  // RAF optimization
  RAF_BATCH_SIZE: 3,        // Max operations per animation frame
};

// ---- Error Messages ----
export const ERRORS = {
  TASK_NOT_FOUND: 'Task not found',
  SUBTASK_NOT_FOUND: 'Subtask not found', 
  INVALID_IMPORT: 'Invalid backup file format',
  STORAGE_FAILED: 'Failed to save data',
  OPERATION_FAILED: 'Operation failed',
  NETWORK_ERROR: 'Network error',
};

// ---- Feature Flags ----
export const FEATURES = {
  SWIPE_GESTURES: true,
  DRAG_REORDER: true,
  KEYBOARD_SHORTCUTS: true,
  AUTO_SAVE: true,
  HAPTIC_FEEDBACK: true,
  VIRTUAL_SCROLLING: false,  // Future feature
  OFFLINE_MODE: false,       // Future feature
  COLLABORATION: false,      // Future feature
};

// ---- CSS Custom Properties (for dynamic theming) ----
export const CSS_VARS = {
  // Colors
  '--color-primary': '#3b82f6',
  '--color-success': '#22c55e', 
  '--color-warning': '#f59e0b',
  '--color-danger': '#ef4444',
  
  // Z-index scale
  '--z-dropdown': '1000',
  '--z-sticky': '1020',
  '--z-modal': '1050',
  '--z-tooltip': '1070',
  '--z-toast': '1080',
};

// ---- Utility functions for constants ----
export const UTILS = {
  // Get timing based on reduced motion preference
  getTiming(duration) {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches 
      ? TIMING.REDUCED_MOTION_DURATION 
      : duration;
  },
  
  // Get appropriate haptic intensity based on device
  getHapticDuration(intensity = 'medium') {
    const intensities = {
      light: FEEDBACK.HAPTIC_LIGHT,
      medium: FEEDBACK.HAPTIC_MEDIUM,
      success: FEEDBACK.HAPTIC_SUCCESS,
    };
    return intensities[intensity] || FEEDBACK.HAPTIC_MEDIUM;
  },
  
  // Check if feature is enabled
  isFeatureEnabled(feature) {
    try {
      const saved = JSON.parse(localStorage.getItem('features') || '{}');
      return saved[feature] ?? FEATURES[feature] ?? false;
    } catch {
      return FEATURES[feature] ?? false;
    }
  },
};

// ---- Export grouped constants for easier imports ----
export const ALL_CONSTANTS = {
  DRAG,
  SWIPE, 
  UI,
  TIMING,
  STORAGE,
  FEEDBACK,
  KEYS,
  BREAKPOINTS,
  PERFORMANCE,
  ERRORS,
  FEATURES,
  CSS_VARS,
  UTILS,
};