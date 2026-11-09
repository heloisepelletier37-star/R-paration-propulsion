import * as THREE from 'three';
import { textes } from '../ui/textes.js';

function label(parent, text, width, height, position, color = '#e2dfc6') {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '500 48px monospace';
  context.fillText(text, 384, 64);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({
    map, transparent: true, roughness: 0.9, depthWrite: false,
  }));
  mesh.position.set(...position);
  parent.add(mesh);
}

export function addSceneLabels(root, ship) {
  const panel = root.getObjectByName('Panel');
  const hatch = root.getObjectByName('Hatch');
  const power = root.getObjectByName('PowerBox');
  if (panel.userData.placeholder) label(panel, textes.labels.panel, 1.05, 0.13, [-0.18, 0.9, 0.04]);
  if (hatch.userData.placeholder) {
    label(hatch, textes.labels.hatch, 0.7, 0.12, [0.97, 0.28, 0.083]);
    label(hatch, textes.labels.safety, 0.4, 0.07, [0.8, -0.12, 0.083]);
  }
  if (power.userData.placeholder) label(power, textes.labels.power, 0.3, 0.06, [0, 0.36, 0.143], '#283b38');
  label(ship, textes.labels.ship, 0.8, 0.24, [2.2, 2.27, -0.025], '#3a4a45');
}
