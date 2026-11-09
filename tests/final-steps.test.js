import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { transition } from '../src/state/machine.js';
import { canAct, sceneState } from '../src/state/procedure.js';
import { CROSS_ORDER, tightenedCount, storedScrews, closureReady } from '../src/steps/step4-close.js';
import { TEST_DURATION_MS, wiringOperational } from '../src/steps/step5-test.js';
import { coverProgress } from '../src/steps/step1-power.js';
import { SCREWS, SAFETY_SCREW, TAU } from '../src/steps/step2-hatch.js';
import { scoreMission } from '../src/state/report.js';
import { createPlaceholderAssets } from '../src/assets/placeholders.js';
import { firstPowerHit } from '../src/interactions/power.js';
import { createProcedureProjection } from '../src/scene/procedure.js';
import { textes as t } from '../src/ui/textes.js';
import { session, cutPower, openHatch, repairWires, pushHatch, tightenScrew, closeHatch, startTest, finishTest, finishBriefing } from '../test-support/procedure.js';

function closing(mode) {
  const s = session(mode); cutPower(s.machine, s.advance); openHatch(s.machine, s.advance); repairWires(s.machine); return s;
}
function testing(mode) { const s = closing(mode); closeHatch(s.machine, s.advance); return s; }
const turn = (m, radians) => m.dispatch({ type: 'SCREW_TURN_MOVE', gestureId: m.state.hatch.gestureId, radians });

test('closure requires inverse dragging, release and 320 ms settling; partial and cancelled gestures preserve the pose', () => {
  const { machine: m, advance } = closing();
  assert.equal(m.state.stepIndex, 3); assert.equal(m.state.hatch.progress, 1);
  assert.equal(m.dispatch({ type: 'SCREW_TURN_START', screwId: SCREWS[0] }), false);
  m.dispatch({ type: 'HATCH_DRAG_START', edge: false }); let gestureId = m.state.hatch.gestureId;
  assert.equal(m.state.hatch.dragging, true); // Pushing the plate does not require gripping its thin edge.
  m.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId, progress: 0.4 }); m.dispatch({ type: 'HATCH_DRAG_END', gestureId });
  assert.equal(m.state.hatch.progress, 0.4); assert.equal(m.state.hatch.opened, true);
  m.dispatch({ type: 'HATCH_DRAG_START' }); gestureId = m.state.hatch.gestureId;
  m.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId, progress: 0 }); m.dispatch({ type: 'HATCH_DRAG_CANCEL', gestureId });
  assert.equal(m.state.hatch.progress, 0.4); assert.equal(m.dispatch({ type: 'HATCH_CLOSED', settleId: 1 }), false);
  m.dispatch({ type: 'HATCH_DRAG_START' }); gestureId = m.state.hatch.gestureId;
  m.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId, progress: 0 }); m.dispatch({ type: 'HATCH_DRAG_END', gestureId });
  const settleId = m.state.hatch.settleId;
  advance(319); assert.equal(m.dispatch({ type: 'HATCH_CLOSED', settleId }), false);
  advance(1); assert.equal(m.dispatch({ type: 'HATCH_CLOSED', settleId: settleId - 1 }), false);
  m.dispatch({ type: 'HATCH_CLOSED', settleId });
  assert.equal(m.state.hatch.opened, false); assert.equal(m.state.steps[3].substeps.hatch, true);
  assert.equal(m.state.hatch.soundKind, 'hatch'); assert.equal(storedScrews(m.state.hatch), 4);
});

