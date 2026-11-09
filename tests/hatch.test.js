import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMachine } from '../src/state/machine.js';
import { canOpenHatch } from '../src/state/procedure.js';
import { createPlaceholderAssets } from '../src/assets/placeholders.js';
import { createProcedureProjection } from '../src/scene/procedure.js';
import { SCREWS, ALL_SCREWS, SAFETY_SCREW, TAU, SCREW_TRAVEL, HATCH_SETTLE_MS, HATCH_ANGLE, removedCount, extraction, circularDelta, pointerAngle, hatchDragProgress } from '../src/steps/step2-hatch.js';
import { textes } from '../src/ui/textes.js';
import { session, cutPower, removeScrew, openHatch, finishBriefing } from '../test-support/procedure.js';

function ready(mode) {
  const s = session(mode); cutPower(s.machine, s.advance);
  s.machine.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' }); return s;
}
function turn(machine, radians = Math.PI / 2) {
  return machine.dispatch({ type: 'SCREW_TURN_MOVE', gestureId: machine.state.hatch.gestureId, radians });
}
function freeHatch(s) { SCREWS.forEach(id => removeScrew(s.machine, id)); }

test('briefing, live power, wrong stages and generic validation cannot bypass the real opening', () => {
  const machine = createMachine();
  const events = [{ type: 'SCREW_TURN_START', screwId: SCREWS[0] }, { type: 'SELECT_SCREW', screwId: SCREWS[0] },
    { type: 'HATCH_DRAG_START' }, { type: 'HATCH_OPENED', settleId: 0 },
    { type: 'COMPLETE_SUBSTEP', stepId: 'open', substepId: 'screws' }, { type: 'DEBUG_VALIDATE_STEP', stepId: 'open' }, { type: 'VALIDATE_STEP', stepId: 'open' }];
  for (const event of events) assert.equal(machine.dispatch(event), false);
  const s = session();
  for (const event of events) assert.equal(s.machine.dispatch(event), false);
  cutPower(s.machine, s.advance);
  for (const event of events.slice(4)) assert.equal(s.machine.dispatch(event), false);
  assert.equal(removedCount(s.machine.state.hatch), 0);
});

test('each full counterclockwise turn extracts one quarter; only four full turns collect a screw', () => {
  const { machine } = ready();
  machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] });
  for (let i = 1; i <= 16; i++) {
    assert.equal(turn(machine), true);
    assert.equal(machine.state.hatch.screws.Screw_TL.turns, i / 4);
    assert.equal(extraction(machine.state.hatch.screws.Screw_TL.turns), i / 16);
    assert.equal(removedCount(machine.state.hatch), i === 16 ? 1 : 0);
  }
  assert.equal(machine.state.hatch.turning, false);
  assert.equal(machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] }), false);
  assert.equal(machine.state.stepIndex, 1);
});

test('clockwise rotation blocks without moving the screw and reversing the same arc cannot farm turns', () => {
  const { machine } = ready(); machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] });
  turn(machine, -Math.PI / 2); const soundId = machine.state.hatch.soundId;
  assert.equal(machine.state.hatch.feedbackCode, 'clockwise');
  assert.equal(machine.state.message.text, textes.hatchControls.clockwise);
  turn(machine, -Math.PI / 2); assert.equal(machine.state.hatch.soundId, soundId);
  turn(machine); turn(machine);
  assert.equal(machine.state.hatch.screws.Screw_TL.turns, 0);
  turn(machine); assert.equal(machine.state.hatch.screws.Screw_TL.turns, 0.25);
  assert.equal(machine.state.errors.length, 0);
});

test('wrong screwdriver slips, scratches the head, records one error per attempt and never removes a screw', () => {
  const { machine } = ready(); machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] });
  for (let i = 0; i < 50; i++) assert.equal(turn(machine), false);
  assert.equal(machine.state.hatch.screws.Screw_TL.turns, 0);
  assert.equal(machine.state.hatch.screws.Screw_TL.scratched, true);
  assert.equal(machine.state.errors.length, 1); assert.equal(machine.state.errors[0].code, 'wrongDriver');
  assert.equal(machine.state.errors[0].nodeName, 'Screw_TL'); assert.equal(machine.state.hatch.soundKind, 'slip');
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' }); removeScrew(machine, SCREWS[0]);
  assert.equal(removedCount(machine.state.hatch), 1); assert.equal(machine.state.steps[1].errors.length, 1);
});

