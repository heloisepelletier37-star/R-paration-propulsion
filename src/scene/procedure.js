import * as THREE from 'three';
import { sceneState } from '../state/procedure.js';
import { coverProgress, smoothProgress, LEVER_RETURN_MS, COVER_ANGLE, LEVER_ANGLE } from '../steps/step1-power.js';

export function createProcedureProjection(root, renderer) {
  const hinge = root.getObjectByName('Hatch_Hinge');
  const cover = root.getObjectByName('Breaker_Cover');
  const lever = root.getObjectByName('Breaker_Lever');
  const bases = new Map([hinge, cover, lever].map(node => [node, node.quaternion.clone()]));
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

  return {
    update(state, now = Date.now()) {
      latest = state;
      const pose = sceneState(state);
      setRotation(hinge, yAxis, pose.hatchOpen ? -THREE.MathUtils.degToRad(110) : 0);
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
      return new THREE.Box3().setFromObject(root.getObjectByName(name)).getCenter(new THREE.Vector3());
    },
    snapshot() {
      return { coverProgress: visualCover, leverProgress: visualLever,
        ledEmissive: ledMaterials.map(({ material }) => material.emissiveIntensity ?? 0) };
    },
  };
}