test('four clockwise turns physically seat each screw; an incomplete screw blocks the serrage check', () => {
  const { machine: m, advance } = closing(); pushHatch(m, advance); m.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  m.dispatch({ type: 'SCREW_TURN_START', screwId: CROSS_ORDER[0] });
  assert.equal(storedScrews(m.state.hatch), 3);
  for (let i = 0; i < 15; i++) turn(m, -TAU / 4);
  m.dispatch({ type: 'SCREW_TURN_END', gestureId: m.state.hatch.gestureId });
  assert.equal(m.state.hatch.screws.Screw_TL.turns, 0.25);
  m.dispatch({ type: 'CHECK_CLOSURE' });
  assert.equal(m.state.stepIndex, 3); assert.equal(m.state.power.circuitOn, false);
  assert.equal(m.state.errors.at(-1).code, 'looseScrew'); assert.equal(m.state.errors.at(-1).stepId, 'close');
  assert.equal(m.state.hatch.feedbackCode, 'looseScrew');
  m.dispatch({ type: 'SCREW_TURN_START', screwId: 'Screw_TL' }); turn(m, -TAU / 4);
  CROSS_ORDER.slice(1).forEach(id => tightenScrew(m, id));
  assert.equal(tightenedCount(m.state.hatch), 4); assert.ok(closureReady(m.state.hatch));
  assert.equal(m.state.stepIndex, 3); m.dispatch({ type: 'CHECK_CLOSURE' });
  assert.equal(m.state.stepIndex, 4); assert.equal(m.state.warnings.length, 0);
  assert.ok(Object.values(m.state.steps[3].substeps).every(Boolean));
});

test('incorrect rotation blocks and cannot farm tightening through back-and-forth motion', () => {
  const { machine: m, advance } = closing(); pushHatch(m, advance); m.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  m.dispatch({ type: 'SCREW_TURN_START', screwId: 'Screw_TL' });
  turn(m, TAU / 4); turn(m, -TAU / 4); assert.equal(m.state.hatch.screws.Screw_TL.turns, 4);
  turn(m, -TAU / 4); assert.equal(m.state.hatch.screws.Screw_TL.turns, 3.75);
  assert.equal(m.state.errors.length, 0);
});

test('wrong tools scratch without tightening and the safety screw remains attached during closure', () => {
  const { machine: m, advance } = closing(); pushHatch(m, advance);
  m.dispatch({ type: 'SELECT_TOOL', toolId: null }); m.dispatch({ type: 'SCREW_TURN_START', screwId: 'Screw_TL' });
  assert.equal(m.state.hatch.turning, false); assert.equal(m.state.errors.length, 0);
  m.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' }); m.dispatch({ type: 'SCREW_TURN_START', screwId: 'Screw_TL' });
  assert.equal(m.state.hatch.screws.Screw_TL.scratched, true); assert.equal(m.state.errors.at(-1).stepId, 'close');
  m.dispatch({ type: 'SCREW_TURN_START', screwId: SAFETY_SCREW });
  assert.equal(m.state.errors.at(-1).code, 'safetyScrew'); assert.equal(m.state.hatch.screws[SAFETY_SCREW].turns, 0);
  assert.equal(storedScrews(m.state.hatch), 4);
});

test('a non-cross order warns once without blocking or reducing the score; the hatch straightens at the last screw', () => {
  const { machine: m, advance, now } = closing(); pushHatch(m, advance); m.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  const { root } = createPlaceholderAssets(); const projection = createProcedureProjection(root, { shadowMap: {} });
  tightenScrew(m, 'Screw_TR'); projection.update(m.state, now()); projection.frame(now() + 500);
  assert.equal(m.state.warnings.length, 1); assert.equal(m.state.hatch.crossWarning, true);
  assert.equal(projection.snapshot().crooked, true); assert.equal(m.state.errors.length, 0);
  for (const id of ['Screw_TL', 'Screw_BL', 'Screw_BR']) tightenScrew(m, id);
  projection.update(m.state, now()); projection.frame(now() + 500);
  assert.equal(projection.snapshot().crooked, false); assert.equal(m.state.warnings.length, 1);
  m.dispatch({ type: 'CHECK_CLOSURE' }); finishTest(m, advance);
  assert.equal(m.state.phase, 'debrief'); assert.equal(m.state.report.score.value, 20);
  assert.equal(m.state.report.warnings.length, 1);
});

