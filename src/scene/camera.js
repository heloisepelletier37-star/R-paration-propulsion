import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const VIEW_LIMITS = Object.freeze({ yaw: 0.34, pitch: 0.2, minFov: 46, maxFov: 58 });

export function clampView(yaw, pitch) {
  return {
    yaw: THREE.MathUtils.clamp(yaw, -VIEW_LIMITS.yaw, VIEW_LIMITS.yaw),
    pitch: THREE.MathUtils.clamp(pitch, -VIEW_LIMITS.pitch, VIEW_LIMITS.pitch),
  };
}

export function createFirstPersonCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 300);
  const eyePosition = new THREE.Vector3(0, 1.23, 4.25);
  // OrbitControls drives only an orientation probe. Its orbital translation is
  // never copied to the real camera: the astronaut stays at a fixed eye position.
  const probe = new THREE.PerspectiveCamera();
  probe.position.set(0, 0, 1);
  const controls = new OrbitControls(probe, canvas);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.32;
  controls.minAzimuthAngle = -VIEW_LIMITS.yaw;
  controls.maxAzimuthAngle = VIEW_LIMITS.yaw;
  controls.minPolarAngle = Math.PI / 2 - VIEW_LIMITS.pitch;
  controls.maxPolarAngle = Math.PI / 2 + VIEW_LIMITS.pitch;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const spherical = new THREE.Spherical();
  let lensFov = 50;

  function updateProjection() {
    // Preserve a useful horizontal field of view on narrow screens, rather than
    // cropping the power box and alarm out of the astronaut's initial view.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(lensFov / 2)) / Math.min(camera.aspect, 1),
    ));
    camera.updateProjectionMatrix();
  }

  function zoom(amount) {
    lensFov = THREE.MathUtils.clamp(lensFov + amount, VIEW_LIMITS.minFov, VIEW_LIMITS.maxFov);
    updateProjection();
  }

  function reset() {
    // Clear pending mouse inertia before restoring the saved forward view.
    controls.enableDamping = false;
    controls.update();
    controls.reset();
    controls.enableDamping = true;
    lensFov = 50;
    updateProjection();
  }

  canvas.addEventListener('pointerdown', () => { if (controls.enabled) canvas.focus({ preventScroll: true }); });
  canvas.addEventListener('wheel', event => {
    if (!controls.enabled) return;
    event.preventDefault();
    zoom(Math.sign(event.deltaY));
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    if (!controls.enabled) return;
    const directions = {
      ArrowLeft: [-0.035, 0], ArrowRight: [0.035, 0],
      ArrowUp: [0, -0.025], ArrowDown: [0, 0.025],
    };
    if (directions[event.key]) {
      event.preventDefault();
      spherical.setFromVector3(probe.position);
      const [x, y] = directions[event.key];
      const view = clampView(spherical.theta + x, spherical.phi - Math.PI / 2 + y);
      spherical.theta = view.yaw;
      spherical.phi = Math.PI / 2 + view.pitch;
      probe.position.setFromSpherical(spherical);
      probe.lookAt(controls.target);
      controls.update();
    }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(-1); }
    if (event.key === '-') { event.preventDefault(); zoom(1); }
  });

  return {
    camera,
    controls,
    reset,
    setEnabled(enabled) {
      if (controls.enabled === enabled) return;
      controls.enabled = enabled;
      if (!enabled) {
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
      }
    },
    get fov() { return lensFov; },
    get reducedMotion() { return motionQuery.matches; },
    update(delta, elapsed) {
      controls.update(delta);
      camera.quaternion.copy(probe.quaternion);
      camera.position.copy(eyePosition);
      if (!motionQuery.matches) camera.position.y += Math.sin(elapsed * 1.35) * 0.004;
    },
    resize(width, height) {
      camera.aspect = width / height;
      updateProjection();
    },
  };
}
