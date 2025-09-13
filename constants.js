// constants.js – single source of truth for gesture/UI tuning
// Import in modules like:
//   import { DRAG, SWIPE, UI } from './constants.js'

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

// ---- Animation & timing constants ----
export const ANIM = {
  DURATION_FAST: 140,
  DURATION_NORMAL: 200,
  DURATION_SLOW: 300,
  EASING: 'ease-out',
  REDUCED_MOTION_DURATION: 80,
};

// ---- Keyboard shortcuts ----
export const KEYS = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  N: 'n',
  S: 's',
};