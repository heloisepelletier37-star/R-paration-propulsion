import test from 'node:test';
import assert from 'node:assert/strict';
import { createMachine, briefingCount, stepStatus } from '../src/state/machine.js';
import { STEPS, TOOLS, canAct, sceneState } from '../src/state/procedure.js';
import { textes as t } from '../src/ui/textes.js';
import { openHatch, repairWires, closeHatch, finishTest } from '../test-support/procedure.js';
const clocks = new WeakMap();

function session(mode = 'training') {
  let time = 0;
  const machine = createMachine({ now: () => time });
  machine.dispatch({ type: 'SCENE_READY' });
  machine.dispatch({ type: 'START', mode, audio: false });
  const advanceTime = ms => { time += ms; };
  clocks.set(machine, advanceTime);
  return { machine, advanceTime };
}
function next(machine) {
  const id = machine.state.message?.id;
  machine.dispatch({ type: 'TYPING_FINISHED', messageId: id });
  machine.dispatch({ type: 'MESSAGE_NEXT', messageId: id });
}
function start(mode = 'training') {
  const result = session(mode);
  while (result.machine.state.phase === 'briefing') next(result.machine);
  return result;
}
function validate(machine) {
  if (machine.state.phase !== 'running') return false;
  if (machine.state.stepIndex === 3) { closeHatch(machine, clocks.get(machine)); return true; }
  if (machine.state.stepIndex === 4) { finishTest(machine, clocks.get(machine)); return true; }
  if (machine.state.stepIndex === 2 && machine.state.phase === 'running') { repairWires(machine); return true; }
  if (machine.state.stepIndex === 1 && machine.state.phase === 'running') { openHatch(machine, clocks.get(machine)); return true; }
  if (machine.state.stepIndex === 0 && machine.state.phase === 'running') {
    machine.dispatch({ type: 'OPEN_POWER_COVER' });
    clocks.get(machine)(400);
    machine.dispatch({ type: 'POWER_COVER_READY', coverId: machine.state.power.coverId });
    machine.dispatch({ type: 'POWER_DRAG_START' });
    const dragId = machine.state.power.dragId;
    machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId, progress: 1 });
    return machine.dispatch({ type: 'POWER_DRAG_END', dragId });
  }
  return machine.dispatch({ type: 'DEBUG_VALIDATE_STEP', stepId: STEPS[machine.state.stepIndex].id });
}

test('loading, welcome and all six briefing messages block tools, lamp, gestures and debug', () => {
  const machine = createMachine();
  const assertLocked = () => {
    const before = machine.state;
    for (const event of [
      { type: 'SELECT_TOOL', toolId: 'phillips' }, { type: 'TOGGLE_LAMP' },
      { type: 'DEBUG_VALIDATE_STEP', stepId: 'power' }, { type: 'VALIDATE_STEP', stepId: 'power' },
      { type: 'COMPLETE_SUBSTEP', stepId: 'power', substepId: 'cover' }, { type: 'REQUEST_HINT' },
      { type: 'RECORD_ERROR', stepId: 'power', code: 'liveCircuit' },
    ]) assert.equal(machine.dispatch(event), false, event.type);
    assert.equal(machine.state, before);
    assert.equal(machine.state.repairLocked, true);
  };
  assertLocked();
  machine.dispatch({ type: 'SCENE_READY' });
  assert.equal(machine.state.phase, 'welcome'); assertLocked();
  machine.dispatch({ type: 'START', mode: 'training' });
  for (let index = 0; index < 6; index++) {
    assert.equal(machine.state.briefingIndex, index); assertLocked();
    assert.equal(machine.state.message.text, t.briefing[index]);
    next(machine);
  }
  assert.equal(canAct(machine.state), true);
  assert.equal(machine.state.message.text, t.steps.power.intro);
});

test('the first Next reveals the current text, a second acknowledges it; stale callbacks cannot skip', () => {
  const { machine } = session();
  const firstId = machine.state.message.id;
  machine.dispatch({ type: 'MESSAGE_NEXT', messageId: firstId });
  assert.equal(machine.state.message.complete, true);
  assert.equal(machine.state.briefingIndex, 0);
  machine.dispatch({ type: 'MESSAGE_NEXT', messageId: firstId });
  assert.equal(machine.state.briefingIndex, 1);
  const current = machine.state;
  assert.equal(machine.dispatch({ type: 'TYPING_FINISHED', messageId: firstId }), false);
  assert.equal(machine.dispatch({ type: 'MESSAGE_NEXT', messageId: firstId }), false);
  assert.equal(machine.state, current);
});

