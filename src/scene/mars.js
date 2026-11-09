import * as THREE from 'three';
import { seededRandom } from './terrain.js';

export function createMarsAtmosphere(scene, renderer) {
  scene.fog = new THREE.FogExp2(0xd0a28b, 0.012);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x826777) },
      horizon: { value: new THREE.Color(0xe8b595) },
    },
    vertexShader: 'varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 zenith;
      uniform vec3 horizon;
      varying vec3 vDirection;
      void main() {
        float h = smoothstep(-0.08, 0.85, normalize(vDirection).y);
        gl_FragColor = vec4(mix(horizon, zenith, h), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  sky.name = 'Mars_Sky';
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xf0c4aa, 0x694534, 1.65));
  const sun = new THREE.DirectionalLight(0xffd1a0, 3.8);
  sun.name = 'Mars_Sun';
  sun.position.set(-9, 4, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 5, bottom: -4, near: 0.5, far: 32 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  // A generated floating-point environment supplies reflections without an HDR file.
  const width = 128;
  const height = 64;
  const pixels = new Float32Array(width * height * 4);
  const warm = new THREE.Color(0xe8b595);
  const cool = new THREE.Color(0x826777);
  const ground = new THREE.Color(0x644332);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const elevation = 1 - y / (height - 1);
    for (let x = 0; x < width; x++) {
      if (elevation > 0.5) color.copy(warm).lerp(cool, (elevation - 0.5) * 2);
      else color.copy(ground).lerp(warm, elevation * 2);
      const sunSpot = Math.exp(-((x / width - 0.25) ** 2 + (elevation - 0.57) ** 2) * 900);
      const offset = (y * width + x) * 4;
      pixels[offset] = color.r + sunSpot * 6;
      pixels[offset + 1] = color.g + sunSpot * 4;
      pixels[offset + 2] = color.b + sunSpot * 2;
      pixels[offset + 3] = 1;
    }
  }
  const environment = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(environment);
  scene.environment = target.texture;
  scene.environmentIntensity = 0.45;
  environment.dispose();
  pmrem.dispose();

  const random = seededRandom(93);
  const coordinates = new Float32Array(500 * 3);
  for (let index = 0; index < coordinates.length; index += 3) {
    coordinates[index] = (random() - 0.5) * 22;
    coordinates[index + 1] = random() * 5;
    coordinates[index + 2] = (random() - 0.5) * 20;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(coordinates, 3));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,224,185,0.8)');
  gradient.addColorStop(1, 'rgba(255,224,185,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: 0xe9c6a3, size: 0.045, map: new THREE.CanvasTexture(canvas),
    transparent: true, opacity: 0.36, depthWrite: false,
  }));
  dust.name = 'Mars_Dust';
  scene.add(dust);
  return {
    update(delta, elapsed, reducedMotion) {
      if (reducedMotion) return;
      for (let index = 0; index < coordinates.length; index += 3) {
        coordinates[index] += delta * 0.065;
        coordinates[index + 1] += Math.sin(elapsed * 0.4 + index) * delta * 0.007;
        if (coordinates[index] > 11) coordinates[index] = -11;
      }
      dustGeometry.attributes.position.needsUpdate = true;
    },
    disposeEnvironment() { target.dispose(); },
  };
}

export function createShip() {
  const ship = new THREE.Group();
  ship.name = 'Ship_Hull';
  const shell = new THREE.MeshStandardMaterial({ color: 0xc7c9b9, roughness: 0.65, metalness: 0.4 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x344449, metalness: 0.55, roughness: 0.63 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xd68148, roughness: 0.63, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.52, 5.6, 32), shell);
  body.rotation.z = Math.PI / 2;
  body.position.set(1.15, 1.6, -1.48);
  body.castShadow = body.receiveShadow = true;
  ship.add(body);
  for (const x of [-1.65, 0.9, 3.9]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.54, 1.54, 0.09, 32, 1, true), trim);
    band.rotation.z = Math.PI / 2;
    band.position.set(x, 1.6, -1.48);
    band.castShadow = true;
    ship.add(band);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 0.045), orange);
  stripe.position.set(0.5, 2.53, -0.23);
  ship.add(stripe);
  for (const x of [-1.3, 2.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.9, 0.18), trim);
    leg.position.set(x, 0.4, -0.2);
    leg.rotation.z = x < 0 ? -0.28 : 0.28;
    leg.castShadow = true;
    ship.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.08, 8), trim);
    foot.position.set(x + (x < 0 ? -0.15 : 0.15), 0.015, -0.2);
    foot.castShadow = true;
    ship.add(foot);
  }
  for (let index = 0; index < 8; index++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.045, 0.07), trim);
    vent.position.set(2.2, 1.1 + index * 0.1, -0.04);
    ship.add(vent);
  }
  // Low, distant mesas retain a clear horizon beyond the ship.
  const ridgeMaterial = new THREE.MeshStandardMaterial({ color: 0x97634c, roughness: 1 });
  for (let index = 0; index < 9; index++) {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(4 + index % 3, 1.6 + index % 3, 5), ridgeMaterial);
    ridge.position.set(-35 + index * 10, 0.6, -27 - index % 3 * 5);
    ridge.rotation.y = index;
    ship.add(ridge);
  }
  return ship;
}
