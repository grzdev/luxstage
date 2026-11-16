import { Box3, BufferAttribute, BufferGeometry, Group, Mesh, Sphere, Vector3, type Material, type Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export interface SpatialPart {
  /** Stable, model-scoped identifier. Save this value as an annotation target. */
  id: string;
  modelId: string;
  name: string;
  /** JSON metadata from the glTF node's extras. */
  metadata: Record<string, unknown>;
}

export interface PartRecord { part: SpatialPart; object: Mesh }

/** Centre an asset on X/Z and rest its lowest point on Y=0, preserving proportions. */
export function modelFit(object: Object3D, size: number) {
  if (!Number.isFinite(size) || size <= 0) throw new Error('[SpatialKit] fit must be a positive finite number.');
  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  const dimensions = box.getSize(new Vector3());
  // Weight vertical height (Y) by 1.35x so tall models (like the quadruped robot dog) fit comfortably
  // inside the vertical camera frustum while wide models (shoes, couches, workdesks) stay full-width.
  const largest = Math.max(dimensions.x, dimensions.y * 1.35, dimensions.z);
  if (box.isEmpty() || !Number.isFinite(largest) || largest <= 0) throw new Error('This model has no visible mesh bounds.');
  const center = box.getCenter(new Vector3());
  const scale = size / largest;
  return { scale, position: [-center.x * scale, -box.min.y * scale, -center.z * scale] as [number, number, number] };
}

interface CachedSubPart {
  name: string;
  geometry: BufferGeometry;
  localCenter: Vector3;
}

const STRUCTURAL_ZONES: ReadonlyArray<{ name: string; u: [number, number, number] }> = [
  { name: 'Apex_Crown_Module', u: [0.5, 0.88, 0.5] },
  { name: 'Forward_Prow_Assembly', u: [0.5, 0.58, 0.86] },
  { name: 'Aft_ Stern_Assembly', u: [0.5, 0.58, 0.14] },
  { name: 'Port_Flank_Shell', u: [0.14, 0.56, 0.5] },
  { name: 'Starboard_Flank_Shell', u: [0.86, 0.56, 0.5] },
  { name: 'Central_Core_Chassis', u: [0.5, 0.52, 0.5] },
  { name: 'Front_Port_Strut', u: [0.24, 0.18, 0.78] },
  { name: 'Front_Starboard_Strut', u: [0.76, 0.18, 0.78] },
  { name: 'Rear_Port_Strut', u: [0.24, 0.18, 0.22] },
  { name: 'Rear_Starboard_Strut', u: [0.76, 0.18, 0.22] },
];

/**
 * Partition a single-mesh AI model into 10 seamless spatial sub-meshes sharing the original
 * vertex/normal/UV buffers so that 0% explode has zero visible seams while >0% explode
 * radially separates the model into interactive 3D structural sub-parts.
 */
function getOrBuildSegmentedParts(geo: BufferGeometry): CachedSubPart[] | null {
  if (geo.userData?._skSegmentedParts) {
    return geo.userData._skSegmentedParts as CachedSubPart[];
  }
  const posAttr = geo.attributes.position;
  if (!posAttr || posAttr.count < 36) return null;

  if (!geo.boundingBox) geo.computeBoundingBox();
  const bbox = geo.boundingBox;
  if (!bbox || bbox.isEmpty()) return null;

  const minX = bbox.min.x, minY = bbox.min.y, minZ = bbox.min.z;
  const spanX = Math.max(1e-5, bbox.max.x - minX);
  const spanY = Math.max(1e-5, bbox.max.y - minY);
  const spanZ = Math.max(1e-5, bbox.max.z - minZ);

  const indexAttr = geo.index;
  const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);
  if (triCount < 12) return null;

  const zoneCount = STRUCTURAL_ZONES.length;
  const buckets: number[][] = Array.from({ length: zoneCount }, () => []);
  const boxes: Box3[] = Array.from({ length: zoneCount }, () => new Box3());
  const centroidSums: Vector3[] = Array.from({ length: zoneCount }, () => new Vector3());
  const triCounts = new Int32Array(zoneCount);

  const v0 = new Vector3();
  const v1 = new Vector3();
  const v2 = new Vector3();

  for (let t = 0; t < triCount; t++) {
    const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

    v0.fromBufferAttribute(posAttr, i0);
    v1.fromBufferAttribute(posAttr, i1);
    v2.fromBufferAttribute(posAttr, i2);

    const cx = (v0.x + v1.x + v2.x) / 3;
    const cy = (v0.y + v1.y + v2.y) / 3;
    const cz = (v0.z + v1.z + v2.z) / 3;

    const nx = (cx - minX) / spanX;
    const ny = (cy - minY) / spanY;
    const nz = (cz - minZ) / spanZ;

    let bestZone = 0;
    let bestDistSq = Infinity;
    for (let z = 0; z < zoneCount; z++) {
      const [ux, uy, uz] = STRUCTURAL_ZONES[z].u;
      const dx = nx - ux;
      const dy = ny - uy;
      const dz = nz - uz;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestZone = z;
      }
    }

    buckets[bestZone].push(i0, i1, i2);
    boxes[bestZone].expandByPoint(v0).expandByPoint(v1).expandByPoint(v2);
    centroidSums[bestZone].x += cx;
    centroidSums[bestZone].y += cy;
    centroidSums[bestZone].z += cz;
    triCounts[bestZone]++;
  }

  const useUint32 = posAttr.count > 65535;
  const parts: CachedSubPart[] = [];

  for (let z = 0; z < zoneCount; z++) {
    const indices = buckets[z];
    if (indices.length === 0) continue;

    const subGeo = new BufferGeometry();
    for (const attrName of Object.keys(geo.attributes)) {
      subGeo.setAttribute(attrName, geo.attributes[attrName]);
    }
    const typedIndices = useUint32 ? new Uint32Array(indices) : new Uint16Array(indices);
    subGeo.setIndex(new BufferAttribute(typedIndices, 1));
    subGeo.boundingBox = boxes[z].clone();
    subGeo.boundingSphere = boxes[z].getBoundingSphere(new Sphere());

    const count = triCounts[z];
    const localCenter = new Vector3(
      centroidSums[z].x / count,
      centroidSums[z].y / count,
      centroidSums[z].z / count
    );

    parts.push({
      name: STRUCTURAL_ZONES[z].name.replace(/\s+/g, ''),
      geometry: subGeo,
      localCenter,
    });
  }

  if (parts.length <= 1) return null;
  geo.userData = geo.userData || {};
  geo.userData._skSegmentedParts = parts;
  return parts;
}

