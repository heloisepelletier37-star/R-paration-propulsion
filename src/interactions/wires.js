import * as THREE from 'three';
import { canRepairWires } from '../state/procedure.js';
import { SIDES } from '../steps/step3-wires.js';
import { pointerAngle, circularDelta, keyTurnSlices } from '../steps/step2-hatch.js';

export function createWireInteractions({ canvas, camera, root, machine, wiring, controls, removeSlider, movePad, aimButton, releaseButton, endButtons }) {
  const ray = new THREE.Raycaster(); const point = new THREE.Vector2();
  const terminals = Array.from({ length: 6 }, (_, i) => SIDES.map(side => root.getObjectByName(`Terminal_Screw_${side}_${i + 1}`))).flat();
  let pointer = null; let q = null; let qHeld = false; let keys = null;
  const consume = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const typing = event => event.target.closest?.('input, textarea, select, [contenteditable="true"]');
  const wire = () => machine.state.wires.items.find(w => w.id === machine.state.wires.selected);
  const project = p => {
    camera.updateMatrixWorld(); const rect = canvas.getBoundingClientRect(); const v = p.clone().project(camera);
    return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 };
  };
  function setRay(x, y) {
    const rect = canvas.getBoundingClientRect(); camera.updateMatrixWorld();
    point.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2); ray.setFromCamera(point, camera);
  }
  function onPlane(x, y, z) {
    setRay(x, y); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), new THREE.Vector3());
  }
  function pick(event) {
    root.updateWorldMatrix(true, true); wiring.group.updateWorldMatrix(true, true); setRay(event.clientX, event.clientY);
    const candidates = wiring.pickPoints();
    let nearest; let distance = 11;
    for (const c of candidates.filter(c => c.kind !== 'wire')) {
      const p = project(c.point); const d = Math.hypot(p.x - event.clientX, p.y - event.clientY);
      if (d < distance) { nearest = c; distance = d; }
    }
    if (nearest) return nearest;
    for (const hit of ray.intersectObjects([wiring.group, ...terminals], true)) {
      let visible = true; for (let n = hit.object; n; n = n.parent) if (!n.visible) visible = false;
      if (!visible) continue;
      for (let n = hit.object; n; n = n.parent) {
        if (n.userData.wireId) return { ...n.userData, point: hit.point };
        const match = /^Terminal_Screw_([LR])_(\d)$/.exec(n.name);
        if (match) return { kind: 'terminal', side: match[1], wireId: `wire${match[2]}`, point: hit.point };
      }
    }
    distance = 8;
    for (const c of candidates.filter(c => c.kind === 'wire')) {
      const p = project(c.point); const d = Math.hypot(p.x - event.clientX, p.y - event.clientY);
      if (d < distance) { nearest = c; distance = d; }
    }
    return nearest ?? null;
  }
  const release = g => { if (g?.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId); };
  function capture(element, event, data) { pointer = { ...data, element, pointerId: event.pointerId }; element.setPointerCapture(event.pointerId); }
  function stopPointer(cancelled) {
    const g = pointer; pointer = null;
    if (g?.id) machine.dispatch({ type: cancelled ? 'WIRE_CANCEL' : g.kind === 'terminal' ? 'WIRE_TERMINAL_END' : g.kind === 'end' ? 'WIRE_END_END' : 'WIRE_REMOVE_END', gestureId: g.id });
    release(g);
  }
  function stopKeys(cancelled) {
    const g = q ?? keys; q = null; keys = null;
    if (g) machine.dispatch({ type: cancelled ? 'WIRE_CANCEL' : g.kind === 'remove' ? 'WIRE_REMOVE_END' : 'WIRE_TERMINAL_END', gestureId: g.id });
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer || q || keys || !canRepairWires(machine.state)) return;
    const hit = pick(event); if (!hit) return;
    consume(event); canvas.focus({ preventScroll: true });
    const item = machine.state.wires.items.find(w => w.id === hit.wireId);
    if (hit.kind === 'terminal') {
      machine.dispatch({ type: 'WIRE_TERMINAL_SELECT', wireId: hit.wireId, side: hit.side });
      machine.dispatch({ type: 'WIRE_TERMINAL_START', wireId: hit.wireId, side: hit.side });
      const g = machine.state.wires.gesture;
      const center = project(wiring.terminalPoint(hit.wireId, hit.side));
      capture(canvas, event, g?.kind === 'terminal' ? { kind: 'terminal', id: g.id, center, angle: pointerAngle(event.clientX, event.clientY, center) } : { kind: 'blocked' });
    } else if (hit.kind === 'end') {
      if (!item.replacement.stripped[hit.side]) {
        machine.dispatch({ type: 'WIRE_STRIP', wireId: hit.wireId, side: hit.side }); capture(canvas, event, { kind: 'blocked' });
      } else {
        machine.dispatch({ type: 'WIRE_END_START', wireId: hit.wireId, side: hit.side }); const g = machine.state.wires.gesture;
        capture(canvas, event, g?.kind === 'end' ? { kind: 'end', id: g.id, wireId: hit.wireId, side: hit.side } : { kind: 'blocked' });
      }
    } else {
      machine.dispatch({ type: 'WIRE_INSPECT', wireId: hit.wireId });
      if (item.removed && !item.replacement) machine.dispatch({ type: 'WIRE_CHOOSE_REPLACEMENT', wireId: item.id });
      capture(canvas, event, { kind: 'candidate', wireId: hit.wireId, x: event.clientX, y: event.clientY,
        start: onPlane(event.clientX, event.clientY, wiring.midpoint(hit.wireId).z) });
    }
  }, { capture: true });
  canvas.addEventListener('contextmenu', event => {
    if (!canRepairWires(machine.state)) return;
    const hit = pick(event); if (!hit) return;
    consume(event); machine.dispatch({ type: 'WIRE_INSPECT', wireId: hit.wireId }); machine.dispatch({ type: 'WIRE_MARK', wireId: hit.wireId });
  });
  function move(event) {
    const g = pointer;
    if (!g || g.pointerId !== event.pointerId) {
      if (event.target === canvas) { const hit = canRepairWires(machine.state) ? pick(event) : null; wiring.hover(hit?.wireId ?? null); if (canRepairWires(machine.state)) canvas.style.cursor = hit ? 'pointer' : 'grab'; }
      return;
    }
    consume(event);
    if (g.kind === 'terminal') {
      const angle = pointerAngle(event.clientX, event.clientY, g.center);
      if (angle !== null && g.angle !== null) machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId: g.id, radians: circularDelta(g.angle, angle) });
      g.angle = angle;
    } else if (g.kind === 'candidate' || g.kind === 'remove') {
      if (g.kind === 'candidate' && Math.hypot(event.clientX - g.x, event.clientY - g.y) > 8) {
        machine.dispatch({ type: 'WIRE_REMOVE_START', wireId: g.wireId }); const active = machine.state.wires.gesture;
        if (active?.kind === 'remove') { g.kind = 'remove'; g.id = active.id; } else g.kind = 'blocked';
      }
      if (g.kind === 'remove' && g.start) {
        const p = onPlane(event.clientX, event.clientY, g.start.z);
        if (p) machine.dispatch({ type: 'WIRE_REMOVE_MOVE', gestureId: g.id, progress: wiring.contains(p) ? 0 : 1, position: p.clone().sub(g.start).toArray() });
      }
    } else if (g.kind === 'remove-control') {
      const progress = Math.max(0, Math.min(1, (event.clientY - g.y) / 90));
      machine.dispatch({ type: 'WIRE_REMOVE_MOVE', gestureId: g.id, progress, position: [0, -1.4 * progress, 0] });
    } else if (g.kind === 'end') {
      const target = wiring.anchor(g.wireId, g.side); const p = onPlane(event.clientX, event.clientY, target.z);
      if (p) machine.dispatch({ type: 'WIRE_END_MOVE', gestureId: g.id, position: p.toArray(), distance: p.distanceTo(target) });
    }
  }
  for (const element of [canvas, removeSlider]) {
    element.addEventListener('pointermove', move, { capture: true });
    element.addEventListener('pointerup', event => { if (pointer?.pointerId === event.pointerId) { move(event); consume(event); stopPointer(false); } }, { capture: true });
    for (const name of ['pointercancel', 'lostpointercapture']) element.addEventListener(name, event => { if (pointer?.pointerId === event.pointerId) stopPointer(true); });
  }
  removeSlider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer || !canRepairWires(machine.state)) return;
    consume(event); removeSlider.focus(); machine.dispatch({ type: 'WIRE_REMOVE_START' }); const g = machine.state.wires.gesture;
    capture(removeSlider, event, g?.kind === 'remove' ? { kind: 'remove-control', id: g.id, y: event.clientY } : { kind: 'blocked' });
  });
  removeSlider.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !canRepairWires(machine.state)) return;
    consume(event);
    if (!keys) { machine.dispatch({ type: 'WIRE_REMOVE_START' }); const g = machine.state.wires.gesture; if (g?.kind !== 'remove') return; keys = { id: g.id, kind: 'remove' }; }
    const g = machine.state.wires.gesture; const progress = event.key === 'End' ? 1 : event.key === 'Home' ? 0 : Math.max(0, Math.min(1, g.progress + (event.key === 'ArrowDown' ? 0.1 : -0.1)));
    machine.dispatch({ type: 'WIRE_REMOVE_MOVE', gestureId: keys.id, progress, position: [0, -1.4 * progress, 0] });
  });
  removeSlider.addEventListener('keyup', event => { if (keys && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { consume(event); stopKeys(false); } });
  function aim() {
    const g = machine.state.wires.gesture; if (g?.kind !== 'end') return;
    const p = wiring.anchor(g.wireId, g.side); p.x += 0.01;
    machine.dispatch({ type: 'WIRE_END_MOVE', gestureId: g.id, position: p.toArray(), distance: 0.01 });
  }
  function drop() { const g = machine.state.wires.gesture; if (g?.kind === 'end') machine.dispatch({ type: 'WIRE_END_END', gestureId: g.id }); }
  aimButton.addEventListener('click', aim); releaseButton.addEventListener('click', drop);
  endButtons.addEventListener('click', event => {
    const button = event.target.closest('[data-wire-end]'); const item = wire(); if (!button || button.disabled || !item?.replacement) return;
    const side = button.dataset.wireEnd;
    if (!item.replacement.stripped[side]) machine.dispatch({ type: 'WIRE_STRIP', side });
    else { machine.dispatch({ type: 'WIRE_END_START', side }); if (machine.state.wires.gesture?.kind === 'end') movePad.focus(); }
  });
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || typing(event) || !canRepairWires(machine.state)) return;
    const g = machine.state.wires.gesture;
    if (event.key === 'Escape' && (g || pointer)) { consume(event); stopPointer(true); stopKeys(true); if (machine.state.wires.gesture) machine.dispatch({ type: 'WIRE_CANCEL', gestureId: g.id }); return; }
    if (event.key.toLowerCase() === 'e' && !event.repeat) { consume(event); machine.dispatch({ type: 'WIRE_MARK' }); return; }
    if (g?.kind === 'end' && !pointer) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
      if (d) {
        consume(event); const p = g.position ? new THREE.Vector3(...g.position) : wiring.endpoint(g.wireId, g.side);
        const step = event.shiftKey ? 0.002 : 0.01; p.x += d[0] * step; p.y += d[1] * step;
        machine.dispatch({ type: 'WIRE_END_MOVE', gestureId: g.id, position: p.toArray(), distance: p.distanceTo(wiring.anchor(g.wireId, g.side)) }); return;
      }
      if (event.key.toLowerCase() === 'a') { consume(event); aim(); return; }
      if (event.key === 'Enter') { consume(event); drop(); return; }
    }
    if (event.key.toLowerCase() !== 'q' || qHeld || keys || (pointer && pointer.kind !== 'terminal') || (g && g.kind !== 'terminal')) return;
    consume(event); qHeld = true;
    if (pointer?.kind === 'terminal') { const p = pointer; pointer = null; release(p); }
    else machine.dispatch({ type: 'WIRE_TERMINAL_START' });
    const active = machine.state.wires.gesture;
    if (active?.kind === 'terminal') q = { id: active.id, action: active.action, last: Date.now() };
  }, { capture: true });
  window.addEventListener('keyup', event => { if (event.key.toLowerCase() === 'q') { qHeld = false; if (q) { consume(event); stopKeys(false); } } }, { capture: true });
  const blur = () => { stopPointer(true); stopKeys(true); const g = machine.state.wires.gesture; if (g) machine.dispatch({ type: 'WIRE_CANCEL', gestureId: g.id }); qHeld = false; };
  window.addEventListener('blur', blur); document.addEventListener('visibilitychange', () => { if (document.hidden) blur(); });
  return {
    get busy() { return Boolean(pointer && pointer.kind !== 'blocked'); },
    sync(state) {
      const g = state.wires.gesture;
      if (pointer && (!canRepairWires(state) || (pointer.id && pointer.id !== g?.id))) { const p = pointer; pointer = null; release(p); }
      if (q?.id !== g?.id) q = null;
      if (keys?.id !== g?.id) keys = null;
      if (!canRepairWires(state)) { qHeld = false; wiring.hover(null); }
    },
    frame(now) {
      if (!q) return;
      const g = q; const elapsed = now - g.last; g.last = now;
      for (const angle of keyTurnSlices(elapsed)) {
        if (machine.state.wires.gesture?.id !== g.id) break;
        machine.dispatch({ type: 'WIRE_TERMINAL_MOVE', gestureId: g.id, radians: angle * (g.action === 'loosen' ? 1 : -1) });
      }
    },
    targets() {
      return Object.fromEntries(machine.state.wires.items.map(item => [item.id, { body: project(wiring.bodyPoint(item.id)),
        terminals: Object.fromEntries(SIDES.map(side => [side, project(wiring.terminalPoint(item.id, side))])),
        ends: Object.fromEntries(SIDES.map(side => [side, project(wiring.endpoint(item.id, side))])),
        anchors: Object.fromEntries(SIDES.map(side => [side, project(wiring.anchor(item.id, side))])) }]));
    },
  };
}
