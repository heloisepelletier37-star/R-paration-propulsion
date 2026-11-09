import { createMachine } from '../src/state/machine.js';
import { SCREWS, TAU, HATCH_SETTLE_MS } from '../src/steps/step2-hatch.js';

export function finishBriefing(machine) {
  while (machine.state.phase === 'briefing') {
    const messageId = machine.state.message.id;
    machine.dispatch({ type: 'TYPING_FINISHED', messageId }); machine.dispatch({ type: 'MESSAGE_NEXT', messageId });
  }
}
export function session(mode = 'training') {
  let time = 0;
  const advance = ms => { time += ms; };
  const machine = createMachine({ now: () => time });
  machine.dispatch({ type: 'SCENE_READY' }); machine.dispatch({ type: 'START', mode }); finishBriefing(machine);
  return { machine, advance, now: () => time };
}
export function cutPower(machine, advance) {
  machine.dispatch({ type: 'OPEN_POWER_COVER' }); advance(400);
  machine.dispatch({ type: 'POWER_COVER_READY', coverId: machine.state.power.coverId });
  machine.dispatch({ type: 'POWER_DRAG_START' }); const dragId = machine.state.power.dragId;
  machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId, progress: 1 }); machine.dispatch({ type: 'POWER_DRAG_END', dragId });
}
export function removeScrew(machine, screwId) {
  machine.dispatch({ type: 'SCREW_TURN_START', screwId }); const gestureId = machine.state.hatch.gestureId;
  for (let i = 0; i < 16; i++) machine.dispatch({ type: 'SCREW_TURN_MOVE', gestureId, radians: TAU / 4 });
}
export function openHatch(machine, advance) {
  if (machine.state.selectedTool !== 'phillips') machine.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  SCREWS.forEach(id => removeScrew(machine, id));
  machine.dispatch({ type: 'HATCH_DRAG_START' }); const gestureId = machine.state.hatch.gestureId;
  machine.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId, progress: 1 }); machine.dispatch({ type: 'HATCH_DRAG_END', gestureId });
  advance(HATCH_SETTLE_MS); machine.dispatch({ type: 'HATCH_OPENED', settleId: machine.state.hatch.settleId });
}
export function turnTerminal(machine, wireId, side) {
  machine.dispatch({ type: 'WIRE_TERMINAL_START', wireId, side });
  const g = machine.state.wires.gesture;
  if (!g) return;
  for (let i = 0; i < 4; i++) machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId: g.id, radians: (g.action === 'loosen' ? 1 : -1) * TAU / 4 });
}
export function repairWires(machine) {
  if (!machine.state.headlamp) machine.dispatch({ type: 'TOGGLE_LAMP' });
  for (const wire of machine.state.wires.items) machine.dispatch({ type: 'WIRE_INSPECT', wireId: wire.id });
  for (const wire of machine.state.wires.items.filter(item => item.broken && !item.repaired)) {
    const wireId = wire.id;
    machine.dispatch({ type: 'WIRE_INSPECT', wireId }); machine.dispatch({ type: 'WIRE_MARK', wireId });
    machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
    for (const side of ['L', 'R']) turnTerminal(machine, wireId, side);
    machine.dispatch({ type: 'WIRE_REMOVE_START', wireId }); let gestureId = machine.state.wires.gesture?.id;
    machine.dispatch({ type: 'WIRE_REMOVE_MOVE', gestureId, progress: 1 }); machine.dispatch({ type: 'WIRE_REMOVE_END', gestureId });
    machine.dispatch({ type: 'SELECT_TOOL', toolId: wire.color }); machine.dispatch({ type: 'WIRE_CHOOSE_REPLACEMENT', wireId });
    machine.dispatch({ type: 'SELECT_TOOL', toolId: 'stripper' });
    for (const side of ['L', 'R']) machine.dispatch({ type: 'WIRE_STRIP', wireId, side });
    for (const side of ['L', 'R']) {
      machine.dispatch({ type: 'WIRE_END_START', wireId, side }); gestureId = machine.state.wires.gesture?.id;
      machine.dispatch({ type: 'WIRE_END_MOVE', gestureId, position: [0, 0, 0], distance: 0.01 }); machine.dispatch({ type: 'WIRE_END_END', gestureId });
    }
    machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
    for (const side of ['L', 'R']) turnTerminal(machine, wireId, side);
  }
}
