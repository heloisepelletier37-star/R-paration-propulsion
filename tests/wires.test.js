import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMachine } from '../src/state/machine.js';
import { initialWiringState, SIDES, SNAP_DISTANCE } from '../src/steps/step3-wires.js';
import { canRepairWires } from '../src/state/procedure.js';
import { keyTurnSlices, pointerAngle } from '../src/steps/step2-hatch.js';
import { createPlaceholderAssets } from '../src/assets/placeholders.js';
import { REQUIRED_NODES } from '../src/assets/manifest.js';
import { createWiringScene, makeWireCurve } from '../src/scene/wiring.js';
import { finishBriefing, cutPower, openHatch, repairWires, turnTerminal, closeHatch, finishTest } from '../test-support/procedure.js';
import { textes } from '../src/ui/textes.js';

function ready(mode = 'training', random = () => 0) {
  let time = 0; const advance = ms => { time += ms; };
  const machine = createMachine({ now: () => time, random });
  machine.dispatch({ type: 'SCENE_READY' }); machine.dispatch({ type: 'START', mode }); finishBriefing(machine);
  cutPower(machine, advance); openHatch(machine, advance);
  return { machine, advance };
}
function inspect(machine, id = 'wire1', mark = true) {
  if (!machine.state.headlamp) machine.dispatch({ type: 'TOGGLE_LAMP' });
  machine.dispatch({ type: 'WIRE_INSPECT', wireId: id }); if (mark) machine.dispatch({ type: 'WIRE_MARK' });
}
function loosen(machine) { machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' }); SIDES.forEach(side => turnTerminal(machine, 'wire1', side)); }
function remove(machine) {
  machine.dispatch({ type: 'WIRE_REMOVE_START' }); const gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_REMOVE_MOVE', gestureId, progress: 1, position: [0, -2, 0] }); machine.dispatch({ type: 'WIRE_REMOVE_END', gestureId });
}
function replacement(machine) { machine.dispatch({ type: 'SELECT_TOOL', toolId: 'red' }); machine.dispatch({ type: 'WIRE_CHOOSE_REPLACEMENT' }); }
function strip(machine) { machine.dispatch({ type: 'SELECT_TOOL', toolId: 'stripper' }); SIDES.forEach(side => machine.dispatch({ type: 'WIRE_STRIP', side })); }
const item = machine => machine.state.wires.items[0];
function attach(machine, side, distance = 0.01) {
  machine.dispatch({ type: 'WIRE_END_START', side }); const gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_END_MOVE', gestureId, position: [1, 2, 3], distance }); machine.dispatch({ type: 'WIRE_END_END', gestureId });
}

test('each draw creates six colored wires and exactly one or two distinct broken wires', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let x = seed;
    const result = initialWiringState(() => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; });
    assert.equal(result.items.length, 6);
    const bad = result.items.filter(w => w.broken);
    assert.ok(bad.length === 1 || bad.length === 2); assert.equal(new Set(bad.map(w => w.id)).size, bad.length);
    assert.ok(result.items.every(w => ['red', 'black', 'yellow'].includes(w.color)));
  }
  assert.equal(initialWiringState(() => 0).items.filter(w => w.broken).length, 1);
  assert.equal(initialWiringState(() => 0.99).items.filter(w => w.broken).length, 2);
});

test('no wire action or generic debug can bypass the briefing, power isolation and real opening', () => {
  const m = createMachine({ random: () => 0 });
  for (const event of [{ type: 'WIRE_INSPECT', wireId: 'wire1' }, { type: 'WIRE_MARK', wireId: 'wire1' }, { type: 'WIRE_TERMINAL_START', wireId: 'wire1', side: 'L' }]) assert.equal(m.dispatch(event), false);
  const { machine } = ready();
  assert.equal(canRepairWires(machine.state), true);
  for (const type of ['DEBUG_VALIDATE_STEP', 'VALIDATE_STEP', 'COMPLETE_SUBSTEP']) assert.equal(machine.dispatch({ type, stepId: 'wires', substepId: 'inspect' }), false);
});

