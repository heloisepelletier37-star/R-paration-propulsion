import * as THREE from 'three';
import { createTerrain } from '../scene/terrain.js';
import { MODEL_SPECS } from './manifest.js';

const materials = {
  shell: new THREE.MeshStandardMaterial({ color: 0xb1b9af, metalness: 0.45, roughness: 0.62 }),
  edge: new THREE.MeshStandardMaterial({ color: 0x344446, metalness: 0.65, roughness: 0.52 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x182629, metalness: 0.3, roughness: 0.83 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xa7b5b8, metalness: 0.8, roughness: 0.37 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xd67435, metalness: 0.15, roughness: 0.67 }),
  red: new THREE.MeshStandardMaterial({ color: 0x8a2826, metalness: 0.2, roughness: 0.45 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xe1d6b7, roughness: 0.8 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb47c40, metalness: 0.8, roughness: 0.4 }),
};

function group(name, parent, position = [0, 0, 0]) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(...position);
  parent.add(node);
  return node;
}

function box(parent, size, position, material = materials.shell) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, depth, position, material = materials.silver) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 16), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function screw(name, parent, position, flat = false, radius = 0.031) {
  // Local Z is the screw axis; the group origin is the head's centre.
  const node = group(name, parent, position);
  cylinder(node, radius * 0.4, 0.065, [0, 0, -0.028]);
  cylinder(node, radius, 0.016, [0, 0, 0]);
  box(node, [radius * 1.4, 0.007, 0.003], [0, 0, 0.009], materials.dark);
  if (!flat) box(node, [0.007, radius * 1.4, 0.003], [0, 0, 0.009], materials.dark);
  return node;
}

function panelAsset() {
  const asset = new THREE.Group();
  asset.position.set(0.35, 1.35, 0.27);
  const panel = group('Panel', asset);
  box(panel, [1.86, 1.45, 0.05], [0, 0, -0.23], materials.edge);
  box(panel, [1.65, 1.23, 0.025], [0, 0, -0.19], materials.dark);
  for (const y of [-0.69, 0.69]) box(panel, [1.87, 0.055, 0.07], [0, y, 0], materials.silver);
  for (const x of [-0.9, 0.9]) box(panel, [0.04, 1.4, 0.09], [x, 0, 0.01]);
  const hinge = group('Hatch_Hinge', panel, [-0.8, 0, 0.055]);
  const hatch = group('Hatch', hinge);
  box(hatch, [1.56, 1.18, 0.085], [0.8, 0, 0.015]);
  // A darker recessed face, vents and orange edge identify the service hatch.
  box(hatch, [1.18, 0.81, 0.016], [0.8, 0, 0.065], materials.edge);
  box(hatch, [0.09, 1.1, 0.025], [1.48, 0, 0.07], materials.orange);
  for (let index = 0; index < 7; index++) {
    box(hatch, [0.27, 0.021, 0.022], [0.42, -0.12 + index * 0.065, 0.082], materials.dark);
  }
  box(hatch, [0.12, 0.26, 0.065], [1.22, 0.02, 0.11], materials.dark);
  box(hatch, [0.055, 0.18, 0.06], [1.22, 0.02, 0.15], materials.silver);
  for (const [name, x, y] of [
    ['Screw_TL', 0.12, 0.5], ['Screw_TR', 1.48, 0.5],
    ['Screw_BL', 0.12, -0.5], ['Screw_BR', 1.48, -0.5],
  ]) screw(name, hatch, [x, y, 0.079]);
  screw('Screw_Safety', hatch, [0.8, 0, 0.085], true, 0.038);
  for (const y of [-0.41, 0.41]) {
    const joint = cylinder(panel, 0.055, 0.18, [-0.81, y, 0.075], materials.silver);
    joint.rotation.x = 0;
  }
  const alarm = group('Alarm_Light', panel, [0.82, 0.92, 0.02]);
  cylinder(alarm, 0.105, 0.07, [0, 0, 0], materials.dark);
  const alarmMaterial = new THREE.MeshStandardMaterial({
    name: 'M_Alarm', color: 0x3a0101, emissive: 0xff0000,
    emissiveIntensity: 3, roughness: 0.25, metalness: 0.1, toneMapped: false,
  });
  cylinder(alarm, 0.075, 0.055, [0, 0, 0.055], alarmMaterial);
  box(panel, [1.87, 0.12, 0.11], [0, 0.9, -0.03], materials.edge);
  return asset;
}