test('evaluation has only message 1, then no hints, step reminders, success feedback or idle prompts', () => {
  const { machine, advanceTime } = session('evaluation');
  assert.equal(briefingCount(machine.state), 1);
  next(machine);
  assert.equal(machine.state.phase, 'running');
  assert.equal(machine.state.message, null);
  assert.equal(machine.dispatch({ type: 'REQUEST_HINT' }), false);
  machine.dispatch({ type: 'RECORD_ERROR', stepId: 'power', code: 'liveCircuit' });
  assert.equal(machine.state.errors.length, 1); assert.equal(machine.state.message, null);
  advanceTime(120000); machine.dispatch({ type: 'TICK' });
  assert.equal(machine.state.message, null); assert.equal(machine.state.hintsUsed, 0);
  validate(machine);
  assert.equal(machine.state.message, null);
  assert.equal(machine.state.steps[0].errors.length, 1);
});

test('stages cannot be skipped, and a stale debug validation never validates the next stage', () => {
  const { machine } = start();
  assert.equal(machine.dispatch({ type: 'DEBUG_VALIDATE_STEP', stepId: 'wires' }), false);
  for (const [index, step] of STEPS.entries()) {
    assert.equal(machine.state.stepIndex, index);
    assert.equal(stepStatus(machine.state, index), 'current');
    validate(machine);
    assert.equal(machine.state.steps[index].completed, true);
    assert.ok(Object.values(machine.state.steps[index].substeps).every(Boolean));
    assert.equal(machine.dispatch({ type: 'DEBUG_VALIDATE_STEP', stepId: step.id }), false);
  }
  assert.equal(machine.state.phase, 'debrief');
  assert.equal(machine.state.repairLocked, true);
  assert.equal(machine.state.validations.length, 5);
  assert.deepEqual(machine.state.validations.map(item => item.source), Array(5).fill('gesture'));
});

test('generic substep and debug events cannot bypass the physical closure or test', () => {
  const { machine } = start();
  validate(machine); validate(machine); validate(machine);
  for (const stepId of ['close', 'test']) {
    for (const type of ['VALIDATE_STEP', 'DEBUG_VALIDATE_STEP', 'COMPLETE_SUBSTEP']) {
      assert.equal(machine.dispatch({ type, stepId, substepId: 'hatch' }), false);
    }
  }
  assert.equal(machine.state.stepIndex, 3);
  validate(machine);
  assert.equal(machine.state.stepIndex, 4);
  assert.equal(machine.state.validations[3].source, 'gesture');
});

