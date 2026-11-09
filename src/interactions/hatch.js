import * as THREE from 'three';
import { canOpenHatch } from '../state/procedure.js';
import { ALL_SCREWS, removed, removedCount, pointerAngle, circularDelta, hatchDragProgress, HATCH_SETTLE_MS, KEY_TURN_SPEED } from '../steps/step2-hatch.js';
import { firstPowerHit } from './power.js';

export function createHatchInteractions({ canvas, controls, slider, guide, root, camera, machine, projection }) {
  const hatch = root.getObjectByName('Hatch');
  const raycaster = new THREE.Raycaster();
  let pointer = null;
  let q = null;
  let qHeld = false;
  let keys = null;
  const consume = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const screenPoint = name => {
    const rect = canvas.getBoundingClientRect();
    camera.updateMatrixWorld();
    const p = projection.targetPoint(name).project(camera);
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  };
  function hitAt(event) {
    const rect = canvas.getBoundingClientRect();
    root.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const hit = firstPowerHit(raycaster.intersectObject(hatch, true));
    if (!hit) return null;
    if (ALL_SCREWS.includes(hit.target.name)) return hit;
    // Small screw heads remain selectable on narrow screens and at limited zoom.
    let nearest; let distance = 12;
    for (const id of ALL_SCREWS) {
      if (removed(machine.state.hatch.screws[id])) continue;
      const p = screenPoint(id); const d = Math.hypot(event.clientX - p.x, event.clientY - p.y);
      if (d < distance) { distance = d; nearest = root.getObjectByName(id); }
    }
    return nearest ? { ...hit, target: nearest } : hit;
  }
  function capture(element, event, gesture) {
    pointer = { ...gesture, element, pointerId: event.pointerId };
    element.setPointerCapture(event.pointerId);
  }
  function release(g) { if (g?.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId); }
  function stopPointer(cancelled) {
    const g = pointer; pointer = null;
    if (g?.kind === 'screw') machine.dispatch({ type: 'SCREW_TURN_END', gestureId: g.id });
    if (g?.kind === 'hatch') machine.dispatch({ type: cancelled ? 'HATCH_DRAG_CANCEL' : 'HATCH_DRAG_END', gestureId: g.id });
    release(g);
  }
  function stopKeys(cancelled) {
    const turn = q; q = null;
    if (turn) machine.dispatch({ type: 'SCREW_TURN_END', gestureId: turn.id });
    const drag = keys; keys = null;
    if (drag) machine.dispatch({ type: cancelled ? 'HATCH_DRAG_CANCEL' : 'HATCH_DRAG_END', gestureId: drag.id });
  }
  function beginHatch(element, event, travel, edge = true) {
    machine.dispatch({ type: 'HATCH_DRAG_START', edge });
    const h = machine.state.hatch;
    capture(element, event, h.dragging ? { kind: 'hatch', id: h.gestureId, initial: h.progress, x: event.clientX, travel } : { kind: 'blocked' });
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer || q || keys || !canOpenHatch(machine.state)) return;
    const hit = hitAt(event); if (!hit) return;
    consume(event); canvas.focus({ preventScroll: true });
    if (ALL_SCREWS.includes(hit.target.name)) {
      const center = screenPoint(hit.target.name);
      machine.dispatch({ type: 'SCREW_TURN_START', screwId: hit.target.name });
      const h = machine.state.hatch;
      capture(canvas, event, h.turning ? { kind: 'screw', id: h.gestureId, center, angle: pointerAngle(event.clientX, event.clientY, center) } : { kind: 'blocked' });
    } else beginHatch(canvas, event, projection.hatchTravel(camera, canvas.clientWidth), removedCount(machine.state.hatch) < 4 || projection.isHatchEdge(hit.point));
  }, { capture: true });
  slider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer || q || keys || !canOpenHatch(machine.state)) return;
    consume(event); slider.focus(); beginHatch(slider, event, Math.max(72, slider.clientWidth - 20));
  }, { capture: true });
  function move(event) {
    const g = pointer;
    if (g?.pointerId === event.pointerId) {
      consume(event);
      if (g.kind === 'screw') {
        const angle = pointerAngle(event.clientX, event.clientY, g.center);
        if (angle !== null && g.angle !== null) machine.dispatch({ type: 'SCREW_TURN_MOVE', gestureId: g.id, radians: circularDelta(g.angle, angle) });
        g.angle = angle;
      } else if (g.kind === 'hatch') machine.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId: g.id,
        progress: hatchDragProgress(g.initial, g.x, event.clientX, g.travel) });
      return;
    }
    if (event.target === canvas && canOpenHatch(machine.state)) canvas.style.cursor = hitAt(event) ? 'pointer' : 'grab';
  }
  for (const element of [canvas, slider]) {
    element.addEventListener('pointermove', move, { capture: true });
    element.addEventListener('pointerup', event => {
      if (pointer?.pointerId !== event.pointerId) return;
      move(event); consume(event); stopPointer(false);
    }, { capture: true });
    for (const name of ['pointercancel', 'lostpointercapture']) element.addEventListener(name, event => {
      if (pointer?.pointerId === event.pointerId) stopPointer(true);
    });
  }
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape' && (pointer || q || keys)) {
      consume(event); stopPointer(true); stopKeys(true); return;
    }
    if (event.key.toLowerCase() !== 'q' || !canOpenHatch(machine.state) || (!controls.contains(event.target) && event.target !== canvas)) return;
    consume(event);
    if (qHeld || pointer || keys) return;
    qHeld = true;
    machine.dispatch({ type: 'SCREW_TURN_START' });
    if (machine.state.hatch.turning) q = { id: machine.state.hatch.gestureId, last: Date.now() };
  }, { capture: true });
  window.addEventListener('keyup', event => {
    if (event.key.toLowerCase() !== 'q') return;
    qHeld = false;
    if (q) { consume(event); stopKeys(false); }
  }, { capture: true });
  slider.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || pointer || q || !canOpenHatch(machine.state)) return;
    consume(event);
    if (!keys) {
      machine.dispatch({ type: 'HATCH_DRAG_START' });
      if (!machine.state.hatch.dragging) return;
      keys = { id: machine.state.hatch.gestureId };
    }
    const progress = event.key === 'End' ? 1 : event.key === 'Home' ? 0
      : Math.round((machine.state.hatch.progress + (event.key === 'ArrowLeft' ? 0.1 : -0.1)) * 10) / 10;
    machine.dispatch({ type: 'HATCH_DRAG_MOVE', gestureId: keys.id, progress });
  });
  slider.addEventListener('keyup', event => {
    if (!keys || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    consume(event); stopKeys(false);
  });
  const blur = () => { stopPointer(true); stopKeys(true); qHeld = false; };
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', () => { if (document.hidden) blur(); });
  controls.addEventListener('focusout', event => { if (!controls.contains(event.relatedTarget)) stopKeys(true); });
  canvas.addEventListener('blur', () => stopKeys(true));

  return {
    sync(state) {
      const h = state.hatch;
      if (pointer && (!canOpenHatch(state) || (pointer.kind === 'screw' && !h.turning) || (pointer.kind === 'hatch' && !h.dragging))) {
        const g = pointer; pointer = null; release(g);
      }
      if (!h.turning) q = null;
      if (!h.dragging) keys = null;
      if (!canOpenHatch(state)) qHeld = false;
    },
    frame(now) {
      if (q) {
        const elapsed = Math.max(0, Math.min(100, now - q.last)); q.last = now;
        machine.dispatch({ type: 'SCREW_TURN_MOVE', gestureId: q.id, radians: KEY_TURN_SPEED * elapsed / 1000 });
      }
      const h = machine.state.hatch;
      if (h.settling && now - h.settleStartedAt >= HATCH_SETTLE_MS) machine.dispatch({ type: 'HATCH_OPENED', settleId: h.settleId });
      guide.hidden = !canOpenHatch(machine.state) || !h.selectedScrew || removed(h.screws[h.selectedScrew]);
      if (!guide.hidden) {
        const p = pointer?.kind === 'screw' ? pointer.center : screenPoint(h.selectedScrew);
        const rect = canvas.getBoundingClientRect();
        guide.style.left = `${p.x - rect.left}px`; guide.style.top = `${p.y - rect.top}px`;
      }
    },
    targets() {
      return { screws: Object.fromEntries(ALL_SCREWS.map(id => [id, screenPoint(id)])), edge: screenPoint('Hatch_Edge'), travel: projection.hatchTravel(camera, canvas.clientWidth) };
    },
  };
}
