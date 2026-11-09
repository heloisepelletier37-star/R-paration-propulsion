export const SCREWS = ['Screw_TL', 'Screw_TR', 'Screw_BL', 'Screw_BR'];
export const SAFETY_SCREW = 'Screw_Safety';
export const ALL_SCREWS = [...SCREWS, SAFETY_SCREW];
export const TURNS_REQUIRED = 4;
export const TAU = Math.PI * 2;
export const SCREW_TRAVEL = 0.09;
export const HATCH_ANGLE = -110 * Math.PI / 180;
export const HATCH_SETTLE_MS = 320;
export const KEY_TURN_SPEED = TAU; // One full turn per second while Q is held.
export const removed = screw => screw.turns >= TURNS_REQUIRED;
export const removedCount = hatch => SCREWS.filter(id => removed(hatch.screws[id])).length;
export const extraction = turns => Math.max(0, Math.min(1, turns / TURNS_REQUIRED));
export function circularDelta(previous, current) {
  return Math.atan2(Math.sin(current - previous), Math.cos(current - previous));
}
export function pointerAngle(x, y, center, deadZone = 3) {
  const dx = x - center.x; const dy = center.y - y;
  return Math.hypot(dx, dy) < deadZone ? null : Math.atan2(dy, dx);
}
export function keyTurnSlices(milliseconds) {
  const radians = Math.max(0, Math.min(500, milliseconds)) * KEY_TURN_SPEED / 1000;
  if (!radians) return [];
  const count = Math.ceil(radians / (Math.PI / 2));
  return Array(count).fill(radians / count);
}
export const hatchDragProgress = (initial, startX, x, travel) => Math.max(0, Math.min(1, initial + (startX - x) / Math.max(1, travel)));
export function initialHatchState() {
  return { screws: Object.fromEntries(ALL_SCREWS.map(id => [id, { turns: 0, scratched: false }])),
    selectedScrew: null, turning: false, dragging: false, gestureId: 0, reverseDebt: 0, directionWarned: false,
    progress: 0, dragOrigin: 0, settling: false, settleId: 0, settleStartedAt: null, opened: false,
    feedbackId: 0, feedbackCode: null, feedbackScrew: null, soundId: 0, soundKind: null };
}