function powerAsset() {
  const asset = new THREE.Group();
  asset.position.set(-1.01, 1.25, 0.21);
  const power = group('PowerBox', asset);
  box(power, [0.5, 0.81, 0.22], [0, 0, 0], materials.edge);
  box(power, [0.42, 0.72, 0.035], [0, 0, 0.12], materials.ivory);
  box(power, [0.29, 0.4, 0.025], [0, -0.035, 0.15], materials.dark);
  const led = new THREE.MeshStandardMaterial({ color: 0x52e5a3, emissive: 0x35d080, emissiveIntensity: 1.4 });
  const ledNode = group('LED_Power', power, [0, 0.29, 0.15]);
  cylinder(ledNode, 0.027, 0.025, [0, 0, 0], led);
  const lever = group('Breaker_Lever', power, [0, -0.13, 0.18]);
  box(lever, [0.045, 0.17, 0.045], [0, 0.07, 0.035], materials.silver);
  box(lever, [0.17, 0.07, 0.085], [0, 0.17, 0.055], materials.dark);
  const cover = group('Breaker_Cover', power, [0, 0.19, 0.2]);
  box(cover, [0.37, 0.035, 0.07], [0, 0, 0], materials.red);
  for (const x of [-0.17, 0.17]) box(cover, [0.03, 0.43, 0.07], [x, -0.2, 0], materials.red);
  box(cover, [0.37, 0.035, 0.07], [0, -0.41, 0], materials.red);
  const glass = new THREE.MeshStandardMaterial({ color: 0xb84739, transparent: true, opacity: 0.18, roughness: 0.2 });
  box(cover, [0.3, 0.36, 0.008], [0, -0.2, 0.04], glass);
  return asset;
}

function harnessAsset() {
  const asset = new THREE.Group();
  asset.position.set(0.35, 1.35, 0.25);
  const colors = [0xbf3c2d, 0x1d2226, 0xe3b348, 0xbf3c2d, 0x1d2226, 0xe3b348];
  for (let index = 1; index <= 6; index++) {
    const y = 0.43 - (index - 1) * 0.17;
    for (const [side, x] of [['L', -0.56], ['R', 0.56]]) {
      const terminal = group(`Terminal_${side}_${index}`, asset, [x, y, -0.07]);
      box(terminal, [0.16, 0.13, 0.07], [0, 0, 0], materials.ivory);
      box(terminal, [0.1, 0.08, 0.01], [0, 0, 0.043], materials.copper);
      screw(`Terminal_Screw_${side}_${index}`, terminal, [0, 0, 0.06], true, 0.023);
    }
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.5, y, -0.04),
      new THREE.Vector3(0, y - 0.07, -0.08),
      new THREE.Vector3(0.5, y, -0.04),
    ]);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.015, 6, false), new THREE.MeshStandardMaterial({ color: colors[index - 1], roughness: 0.8 }));
    wire.name = `Harness_Wire_${index}`;
    asset.add(wire);
  }
  return asset;
}

function toolsAsset() {
  const asset = new THREE.Group();
  asset.position.set(0.05, 0.18, 1.38);
  box(asset, [1.85, 0.065, 0.7], [0, -0.045, 0], materials.edge);
  box(asset, [1.72, 0.015, 0.59], [0, 0, 0], materials.dark);
  for (const [name, x, color] of [
    ['Screwdriver_Phillips', -0.62, materials.orange],
    ['Screwdriver_Flat', -0.19, materials.ivory],
  ]) {
    const tool = group(name, asset, [x, 0.055, 0.1]);
    tool.rotation.x = -Math.PI / 2;
    const grip = cylinder(tool, 0.042, 0.2, [0, 0, 0], color);
    grip.rotation.x = 0;
    const shaft = cylinder(tool, 0.012, 0.23, [0, 0.21, 0]);
    shaft.rotation.x = 0;
    box(tool, [0.023, 0.055, 0.005], [0, 0.35, 0], materials.silver);
    if (name.endsWith('Phillips')) box(tool, [0.005, 0.055, 0.023], [0, 0.35, 0], materials.silver);
  }
  const stripper = group('Wire_Stripper', asset, [0.27, 0.065, 0.05]);
  stripper.rotation.x = -Math.PI / 2;
  for (const sign of [-1, 1]) {
    const arm = box(stripper, [0.035, 0.23, 0.035], [sign * 0.043, -0.04, 0], materials.orange);
    arm.rotation.z = sign * -0.18;
    box(stripper, [0.025, 0.12, 0.025], [sign * 0.03, 0.13, 0], materials.silver);
  }
  const lamp = group('Headlamp', asset, [0.67, 0.095, 0]);
  box(lamp, [0.2, 0.14, 0.12], [0, 0, 0], materials.dark);
  cylinder(lamp, 0.065, 0.03, [0, 0, 0.08], materials.ivory);
  return asset;
}

export function createPlaceholderAssets() {
  const root = new THREE.Group();
  root.name = 'RepairAssembly';
  const builders = [panelAsset, powerAsset, harnessAsset, toolsAsset, createTerrain];
  const assets = new Map();
  MODEL_SPECS.forEach((spec, index) => {
    const asset = builders[index]();
    asset.name = spec.file;
    assets.set(spec.file, asset);
    root.add(asset);
    for (const name of spec.nodes) {
      const node = asset.getObjectByName(name);
      if (!node) throw new Error(`Placeholder absent : ${name}`);
      node.userData.placeholder = true;
      node.userData.asset = spec.file;
    }
  });
  return { root, assets };
}
