import * as THREE from 'three';
import { WIRE_DEFS, WIRE_COLORS, SIDES, SNAP_DISTANCE } from '../steps/step3-wires.js';
import { TAU } from '../steps/step2-hatch.js';

export function makeWireCurve(left, right) {
  const length = left.distanceTo(right);
  const middle = left.clone().lerp(right, 0.5);
  middle.y -= Math.min(0.14, length * 0.15 * 0.38);
  middle.z += 0.015;
  return new THREE.CatmullRomCurve3([left.clone(), left.clone().lerp(middle, 0.5), middle, middle.clone().lerp(right, 0.5), right.clone()]);
}
const tube = (curve, from, to, radius) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
  Array.from({ length: 17 }, (_, index) => curve.getPoint(from + (to - from) * index / 16))), 24, radius, 6, false);

export function createWiringScene(scene, root, renderer) {
  const group = new THREE.Group(); group.name = 'Repair_Harness'; scene.add(group);
  root.updateWorldMatrix(true, true);
  const copper = new THREE.MeshStandardMaterial({ color: 0xc98449, metalness: 0.75, roughness: 0.4 });
  const records = new Map(); const terminalMaterials = [];
  let latest; let hovered = null; let lastLight;
  const mesh = (parent, material, data) => {
    const node = new THREE.Mesh(new THREE.BufferGeometry(), material); node.userData = data; node.castShadow = true; parent.add(node); return node;
  };
  for (const def of WIRE_DEFS) {
    root.getObjectByName(`Harness_Wire_${def.index}`)?.traverse(node => { if (node.isMesh) node.visible = false; });
    const anchors = {}; const screws = {};
    for (const side of SIDES) {
      const terminal = root.getObjectByName(`Terminal_${side}_${def.index}`);
      anchors[side] = terminal.localToWorld(new THREE.Vector3(0, 0, 0.055));
      const node = root.getObjectByName(`Terminal_Screw_${side}_${def.index}`);
      screws[side] = { node, position: node.position.clone(), quaternion: node.quaternion.clone(), turns: -1 };
      terminal.traverse(child => {
        if (!child.isMesh) return;
        const clone = material => {
          const copied = material.clone(); terminalMaterials.push({ material: copied, color: copied.color?.clone() }); return copied;
        };
        child.material = Array.isArray(child.material) ? child.material.map(clone) : clone(child.material);
      });
    }
    const original = new THREE.Group(); group.add(original);
    const material = new THREE.MeshStandardMaterial({ color: WIRE_COLORS[def.color], roughness: 0.72 });
    const originalParts = [mesh(original, material, { wireId: def.id, kind: 'wire' }), mesh(original, material, { wireId: def.id, kind: 'wire' })];
    const fray = new THREE.Group(); original.add(fray);
    const replacement = new THREE.Group(); group.add(replacement);
    const core = mesh(replacement, copper, { wireId: def.id, kind: 'wire' });
    const insulation = mesh(replacement, material, { wireId: def.id, kind: 'wire' });
    const ends = {};
    for (const side of SIDES) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 6), material);
      cap.userData = { wireId: def.id, side, kind: 'end' }; replacement.add(cap); ends[side] = cap;
    }
    const target = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 5, 20), new THREE.MeshBasicMaterial({ color: 0x8be8b5 }));
    target.raycast = () => {}; target.visible = false; group.add(target);
    records.set(def.id, { def, anchors, screws, original, originalParts, fray, material, replacement, core, insulation, ends, target,
      strip: { L: 0, R: 0 }, points: { L: anchors.L.clone(), R: anchors.R.clone() }, curve: makeWireCurve(anchors.L, anchors.R), originalKey: null, replacementKey: null });
  }
  function dirty() { if (renderer) renderer.shadowMap.needsUpdate = true; }
  function replaceGeometry(node, geometry) { node.geometry.dispose(); node.geometry = geometry; dirty(); }
  function buildOriginal(record, wire, offset) {
    const curve = makeWireCurve(record.anchors.L.clone().add(offset), record.anchors.R.clone().add(offset));
    record.curve = curve;
    const ranges = wire.broken ? [[0, 0.455], [0.545, 1]] : [[0, 1]];
    record.originalParts.forEach((node, index) => {
      node.visible = index < ranges.length;
      if (node.visible) replaceGeometry(node, tube(curve, ...ranges[index], 0.014));
    });
    record.fray.children.forEach(child => child.geometry.dispose()); record.fray.clear();
    if (wire.broken) {
      for (const [at, direction] of [[0.455, 1], [0.545, -1]]) {
        const tip = curve.getPoint(at); const tangent = curve.getTangent(at).multiplyScalar(direction);
        for (let strand = 0; strand < 4; strand++) {
          const end = tip.clone().addScaledVector(tangent, 0.021 + strand * 0.003);
          end.y += (strand - 1.5) * 0.004; end.z += Math.sin(strand * 2 + wire.index) * 0.008;
          const fiber = new THREE.Mesh(tube(makeWireCurve(tip, end), 0, 1, 0.0015), copper);
          fiber.userData = { wireId: wire.id, kind: 'wire' }; record.fray.add(fiber);
        }
      }
    }
  }
  function freePoint(record, side) {
    return record.anchors[side].clone().add(new THREE.Vector3(side === 'L' ? 0.12 : -0.12, -0.11, 0.17));
  }
  return {
    group,
    update(state) { latest = state; },
    hover(id) { hovered = id; },
    anchor(id, side) { return records.get(id).anchors[side].clone(); },
    endpoint(id, side) { return records.get(id).points[side].clone(); },
    midpoint(id) { return records.get(id).anchors.L.clone().lerp(records.get(id).anchors.R, 0.5); },
    bodyPoint(id) { return records.get(id).curve.getPoint(0.5); },
    terminalPoint(id, side) {
      root.updateWorldMatrix(true, true);
      return records.get(id).screws[side].node.localToWorld(new THREE.Vector3(0, 0, 0.012));
    },
    pickPoints() {
      return [...records].flatMap(([id, r]) => [
        ...Array.from({ length: 15 }, (_, i) => ({ wireId: id, kind: 'wire', point: r.curve.getPoint(i / 14) })),
        ...SIDES.map(side => ({ wireId: id, kind: 'terminal', side, point: this.terminalPoint(id, side) })),
        ...SIDES.filter(side => r.replacement.visible && !latest.wires.items.find(w => w.id === id).replacement.connected[side])
          .map(side => ({ wireId: id, kind: 'end', side, point: r.points[side].clone() })),
      ]);
    },
    contains(point) {
      const box = new THREE.Box3(); records.forEach(r => SIDES.forEach(side => box.expandByPoint(r.anchors[side])));
      box.expandByVector(new THREE.Vector3(0.08, 0.1, 0.25)); return box.containsPoint(point);
    },
    frame(delta = 1 / 60) {
      if (!latest) return;
      const light = latest.headlamp;
      if (lastLight !== light) {
        lastLight = light;
        copper.color.setHex(0xc98449).multiplyScalar(light ? 1 : 0.04);
        terminalMaterials.forEach(entry => { if (entry.color) entry.material.color.copy(entry.color).multiplyScalar(light ? 1 : 0.06); });
      }
      const g = latest.wires.gesture;
      for (const wire of latest.wires.items) {
        const r = records.get(wire.id);
        r.material.color.setHex(WIRE_COLORS[wire.color]).multiplyScalar(light ? 1 : 0.035);
        r.material.emissive.setHex(light && (hovered === wire.id || latest.wires.selected === wire.id || wire.marked) ? wire.repaired ? 0x16402c : 0x42341a : 0);
        r.original.visible = !wire.removed; r.replacement.visible = Boolean(wire.replacement);
        for (const side of SIDES) {
          const screw = r.screws[side]; const turns = wire.terminals[side];
          if (turns !== screw.turns) {
            screw.turns = turns;
            dirty();
            screw.node.quaternion.copy(screw.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), TAU * turns));
            screw.node.position.copy(screw.position).add(new THREE.Vector3(0, 0, turns * 0.012).applyQuaternion(screw.quaternion));
          }
        }
        const offset = g?.kind === 'remove' && g.wireId === wire.id && g.position ? new THREE.Vector3(...g.position) : new THREE.Vector3();
        const originalKey = `${wire.broken}:${offset.toArray()}`;
        if (r.originalKey !== originalKey) { r.originalKey = originalKey; buildOriginal(r, wire, offset); }
        r.target.visible = false;
        if (!wire.replacement) { r.strip.L = 0; r.strip.R = 0; r.replacementKey = null; continue; }
        for (const side of SIDES) {
          const target = wire.replacement.stripped[side] ? 1 : 0;
          r.strip[side] = THREE.MathUtils.damp(r.strip[side], target, 20, delta);
          if (Math.abs(r.strip[side] - target) < 0.002) r.strip[side] = target;
          r.points[side] = wire.replacement.connected[side] ? r.anchors[side].clone() : freePoint(r, side);
          if (g?.kind === 'end' && g.wireId === wire.id && g.side === side && g.position) r.points[side] = g.snapped ? r.anchors[side].clone() : new THREE.Vector3(...g.position);
          r.ends[side].position.copy(r.points[side]); r.ends[side].material = r.strip[side] > 0.9 ? copper : r.material;
          r.ends[side].scale.setScalar(1 - r.strip[side] * 0.45); r.ends[side].visible = !wire.replacement.connected[side];
        }
        const curve = makeWireCurve(r.points.L, r.points.R); const length = curve.getLength();
        const replacementKey = `${r.points.L.toArray()}:${r.points.R.toArray()}:${r.strip.L}:${r.strip.R}`;
        if (r.replacementKey !== replacementKey) {
          r.replacementKey = replacementKey;
          replaceGeometry(r.core, tube(curve, 0, 1, 0.008));
          replaceGeometry(r.insulation, tube(curve, Math.min(0.12, 0.03 / length) * r.strip.L, 1 - Math.min(0.12, 0.03 / length) * r.strip.R, 0.014));
          r.curve = curve;
        }
        if (g?.kind === 'end' && g.wireId === wire.id) {
          r.target.visible = true; r.target.position.copy(r.anchors[g.side]);
          r.target.material.color.setHex(g.snapped ? 0x8be8b5 : 0xe6c18a);
        }
      }
    },
    snapshot() {
      return { snapDistance: SNAP_DISTANCE, wires: [...records].map(([id, r]) => ({ id, originalVisible: r.original.visible, replacementVisible: r.replacement.visible,
        frayed: r.fray.children.length, stripped: { ...r.strip }, ends: { L: r.points.L.toArray(), R: r.points.R.toArray() } })) };
    },
  };
}