test('the headlamp is necessary to inspect, mark and manipulate the harness', () => {
  const { machine } = ready();
  machine.dispatch({ type: 'WIRE_INSPECT', wireId: 'wire1' });
  assert.equal(item(machine).inspected, false); assert.equal(machine.state.wires.feedbackCode, 'dark');
  machine.dispatch({ type: 'WIRE_MARK' }); assert.equal(item(machine).marked, false);
  inspect(machine); assert.equal(item(machine).inspected, true); assert.equal(item(machine).marked, true);
  loosen(machine); machine.dispatch({ type: 'WIRE_REMOVE_START' });
  machine.dispatch({ type: 'TOGGLE_LAMP' }); assert.equal(machine.state.wires.gesture, null);
});

test('marking an intact wire records an error without declaring or modifying it', () => {
  const { machine } = ready(); inspect(machine, 'wire2');
  assert.equal(machine.state.errors.at(-1).code, 'intactWire');
  assert.equal(machine.state.wires.items[1].marked, false); assert.equal(machine.state.wires.items[1].removed, false);
  assert.equal(machine.state.message.text, textes.errors.intactWire.why);
});

test('a wire must be inspected and declared before its terminals can be loosened', () => {
  const { machine } = ready(); inspect(machine, 'wire1', false);
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' }); machine.dispatch({ type: 'WIRE_TERMINAL_START', side: 'L' });
  assert.equal(machine.state.wires.gesture, null); assert.equal(item(machine).terminals.L, 0);
  machine.dispatch({ type: 'WIRE_MARK' }); machine.dispatch({ type: 'WIRE_TERMINAL_START', side: 'L' });
  assert.equal(machine.state.wires.gesture.kind, 'terminal');
});

test('a Phillips screwdriver slips on a terminal and records the correct rule', () => {
  const { machine } = ready(); inspect(machine);
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'phillips' }); machine.dispatch({ type: 'WIRE_TERMINAL_START', side: 'L' });
  assert.equal(machine.state.errors.at(-1).code, 'wireDriver'); assert.equal(machine.state.wires.gesture, null);
  assert.equal(item(machine).terminals.L, 0);
});

test('one counterclockwise turn is required on each terminal, and clockwise input blocks', () => {
  const { machine } = ready(); inspect(machine); machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  machine.dispatch({ type: 'WIRE_TERMINAL_START', side: 'L' }); const gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId, radians: -Math.PI / 2 });
  assert.equal(item(machine).terminals.L, 0); assert.equal(machine.state.wires.feedbackCode, 'counterclockwise');
  machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId, radians: Math.PI / 2 });
  assert.equal(item(machine).terminals.L, 0);
  for (let i = 0; i < 3; i++) machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId, radians: Math.PI / 2 });
  assert.equal(item(machine).terminals.L, 0.75);
  machine.dispatch({ type: 'WIRE_REMOVE_START' }); assert.equal(item(machine).removed, false);
  machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId, radians: Math.PI / 2 });
  assert.equal(item(machine).terminals.L, 1); assert.equal(machine.state.wires.gesture, null);
});

test('both terminals must be loose, and a partial or cancelled removal keeps the old wire', () => {
  const { machine } = ready(); inspect(machine); machine.dispatch({ type: 'WIRE_REMOVE_START' });
  assert.equal(machine.state.wires.gesture, null);
  loosen(machine); machine.dispatch({ type: 'WIRE_REMOVE_START' }); let gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_REMOVE_MOVE', gestureId, progress: 0.9 }); machine.dispatch({ type: 'WIRE_REMOVE_END', gestureId });
  assert.equal(item(machine).removed, false);
  machine.dispatch({ type: 'WIRE_REMOVE_START' }); gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_REMOVE_MOVE', gestureId, progress: 1 }); machine.dispatch({ type: 'WIRE_CANCEL', gestureId });
  assert.equal(item(machine).removed, false); assert.equal(machine.dispatch({ type: 'WIRE_REMOVE_END', gestureId }), false);
  remove(machine); assert.equal(item(machine).removed, true);
});

test('the replacement must match the original color and never changes the original diagnosis', () => {
  const { machine } = ready(); inspect(machine); loosen(machine); remove(machine);
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'yellow' }); machine.dispatch({ type: 'WIRE_CHOOSE_REPLACEMENT' });
  assert.equal(machine.state.errors.at(-1).code, 'wrongColor'); assert.equal(item(machine).replacement, null);
  replacement(machine); assert.equal(item(machine).replacement.color, 'red'); assert.equal(item(machine).broken, true);
});