test('replaying the briefing locks actions and preserves progress, errors, tools and active time', () => {
  const { machine, advanceTime } = start();
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  machine.dispatch({ type: 'TOGGLE_LAMP' });
  machine.dispatch({ type: 'RECORD_ERROR', stepId: 'power', code: 'liveCircuit' });
  validate(machine);
  const beforeReplay = machine.state.elapsedMs;
  advanceTime(5000); machine.dispatch({ type: 'REPLAY_BRIEFING' });
  assert.equal(machine.state.phase, 'briefing'); assert.equal(machine.state.repairLocked, true);
  assert.equal(machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' }), false);
  assert.equal(validate(machine), false);
  advanceTime(90000);
  while (machine.state.phase === 'briefing') next(machine);
  assert.equal(machine.state.stepIndex, 1); assert.equal(machine.state.steps[0].completed, true);
  assert.equal(machine.state.errors.length, 1); assert.equal(machine.state.selectedTool, 'phillips');
  assert.equal(machine.state.headlamp, true); assert.equal(machine.state.elapsedMs, beforeReplay + 5000);
  advanceTime(2000); machine.dispatch({ type: 'TICK' });
  assert.equal(machine.state.elapsedMs, beforeReplay + 7000);
});

test('hints progress through three levels, count every consultation, and reset per stage', () => {
  const { machine } = start();
  for (let level = 1; level <= 3; level++) {
    machine.dispatch({ type: 'REQUEST_HINT' });
    assert.equal(machine.state.steps[0].hintLevel, level);
    assert.equal(machine.state.message.text, t.steps.power.hints[level - 1]);
    assert.equal(machine.state.message.demo, level === 3 ? 'power' : null);
  }
  machine.dispatch({ type: 'REQUEST_HINT' });
  assert.equal(machine.state.hintsUsed, 4); assert.equal(machine.state.steps[0].hintLevel, 3);
  validate(machine);
  machine.dispatch({ type: 'REQUEST_HINT' });
  assert.equal(machine.state.steps[1].hintLevel, 1); assert.equal(machine.state.hintsUsed, 5);
});

test('30 seconds of inactivity offers help once, without consuming a hint', () => {
  const { machine, advanceTime } = start();
  advanceTime(29999); machine.dispatch({ type: 'TICK' });
  assert.notEqual(machine.state.message.topic, 'idle');
  advanceTime(1); machine.dispatch({ type: 'TICK' });
  assert.equal(machine.state.message.topic, 'idle'); assert.equal(machine.state.hintsUsed, 0);
  const id = machine.state.message.id;
  advanceTime(30000); machine.dispatch({ type: 'TICK' });
  assert.equal(machine.state.message.id, id);
  machine.dispatch({ type: 'ACTIVITY' });
  advanceTime(30000); machine.dispatch({ type: 'TICK' });
  assert.notEqual(machine.state.message.id, id);
});

test('new messages leave the radio collapsed and set an unread flag until it is opened', () => {
  const { machine } = start();
  machine.dispatch({ type: 'TOGGLE_RADIO' });
  machine.dispatch({ type: 'REQUEST_HINT' });
  assert.equal(machine.state.radioCollapsed, true); assert.equal(machine.state.unread, true);
  assert.equal(machine.dispatch({ type: 'MESSAGE_NEXT', messageId: machine.state.message.id }), false);
  machine.dispatch({ type: 'TOGGLE_RADIO' });
  assert.equal(machine.state.unread, false);
});

test('training errors get a constructive explanation and persist after success and in the final debrief', () => {
  const { machine } = start();
  machine.dispatch({ type: 'RECORD_ERROR', stepId: 'power', code: 'liveCircuit' });
  assert.equal(machine.state.message.kind, 'error');
  assert.equal(machine.state.message.text, t.errors.liveCircuit.why);
  validate(machine);
  assert.equal(machine.state.steps[0].errors.length, 1);
  assert.equal(machine.state.message.kind, 'success');
  for (let index = 1; index < 5; index++) validate(machine);
  const debrief = [machine.state.message.text, ...machine.state.messageQueue.map(item => item.text)].join(' ');
  assert.ok(debrief.includes(t.errors.liveCircuit.rule));
  while (machine.state.phase === 'debrief') next(machine);
  assert.equal(machine.state.phase, 'complete');
  assert.equal(machine.state.steps[0].errors.length, 1);
});

test('evaluation reveals recorded errors only when the final debrief starts', () => {
  const { machine } = start('evaluation');
  machine.dispatch({ type: 'RECORD_ERROR', stepId: 'power', code: 'liveCircuit' });
  for (let index = 0; index < 5; index++) validate(machine);
  assert.equal(machine.state.phase, 'debrief');
  assert.ok(machine.state.messageQueue.some(item => item.text.includes(t.errors.liveCircuit.rule)));
});

test('all seven tools can be selected without advancing any substep, and reset clears the session', () => {
  const { machine } = start();
  for (const tool of TOOLS) {
    machine.dispatch({ type: 'SELECT_TOOL', toolId: tool.id });
    assert.equal(machine.state.selectedTool, tool.id);
    assert.ok(Object.values(machine.state.steps[0].substeps).every(value => !value));
  }
  assert.equal(machine.dispatch({ type: 'SELECT_TOOL', toolId: 'unknown' }), false);
  for (let index = 0; index < 5; index++) validate(machine);
  machine.dispatch({ type: 'RESTART' });
  assert.equal(machine.state.phase, 'welcome'); assert.equal(machine.state.hasBegun, false);
  assert.equal(machine.state.errors.length, 0); assert.equal(machine.state.hintsUsed, 0);
  assert.equal(machine.state.selectedTool, null); assert.equal(machine.state.elapsedMs, 0);
  assert.ok(machine.state.steps.every(step => !step.completed));
});

test('scene projection follows the validated steps, including power and hatch state', () => {
  const { machine } = start();
  assert.deepEqual(sceneState(machine.state), { circuitOn: true, hatchOpen: false, alarmActive: true });
  validate(machine); validate(machine);
  assert.deepEqual(sceneState(machine.state), { circuitOn: false, hatchOpen: true, alarmActive: true });
  validate(machine); validate(machine); validate(machine);
  assert.deepEqual(sceneState(machine.state), { circuitOn: true, hatchOpen: false, alarmActive: false });
});

test('snapshots are immutable and invalid messages do not notify subscribers', () => {
  const { machine } = start();
  assert.throws(() => { machine.state.steps[0].completed = true; }, TypeError);
  let notifications = 0;
  machine.subscribe(() => notifications++);
  machine.dispatch({ type: 'UNKNOWN' });
  assert.equal(notifications, 1);
});