test('the central safety screw always stays attached with either screwdriver and is never counted', () => {
  const { machine } = ready();
  for (const toolId of ['phillips', 'flat']) {
    if (machine.state.selectedTool !== toolId) machine.dispatch({ type: 'SELECT_TOOL', toolId });
    machine.dispatch({ type: 'SCREW_TURN_START', screwId: SAFETY_SCREW });
    assert.equal(turn(machine), false);
    assert.equal(machine.state.hatch.screws[SAFETY_SCREW].turns, 0);
    assert.equal(removedCount(machine.state.hatch), 0);
  }
  assert.deepEqual(machine.state.errors.map(e => e.code), ['safetyScrew', 'safetyScrew']);
});

test('bare hands and non-screwdriver tools cannot advance or scratch a screw', () => {
  const { machine } = ready();
  for (const toolId of [null, 'stripper', 'red', 'lamp']) {
    machine.dispatch({ type: 'SELECT_TOOL', toolId });
    machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] });
    assert.equal(machine.state.hatch.turning, false); assert.equal(machine.state.hatch.feedbackCode, 'toolRequired');
  }
  assert.equal(machine.state.errors.length, 0); assert.equal(machine.state.hatch.screws.Screw_TL.scratched, false);
});

test('invalid and stale samples, tool changes and replay do not advance the gesture', () => {
  const { machine } = ready(); machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] });
  const gestureId = machine.state.hatch.gestureId;
  for (const radians of [NaN, Infinity, '1', TAU, -TAU]) assert.equal(turn(machine, radians), false);
  turn(machine); machine.dispatch({ type: 'REPLAY_BRIEFING' });
  assert.equal(turn(machine), false); finishBriefing(machine);
  assert.equal(machine.state.hatch.screws.Screw_TL.turns, 0.25);
  machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] });
  assert.equal(machine.dispatch({ type: 'SCREW_TURN_MOVE', gestureId, radians: 1 }), false);
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' }); assert.equal(turn(machine), false);
  assert.equal(machine.state.hatch.screws.Screw_TL.turns, 0.25);
});

test('the hatch stays locked until all four corner screws are removed', () => {
  const s = ready(); const { machine } = s;
  SCREWS.slice(0, 3).forEach(id => removeScrew(machine, id));
  machine.dispatch({ type: 'HATCH_DRAG_START' });
  assert.equal(machine.state.hatch.dragging, false); assert.equal(machine.state.hatch.feedbackCode, 'fastened');
  assert.equal(machine.state.hatch.progress, 0);
  removeScrew(machine, SCREWS[3]);
  assert.deepEqual(machine.state.steps[1].substeps, { driver: true, screws: true, hatch: false });
  machine.dispatch({ type: 'HATCH_DRAG_START', edge: false });
  assert.equal(machine.state.hatch.dragging, false); assert.equal(machine.state.hatch.feedbackCode, 'edge');
  assert.equal(machine.state.stepIndex, 1);
});

test('partial pulls stay partial, cancellation restores the previous pose and cannot complete stage 2', () => {
  const s = ready(); const { machine } = s; freeHatch(s);
  machine.dispatch({ type: 'HATCH_DRAG_START' }); let gestureId = machine.state.hatch.gestureId;
  machine.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId, progress: 0.4 }); machine.dispatch({ type: 'HATCH_DRAG_END', gestureId });
  assert.equal(machine.state.hatch.progress, 0.4); assert.equal(machine.state.hatch.settling, false);
  machine.dispatch({ type: 'HATCH_DRAG_START' }); gestureId = machine.state.hatch.gestureId;
  machine.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId, progress: 1 }); machine.dispatch({ type: 'HATCH_DRAG_CANCEL', gestureId });
  assert.equal(machine.state.hatch.progress, 0.4); assert.equal(machine.state.stepIndex, 1);
  assert.equal(machine.dispatch({ type: 'HATCH_DRAG_END', gestureId }), false);
});

