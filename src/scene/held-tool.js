import * as THREE from 'three';
import { TOOLS, canAct } from '../state/procedure.js';

export function createHeldTool(camera, root) {
  const holder = new THREE.Group();
  holder.name = 'Held_Tool';
  camera.add(holder);
  let selected;
  let disposable;
  let soundId = 0;
  let slipAt = -Infinity;
  return {
    update(state) {
      if (state.hatch.soundId !== soundId) {
        soundId = state.hatch.soundId;
        if (state.hatch.soundKind === 'slip') slipAt = Date.now();
      }
      holder.visible = canAct(state) && Boolean(state.selectedTool);
      if (state.selectedTool === selected) return;
      selected = state.selectedTool;
      holder.clear();
      disposable?.geometry.dispose(); disposable?.material.dispose(); disposable = null;
      if (!selected) return;
      const tool = TOOLS.find(item => item.id === selected);
      let visual;
      if (tool.model) {
        visual = root.getObjectByName(tool.model).clone(true);
        visual.position.set(0, 0, 0); visual.quaternion.identity(); visual.scale.setScalar(0.62);
        visual.rotation.z = -0.3;
      } else {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.14, 0.08, 0), new THREE.Vector3(0, -0.01, 0.035), new THREE.Vector3(0.14, 0.11, 0),
        ]);
        visual = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.012, 8, false), new THREE.MeshStandardMaterial({ color: tool.color, roughness: 0.75 }));
        disposable = visual;
      }
      // Clones never duplicate the semantic node names required by the GLB contract.
      visual.traverse(node => { node.name = `Held_${node.name || node.type}`; node.castShadow = false; node.receiveShadow = false; });
      holder.position.set(0.04, tool.model && selected !== 'lamp' ? -0.33 : -0.23, -0.7);
      holder.add(visual);
    },
    frame(now, reducedMotion) {
      const age = now - slipAt;
      const strength = !reducedMotion && age >= 0 && age < 250 ? (1 - age / 250) : 0;
      holder.rotation.z = Math.sin(age * 0.09) * strength * 0.14 || 0;
      holder.position.x = 0.04 + (Math.sin(age * 0.07) * strength * 0.018 || 0);
    },
  };
}
