import * as THREE from 'three';
import { SHOCK_DURATION_MS } from '../steps/step1-power.js';

export function shockStrength(elapsed, reducedMotion = false) {
  return reducedMotion ? 0 : Math.max(0, 1 - elapsed / SHOCK_DURATION_MS);
}

export function createElectricShock(scene, view, contactPoint) {
  const count = 20;
  const coordinates = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(coordinates, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xffe39a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const sparks = new THREE.LineSegments(geometry, material);
  sparks.name = 'Electrical_Sparks'; sparks.visible = false;
  scene.add(sparks);
  let shock = null;
  let lastId = 0;
  return {
    update(state) {
      if (state.shock.id === lastId) return;
      lastId = state.shock.id;
      if (!lastId) { shock = null; sparks.visible = false; view.setShake(0); return; }
      shock = state.shock;
      sparks.position.copy(shock.point ? new THREE.Vector3(...shock.point) : contactPoint());
    },
    frame(now) {
      if (!shock) return;
      const age = Math.max(0, now - shock.at);
      view.setShake(shockStrength(age, view.reducedMotion));
      sparks.visible = age < 350;
      if (!sparks.visible) return;
      const seconds = view.reducedMotion ? 0.05 : Math.max(0.008, age / 1000);
      for (let index = 0; index < count; index++) {
        const angle = index * 2.39996;
        const speed = 0.4 + (index % 5) * 0.14;
        for (let end = 0; end < 2; end++) {
          const time = seconds * (end ? 1 : 0.58);
          const offset = index * 6 + end * 3;
          coordinates[offset] = Math.cos(angle) * speed * time;
          coordinates[offset + 1] = Math.sin(angle) * speed * time - 1.85 * time * time;
          coordinates[offset + 2] = 0.025 + time * (0.25 + index % 3 * 0.2);
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeBoundingSphere();
      material.opacity = 1 - age / 350;
    },
    snapshot() { return { shockId: lastId, sparkCount: count, sparksVisible: sparks.visible }; },
  };
}
