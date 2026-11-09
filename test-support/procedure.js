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
