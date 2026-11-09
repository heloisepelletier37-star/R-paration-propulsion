import test from 'node:test';
import { openHatch, repairWires } from '../test-support/procedure.js';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMachine } from '../src/state/machine.js';
import { canAct, sceneState } from '../src/state/procedure.js';
import { createPlaceholderAssets } from '../src/assets/placeholders.js';
import { createProcedureProjection } from '../src/scene/procedure.js';
import { createElectricShock, shockStrength } from '../src/scene/electric-shock.js';
import { semanticTarget, firstPowerHit } from '../src/interactions/power.js';
import { COVER_DURATION_MS, COVER_ANGLE, SHOCK_DURATION_MS, dragProgress, passesThreshold } from '../src/steps/step1-power.js';
import { textes } from '../src/ui/textes.js';

function ready(mode = 'training') {
  let time = 1000;
  const machine = createMachine({ now: () => time });
  machine.dispatch({ type: 'SCENE_READY' }); machine.dispatch({ type: 'START', mode });
  while (machine.state.phase === 'briefing') {
    const messageId = machine.state.message.id;
    machine.dispatch({ type: 'TYPING_FINISHED', messageId }); machine.dispatch({ type: 'MESSAGE_NEXT', messageId });
  }
  return { machine, now: () => time, advance(ms) { time += ms; } };
}
function openCover(session) {
  const { machine } = session;
  machine.dispatch({ type: 'OPEN_POWER_COVER' }); session.advance(COVER_DURATION_MS);
  machine.dispatch({ type: 'POWER_COVER_READY', coverId: machine.state.power.coverId });
}
function drag(machine, progress) {
  machine.dispatch({ type: 'POWER_DRAG_START' });
  const dragId = machine.state.power.dragId;
  machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId, progress });
  machine.dispatch({ type: 'POWER_DRAG_END', dragId });
}

test('all power gestures are rejected before the briefing and power cannot be validated by debug', () => {
  const machine = createMachine();
  for (const event of [{ type: 'OPEN_POWER_COVER' }, { type: 'POWER_DRAG_START' }, { type: 'TOUCH_HATCH', nodeName: 'Hatch' }]) {
    assert.equal(machine.dispatch(event), false);
  }
  const s = ready();
  for (const type of ['DEBUG_VALIDATE_STEP', 'VALIDATE_STEP', 'COMPLETE_SUBSTEP']) {
    assert.equal(s.machine.dispatch({ type, stepId: 'power', substepId: 'breaker' }), false);
  }
});

test('the cover takes 400 ms to open, blocks the lever, and ignores stale completion callbacks', () => {
  const s = ready(); const { machine } = s;
  assert.equal(machine.dispatch({ type: 'POWER_DRAG_START' }), false);
  machine.dispatch({ type: 'OPEN_POWER_COVER' }); const coverId = machine.state.power.coverId;
  assert.equal(machine.state.power.cover, 'opening');
  s.advance(399);
  assert.equal(machine.dispatch({ type: 'POWER_COVER_READY', coverId }), false);
  assert.equal(machine.dispatch({ type: 'POWER_DRAG_START' }), false);
  s.advance(1);
  assert.equal(machine.dispatch({ type: 'POWER_COVER_READY', coverId: coverId - 1 }), false);
  machine.dispatch({ type: 'POWER_COVER_READY', coverId });
  assert.equal(machine.state.power.cover, 'open'); assert.equal(machine.state.steps[0].substeps.cover, true);
  assert.equal(machine.state.steps[0].substeps.breaker, false);
});

for (const progress of [0, 0.3, 0.69, 0.7]) test(`a release at ${progress * 100}% springs back without validating or adding an error`, () => {
  const s = ready(); openCover(s); drag(s.machine, progress);
  assert.equal(s.machine.state.power.circuitOn, true);
  assert.equal(s.machine.state.power.leverProgress, 0);
  assert.equal(s.machine.state.power.lastRelease, 'short');
  assert.equal(s.machine.state.stepIndex, 0); assert.equal(s.machine.state.errors.length, 0);
});