test('opening to 110 degrees requires release and settling before automatically validating stage 2', () => {
  const s = ready(); const { machine } = s; freeHatch(s);
  machine.dispatch({ type: 'HATCH_DRAG_START' }); const gestureId = machine.state.hatch.gestureId;
  machine.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId, progress: 1 });
  assert.equal(machine.state.stepIndex, 1); assert.equal(machine.state.hatch.opened, false);
  machine.dispatch({ type: 'HATCH_DRAG_END', gestureId }); const settleId = machine.state.hatch.settleId;
  s.advance(HATCH_SETTLE_MS - 1); assert.equal(machine.dispatch({ type: 'HATCH_OPENED', settleId }), false);
  s.advance(1); assert.equal(machine.dispatch({ type: 'HATCH_OPENED', settleId: settleId - 1 }), false);
  machine.dispatch({ type: 'HATCH_OPENED', settleId });
  assert.equal(machine.state.stepIndex, 2); assert.equal(machine.state.hatch.opened, true);
  assert.deepEqual(machine.state.validations.map(v => v.source), ['gesture', 'gesture']);
  assert.equal(canOpenHatch(machine.state), false);
});

test('evaluation retains errors without corrective coaching, then explains them in the final debrief', () => {
  const s = ready('evaluation'); const { machine } = s;
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] });
  machine.dispatch({ type: 'SCREW_TURN_START', screwId: SAFETY_SCREW });
  assert.equal(machine.state.message, null); assert.equal(machine.state.errors.length, 2);
  openHatch(machine, s.advance);
  for (const stepId of ['wires', 'close', 'test']) machine.dispatch({ type: 'DEBUG_VALIDATE_STEP', stepId });
  const transcript = machine.state.messageQueue.map(m => m.text).join(' ');
  assert.ok(transcript.includes(textes.errors.safetyScrew.rule)); assert.ok(transcript.includes(textes.errors.wrongDriver.rule));
  machine.dispatch({ type: 'RESTART' });
  assert.equal(removedCount(machine.state.hatch), 0); assert.equal(machine.state.hatch.progress, 0);
  assert.ok(ALL_SCREWS.every(id => !machine.state.hatch.screws[id].scratched));
});

test('3D screws rotate around local Z, extract in quarters, disappear when collected and keep the safety screw', () => {
  const s = ready(); const { machine } = s; const { root } = createPlaceholderAssets();
  const projection = createProcedureProjection(root, { shadowMap: {} });
  const screw = root.getObjectByName(SCREWS[0]); const base = screw.position.clone();
  machine.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] }); turn(machine);
  projection.update(machine.state, s.now());
  assert.ok(Math.abs(screw.rotation.z - Math.PI / 2) < 1e-8);
  assert.ok(Math.abs(screw.position.z - base.z - SCREW_TRAVEL / 16) < 1e-8);
  for (let i = 0; i < 3; i++) turn(machine);
  projection.update(machine.state, s.now()); assert.ok(Math.abs(screw.position.z - base.z - SCREW_TRAVEL / 4) < 1e-8);
  for (let i = 0; i < 12; i++) turn(machine);
  projection.update(machine.state, s.now()); assert.equal(screw.visible, false);
  assert.equal(root.getObjectByName(SAFETY_SCREW).visible, true);
  assert.equal(root.getObjectsByProperty('name', SCREWS[0]).length, 1);
});

test('the real hinge follows a partial drag with inertia and ends at 110 degrees', () => {
  const s = ready(); const { root } = createPlaceholderAssets();
  const projection = createProcedureProjection(root, { shadowMap: {} });
  projection.update(s.machine.state, s.now());
  openHatch(s.machine, s.advance); projection.update(s.machine.state, s.now());
  projection.frame(s.now() + HATCH_SETTLE_MS / 2);
  assert.ok(Math.abs(root.getObjectByName('Hatch_Hinge').rotation.y - HATCH_ANGLE / 2) < 1e-8);
  projection.frame(s.now() + HATCH_SETTLE_MS);
  assert.ok(root.getObjectByName('Hatch_Hinge').quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), HATCH_ANGLE)) < 1e-7);
});

test('circle tracking handles wraparound, the central dead zone and horizontal pulling', () => {
  assert.ok(Math.abs(circularDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-8);
  assert.ok(Math.abs(circularDelta(-Math.PI + 0.1, Math.PI - 0.1) + 0.2) < 1e-8);
  assert.equal(pointerAngle(100, 100, { x: 100, y: 100 }), null);
  assert.equal(pointerAngle(130, 100, { x: 100, y: 100 }), 0);
  assert.equal(pointerAngle(100, 70, { x: 100, y: 100 }), Math.PI / 2);
  assert.equal(hatchDragProgress(0, 300, 250, 100), 0.5);
  assert.equal(hatchDragProgress(0, 300, 500, 100), 0);
});
