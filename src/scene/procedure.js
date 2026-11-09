import * as THREE from 'three';
import { sceneState } from '../state/procedure.js';
import { coverProgress, smoothProgress, LEVER_RETURN_MS, COVER_ANGLE, LEVER_ANGLE } from '../steps/step1-power.js';
import { ALL_SCREWS, SCREWS, HATCH_ANGLE, HATCH_SETTLE_MS, SCREW_TRAVEL, TAU, extraction, removed } from '../steps/step2-hatch.js';

export function createProcedureProjection(root, renderer) {
  const hinge = root.getObjectByName('Hatch_Hinge');
  const cover = root.getObjectByName('Breaker_Cover');
  const lever = root.getObjectByName('Breaker_Lever');
  const bases = new Map([hinge, cover, lever].map(node => [node, node.quaternion.clone()]));
  root.updateWorldMatrix(true, true);
  const localBoundsOf = node => {
    const inverse = node.matrixWorld.clone().invert(); const bounds = new THREE.Box3();
    node.traverse(child => {
      if (!child.isMesh) return;
      child.geometry.computeBoundingBox();
      bounds.union(child.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)));
    });
    return bounds;
  };
  const hatchBounds = localBoundsOf(hinge);
  const hatchHandle = new THREE.Vector3(hatchBounds.max.x - 0.06, 0, hatchBounds.max.z + 0.005);
  const scratchMaterial = new THREE.LineBasicMaterial({ color: 0xd3a16d, depthTest: true });
  const screws = ALL_SCREWS.map(id => {
    const node = root.getObjectByName(id); const bounds = localBoundsOf(node);
    const radius = Math.max(bounds.max.x - bounds.min.x, 0.02) * 0.33;
    const z = bounds.max.z + 0.001;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-radius, -radius * 0.4, z), new THREE.Vector3(radius, radius * 0.65, z),
      new THREE.Vector3(-radius * 0.65, radius * 0.7, z), new THREE.Vector3(radius * 0.7, -radius * 0.6, z),
    ]);
    const scratch = new THREE.LineSegments(geometry, scratchMaterial); scratch.visible = false; node.add(scratch);
    scratch.raycast = () => {}; // A cosmetic scratch must not enlarge the screw's hit area.
    return { id, node, position: node.position.clone(), quaternion: node.quaternion.clone(), scratch, front: z };
  });
  const ledMaterials = [];
  root.getObjectByName('LED_Power').traverse(node => {
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material?.color) ledMaterials.push({ material, color: material.color.clone(), intensity: material.emissiveIntensity });
    }
  });
  root.updateWorldMatrix(true, true);
  const inverse = lever.matrixWorld.clone().invert();
  const localBounds = new THREE.Box3();
  lever.traverse(node => {
    if (!node.isMesh) return;
    node.geometry.computeBoundingBox();
    localBounds.union(node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld)));
  });
  const handle = new THREE.Vector3(
    (localBounds.min.x + localBounds.max.x) / 2,
    THREE.MathUtils.lerp(localBounds.min.y, localBounds.max.y, 0.85),
    localBounds.max.z,
  );
  const xAxis = new THREE.Vector3(1, 0, 0);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion();
  let latest;
  let visualLever = 0;
  let visualCover = 0;
  let visualHatch = 0;
  let hatchSpring = { from: 0, to: 0, at: 0, dragging: false, duration: HATCH_SETTLE_MS };
  let spring = { from: 0, to: 0, at: 0 };
  let lastCircuit;

  function setRotation(node, axis, angle) {
    const target = bases.get(node).clone().multiply(rotation.setFromAxisAngle(axis, angle));
    if (node.quaternion.angleTo(target) > 0.000001) {
      node.quaternion.copy(target);
      renderer.shadowMap.needsUpdate = true;
    }
  }

  function leverPoint(progress, point = handle) {
    lever.parent.updateWorldMatrix(true, false);
    const quaternion = bases.get(lever).clone().multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, LEVER_ANGLE * progress));
    const matrix = new THREE.Matrix4().compose(lever.position, quaternion, lever.scale);
    return point.clone().applyMatrix4(matrix).applyMatrix4(lever.parent.matrixWorld);
  }

  function hatchPoint(progress) {
    hinge.parent.updateWorldMatrix(true, false);
    const quaternion = bases.get(hinge).clone().multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, HATCH_ANGLE * progress));
    return hatchHandle.clone().applyMatrix4(new THREE.Matrix4().compose(hinge.position, quaternion, hinge.scale)).applyMatrix4(hinge.parent.matrixWorld);
  }

  return {
    update(state, now = Date.now()) {
      latest = state;
      const pose = sceneState(state);
      const targetHatch = state.steps[3].completed ? 0 : state.hatch.progress;
      if (hatchSpring.to !== targetHatch || hatchSpring.dragging !== state.hatch.dragging) {
        hatchSpring = { from: visualHatch, to: targetHatch, at: now, dragging: state.hatch.dragging,
          duration: state.hatch.dragging ? 65 : HATCH_SETTLE_MS };
      }
      for (const entry of screws) {
        const screw = state.hatch.screws[entry.id];
        const refastened = state.steps[3].completed;
        const turns = refastened ? 0 : screw.turns;
        if (entry.lastTurns === turns && entry.lastScratch === screw.scratched) continue;
        entry.lastTurns = turns; entry.lastScratch = screw.scratched;
        entry.node.position.copy(entry.position).add(new THREE.Vector3(0, 0, SCREW_TRAVEL * extraction(turns)).applyQuaternion(entry.quaternion));
        entry.node.quaternion.copy(entry.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), turns * TAU));
        const visible = refastened || !removed(screw);
        renderer.shadowMap.needsUpdate = true;
        entry.node.visible = visible; entry.scratch.visible = screw.scratched;
      }
      if (state.power.dragging) {
        visualLever = state.power.leverProgress;
        spring = { from: visualLever, to: visualLever, at: now };
      } else if (spring.to !== state.power.leverProgress) {
        spring = { from: visualLever, to: state.power.leverProgress, at: now };
      }
      if (pose.circuitOn !== lastCircuit) {
        lastCircuit = pose.circuitOn;
        for (const entry of ledMaterials) {
          entry.material.color.copy(entry.color).multiplyScalar(pose.circuitOn ? 1 : 0.12);
          if (entry.intensity !== undefined) entry.material.emissiveIntensity = pose.circuitOn ? entry.intensity : 0;
        }
      }
      this.frame(now);
    },
    frame(now = Date.now()) {
      if (!latest) return;
      visualCover = coverProgress(latest.power, now);
      visualHatch = THREE.MathUtils.lerp(hatchSpring.from, hatchSpring.to, smoothProgress((now - hatchSpring.at) / hatchSpring.duration));
      setRotation(hinge, yAxis, HATCH_ANGLE * visualHatch);
      if (!latest.power.dragging) visualLever = THREE.MathUtils.lerp(spring.from, spring.to, smoothProgress((now - spring.at) / LEVER_RETURN_MS));
      setRotation(cover, xAxis, COVER_ANGLE * smoothProgress(visualCover));
      setRotation(lever, xAxis, LEVER_ANGLE * visualLever);
    },
    leverTravel(camera, height, hitPoint) {
      root.updateWorldMatrix(true, true);
      const point = hitPoint ? lever.worldToLocal(hitPoint.clone()) : handle;
      const a = leverPoint(0, point).project(camera);
      const b = leverPoint(1, point).project(camera);
      return Math.max(32, Math.abs(a.y - b.y) * height / 2);
    },
    targetPoint(name) {
      root.updateWorldMatrix(true, true);
      if (name === 'Breaker_Lever') return leverPoint(visualLever);
      if (name === 'Hatch_Edge') return hatchPoint(visualHatch);
      const screw = screws.find(entry => entry.id === name);
      if (screw) return screw.node.localToWorld(new THREE.Vector3(0, 0, screw.front));
      return new THREE.Box3().setFromObject(root.getObjectByName(name)).getCenter(new THREE.Vector3());
    },
    isHatchEdge(point) {
      const local = hinge.worldToLocal(point.clone());
      return local.x >= THREE.MathUtils.lerp(hatchBounds.min.x, hatchBounds.max.x, 0.72);
    },
    hatchTravel(camera, width) {
      const start = hatchPoint(0).project(camera); const end = hatchPoint(1).project(camera);
      return Math.max(72, Math.abs(start.x - end.x) * width / 2);
    },
    snapshot() {
      return { coverProgress: visualCover, leverProgress: visualLever, hatchProgress: visualHatch,
        screws: screws.filter(entry => SCREWS.includes(entry.id)).map(entry => ({ id: entry.id, visible: entry.node.visible, position: entry.node.position.toArray(), scratched: entry.scratch.visible })),
        ledEmissive: ledMaterials.map(({ material }) => material.emissiveIntensity ?? 0) };
    },
  };
}
