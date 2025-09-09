// constants.js — single source of truth for gesture/UI tuning
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

// ---- Swipe thresholds (tuned for 60–120 Hz) ----
export const SWIPE = {
  FLING_VX: 0.95,     // px/ms (~950 px/s)
  FLING_MIN: 34,      // px min travel to qualify as fling
  FLING_EXPIRE: 60,   // ms freshness window for velocity sample
  SNAP_MS: 120,       // ms snap animation
  EXEC_MS: 120,       // ms execute animation
  VERTICAL_GUARD: 8,  // px vertical before we cancel for scrolling
};

// ---- UI tokens (optional) ----
export const UI = {
  TOPBAR_H: 56,       // px
};

// ---- Overrides (optional) -----------------------------------------------
// Provide a single place to tweak constants without touching code.
// Example in DevTools: setOverrides({ DRAG: { FOLLOW_MIN: 0.45 } })
export function setOverrides(next){
  try {
    const cur = JSON.parse(localStorage.getItem('app:overrides') || '{}');
    const merged = { ...cur, ...next };
    localStorage.setItem('app:overrides', JSON.stringify(merged));
    applyOverrides();
  } catch {}
}

export function clearOverrides(){
  try { localStorage.removeItem('app:overrides'); applyOverrides(); } catch {}
}

function applyOverrides(){
  try {
    const o = JSON.parse(localStorage.getItem('app:overrides') || '{}');
    if (o.DRAG)  Object.assign(DRAG,  o.DRAG);
    if (o.SWIPE) Object.assign(SWIPE, o.SWIPE);
    if (o.UI)    Object.assign(UI,    o.UI);
  } catch {}
}

// Apply any saved overrides immediately on import
applyOverrides();
