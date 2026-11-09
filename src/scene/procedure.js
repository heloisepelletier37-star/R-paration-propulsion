import * as THREE from 'three';
import { sceneState } from '../state/procedure.js';

// Temporary scene poses for the debug validations, not gesture implementations.
export function createProcedureProjection(root, renderer) {
  const hinge = root.getObjectByName('Hatch_Hinge');
  const cover = root.getObjectByName('Breaker_Cover');
  const lever = root.getObjectByName('Breaker_Lever');
  const ledMaterials = [];
  root.getObjectByName('LED_Power').traverse(node => {
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material?.color) ledMaterials.push({ material, color: material.color.clone(), intensity: material.emissiveIntensity });
    }
  });
  let signature;
  return {
    update(state) {
      const pose = sceneState(state);
      const key = JSON.stringify(pose);
      if (key === signature) return;
      signature = key;
      hinge.rotation.y = pose.hatchOpen ? -THREE.MathUtils.degToRad(110) : 0;
      cover.rotation.x = pose.circuitOn ? 0 : -Math.PI * 0.65;
      lever.rotation.x = pose.circuitOn ? 0 : -Math.PI * 0.7;
      for (const entry of ledMaterials) {
        entry.material.color.copy(entry.color).multiplyScalar(pose.circuitOn ? 1 : 0.12);
        if (entry.intensity !== undefined) entry.material.emissiveIntensity = pose.circuitOn ? entry.intensity : 0;
      }
      renderer.shadowMap.needsUpdate = true;
    },
  };
}
