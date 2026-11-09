export const COVER_DURATION_MS = 400;
export const LEVER_THRESHOLD = 0.7;
export const LEVER_RETURN_MS = 180;
export const SHOCK_DURATION_MS = 800;
export const COVER_ANGLE = -Math.PI * 0.65;
export const LEVER_ANGLE = Math.PI * 5 / 6;
export const HATCH_TARGETS = ['Hatch', 'Screw_TL', 'Screw_TR', 'Screw_BL', 'Screw_BR', 'Screw_Safety'];
export const isScrewdriver = toolId => ['phillips', 'flat'].includes(toolId);
export const clampProgress = value => Math.min(1, Math.max(0, value));
export const passesThreshold = value => Number.isFinite(value) && value > LEVER_THRESHOLD;
export const dragProgress = (initial, startY, currentY, travel) => clampProgress(initial + (currentY - startY) / Math.max(1, travel));
export const smoothProgress = value => { const p = clampProgress(value); return p * p * (3 - 2 * p); };
export const coverProgress = (power, now) => power.cover === 'closed' ? 0 : power.cover === 'open' ? 1 : power.cover === 'closing' ? 1 - clampProgress((now - power.coverStartedAt) / COVER_DURATION_MS) : clampProgress((now - power.coverStartedAt) / COVER_DURATION_MS);

export function initialPowerState() {
  return { circuitOn: true, cover: 'closed', coverId: 0, coverStartedAt: null,
    leverProgress: 0, dragging: false, dragId: 0, lastRelease: null, releaseId: 0 };
}
