import { canRepairWires } from '../state/procedure.js';
import { textes as t } from '../ui/textes.js';
import { TAU } from './step2-hatch.js';

export const WIRE_DEFS = ['red', 'black', 'yellow', 'red', 'black', 'yellow'].map((color, index) => ({ id: `wire${index + 1}`, index: index + 1, color }));
export const SIDES = ['L', 'R'];
export const WIRE_COLORS = { red: 0xbf3c2d, black: 0x1d2226, yellow: 0xe3b348 };
export const SNAP_DISTANCE = 0.02;
export const finitePoint = point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
const clamp = value => Math.max(0, Math.min(1, value));
export function initialWiringState(random = Math.random) {
  const sample = () => { const n = random(); return Number.isFinite(n) ? Math.max(0, Math.min(1 - Number.EPSILON, n)) : 0.5; };
  const count = sample() < 0.5 ? 1 : 2;
  const choices = WIRE_DEFS.map(w => w.id);
  for (let i = 0; i < count; i++) { const j = i + Math.floor(sample() * (choices.length - i)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { items: WIRE_DEFS.map(def => ({ ...def, broken: choices.slice(0, count).includes(def.id), inspected: false, marked: false,
    terminals: { L: 0, R: 0 }, removed: false, replacement: null, repaired: false })),
    selected: null, terminal: null, gesture: null, gestureId: 0, feedbackId: 0, feedbackCode: null, soundId: 0, soundKind: null };
}
export function cancelWiring(state) { state.wires.gesture = null; state.wires.gestureId++; }
export function reduceWiring(state, event, time, api) {
  const { next, activity, showMessages, message, finishStep } = api;
  const feedback = (s, code, sound = null) => {
    s.wires.feedbackCode = code; s.wires.feedbackId++;
    if (sound) { s.wires.soundId++; s.wires.soundKind = sound; }
    activity(s, time); return s;
  };
  const sync = s => {
    const bad = s.wires.items.filter(w => w.broken);
    const p = s.steps[2].substeps;
    p.inspect = s.wires.items.every(w => w.inspected);
    p.mark = bad.every(w => w.marked); p.remove = bad.every(w => w.removed);
    p.prepare = bad.every(w => w.replacement && SIDES.every(side => w.replacement.stripped[side]));
    p.connect = bad.every(w => w.repaired);
    if (p.connect && !p.inspect) feedback(s, 'inspectAll');
    if (Object.values(p).every(Boolean)) { cancelWiring(s); finishStep(s, time, 'gesture'); }
    return s;
  };
  const error = (s, code) => {
    const entry = { stepId: 'wires', code, nodeName: s.wires.selected, atMs: s.elapsedMs, source: 'gesture' };
    s.errors.push(entry); s.steps[2].errors.push(entry);
    if (s.mode === 'training') showMessages(s, [message(t.errors[code].why, 'error', 'error')]);
    return feedback(s, code, 'slip');
  };
  const oldGesture = state.wires.gesture;
  if (event.type === 'WIRE_CANCEL') {
    if (!oldGesture || event.gestureId !== oldGesture.id) return state;
    const s = next(); cancelWiring(s); return feedback(s, 'cancelled');
  }
  if (typeof event.type !== 'string' || !event.type.startsWith('WIRE_') || !canRepairWires(state)) return state;
  const id = event.wireId ?? state.wires.selected;
  const original = state.wires.items.find(w => w.id === id);
  const side = event.side ?? state.wires.terminal;
  const select = () => { const s = next(); s.wires.selected = id; return [s, s.wires.items.find(w => w.id === id)]; };
  const deny = code => feedback(next(), code);
  const gestureMatches = kind => oldGesture?.kind === kind && event.gestureId === oldGesture.id;
  if (event.type === 'WIRE_CLEAR_SELECTION') {
    const s = next(); cancelWiring(s); s.wires.selected = null; s.wires.terminal = null; return feedback(s, null);
  }
  if (!original) return state;
  if (event.type === 'WIRE_INSPECT') {
    const [s, wire] = select(); cancelWiring(s); s.wires.terminal = null;
    if (!s.headlamp) return feedback(s, 'dark');
    wire.inspected = true; return sync(feedback(s, 'diagnosis'));
  }
  if (!state.headlamp) return deny('dark');
  if (event.type === 'WIRE_MARK') {
    if (!original.inspected) return deny('inspectFirst');
    if (original.marked) return state;
    const [s, wire] = select();
    if (!wire.broken) return error(s, 'intactWire');
    wire.marked = true; return sync(feedback(s, 'marked'));
  }
  if (!original.inspected || !original.marked) return deny('markFirst');
  switch (event.type) {
    case 'WIRE_TERMINAL_SELECT': {
      if (!SIDES.includes(side)) return state;
      const [s] = select(); cancelWiring(s); s.wires.terminal = side; return feedback(s, 'terminalSelected');
    }
    case 'WIRE_TERMINAL_START': {
      if (oldGesture || !SIDES.includes(side)) return state;
      const [s, wire] = select(); s.wires.terminal = side;
      if (s.selectedTool !== 'flat') return s.selectedTool === 'phillips' ? error(s, 'wireDriver') : feedback(s, 'flatTool');
      const action = wire.removed ? 'tighten' : 'loosen';
      if (action === 'tighten' && !wire.replacement?.connected[side]) return feedback(s, 'connectFirst');
      if ((action === 'loosen' && wire.terminals[side] >= 1) || (action === 'tighten' && wire.terminals[side] <= 0)) return feedback(s, 'terminalDone');
      s.wires.gesture = { id: ++s.wires.gestureId, kind: 'terminal', wireId: id, side, action, debt: 0, warned: false };
      return feedback(s, action);
    }
    case 'WIRE_TERMINAL_MOVE': {
      if (!gestureMatches('terminal') || !Number.isFinite(event.radians) || Math.abs(event.radians) > Math.PI / 2 + 1e-8 || !event.radians) return state;
      const s = next(); const g = s.wires.gesture; const wire = s.wires.items.find(w => w.id === g.wireId);
      const sign = g.action === 'loosen' ? 1 : -1; const delta = sign * event.radians;
      if (delta < 0) {
        g.debt += -delta;
        if (!g.warned && g.debt > 0.08) { g.warned = true; feedback(s, g.action === 'loosen' ? 'counterclockwise' : 'clockwise', 'blocked'); }
      } else {
        const usable = Math.max(0, delta - g.debt); g.debt = Math.max(0, g.debt - delta);
        wire.terminals[g.side] = clamp(wire.terminals[g.side] + sign * usable / TAU);
        if (wire.terminals[g.side] < 1e-8) wire.terminals[g.side] = 0;
        if (wire.terminals[g.side] > 1 - 1e-8) wire.terminals[g.side] = 1;
        if (usable) { s.wires.soundId++; s.wires.soundKind = 'screw'; }
        if (wire.terminals[g.side] === (g.action === 'loosen' ? 1 : 0)) {
          s.wires.gesture = null; feedback(s, g.action === 'loosen' ? 'loose' : 'tight');
          wire.repaired = Boolean(wire.replacement && SIDES.every(end => wire.replacement.connected[end] && wire.terminals[end] === 0));
        }
      }
      activity(s, time); return sync(s);
    }
    case 'WIRE_TERMINAL_END': {
      if (!gestureMatches('terminal')) return state;
      const s = next(); cancelWiring(s); return s;
    }
    case 'WIRE_REMOVE_START': {
      if (oldGesture || original.removed) return state;
      if (!SIDES.every(end => original.terminals[end] === 1)) return deny('loosenFirst');
      const [s] = select(); s.wires.gesture = { id: ++s.wires.gestureId, kind: 'remove', wireId: id, progress: 0, position: null };
      return feedback(s, 'pullOut');
    }
    case 'WIRE_REMOVE_MOVE': {
      if (!gestureMatches('remove') || !Number.isFinite(event.progress) || (event.position !== undefined && !finitePoint(event.position))) return state;
      const s = next(); s.wires.gesture.progress = clamp(event.progress); s.wires.gesture.position = event.position ?? null; activity(s, time); return s;
    }
    case 'WIRE_REMOVE_END': {
      if (!gestureMatches('remove')) return state;
      const [s, wire] = select(); const done = s.wires.gesture.progress >= 1; cancelWiring(s);
      if (done) wire.removed = true;
      return sync(feedback(s, done ? 'removed' : 'stillInside', done ? 'switch' : null));
    }
    case 'WIRE_CHOOSE_REPLACEMENT': {
      if (oldGesture || !original.removed || original.replacement) return state;
      const [s, wire] = select();
      if (!Object.hasOwn(WIRE_COLORS, s.selectedTool)) return feedback(s, 'colorTool');
      if (s.selectedTool !== wire.color) return error(s, 'wrongColor');
      wire.replacement = { color: wire.color, stripped: { L: false, R: false }, connected: { L: false, R: false } };
      s.selectedTool = null;
      return feedback(s, 'chosen');
    }
    case 'WIRE_STRIP': {
      if (oldGesture || !SIDES.includes(side) || !original.replacement || original.replacement.connected[side] || original.replacement.stripped[side]) return state;
      const [s, wire] = select();
      if (s.selectedTool !== 'stripper') return feedback(s, 'stripTool');
      wire.replacement.stripped[side] = true; return sync(feedback(s, 'stripped', 'switch'));
    }
    case 'WIRE_END_START': {
      if (oldGesture || !SIDES.includes(side) || !original.replacement || original.replacement.connected[side]) return state;
      if (!SIDES.every(end => original.replacement.stripped[end])) return deny('stripBoth');
      const [s] = select(); s.wires.gesture = { id: ++s.wires.gestureId, kind: 'end', wireId: id, side, position: null, distance: null, snapped: false };
      return feedback(s, 'dragEnd');
    }
    case 'WIRE_END_MOVE': {
      if (!gestureMatches('end') || !Number.isFinite(event.distance) || event.distance < 0 || !finitePoint(event.position)) return state;
      const s = next(); const g = s.wires.gesture; const was = g.snapped;
      g.position = [...event.position]; g.distance = event.distance; g.snapped = event.distance < SNAP_DISTANCE;
      if (g.snapped && !was) feedback(s, 'snapped', 'switch');
      activity(s, time); return s;
    }
    case 'WIRE_END_END': {
      if (!gestureMatches('end')) return state;
      const s = next(); const g = s.wires.gesture; const wire = s.wires.items.find(w => w.id === g.wireId);
      if (g.snapped) wire.replacement.connected[g.side] = true;
      const done = g.snapped; cancelWiring(s); return feedback(s, done ? 'attached' : 'notNear');
    }
    default: return state;
  }
}