test('the stripper must expose copper on both ends before either can be attached', () => {
  const { machine } = ready(); inspect(machine); loosen(machine); remove(machine); replacement(machine);
  machine.dispatch({ type: 'WIRE_STRIP', side: 'L' }); assert.equal(item(machine).replacement.stripped.L, false);
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'stripper' }); machine.dispatch({ type: 'WIRE_STRIP', side: 'L' });
  machine.dispatch({ type: 'WIRE_END_START', side: 'L' }); assert.equal(machine.state.wires.gesture, null);
  machine.dispatch({ type: 'WIRE_STRIP', side: 'R' }); machine.dispatch({ type: 'WIRE_END_START', side: 'L' });
  assert.equal(machine.state.wires.gesture.kind, 'end');
});

for (const distance of [0.02, 0.021, 0.2]) test(`a release at ${distance} m does not attach the end`, () => {
  const { machine } = ready(); inspect(machine); loosen(machine); remove(machine); replacement(machine); strip(machine); attach(machine, 'L', distance);
  assert.equal(item(machine).replacement.connected.L, false);
});

test('magnetism below 2 cm previews the snap but only release commits it', () => {
  const { machine } = ready(); inspect(machine); loosen(machine); remove(machine); replacement(machine); strip(machine);
  machine.dispatch({ type: 'WIRE_END_START', side: 'L' }); const gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_END_MOVE', gestureId, position: [1, 2, 3], distance: SNAP_DISTANCE - 0.000001 });
  assert.equal(machine.state.wires.gesture.snapped, true); assert.equal(item(machine).replacement.connected.L, false);
  machine.dispatch({ type: 'WIRE_END_END', gestureId }); assert.equal(item(machine).replacement.connected.L, true);
  assert.equal(item(machine).repaired, false);
});

test('an unconnected end cannot be tightened; connected ends each require a full clockwise turn', () => {
  const { machine } = ready(); inspect(machine); loosen(machine); remove(machine); replacement(machine); strip(machine);
  machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' }); machine.dispatch({ type: 'WIRE_TERMINAL_START', side: 'L' });
  assert.equal(machine.state.wires.gesture, null); assert.equal(item(machine).terminals.L, 1);
  attach(machine, 'L'); attach(machine, 'R');
  turnTerminal(machine, 'wire1', 'L'); assert.equal(item(machine).terminals.L, 0); assert.equal(item(machine).repaired, false);
  turnTerminal(machine, 'wire1', 'R'); assert.equal(item(machine).repaired, true);
  assert.equal(machine.state.stepIndex, 2); // The other five wires still need inspection.
  for (const wire of machine.state.wires.items.slice(1)) machine.dispatch({ type: 'WIRE_INSPECT', wireId: wire.id });
  assert.equal(machine.state.stepIndex, 3); assert.equal(machine.state.validations[2].source, 'gesture');
});

test('changing tools, switching off the lamp and replay cancel gestures without losing completed work', () => {
  const { machine } = ready(); inspect(machine); machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  machine.dispatch({ type: 'WIRE_TERMINAL_START', side: 'L' }); const gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId, radians: Math.PI / 2 });
  machine.dispatch({ type: 'REPLAY_BRIEFING' }); assert.equal(machine.state.wires.gesture, null);
  assert.equal(machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId, radians: 1 }), false);
  finishBriefing(machine); assert.equal(item(machine).terminals.L, 0.25); assert.equal(item(machine).marked, true);
});

test('malformed and stale samples cannot move or attach a wire', () => {
  const { machine } = ready(); inspect(machine); loosen(machine); remove(machine); replacement(machine); strip(machine);
  machine.dispatch({ type: 'WIRE_END_START', side: 'L' }); const gestureId = machine.state.wires.gesture.id;
  for (const event of [{ position: [0, NaN, 1], distance: 0 }, { position: [0, 1, 2], distance: -1 }, { position: [0, 1, 2], distance: Infinity }]) assert.equal(machine.dispatch({ type: 'WIRE_END_MOVE', gestureId, ...event }), false);
  machine.dispatch({ type: 'WIRE_CANCEL', gestureId });
  assert.equal(machine.dispatch({ type: 'WIRE_END_END', gestureId }), false);
  assert.equal(item(machine).replacement.connected.L, false); assert.equal(machine.dispatch({}), false);
});