test('only releasing beyond 70% cuts power and automatically validates stage 1', () => {
  const s = ready(); openCover(s); const { machine } = s;
  machine.dispatch({ type: 'POWER_DRAG_START' }); const dragId = machine.state.power.dragId;
  machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId, progress: 0.700001 });
  assert.equal(machine.state.power.circuitOn, true);
  machine.dispatch({ type: 'POWER_DRAG_END', dragId });
  assert.equal(machine.state.power.circuitOn, false); assert.equal(machine.state.stepIndex, 1);
  assert.deepEqual(machine.state.steps[0].substeps, { cover: true, breaker: true });
  assert.equal(machine.state.validations[0].source, 'gesture');
  assert.deepEqual(sceneState(machine.state), { circuitOn: false, hatchOpen: false, alarmActive: true });
  assert.equal(machine.dispatch({ type: 'POWER_DRAG_END', dragId }), false);
});

test('invalid samples, cancellation and a replay never commit a drag', () => {
  const s = ready(); openCover(s); const { machine } = s;
  machine.dispatch({ type: 'POWER_DRAG_START' }); const first = machine.state.power.dragId;
  for (const progress of [NaN, Infinity, '1']) assert.equal(machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId: first, progress }), false);
  machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId: first, progress: 1 });
  machine.dispatch({ type: 'POWER_DRAG_CANCEL', dragId: first });
  assert.equal(machine.state.power.circuitOn, true); assert.equal(machine.state.power.leverProgress, 0);
  machine.dispatch({ type: 'POWER_DRAG_START' });
  assert.equal(machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId: first, progress: 1 }), false);
  machine.dispatch({ type: 'REPLAY_BRIEFING' });
  assert.equal(machine.state.power.dragging, false); assert.equal(machine.state.power.leverProgress, 0);
  assert.equal(machine.dispatch({ type: 'POWER_DRAG_END', dragId: machine.state.power.dragId }), false);
});

test('a screwdriver touching a live hatch shocks once, records the error, and returns to stage 1', () => {
  const s = ready(); const { machine } = s;
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' });
  machine.dispatch({ type: 'TOUCH_HATCH', nodeName: 'Screw_TL', point: [1, 2, 3] });
  assert.equal(machine.state.shock.active, true); assert.equal(canAct(machine.state), false);
  assert.equal(machine.state.shock.id, 1); assert.deepEqual(machine.state.shock.point, [1, 2, 3]);
  assert.equal(machine.state.stepIndex, 0); assert.equal(machine.state.power.circuitOn, true);
  assert.equal(machine.state.errors.length, 1); assert.equal(machine.state.steps[0].errors[0].code, 'liveCircuit');
  assert.equal(machine.state.message.text, textes.errors.liveCircuit.why);
  assert.equal(machine.dispatch({ type: 'TOUCH_HATCH', nodeName: 'Hatch' }), false);
  assert.equal(machine.dispatch({ type: 'OPEN_POWER_COVER' }), false);
  s.advance(SHOCK_DURATION_MS - 1);
  assert.equal(machine.dispatch({ type: 'SHOCK_FINISHED', shockId: 1 }), false);
  s.advance(1); machine.dispatch({ type: 'SHOCK_FINISHED', shockId: 1 });
  assert.equal(canAct(machine.state), true);
  machine.dispatch({ type: 'TOUCH_HATCH', nodeName: 'Hatch' });
  assert.equal(machine.state.errors.length, 2);
});

test('bare hands, other tools, unrelated nodes and an unpowered hatch never cause a shock', () => {
  const s = ready(); const { machine } = s;
  for (const toolId of [null, 'stripper', 'red', 'lamp']) {
    machine.dispatch({ type: 'SELECT_TOOL', toolId });
    assert.equal(machine.dispatch({ type: 'TOUCH_HATCH', nodeName: 'Hatch' }), false);
  }
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  assert.equal(machine.dispatch({ type: 'TOUCH_HATCH', nodeName: 'PowerBox' }), false);
  openCover(s); drag(machine, 0.9);
  assert.equal(machine.dispatch({ type: 'TOUCH_HATCH', nodeName: 'Hatch' }), false);
  assert.equal(machine.state.errors.length, 0); assert.equal(machine.state.shock.id, 0);
});

