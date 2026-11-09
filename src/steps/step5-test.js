import { SIDES } from './step3-wires.js';
import { closureReady } from './step4-close.js';

export const TEST_DURATION_MS = 2000;
export const STARTUP_DURATION_MS = 2200;
export const initialTestState = () => ({ status: 'idle', id: 0, startedAtMs: null, finishedAtMs: null,
  attempts: [], startupId: 0, startupAt: null });
// Inspect the actual electrical connections, independently of checklist/diagnostic flags.
export const wireOperational = w => {
  if (!w.broken) return !w.removed && !w.replacement && SIDES.every(side => w.terminals[side] === 0);
  const r = w.replacement;
  return w.removed && r?.color === w.color && SIDES.every(side => r.stripped[side] && r.connected[side] && w.terminals[side] === 0);
};
export const wiringOperational = wires => wires.items.length === 6 && wires.items.every(wireOperational);
export const propulsionOperational = state => closureReady(state.hatch) && wiringOperational(state.wires);