test('evaluation records incorrect marks and colors silently and explains them at debrief', () => {
  const { machine, advance } = ready('evaluation'); inspect(machine, 'wire2');
  assert.equal(machine.state.message, null);
  inspect(machine); loosen(machine); remove(machine); machine.dispatch({ type: 'SELECT_TOOL', toolId: 'yellow' }); machine.dispatch({ type: 'WIRE_CHOOSE_REPLACEMENT' });
  assert.equal(machine.state.errors.length, 2); assert.equal(machine.state.message, null);
  repairWires(machine);
  closeHatch(machine, advance); finishTest(machine, advance);
  const transcript = machine.state.messageQueue.map(m => m.text).join(' ');
  assert.ok(transcript.includes(textes.errors.intactWire.rule)); assert.ok(transcript.includes(textes.errors.wrongColor.rule));
});

test('two broken wires must both be repaired before stage 4 is available', () => {
  const { machine } = ready('training', () => 0.99);
  assert.equal(machine.state.wires.items.filter(w => w.broken).length, 2);
  repairWires(machine);
  assert.equal(machine.state.stepIndex, 3); assert.equal(machine.state.wires.items.filter(w => w.repaired).length, 2);
});

test('a full replacement validates stage 3 and a restart draws a fresh harness', () => {
  const { machine, advance } = ready(); repairWires(machine);
  assert.equal(machine.state.stepIndex, 3); assert.ok(Object.values(machine.state.steps[2].substeps).every(Boolean));
  closeHatch(machine, advance); finishTest(machine, advance);
  machine.dispatch({ type: 'RESTART' });
  assert.ok(machine.state.wires.items.every(w => !w.inspected && !w.marked && !w.removed && !w.replacement));
  assert.equal(machine.state.wires.selected, null);
});

test('selecting an already held tool keeps it in hand; explicit put-down still works', () => {
  const { machine } = ready(); machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' }); machine.dispatch({ type: 'SELECT_TOOL', toolId: 'flat' });
  assert.equal(machine.state.selectedTool, 'flat'); machine.dispatch({ type: 'SELECT_TOOL', toolId: null }); assert.equal(machine.state.selectedTool, null);
});

test('keyboard timing preserves elapsed motion at low frame rates without oversized angular samples', () => {
  const slices = keyTurnSlices(400);
  assert.ok(slices.every(value => value <= Math.PI / 2)); assert.ok(Math.abs(slices.reduce((a, b) => a + b, 0) - Math.PI * 0.8) < 1e-8);
  assert.notEqual(pointerAngle(105, 100, { x: 100, y: 100 }), null);
});

test('real wire geometry shows frayed copper, follows a dragged end and retains all named model nodes', () => {
  const { machine } = ready(); const scene = new THREE.Scene(); const { root } = createPlaceholderAssets(); scene.add(root);
  const outside = root.getObjectByName('PowerBox').children[0].material.color.clone();
  const wiring = createWiringScene(scene, root); wiring.update(machine.state); wiring.frame();
  assert.equal(wiring.snapshot().wires[0].frayed, 8); assert.equal(wiring.snapshot().wires[1].frayed, 0);
  assert.ok(root.getObjectByName('PowerBox').children[0].material.color.equals(outside));
  inspect(machine); loosen(machine); remove(machine); replacement(machine); strip(machine);
  machine.dispatch({ type: 'WIRE_END_START', side: 'L' }); const gestureId = machine.state.wires.gesture.id;
  machine.dispatch({ type: 'WIRE_END_MOVE', gestureId, position: [0, 1, 1], distance: 0.5 });
  wiring.update(machine.state); for (let i = 0; i < 10; i++) wiring.frame(0.05);
  const snapshot = wiring.snapshot().wires[0];
  assert.equal(snapshot.originalVisible, false); assert.equal(snapshot.replacementVisible, true); assert.equal(snapshot.stripped.L, 1);
  assert.deepEqual(snapshot.ends.L, [0, 1, 1]);
  for (const name of REQUIRED_NODES) assert.equal(root.getObjectsByProperty('name', name).length, 1);
});

test('the replacement curve reaches its anchors and sags under Martian gravity', () => {
  const left = new THREE.Vector3(-0.5, 1, 0); const right = new THREE.Vector3(0.5, 1, 0);
  const curve = makeWireCurve(left, right);
  assert.ok(curve.getPoint(0).distanceTo(left) < 1e-8); assert.ok(curve.getPoint(1).distanceTo(right) < 1e-8);
  assert.ok(curve.getPoint(0.5).y < 1); assert.ok(curve.getPoint(0.5).y > 0.85);
});