test('evaluation records the discharge without adding intermediate coaching', () => {
  const s = ready('evaluation'); const { machine } = s;
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  machine.dispatch({ type: 'TOUCH_HATCH', nodeName: 'Hatch' });
  assert.equal(machine.state.message, null); assert.equal(machine.state.shock.active, true);
  assert.equal(machine.state.errors.length, 1);
  s.advance(SHOCK_DURATION_MS); machine.dispatch({ type: 'SHOCK_FINISHED', shockId: 1 });
  openCover(s); drag(machine, 1);
  assert.equal(machine.state.steps[0].errors.length, 1);
  openHatch(machine, s.advance);
  repairWires(machine);
  for (const stepId of ['close', 'test']) machine.dispatch({ type: 'DEBUG_VALIDATE_STEP', stepId });
  assert.ok(machine.state.messageQueue.some(item => item.text.includes(textes.errors.liveCircuit.rule)));
});

test('actual scene rotations animate the cover, return the lever and switch off the LED', () => {
  const s = ready(); const { root } = createPlaceholderAssets();
  const projection = createProcedureProjection(root, { shadowMap: { needsUpdate: false } });
  projection.update(s.machine.state, s.now());
  s.machine.dispatch({ type: 'OPEN_POWER_COVER' }); projection.update(s.machine.state, s.now());
  s.advance(200); projection.frame(s.now());
  assert.ok(Math.abs(root.getObjectByName('Breaker_Cover').rotation.x - COVER_ANGLE / 2) < 1e-8);
  s.advance(200); s.machine.dispatch({ type: 'POWER_COVER_READY', coverId: 1 });
  drag(s.machine, 1); projection.update(s.machine.state, s.now());
  s.advance(180); projection.frame(s.now());
  assert.equal(projection.snapshot().leverProgress, 1);
  assert.ok(projection.snapshot().ledEmissive.every(value => value === 0));
});

test('ray hits resolve real meshes to their named targets and the closed cover occludes the lever', () => {
  const { root } = createPlaceholderAssets(); root.updateWorldMatrix(true, true);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 300); camera.position.set(0, 1.23, 4.25); camera.updateMatrixWorld();
  const target = root.getObjectByName('Breaker_Lever');
  const point = target.localToWorld(new THREE.Vector3(0, 0.17, 0.06)).project(camera);
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
  const objects = ['Breaker_Cover', 'Breaker_Lever', 'Hatch'].map(name => root.getObjectByName(name));
  const hit = firstPowerHit(ray.intersectObjects(objects, true));
  assert.equal(hit.target.name, 'Breaker_Cover');
  root.getObjectByName('Breaker_Cover').rotation.x = COVER_ANGLE; root.updateWorldMatrix(true, true);
  assert.equal(firstPowerHit(ray.intersectObjects(objects, true)).target.name, 'Breaker_Lever');
  assert.equal(semanticTarget(root.getObjectByName('Screw_TL').children[0]).name, 'Screw_TL');
});

test('discharge has a finite lifetime, clears camera shake and respects reduced motion', () => {
  const scene = new THREE.Scene(); let strength = 0;
  const effects = createElectricShock(scene, { reducedMotion: false, setShake(value) { strength = value; } }, () => new THREE.Vector3());
  effects.update({ shock: { id: 1, at: 1000, point: [0, 1, 0] } }); effects.frame(1100);
  assert.equal(effects.snapshot().sparksVisible, true); assert.ok(strength > 0);
  effects.frame(1000 + SHOCK_DURATION_MS);
  assert.equal(effects.snapshot().sparksVisible, false); assert.equal(strength, 0);
  assert.equal(shockStrength(100, true), 0);
});

test('screen drag samples clamp to the course and use a strict threshold', () => {
  assert.equal(dragProgress(0, 100, 140, 100), 0.4);
  assert.equal(dragProgress(0, 100, 500, 100), 1);
  assert.equal(dragProgress(0, 100, 10, 100), 0);
  assert.equal(passesThreshold(0.7), false); assert.equal(passesThreshold(0.71), true);
});