test('replay and tool changes cancel closure gestures and stale samples cannot tighten or close', () => {
  const { machine: m, advance } = closing(); pushHatch(m, advance); m.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  m.dispatch({ type: 'SCREW_TURN_START', screwId: 'Screw_TL' }); const gestureId = m.state.hatch.gestureId;
  turn(m, -TAU / 4); m.dispatch({ type: 'REPLAY_BRIEFING' });
  assert.equal(m.dispatch({ type: 'SCREW_TURN_MOVE', gestureId, radians: -TAU / 4 }), false);
  finishBriefing(m); assert.equal(m.state.hatch.screws.Screw_TL.turns, 3.75);
  m.dispatch({ type: 'SCREW_TURN_START' }); m.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  assert.equal(m.state.hatch.turning, false);
});

for (const progress of [1, 0.6, 0.3]) test(`restoring at lever position ${progress} does not cross the strict 70% threshold`, () => {
  const { machine: m } = testing(); m.dispatch({ type: 'POWER_DRAG_START' }); const dragId = m.state.power.dragId;
  m.dispatch({ type: 'POWER_DRAG_MOVE', dragId, progress }); m.dispatch({ type: 'POWER_DRAG_END', dragId });
  assert.equal(m.state.power.circuitOn, false); assert.equal(m.state.power.leverProgress, 1);
  assert.equal(m.dispatch({ type: 'CLOSE_POWER_COVER' }), false);
});

test('raising the lever restores the LED; closing the cover takes 400 ms and starts a separate two-second test', () => {
  const { machine: m, advance } = testing();
  m.dispatch({ type: 'POWER_DRAG_START' }); const dragId = m.state.power.dragId;
  m.dispatch({ type: 'POWER_DRAG_MOVE', dragId, progress: 0.29 }); m.dispatch({ type: 'POWER_DRAG_END', dragId });
  assert.equal(m.state.power.circuitOn, true); assert.equal(m.state.power.leverProgress, 0);
  assert.equal(sceneState(m.state).alarmActive, true); assert.equal(m.state.phase, 'running');
  m.dispatch({ type: 'CLOSE_POWER_COVER' }); const coverId = m.state.power.coverId;
  advance(200); assert.equal(coverProgress(m.state.power, m.state.power.coverStartedAt + 200), 0.5);
  assert.equal(m.dispatch({ type: 'POWER_COVER_CLOSED', coverId }), false);
  advance(200); m.dispatch({ type: 'POWER_COVER_CLOSED', coverId });
  assert.equal(m.state.test.status, 'pending'); assert.equal(canAct(m.state), false);
  const testId = m.state.test.id;
  advance(1999); assert.equal(m.dispatch({ type: 'PROPULSION_TEST_FINISHED', testId }), false);
  assert.equal(sceneState(m.state).alarmActive, true);
  advance(1); assert.equal(m.dispatch({ type: 'PROPULSION_TEST_FINISHED', testId: testId - 1 }), false);
  m.dispatch({ type: 'PROPULSION_TEST_FINISHED', testId });
  assert.equal(m.state.phase, 'debrief'); assert.equal(m.state.test.status, 'passed'); assert.equal(sceneState(m.state).alarmActive, false);
  assert.equal(m.state.message.text, t.testControls.success); assert.equal(m.state.test.startupId, 1);
  assert.equal(m.state.report.score.value, 20);
});

