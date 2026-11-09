import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MODEL_SPECS } from './manifest.js';

export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

// Preserve missing branches and their working pivots while using authored nodes
// wherever possible. attach() preserves the fallback's world transform.
export function mergeModelWithPlaceholders(model, fallback, names) {
  const originals = new Map(names.map(name => [name, fallback.getObjectByName(name)]));
  const supplied = new Map(names.map(name => [name, model.getObjectByName(name)]));
  model.updateWorldMatrix(true, true);
  fallback.updateWorldMatrix(true, true);
  const missing = [];
  for (const name of names) {
    if (supplied.get(name)) continue;
    missing.push(name);
    const node = originals.get(name);
    let parent = node.parent;
    while (parent && !originals.has(parent.name)) parent = parent.parent;
    if (!parent) model.attach(node);
    else if (supplied.get(parent.name)) supplied.get(parent.name).attach(node);
  }
  for (const name of names) {
    if (supplied.get(name)) originals.get(name).removeFromParent();
  }
  fallback.removeFromParent();
  return missing;
}

export async function loadOptionalModels({ root, assets, available, onProgress }) {
  const draco = new DRACOLoader();
  // Ship the official npm-provided decoders with the app; no runtime CDN needed.
  draco.setDecoderPath(DRACO_GLTF_CONFIG);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let completed = 0;
  try {
    // Sequential loads keep memory use and progress reporting predictable.
    for (const { file, nodes } of MODEL_SPECS) {
      const path = `models/${file}`;
      if (!available.has(path)) {
        console.warn(`[Modèles] ${file} absent : géométries provisoires pour ${nodes.join(', ')}.`);
      } else {
        let mounted;
        try {
          const gltf = await loader.loadAsync(assetUrl(path));
          const fallback = assets.get(file);
          mounted = new THREE.Group();
          mounted.name = file;
          mounted.position.copy(fallback.position);
          mounted.quaternion.copy(fallback.quaternion);
          mounted.scale.copy(fallback.scale);
          mounted.add(gltf.scene);
          root.add(mounted);
          mounted.traverse(node => {
            if (node.isMesh) node.castShadow = node.receiveShadow = true;
          });
          const missing = mergeModelWithPlaceholders(mounted, fallback, nodes);
          assets.set(file, mounted);
          if (missing.length) console.warn(`[Modèles] ${file} : nœuds manquants remplacés par des géométries provisoires : ${missing.join(', ')}.`);
        } catch (error) {
          mounted?.removeFromParent();
          console.warn(`[Modèles] ${file} illisible : conservation des géométries provisoires.`, error.message);
        }
      }
      onProgress(++completed / MODEL_SPECS.length);
    }
  } finally {
    draco.dispose();
  }
}

export async function loadOptionalHdri(scene, renderer, available, disposeFallback) {
  if (!available.has('hdri/mars_sky.hdr')) return;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let texture;
  try {
    texture = await new RGBELoader().loadAsync(assetUrl('hdri/mars_sky.hdr'));
    const environment = pmrem.fromEquirectangular(texture);
    disposeFallback();
    scene.environment = environment.texture;
    // The visible procedural sky remains a backdrop; HDRI supplies PBR lighting.
  } catch (error) {
    console.warn('[HDRI] Ciel HDR illisible : environnement procédural conservé.', error.message);
  } finally {
    texture?.dispose();
    pmrem.dispose();
  }
}
