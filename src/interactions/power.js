import * as THREE from 'three';
import { canAct, canUseBreaker } from '../state/procedure.js';
import { COVER_DURATION_MS, dragProgress, HATCH_TARGETS, isScrewdriver } from '../steps/step1-power.js';

const names = new Set(['Breaker_Cover', 'Breaker_Lever', ...HATCH_TARGETS]);
export function semanticTarget(object) {
  for (let node = object; node; node = node.parent) if (names.has(node.name)) return node;
  return null;
}
export function firstPowerHit(hits) {
  for (const hit of hits) {
    let visible = true;
    for (let node = hit.object; node; node = node.parent) if (!node.visible) visible = false;
    const target = semanticTarget(hit.object);
    if (visible && target) return { ...hit, target };
  }
  return null;
}

export function createPowerInteractions({ canvas, slider, root, camera, machine, projection }) {
  const roots = ['Breaker_Cover', 'Breaker_Lever', 'Hatch'].map(name => root.getObjectByName(name));
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let gesture = null;
  let keyboard = null;
  const consume = event => { event.preventDefault(); event.stopImmediatePropagation(); };

  function hitAt(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    root.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    return firstPowerHit(raycaster.intersectObjects(roots, true));
  }
  function release(g) {
    if (g?.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId);
  }
  function cancelPointer() {
    const g = gesture; gesture = null;
    if (g?.kind === 'lever') machine.dispatch({ type: 'POWER_DRAG_CANCEL', dragId: g.dragId });
    release(g);
  }
  function beginLever(element, event, travel, hitPoint) {
    if (!machine.dispatch({ type: 'POWER_DRAG_START' })) return false;
    const power = machine.state.power;
    gesture = { kind: 'lever', element, pointerId: event.pointerId, startY: event.clientY,
      initial: power.leverProgress, travel, dragId: power.dragId, hitPoint };
    element.setPointerCapture(event.pointerId);
    return true;
  }
  function down(event) {
    if (event.button !== 0 || gesture || !canAct(machine.state)) return;
    const hit = hitAt(event);
    if (!hit) return;
    const name = hit.target.name;
    if (name === 'Breaker_Cover' && canUseBreaker(machine.state)) {
      consume(event);
      machine.dispatch({ type: 'OPEN_POWER_COVER' });
      gesture = { kind: 'cover', element: canvas, pointerId: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
    } else if (name === 'Breaker_Lever' && canUseBreaker(machine.state)) {
      consume(event);
      beginLever(canvas, event, projection.leverTravel(camera, canvas.clientHeight, hit.point), hit.point);
    } else if (HATCH_TARGETS.includes(name) && isScrewdriver(machine.state.selectedTool)) {
      consume(event);
      machine.dispatch({ type: 'TOUCH_HATCH', nodeName: name, point: hit.point.toArray() });
    }
  }
  function move(event) {
    if (gesture?.pointerId === event.pointerId) {
      consume(event);
      if (gesture.kind === 'lever') machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId: gesture.dragId,
        progress: dragProgress(gesture.initial, gesture.startY, event.clientY, gesture.travel) });
      return;
    }
    if (event.target !== canvas) return;
    const hit = canAct(machine.state) ? hitAt(event) : null;
    canvas.style.cursor = hit?.target.name === 'Breaker_Lever' && machine.state.power.cover === 'open' ? 'ns-resize'
      : hit && (hit.target.name === 'Breaker_Cover' || isScrewdriver(machine.state.selectedTool)) ? 'pointer' : 'grab';
  }
  function up(event) {
    if (gesture?.pointerId !== event.pointerId) return;
    consume(event);
    const g = gesture; gesture = null;
    if (g.kind === 'lever') {
      machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId: g.dragId, progress: dragProgress(g.initial, g.startY, event.clientY, g.travel) });
      machine.dispatch({ type: 'POWER_DRAG_END', dragId: g.dragId });
    }
    release(g);
  }
  function lost(event) { if (gesture?.pointerId === event.pointerId) cancelPointer(); }
  for (const element of [canvas, slider]) {
    element.addEventListener('pointermove', move, { capture: true });
    element.addEventListener('pointerup', up, { capture: true });
    element.addEventListener('pointercancel', lost, { capture: true });
    element.addEventListener('lostpointercapture', lost);
  }
  canvas.addEventListener('pointerdown', down, { capture: true });
  slider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gesture) return;
    consume(event);
    slider.focus();
    beginLever(slider, event, Math.max(32, slider.clientHeight - 18));
  });
  slider.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) return;
    consume(event);
    if (event.key === 'Escape') { cancelKeyboard(); return; }
    if (!keyboard) {
      if (!machine.dispatch({ type: 'POWER_DRAG_START' })) return;
      keyboard = { dragId: machine.state.power.dragId };
    }
    const power = machine.state.power;
    const progress = event.key === 'End' ? 1 : event.key === 'Home' ? 0
      : Math.round((power.leverProgress + (event.key === 'ArrowDown' ? 0.1 : -0.1)) * 10) / 10;
    machine.dispatch({ type: 'POWER_DRAG_MOVE', dragId: keyboard.dragId, progress });
  });
  slider.addEventListener('keyup', event => {
    if (!keyboard || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    consume(event);
    const g = keyboard; keyboard = null;
    machine.dispatch({ type: 'POWER_DRAG_END', dragId: g.dragId });
  });
  function cancelKeyboard() {
    const g = keyboard; keyboard = null;
    if (g) machine.dispatch({ type: 'POWER_DRAG_CANCEL', dragId: g.dragId });
  }
  slider.addEventListener('blur', cancelKeyboard);
  window.addEventListener('blur', () => { cancelPointer(); cancelKeyboard(); });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && gesture?.kind === 'lever') { consume(event); cancelPointer(); }
  }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelPointer(); cancelKeyboard(); } });

  return {
    sync(state) {
      if (!canAct(state) || !state.power.dragging) {
        if (gesture?.kind === 'lever') { const g = gesture; gesture = null; release(g); }
        keyboard = null;
      }
      if (!canAct(state)) { if (gesture) { const g = gesture; gesture = null; release(g); } canvas.style.cursor = ''; }
    },
    frame(now) {
      const state = machine.state;
      if (state.power.cover === 'opening' && now - state.power.coverStartedAt >= COVER_DURATION_MS) {
        machine.dispatch({ type: 'POWER_COVER_READY', coverId: state.power.coverId });
      }
      if (machine.state.shock.active && now >= machine.state.shock.until) {
        machine.dispatch({ type: 'SHOCK_FINISHED', shockId: machine.state.shock.id });
      }
    },
    targets() {
      camera.updateMatrixWorld();
      const rect = canvas.getBoundingClientRect();
      const result = {};
      for (const [key, name] of [['cover', 'Breaker_Cover'], ['lever', 'Breaker_Lever'], ['hatch', 'Hatch']]) {
        const p = projection.targetPoint(name).project(camera);
        result[key] = { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
      }
      result.travel = projection.leverTravel(camera, rect.height);
      return result;
    },
  };
}