test('briefing replay pauses the test timer and the final report keeps a fixed active duration', () => {
  const { machine: m, advance } = testing(); startTest(m, advance); advance(1000);
  m.dispatch({ type: 'REPLAY_BRIEFING' }); const paused = m.state.elapsedMs;
  advance(60000); assert.equal(m.dispatch({ type: 'PROPULSION_TEST_FINISHED', testId: m.state.test.id }), false);
  finishBriefing(m); assert.equal(m.state.elapsedMs, paused);
  advance(999); m.dispatch({ type: 'TICK' }); assert.equal(m.state.phase, 'running');
  advance(1); m.dispatch({ type: 'TICK' }); assert.equal(m.state.phase, 'debrief');
  const report = m.state.report; advance(60000); m.dispatch({ type: 'TOGGLE_RADIO' });
  assert.deepEqual(m.state.report, report); assert.equal(m.state.elapsedMs, report.elapsedMs);
});

for (const defect of ['missing', 'color', 'insulation', 'disconnected', 'loose']) test(`actual ${defect} defect keeps the alarm active and returns to a safe restart of the procedure`, () => {
  const s = testing(); startTest(s.machine, s.advance);
  let prepared = structuredClone(s.machine.state); const w = prepared.wires.items.find(w => w.broken);
  if (defect === 'missing') { w.removed = false; w.replacement = null; }
  if (defect === 'color') w.replacement.color = w.color === 'red' ? 'yellow' : 'red';
  if (defect === 'insulation') w.replacement.stripped.R = false;
  if (defect === 'disconnected') w.replacement.connected.R = false;
  if (defect === 'loose') w.terminals.R = 0.25;
  assert.equal(wiringOperational(prepared.wires), false); // Completed checklist flags do not hide a fault.
  s.advance(TEST_DURATION_MS);
  prepared = transition(prepared, { type: 'PROPULSION_TEST_FINISHED', testId: prepared.test.id }, s.now());
  assert.equal(prepared.stepIndex, 0); assert.equal(prepared.phase, 'running'); assert.equal(prepared.power.circuitOn, true);
  assert.equal(prepared.power.cover, 'closed'); assert.equal(prepared.hatch.opened, false); assert.equal(tightenedCount(prepared.hatch), 4);
  assert.equal(prepared.test.status, 'failed'); assert.equal(prepared.report, null);
  assert.equal(prepared.errors.at(-1).code, 'persistentFault'); assert.equal(prepared.steps[4].errors.length, 1);
  assert.equal(sceneState(prepared).alarmActive, true); assert.equal(prepared.wires.items.find(x => x.id === w.id).repaired, false);
  assert.equal(transition(prepared, { type: 'HATCH_DRAG_START' }, s.now()), prepared);
  assert.equal(transition(prepared, { type: 'SCREW_TURN_START', screwId: 'Screw_TL' }, s.now()), prepared);
  if (defect === 'missing') {
    // Exercise the full recovery with the same pure transitions used by createMachine.
    const m = { get state() { return prepared; }, dispatch(e) { const n = transition(prepared, e, s.now()); const changed = n !== prepared; prepared = n; return changed; } };
    cutPower(m, s.advance); openHatch(m, s.advance); repairWires(m); closeHatch(m, s.advance); finishTest(m, s.advance);
    assert.equal(m.state.phase, 'debrief'); assert.equal(m.state.report.testAttempts.length, 2);
    assert.deepEqual(m.state.report.testAttempts.map(a => a.passed), [false, true]);
    assert.equal(m.state.report.score.value, 19); assert.ok(m.state.messageQueue.some(msg => msg.text.includes(t.errors.persistentFault.rule)));
  }
});

test('contact after restoring power shocks without magically unscrewing or moving the repaired hardware', () => {
  const { machine: m } = testing();
  m.dispatch({ type: 'POWER_DRAG_START' }); const dragId = m.state.power.dragId;
  m.dispatch({ type: 'POWER_DRAG_MOVE', dragId, progress: 0 }); m.dispatch({ type: 'POWER_DRAG_END', dragId });
  const wires = structuredClone(m.state.wires.items);
  m.dispatch({ type: 'TOUCH_HATCH', nodeName: 'Hatch' });
  assert.equal(m.state.stepIndex, 0); assert.equal(m.state.shock.active, true); assert.equal(tightenedCount(m.state.hatch), 4);
  assert.deepEqual(m.state.wires.items.map(w => w.replacement), wires.map(w => w.replacement));
});

