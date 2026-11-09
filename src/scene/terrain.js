import * as THREE from 'three';

export function seededRandom(seed = 42) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function groundHeight(x, z) {
  const distance = Math.hypot(x, z);
  // Keep the working area nearly flat, then gently raise the distant terrain.
  const amplitude = THREE.MathUtils.smoothstep(distance, 2, 16);
  return -0.05 + amplitude * (
    0.22 * Math.sin(x * 0.23) * Math.cos(z * 0.19)
    + 0.11 * Math.sin(x * 0.6 + z * 0.28)
    + 0.03 * Math.sin(x * 2.2 - z * 1.8)
  );
}

export function createTerrain() {
  const terrain = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(160, 160, 110, 110);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  const random = seededRandom(67);
  for (let index = 0; index < position.count; index++) {
    const height = groundHeight(position.getX(index), position.getZ(index));
    position.setY(index, height);
    color.setHSL(0.055 + random() * 0.015, 0.38, 0.30 + random() * 0.055 + height * 0.04);
    color.toArray(colors, index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.name = 'Ground';
  ground.receiveShadow = true;
  terrain.add(ground);

  const rocks = new THREE.Group();
  rocks.name = 'Rocks';
  const stones = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x635047, roughness: 0.97, flatShading: true }),
    180,
  );
  const matrix = new THREE.Object3D();
  for (let index = 0; index < stones.count; index++) {
    let x = (random() - 0.5) * 70;
    let z = (random() - 0.5) * 70;
    if (Math.abs(x) < 3.3 && z > -4 && z < 5) x += x > 0 ? 4 : -4;
    const scale = 0.05 + random() ** 3 * 0.75;
    matrix.position.set(x, groundHeight(x, z) + scale * 0.25, z);
    matrix.scale.set(scale * 1.3, scale * 0.65, scale);
    matrix.rotation.set(random() * 2, random() * Math.PI, random());
    matrix.updateMatrix();
    stones.setMatrixAt(index, matrix.matrix);
  }
  stones.castShadow = true;
  stones.receiveShadow = true;
  rocks.add(stones);
  terrain.add(rocks);
  return terrain;
}
