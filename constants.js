// constants.js – single source of truth for gesture/UI tuning
// Import in modules like:
//   import { DRAG, SWIPE, UI } from './constants.js'
// You can override at runtime via localStorage key `app:overrides` or using setOverrides().

// ---- Drag thresholds & smoothing ----
export const DRAG = {
  HOLD_MS: 350,
  JITTER_PX: 8,
  GATE: 0.30,
  FORCE: 0.70,
  // adaptive follower (used by drag.js)
  FOLLOW_MIN: 0.38,   // lower = smoother, higher = tighter
  FOLLOW_MAX: 0.86,   // cap so it doesn't overshoot
  SPEED_GAIN: 0.012,  // velocity influence
  GAP_GAIN:   0.020,  // distance influence
  SNAP_EPS:   0.25,   // sub-pixel snap threshold
};

// ---- Swipe thresholds (industry-standard tuning for 60-120 Hz displays) ----
export const SWIPE = {
  // === Gesture Recognition ===
  HOLD_MS: 600,              // ms - Long press timing (iOS: 500ms, Android: 600-800ms)
  MIN_INTENT_DISTANCE: 40,   // px - Minimum distance to confirm intentional swipe
  VERTICAL_GUARD: 12,        // px - Vertical movement tolerance before canceling
  
  // === Velocity-Based Fling Detection ===
  FLING_VX: 0.8,             // px/ms - Minimum velocity for fling (~800 px/s, iOS standard)
  FLING_MIN: 32,             // px - Minimum distance for fling to qualify
  FLING_EXPIRE: 80,          // ms - Velocity sample freshness window
  
  // === Deliberate Gesture Threshold ===
  DELIBERATE_MIN: 80,        // px - Distance for slow but intentional swipes
  
  // === Animation Timing ===
  SNAP_MS: 150,              // ms - Snap to position animation (smooth but responsive)
  EXEC_MS: 140,              // ms - Execute action animation (slightly faster)
  
  // === Resistance & Feel ===
  RESISTANCE_FACTOR: 0.3,    // Over-pull resistance multiplier
  MAX_OVEREXTEND: 1.3,       // Max overextension as multiplier of action width
};

// ---- UI tokens ----
export const UI = {
  TOPBAR_H: 56,       // px
};

// ---- Gesture Feel Presets ----
// You can quickly switch between different feels by calling setGestureFeel()
export const GESTURE_PRESETS = {
  // Responsive feel - good for power users
  SNAPPY: {
    HOLD_MS: 500,
    FLING_VX: 1.0,
    SNAP_MS: 120,
    EXEC_MS: 100
  },
  
  // Balanced feel - good default
  BALANCED: {
    HOLD_MS: 600,
    FLING_VX: 0.8,
    SNAP_MS: 150,
    EXEC_MS: 140
  },
  
  // Relaxed feel - good for accessibility
  RELAXED: {
    HOLD_MS: 800,
    FLING_VX: 0.6,
    SNAP_MS: 200,
    EXEC_MS: 180
  }
};

// ---- Advanced Tuning Functions -----------------------------------------------

/**
 * Apply a gesture feel preset
 * @param {string} preset - 'SNAPPY', 'BALANCED', or 'RELAXED'
 */
export function setGestureFeel(preset) {
  const settings = GESTURE_PRESETS[preset];
  if (!settings) {
    console.warn(`Unknown gesture preset: ${preset}`);
    return;
  }
  
  setOverrides({ SWIPE: settings });
  console.log(`Applied ${preset} gesture feel`);
}

/**
 * Override constants without touching code
 * Example: setOverrides({ SWIPE: { HOLD_MS: 700, FLING_VX: 0.9 } })
 */
export function setOverrides(next){
  try {
    const cur = JSON.parse(localStorage.getItem('app:overrides') || '{}');
    const merged = { ...cur, ...next };
    localStorage.setItem('app:overrides', JSON.stringify(merged));
    applyOverrides();
    console.log('Gesture constants updated:', next);
  } catch(e) {
    console.warn('Failed to save overrides:', e);
  }
}

/**
 * Reset all overrides to defaults
 */
export function clearOverrides(){
  try { 
    localStorage.removeItem('app:overrides'); 
    applyOverrides(); 
    console.log('Reset gesture constants to defaults');
  } catch(e) {
    console.warn('Failed to clear overrides:', e);
  }
}

/**
 * Get current effective values (including overrides)
 */
export function getCurrentConstants() {
  return { DRAG: {...DRAG}, SWIPE: {...SWIPE}, UI: {...UI} };
}

/**
 * Log current constants for debugging
 */
export function debugConstants() {
  console.group('Current Gesture Constants');
  console.log('SWIPE:', SWIPE);
  console.log('DRAG:', DRAG);
  console.groupEnd();
}

// ---- Internal override system ----
function applyOverrides(){
  try {
    const o = JSON.parse(localStorage.getItem('app:overrides') || '{}');
    if (o.DRAG)  Object.assign(DRAG,  o.DRAG);
    if (o.SWIPE) Object.assign(SWIPE, o.SWIPE);
    if (o.UI)    Object.assign(UI,    o.UI);
  } catch(e) {
    console.warn('Failed to apply overrides:', e);
  }
}

// Apply any saved overrides immediately on import
applyOverrides();

// ---- Development helpers (available globally in DevTools) ----
if (typeof window !== 'undefined') {
  window.gestureTuning = {
    setGestureFeel,
    setOverrides,
    clearOverrides,
    getCurrentConstants,
    debugConstants,
    presets: Object.keys(GESTURE_PRESETS)
  };
}