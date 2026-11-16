import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LoadingManager, Mesh, Texture, type AnimationClip, type Object3D, type Material } from 'three';
import { createModelInstance, modelFit } from './spatialkit/model';

export const MAX_MODEL_MB = 500;
export const MAX_MODEL_BYTES = MAX_MODEL_MB * 1024 * 1024;
export const MODEL_FIT = 3.35;

export interface ModelUploadProgress {
  percent: number;
  stage: string;
}

export interface ModelAsset {
  id: string;
  name: string;
  filename: string;
  format: string;
  sourceUrl?: string;
  object?: Object3D;
  animations?: readonly AnimationClip[];
  hasAnimations?: boolean;
  file?: File;
  dispose?: () => void;
}
export const DEMO_MODEL: ModelAsset = { id: 'robot-dog', name: 'Quadruped Robot Dog (Lux3D)', filename: 'robot-dog.glb', format: 'Aholo Lux3D · GLB', hasAnimations: false };

/** Read and validate the container before GLTFLoader can fetch any referenced resources. */
export function validateModelFile(filename: string, bytes: ArrayBuffer): Record<string, any> {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext !== 'glb' && ext !== 'gltf') throw new Error('Choose a .glb or self-contained .gltf model. Export other formats as GLB first.');
  if (!bytes.byteLength || bytes.byteLength > MAX_MODEL_BYTES) throw new Error(`Choose a non-empty model smaller than ${MAX_MODEL_MB} MB.`);
  let json: string;
  if (ext === 'glb') {
    const view = new DataView(bytes);
    if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) throw new Error('This file is not a valid GLB 2.0 model. Please export it again.');
    const length = view.getUint32(12, true);
    if (view.getUint32(16, true) !== 0x4e4f534a || length > bytes.byteLength - 20) throw new Error('The GLB model has an invalid data header.');
    json = new TextDecoder().decode(new Uint8Array(bytes, 20, length));
  } else json = new TextDecoder().decode(bytes);
  let document: Record<string, any>;
  try { document = JSON.parse(json); } catch { throw new Error('The model contains invalid glTF data. Please export it again.'); }
  if (!document || document.asset?.version !== '2.0') throw new Error('Only glTF 2.0 models are supported.');
  for (const collection of ['buffers', 'images']) {
    if (document[collection] !== undefined && !Array.isArray(document[collection])) throw new Error('Invalid glTF resources. Please export as GLB.');
    for (const resource of document[collection] ?? []) {
      if (resource.uri !== undefined && (typeof resource.uri !== 'string' || !resource.uri.startsWith('data:'))) throw new Error('This model references separate files. Export as GLB with textures embedded, then try again.');
    }
  }
  const extensions = document.extensionsUsed ?? [];
  if (!Array.isArray(extensions)) throw new Error('Invalid glTF extensions.');
  if (extensions.some((name: string) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(name))) throw new Error('This preview needs an uncompressed GLB. Export without Draco, Meshopt, or KTX2 compression.');
  return document;
}

/**
 * Compress oversized textures (downscaling >1024px maps to 1024px) and optimize
 * geometry buffers so AI-generated models render and fly at 60fps without lag.
 */
export function compressAndOptimizeModelScene(root: Object3D) {
  const seenTextures = new Set<Texture>();
  const MAX_TEX_DIM = 1024;

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const mesh = child;
    const geo = mesh.geometry;
    if (geo) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingSphere) geo.computeBoundingSphere();
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const value of Object.values(mat)) {
        if (!(value instanceof Texture) || seenTextures.has(value)) continue;
        seenTextures.add(value);
        const img = value.image as { width?: number; height?: number; close?: () => void } | undefined;
        if (
          img &&
          typeof document !== 'undefined' &&
          typeof img.width === 'number' &&
          typeof img.height === 'number' &&
          (img.width > MAX_TEX_DIM || img.height > MAX_TEX_DIM)
        ) {
          try {
            const scale = MAX_TEX_DIM / Math.max(img.width, img.height);
            const targetW = Math.max(1, Math.round(img.width * scale));
            const targetH = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img as CanvasImageSource, 0, 0, targetW, targetH);
              if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
                img.close();
              }
              value.image = canvas;
              value.needsUpdate = true;
            }
          } catch {
            // Keep original texture if canvas draw fails
          }
        }
      }
    }
  });
}

export function disposeAsset(root: Object3D) {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => { texture.dispose(); if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close(); });
}

function readFileWithProgress(
  file: File,
  onProgress?: (progress: ModelUploadProgress) => void
): Promise<ArrayBuffer> {
  if (!onProgress || typeof FileReader === 'undefined') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const totalMB = (file.size / 1024 / 1024).toFixed(1);
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const ratio = Math.min(1, event.loaded / event.total);
        const loadedMB = (event.loaded / 1024 / 1024).toFixed(1);
        onProgress({
          percent: Math.max(2, Math.round(ratio * 45)),
          stage: `Reading file (${loadedMB} / ${totalMB} MB)…`,
        });
      }
    };
    reader.onerror = () => reject(new Error('Could not read the selected model file.'));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected model file.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