/** Clone transforms and materials; retain shared, loader-owned geometries/textures. */
export function createModelInstance(source: Object3D, modelId: string) {
  let root = clone(source);

  // If the model contains only a single Mesh (typical for AI-generated GLBs),
  // automatically segment it into structural sub-meshes sharing the original vertex buffers.
  const allMeshes: Mesh[] = [];
  root.traverse((n) => {
    if (n instanceof Mesh) allMeshes.push(n);
  });

  if (allMeshes.length === 1) {
    const singleMesh = allMeshes[0];
    const segmented = getOrBuildSegmentedParts(singleMesh.geometry);
    if (segmented && segmented.length > 1) {
      const container = new Group();
      container.name = singleMesh.name || 'SegmentedAssembly';
      container.position.copy(singleMesh.position);
      container.rotation.copy(singleMesh.rotation);
      container.scale.copy(singleMesh.scale);
      container.userData = { ...singleMesh.userData };

      for (const part of segmented) {
        const subMesh = new Mesh(part.geometry, singleMesh.material);
        subMesh.name = part.name;
        subMesh.castShadow = singleMesh.castShadow;
        subMesh.receiveShadow = singleMesh.receiveShadow;
        subMesh.userData = {
          ...singleMesh.userData,
          label: part.name.replace(/_/g, ' '),
          _skLocalCenter: part.localCenter.clone(),
          _skSyntheticSplit: true,
        };
        container.add(subMesh);
      }

      if (singleMesh.parent) {
        const parent = singleMesh.parent;
        const idx = parent.children.indexOf(singleMesh);
        if (idx !== -1) {
          parent.children[idx] = container;
          container.parent = parent;
        } else {
          parent.remove(singleMesh);
          parent.add(container);
        }
      } else if (root === singleMesh) {
        root = container;
      }
    }
  }

  const records: PartRecord[] = [];
  const materials: Material[] = [];
  const names = new Map<string, number>();
  root.traverse((node) => {
    if (node instanceof Mesh && node.name) names.set(node.name, (names.get(node.name) ?? 0) + 1);
  });
  const ids = new Set<string>();
  const materialMap = new Map<Material, Material>();
  const copy = (material: Material) => {
    let cloned = materialMap.get(material);
    if (!cloned) {
      cloned = material.clone();
      materialMap.set(material, cloned);
      materials.push(cloned);
    }
    return cloned;
  };
  const visit = (node: Object3D, path: string) => {
    if (node instanceof Mesh) {
      const explicit = node.userData.spatialId;
      const key = typeof explicit === 'string' && explicit.length > 0
        ? explicit
        : node.name && names.get(node.name) === 1 ? node.name : `node:${path}`;
      const id = `${modelId}/${key}`;
      if (ids.has(id)) throw new Error(`[SpatialKit] Duplicate part id "${id}". Set unique node extras.spatialId values.`);
      ids.add(id);
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
      // Preserve baseline position for procedural exploded views
      if (!node.userData._skOriginalPosition) {
        node.userData._skOriginalPosition = node.position.clone();
      }
      // Ensure bounding sphere and box are precomputed for fast raycast culling and O(1) centers
      if (node.geometry) {
        if (!node.geometry.boundingSphere) {
          node.geometry.computeBoundingSphere();
        }
        if (!node.geometry.boundingBox) {
          node.geometry.computeBoundingBox();
        }
        if (node.geometry.boundingBox && !node.userData._skLocalCenter) {
          node.userData._skLocalCenter = node.geometry.boundingBox.getCenter(new Vector3());
        }
      }
      records.push({ object: node, part: { id, modelId, name: node.name || key, metadata: { ...node.userData } } });
      node.userData._skPartId = id;
    }
    node.children.forEach((child, index) => visit(child, `${path}.${index}`));
  };
  visit(root, '0');
  return { root, records, dispose: () => materials.forEach((material) => material.dispose()) };
}

/** Exact scoped ids win; short names must resolve to exactly one mesh. */
export function resolvePart(records: readonly PartRecord[], target: string, modelId?: string): PartRecord | undefined {
  const scoped = modelId ? records.filter((record) => record.part.modelId === modelId) : records;
  const exact = scoped.find((record) => record.part.id === target);
  if (exact) return exact;
  const matches = scoped.filter((record) => record.part.name === target || record.part.id === `${record.part.modelId}/${target}`);
  return matches.length === 1 ? matches[0] : undefined;
}

const bounds = new Box3();
/** Compute an attachment point after all ancestor transforms, including model scaling. */
export function partCenter(object: Object3D, out = new Vector3()): Vector3 {
  object.updateWorldMatrix(true, false);
  const mesh = object as Mesh;
  if (mesh.userData?._skLocalCenter) {
    out.copy(mesh.userData._skLocalCenter as Vector3);
    return object.localToWorld(out);
  }
  if (mesh.geometry) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) {
      const center = mesh.geometry.boundingBox.getCenter(new Vector3());
      mesh.userData._skLocalCenter = center;
      out.copy(center);
      return object.localToWorld(out);
    }
  }
  return bounds.setFromObject(object).getCenter(out);
}
