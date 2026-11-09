import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlaceholderAssets } from '../src/assets/placeholders.js';
import { REQUIRED_NODES } from '../src/assets/manifest.js';
import { mergeModelWithPlaceholders } from '../src/assets/loader.js';
import { isAlarmOn, updateAlarm } from '../src/scene/alarm.js';
import { clampView, VIEW_LIMITS } from '../src/scene/camera.js';

test('the 43 required nodes exist exactly once without any supplied models', () => {
  const { root } = createPlaceholderAssets();
  const expected = [
    'Panel', 'Hatch', 'Hatch_Hinge', 'Screw_TL', 'Screw_TR', 'Screw_BL', 'Screw_BR', 'Screw_Safety',
    'PowerBox', 'Breaker_Cover', 'Breaker_Lever', 'LED_Power', 'Alarm_Light',
    'Screwdriver_Phillips', 'Screwdriver_Flat', 'Wire_Stripper', 'Headlamp', 'Ground', 'Rocks',
  ];
  for (let index = 1; index <= 6; index++) {
    expected.push(`Terminal_L_${index}`, `Terminal_R_${index}`, `Terminal_Screw_L_${index}`, `Terminal_Screw_R_${index}`);
  }
  assert.equal(expected.length, 43);
  assert.deepEqual([...REQUIRED_NODES].sort(), expected.sort());
  for (const name of expected) {
    assert.equal(root.getObjectsByProperty('name', name).length, 1, name);
    assert.equal(root.getObjectByName(name).userData.placeholder, true);
  }
});

test('the hatch and its screws rotate together around the left hinge', () => {
  const { root } = createPlaceholderAssets();
  const hinge = root.getObjectByName('Hatch_Hinge');
  const hatch = root.getObjectByName('Hatch');
  const screw = root.getObjectByName('Screw_TR');
  assert.equal(hatch.parent, hinge);
  assert.equal(screw.parent, hatch);
  const before = screw.getWorldPosition(new THREE.Vector3());
  const pivot = hinge.getWorldPosition(new THREE.Vector3());
  hinge.rotation.y = -THREE.MathUtils.degToRad(110);
  const after = screw.getWorldPosition(new THREE.Vector3());
  assert.ok(after.distanceTo(before) > 1);
  assert.ok(Math.abs(before.distanceTo(pivot) - after.distanceTo(pivot)) < 1e-8);
  assert.ok(after.z > before.z);
});

test('missing model branches retain their names, world positions and pivots', () => {
  const { root, assets } = createPlaceholderAssets();
  const fallback = assets.get('ship_panel.glb');
  const screw = root.getObjectByName('Screw_TR');
  const before = screw.getWorldPosition(new THREE.Vector3());
  const loaded = new THREE.Group();
  loaded.position.copy(fallback.position);
  const panel = new THREE.Group();
  panel.name = 'Panel';
  loaded.add(panel);
  root.add(loaded);
  const names = ['Panel', 'Hatch', 'Hatch_Hinge', 'Screw_TL', 'Screw_TR', 'Screw_BL', 'Screw_BR', 'Screw_Safety', 'Alarm_Light'];
  const missing = mergeModelWithPlaceholders(loaded, fallback, names);
  assert.equal(missing.length, 8);
  assert.equal(root.getObjectByName('Panel'), panel);
  assert.equal(root.getObjectByName('Hatch_Hinge').parent, panel);
  assert.ok(screw.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-8);
  for (const name of REQUIRED_NODES) assert.equal(root.getObjectsByProperty('name', name).length, 1, name);
});

test('the alarm alternates twice per second, completing a cycle at 1 Hz', () => {
  assert.deepEqual([0, 0.49, 0.5, 0.99, 1, 1.5, 2].map(isAlarmOn), [true, true, false, false, true, false, true]);
  const { root } = createPlaceholderAssets();
  const alarm = root.getObjectByName('Alarm_Light');
  let material;
  alarm.traverse(node => { if (node.material?.name === 'M_Alarm') material = node.material; });
  updateAlarm(alarm, 0.25);
  assert.equal(material.emissiveIntensity, 3.2);
  updateAlarm(alarm, 0.75);
  assert.equal(material.emissiveIntensity, 0.08);
});

test('view angles stay limited even for extreme input', () => {
  assert.deepEqual(clampView(100, -100), { yaw: VIEW_LIMITS.yaw, pitch: -VIEW_LIMITS.pitch });
  assert.deepEqual(clampView(-100, 100), { yaw: -VIEW_LIMITS.yaw, pitch: VIEW_LIMITS.pitch });
  assert.deepEqual(clampView(0.1, -0.1), { yaw: 0.1, pitch: -0.1 });
});
