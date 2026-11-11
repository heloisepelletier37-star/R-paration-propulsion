import * as THREE from 'three';
import { createPlaceholderAssets } from './assets/placeholders.js';
import { loadOptionalModels, loadOptionalHdri } from './assets/loader.js';
import { REQUIRED_NODES } from './assets/manifest.js';
import { createMarsAtmosphere, createShip } from './scene/mars.js';
import { createFirstPersonCamera } from './scene/camera.js';
import { addSceneLabels } from './scene/labels.js';
import { updateAlarm } from './scene/alarm.js';
import { createAlarmAudio } from './audio/alarm.js';
import { createHeldTool } from './scene/held-tool.js';
import { createProcedureProjection } from './scene/procedure.js';
import { createPowerInteractions } from './interactions/power.js';
import { createHatchInteractions } from './interactions/hatch.js';
import { createWireInteractions } from './interactions/wires.js';
import { createWiringScene } from './scene/wiring.js';
import { createElectricShock } from './scene/electric-shock.js';
import { canAct, sceneState } from './state/procedure.js';
import { createMachine } from './state/machine.js';
import { createHud } from './ui/hud.js';
import { textes } from './ui/textes.js';
import './ui/styles.css';

const hud = createHud();

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas: hud.canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const view = createFirstPersonCamera(hud.canvas);
  view.setEnabled(false);
  scene.add(view.camera);
  const atmosphere = createMarsAtmosphere(scene, renderer);
  const ship = createShip();
  scene.add(ship);
  const { root, assets } = createPlaceholderAssets();
  scene.add(root);
  const machine = createMachine();

  const available = new Set(__AVAILABLE_ASSETS__);
  await loadOptionalModels({ root, assets, available, onProgress: value => hud.progress(value) });
  await loadOptionalHdri(scene, renderer, available, atmosphere.disposeEnvironment);
  addSceneLabels(root, ship);
  // The initial scene has no moving repair parts. Reuse its shadow map while
  // looking around; future object interactions must mark needsUpdate again.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const alarm = root.getObjectByName('Alarm_Light');
  const alarmLight = new THREE.PointLight(0xff3822, 0, 1.2, 2);
  alarmLight.position.set(0, 0, 0.16);
  alarm.add(alarmLight);
  const lamp = new THREE.SpotLight(0xfff3d7, 0, 12, 0.47, 0.6, 1.5);
  lamp.position.set(0.08, 0.08, -0.05);
  lamp.target.position.set(0, 0, -4);
  view.camera.add(lamp, lamp.target);
  const audio = createAlarmAudio(view.camera, alarm, () => {
    machine.dispatch({ type: 'SET_AUDIO', enabled: false });
    hud.feedback(textes.controls.audioError);
  });
  const heldTool = createHeldTool(view.camera, root);
  const projection = createProcedureProjection(root, renderer);
  const wiring = createWiringScene(scene, root, renderer);
  const powerInteractions = createPowerInteractions({ canvas: hud.canvas, slider: hud.leverControl, root, camera: view.camera, machine, projection });
  const hatchInteractions = createHatchInteractions({ canvas: hud.canvas, controls: hud.hatchControls, slider: hud.hatchSlider, guide: hud.screwGuide, root, camera: view.camera, machine, projection });
  const wireInteractions = createWireInteractions({ canvas: hud.canvas, camera: view.camera, root, machine, wiring,
    controls: hud.wireControls, removeSlider: hud.wireRemove, movePad: hud.wireMove, aimButton: hud.wireAim, releaseButton: hud.wireRelease, endButtons: hud.wireEnds });
  const electricShock = createElectricShock(scene, view, () => projection.targetPoint('Hatch'));
  let lastSoundMessage;
  let audioRequest = 0;
  let lastElapsed = 0;
  let lastCircuit;
  let lastShock = 0;
  let lastRelease = 0;
  let lastHatchSound = 0;
  let lastWireSound = 0;
  let lastStartup = 0;

  function notifyMessage(state) {
    if (state.phase === 'welcome') lastSoundMessage = undefined;
    if (state.message && state.audio && !state.shock.active && state.message.id !== lastSoundMessage && audio.ping()) lastSoundMessage = state.message.id;
  }

  async function setAudio(enabled) {
    const request = ++audioRequest;
    hud.audioButton.disabled = true;
    try {
      const actual = await audio.setEnabled(enabled);
      if (request !== audioRequest) return;
      machine.dispatch({ type: 'SET_AUDIO', enabled: actual });
      if (enabled && !actual) hud.feedback(textes.controls.audioError);
      notifyMessage(machine.state);
    } catch {
      if (request === audioRequest) {
        machine.dispatch({ type: 'SET_AUDIO', enabled: false });
        hud.feedback(textes.controls.audioError);
      }
    } finally {
      if (request === audioRequest) hud.audioButton.disabled = false;
    }
  }

  hud.connect(event => {
    if (event.type === 'TOUCH_HATCH' && !event.point) event = { ...event, point: projection.targetPoint('Hatch').toArray() };
    const starting = event.type === 'START' && machine.state.phase === 'welcome';
    // Starting the mission never depends on an optional browser permission.
    // Enable audio separately: resume() can reject or remain pending in an iframe.
    const changed = machine.dispatch(starting ? { ...event, audio: false } : event);
    if (changed && ['START', 'RESTART'].includes(event.type)) view.reset();
    if (changed && starting) void setAudio(event.audio);
    if (changed && event.type === 'SELECT_TOOL') {
      const id = machine.state.selectedTool;
      hud.feedback(id ? textes.tools.selected(textes.tools[id].detail) : textes.tools.none);
    }
  });
  machine.subscribe(state => {
    hud.render(state);
    const busy = state.power.dragging || state.hatch.turning || state.hatch.dragging || Boolean(state.wires.gesture);
    const inspected = state.wires.items.find(w => w.id === state.wires.selected);
    view.inspect(state.stepIndex === 2 && state.headlamp && inspected?.inspected ? wiring.midpoint(inspected.id) : null);
    view.setBusy(busy); view.setEnabled(canAct(state) && !busy);
    lamp.intensity = state.headlamp && canAct(state) ? 7 : 0;
    heldTool.update(state);
    projection.update(state);
    wiring.update(state);
    powerInteractions.sync(state);
    hatchInteractions.sync(state);
    wireInteractions.sync(state);
    electricShock.update(state);
    const pose = sceneState(state);
    audio.update(lastElapsed, pose.circuitOn, pose.alarmActive);
    if (lastCircuit !== undefined && lastCircuit !== pose.circuitOn) audio.effect('switch');
    lastCircuit = pose.circuitOn;
    if (state.phase === 'welcome') { lastStartup = 0; audio.stopEffects(); lastShock = 0; lastRelease = 0; lastHatchSound = 0; lastWireSound = 0; }
    if (state.shock.id !== lastShock) { lastShock = state.shock.id; if (lastShock) audio.effect('shock'); }
    if (state.power.releaseId !== lastRelease) {
      lastRelease = state.power.releaseId;
      const outcome = state.power.lastRelease;
      hud.feedback(outcome === 'short' ? textes.powerControls.short : outcome === 'success' ? textes.powerControls.cut : outcome === 'restored' ? textes.powerControls.restored : textes.powerControls.cancelled);
    }
    if (state.hatch.soundId !== lastHatchSound) {
      lastHatchSound = state.hatch.soundId;
      if (lastHatchSound) audio.effect(state.hatch.soundKind);
    }
    if (state.test.startupId !== lastStartup) {
      lastStartup = state.test.startupId;
      if (lastStartup) { audio.effect('startup'); view.startPropulsion(state.test.startupAt); hud.feedback(textes.testControls.startup); }
    }
    if (state.wires.soundId !== lastWireSound) { lastWireSound = state.wires.soundId; if (lastWireSound) audio.effect(state.wires.soundKind); }
    notifyMessage(state);
  });

  function toggleLamp() {
    if (!canAct(machine.state)) return;
    machine.dispatch({ type: 'TOGGLE_LAMP' });
    hud.feedback(`${textes.controls.lamp} : ${machine.state.headlamp ? textes.controls.on : textes.controls.off}.`);
  }
  function resetView() {
    if (!canAct(machine.state) || machine.state.power.dragging || machine.state.hatch.turning || machine.state.hatch.dragging || machine.state.wires.gesture) return;
    if (machine.state.stepIndex === 2 && machine.state.wires.selected) machine.dispatch({ type: 'WIRE_CLEAR_SELECTION' });
    view.reset();
    machine.dispatch({ type: 'ACTIVITY' });
    hud.feedback(textes.controls.resetFeedback);
  }
  hud.lampButton.addEventListener('click', toggleLamp);
  hud.resetButton.addEventListener('click', resetView);
  hud.audioButton.addEventListener('click', () => void setAudio(!machine.state.audio));
  window.addEventListener('keydown', event => {
    const target = event.target instanceof Element ? event.target : document.body;
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || !canAct(machine.state)
        || target.closest('input, textarea, select')) return;
    if (event.code === 'KeyL') { event.preventDefault(); toggleLamp(); }
    if (event.code === 'KeyR') { event.preventDefault(); resetView(); }
  });
  for (const type of ['pointerdown', 'keydown', 'wheel']) hud.canvas.addEventListener(type, () => machine.dispatch({ type: 'ACTIVITY' }), { passive: true });
  setInterval(() => machine.dispatch({ type: 'TICK' }), 1000);

  const resize = () => {
    const { width, height } = hud.canvas.getBoundingClientRect();
    view.resize(width, height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height, false);
  };
  new ResizeObserver(resize).observe(hud.canvas);
  resize();
  let lastTime = performance.now();
  const startedAt = lastTime;
  let lastAlarm;
  let frameCount = 0;
  renderer.setAnimationLoop(now => {
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    const elapsed = (now - startedAt) / 1000;
    lastTime = now;
    lastElapsed = elapsed;
    frameCount++;
    const wallTime = Date.now();
    powerInteractions.frame(wallTime);
    hatchInteractions.frame(wallTime);
    wireInteractions.frame(wallTime);
    projection.frame(wallTime);
    wiring.frame(delta);
    heldTool.frame(wallTime, view.reducedMotion);
    const busy = machine.state.power.dragging || machine.state.hatch.turning || machine.state.hatch.dragging || Boolean(machine.state.wires.gesture) || wireInteractions.busy;
    view.setBusy(busy); view.setEnabled(canAct(machine.state) && !busy);
    electricShock.frame(wallTime);
    view.update(delta, elapsed);
    atmosphere.update(delta, elapsed, view.reducedMotion);
    const physical = sceneState(machine.state);
    const alarmOn = updateAlarm(alarm, elapsed, physical.alarmActive);
    alarmLight.intensity = alarmOn ? 0.35 : 0;
    if (alarmOn !== lastAlarm) {
      hud.app.dataset.alarm = alarmOn ? 'on' : 'off';
      lastAlarm = alarmOn;
    }
    audio.update(elapsed, physical.circuitOn, physical.alarmActive);
    renderer.render(scene, view.camera);
  });
  machine.dispatch({ type: 'SCENE_READY' });
  hud.ready();

  // Read-only diagnostics for local development; omitted in production builds.
  if (import.meta.env.DEV) {
    window.__MARS_DEBUG__ = {
      snapshot() {
        return {
          nodes: REQUIRED_NODES.map(name => ({ name, count: scene.getObjectsByProperty('name', name).length })),
          state: machine.state,
          camera: {
            position: view.camera.position.toArray(),
            yaw: view.controls.getAzimuthalAngle(),
            pitch: view.controls.getPolarAngle() - Math.PI / 2,
            fov: view.fov,
            verticalFov: view.camera.fov,
            inspectionReady: view.inspectionReady,
          },
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          pixelRatio: renderer.getPixelRatio(),
          animation: { frames: frameCount, elapsed: lastElapsed },
          interactions: powerInteractions.targets(),
          hatchTargets: hatchInteractions.targets(),
          wireTargets: wireInteractions.targets(),
          wiring: wiring.snapshot(),
          visual: projection.snapshot(),
          audio: audio.snapshot(),
          effect: electricShock.snapshot(),
        };
      },
    };
  }
}

start().catch(error => {
  console.error('[Mars] Initialisation impossible.', error);
  hud.fatal();
});