test('the JSON report includes score details, per-stage errors, labels, hints, times and only physical validations', () => {
  const { machine: m, advance } = closing(); m.dispatch({ type: 'REQUEST_HINT' }); pushHatch(m, advance);
  m.dispatch({ type: 'CHECK_CLOSURE' }); m.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  CROSS_ORDER.forEach(id => tightenScrew(m, id)); m.dispatch({ type: 'CHECK_CLOSURE' }); finishTest(m, advance);
  const report = JSON.parse(JSON.stringify(m.state.report));
  assert.equal(report.schemaVersion, 1); assert.equal(report.mode, 'training'); assert.equal(report.result, 'success');
  assert.equal(report.score.value, 18.5); assert.equal(report.score.errorPenalty, 1); assert.equal(report.score.hintPenalty, 0.5);
  assert.equal(report.hints.length, 1); assert.equal(report.steps[3].hints[0].level, 1);
  assert.equal(report.steps[3].errors[0].label, t.errors.looseScrew.label); assert.equal(report.errors[0].rule, t.errors.looseScrew.rule);
  assert.ok(report.validations.every(v => v.source === 'gesture')); assert.equal(report.validations.length, 5);
  assert.equal(report.testAttempts[0].finishedAtMs - report.testAttempts[0].startedAtMs, 2000);
  assert.deepEqual(report.crossOrder, CROSS_ORDER);
  assert.throws(() => { m.state.report.score.value = 100; }, TypeError);
});

test('score clamps at zero and safety errors weigh three points; warnings and time do not penalize', () => {
  assert.equal(scoreMission({ errors: [{ code: 'liveCircuit', stepId: 'power' }], hintsUsed: 0 }).value, 17);
  assert.equal(scoreMission({ errors: Array(30).fill({ code: 'looseScrew' }), hintsUsed: 5 }).value, 0);
});

test('restart clears results, warning, test state, physical screws and time, and uses a new random draw', () => {
  const { machine: m, advance } = closing(); closeHatch(m, advance, SCREWS); finishTest(m, advance); m.dispatch({ type: 'RESTART' });
  assert.equal(m.state.report, null); assert.equal(m.state.test.status, 'idle'); assert.deepEqual(m.state.test.attempts, []);
  assert.deepEqual(m.state.warnings, []); assert.equal(m.state.elapsedMs, 0); assert.equal(m.state.hatch.progress, 0);
  assert.ok(m.state.wires.items.every(w => !w.inspected && !w.replacement));
  assert.equal(tightenedCount(m.state.hatch), 4); assert.equal(m.state.power.circuitOn, true);
});

test('the edge target remains on the visible hatch face when closed, partially open or beyond 90 degrees', () => {
  const { machine: m } = closing(); const { root } = createPlaceholderAssets();
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.12), new THREE.MeshStandardMaterial({ transparent: true }));
  label.position.set(0.97, 0.28, 0.083); root.getObjectByName('Hatch').add(label);
  const projection = createProcedureProjection(root, { shadowMap: {} });
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 300); camera.position.set(0, 1.23, 4.25); camera.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  for (const progress of Array.from({ length: 41 }, (_, i) => i / 40)) {
    const prepared = structuredClone(m.state); prepared.hatch.progress = progress;
    projection.update(prepared, 0); projection.frame(500); root.updateWorldMatrix(true, true);
    const target = projection.targetPoint('Hatch_Edge', camera);
    ray.set(camera.position, target.clone().sub(camera.position).normalize());
    const hit = firstPowerHit(ray.intersectObject(root.getObjectByName('Hatch'), true));
    assert.equal(hit?.target.name, 'Hatch', `visible face at ${progress}`);
    assert.equal(projection.isHatchEdge(hit.point), true);
  }
});