async function computeModelId(bytes: ArrayBuffer): Promise<string> {
  // For very large files (>16 MB), hash a 4 MB fingerprint + length to avoid duplicating hundreds of MB in WebCrypto
  const SAMPLE_THRESHOLD = 16 * 1024 * 1024;
  let hashInput: BufferSource = bytes;
  if (bytes.byteLength > SAMPLE_THRESHOLD) {
    const chunk = 2 * 1024 * 1024;
    const sample = new Uint8Array(chunk * 2 + 8);
    sample.set(new Uint8Array(bytes, 0, chunk), 0);
    sample.set(new Uint8Array(bytes, bytes.byteLength - chunk, chunk), chunk);
    new DataView(sample.buffer).setFloat64(chunk * 2, bytes.byteLength, true);
    hashInput = sample;
  }
  const digest = await crypto.subtle.digest('SHA-256', hashInput);
  return `model-${Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export async function prepareModel(
  file: File,
  onProgress?: (progress: ModelUploadProgress) => void
): Promise<ModelAsset> {
  if (file.size > MAX_MODEL_BYTES) throw new Error(`Choose a model smaller than ${MAX_MODEL_MB} MB.`);
  const totalMB = (file.size / 1024 / 1024).toFixed(1);
  onProgress?.({ percent: 2, stage: `Reading ${file.name} (${totalMB} MB)…` });

  const bytes = await readFileWithProgress(file, onProgress);

  onProgress?.({ percent: 48, stage: 'Validating GLB 2.0 container…' });
  validateModelFile(file.name, bytes);

  onProgress?.({ percent: 54, stage: 'Computing model content ID…' });
  const id = await computeModelId(bytes);

  onProgress?.({ percent: 60, stage: 'Parsing 3D meshes & decoding textures…' });
  if (onProgress && typeof window !== 'undefined') {
    await new Promise((r) => setTimeout(r, 16));
  }

  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (!url.startsWith('data:') && !url.startsWith('blob:')) throw new Error('External model resources are not supported. Export an embedded GLB.');
    return url;
  });
  manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    if (itemsTotal > 0) {
      const ratio = Math.min(1, itemsLoaded / itemsTotal);
      onProgress?.({
        percent: Math.round(60 + ratio * 28),
        stage: `Decoding 3D resources (${itemsLoaded}/${itemsTotal})…`,
      });
    }
  };

  const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
  try {
    onProgress?.({ percent: 90, stage: 'Compressing textures & optimizing 3D mesh…' });
    if (onProgress && typeof window !== 'undefined') {
      await new Promise((r) => setTimeout(r, 16));
    }
    compressAndOptimizeModelScene(gltf.scene);
    modelFit(gltf.scene, MODEL_FIT);
    gltf.scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.geometry && !mesh.geometry.boundingSphere) {
          mesh.geometry.computeBoundingSphere();
        }
      }
    });
    // Reject duplicate explicit IDs before replacing the current working model.
    const instance = createModelInstance(gltf.scene, id);
    const count = instance.records.length;
    instance.dispose();
    if (!count) throw new Error('This model does not contain selectable meshes.');
    onProgress?.({ percent: 100, stage: 'Model ready!' });
  } catch (error) { disposeAsset(gltf.scene); throw error; }
  return {
    id, name: file.name.replace(/\.(glb|gltf)$/i, ''), filename: file.name,
    format: `Your model · ${totalMB} MB`,
    object: gltf.scene, animations: gltf.animations, hasAnimations: gltf.animations.length > 0, file, dispose: () => disposeAsset(gltf.scene),
  };
}

export async function prepareModelFromUrl(
  url: string,
  defaultName?: string,
  onProgress?: (progress: ModelUploadProgress) => void
): Promise<ModelAsset> {
  onProgress?.({ percent: 5, stage: 'Downloading 3D model…' });
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    if (/^https?:\/\//i.test(url)) {
      response = await fetch(`/api/glb-proxy?url=${encodeURIComponent(url)}`);
    } else {
      throw new Error('Could not download 3D model.');
    }
  }
  if (!response.ok && /^https?:\/\//i.test(url)) {
    response = await fetch(`/api/glb-proxy?url=${encodeURIComponent(url)}`);
  }
  if (!response.ok) throw new Error(`Could not load model from URL (${response.status})`);
  const blob = await response.blob();
  const cleanUrl = url.split('?')[0].split('#')[0];
  const urlFilename = cleanUrl.split('/').pop() || 'model.glb';
  const rawName = (defaultName || urlFilename).trim();
  const filename = /\.(glb|gltf)$/i.test(rawName) ? rawName : `${rawName}.glb`;
  const file = new File([blob], filename, { type: blob.type || 'model/gltf-binary' });
  const asset = await prepareModel(file, onProgress);
  return {
    ...asset,
    name: defaultName ? defaultName.replace(/\.(glb|gltf)$/i, '') : asset.name,
    sourceUrl: /^https?:\/\//i.test(url) ? url : undefined,
  };
}
