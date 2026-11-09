import * as THREE from 'three';
import { createPlaceholderAssets } from './assets/placeholders.js';
import { loadOptionalModels, loadOptionalHdri } from './assets/loader.js';
import { REQUIRED_NODES } from './assets/manifest.js';
import { createMarsAtmosphere, createShip } from './scene/mars.js';
import { createFirstPersonCamera } from './scene/camera.js';
import { addSceneLabels } from './scene/labels.js';
import { updateAlarm } from './scene/alarm.js';
import { createAlarmAudio } from './audio/alarm.js';
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
  const audio = createAlarmAudio(view.camera, alarm);
  machine.subscribe(state => {
    hud.render(state);
    lamp.intensity = state.headlamp ? 7 : 0;
  });

  function toggleLamp() {
    machine.dispatch({ type: 'TOGGLE_LAMP' });
    hud.feedback(`${textes.lamp} : ${machine.state.headlamp ? textes.on : textes.off}.`);
  }
  function resetView() {
    view.reset();
    hud.feedback(textes.resetFeedback);
  }
  hud.lampButton.addEventListener('click', toggleLamp);
  hud.resetButton.addEventListener('click', resetView);
  hud.audioButton.addEventListener('click', async () => {
    hud.audioButton.disabled = true;
    try {
      const enabled = await audio.toggle();
      machine.dispatch({ type: 'SET_AUDIO', enabled });
      hud.feedback(`${textes.audio} : ${enabled ? textes.on : textes.off}.`);
    } catch {
      hud.feedback(textes.audioError);
    } finally {
      hud.audioButton.disabled = false;
    }
  });
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.code === 'KeyL') { event.preventDefault(); toggleLamp(); }
    if (event.code === 'KeyR') { event.preventDefault(); resetView(); }
  });

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
  let lastElapsed = 0;
  renderer.setAnimationLoop(now => {
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    const elapsed = (now - startedAt) / 1000;
    lastTime = now;
    lastElapsed = elapsed;
    frameCount++;
    view.update(delta, elapsed);
    atmosphere.update(delta, elapsed, view.reducedMotion);
    const alarmOn = updateAlarm(alarm, elapsed);
    alarmLight.intensity = alarmOn ? 0.35 : 0;
    if (alarmOn !== lastAlarm) {
      hud.app.dataset.alarm = alarmOn ? 'on' : 'off';
      lastAlarm = alarmOn;
    }
    audio.update(elapsed);
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
          },
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          pixelRatio: renderer.getPixelRatio(),
          animation: { frames: frameCount, elapsed: lastElapsed },
        };
      },
    };
  }
}

start().catch(error => {
  console.error('[Mars] Initialisation impossible.', error);
  hud.fatal();
});
