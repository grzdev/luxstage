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
  isGlass?: boolean;
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

const BLENDER_ZONES: ReadonlyArray<{ name: string; isGlass: boolean; u: [number, number, number] }> = [
  { name: 'Sealed_Top_Lid', isGlass: false, u: [0.5, 0.92, 0.5] },
  { name: 'Glass_Pitcher_Front', isGlass: true, u: [0.5, 0.61, 0.78] },
  { name: 'Glass_Pitcher_Rear', isGlass: true, u: [0.5, 0.61, 0.22] },
  { name: 'Glass_Pitcher_Left', isGlass: true, u: [0.22, 0.61, 0.5] },
  { name: 'Glass_Pitcher_Right', isGlass: true, u: [0.82, 0.61, 0.5] },
  { name: 'Blade_Collar_Seal', isGlass: false, u: [0.5, 0.31, 0.5] },
  { name: 'Steel_Base_Front', isGlass: false, u: [0.5, 0.16, 0.82] },
  { name: 'Steel_Base_Rear', isGlass: false, u: [0.5, 0.16, 0.18] },
  { name: 'Steel_Base_Left', isGlass: false, u: [0.18, 0.16, 0.5] },
  { name: 'Steel_Base_Right', isGlass: false, u: [0.82, 0.16, 0.5] },
];

/**
 * Partition a single-mesh AI model into 10 seamless spatial sub-meshes sharing the original
 * vertex/normal/UV buffers so that 0% explode has zero visible seams while >0% explode
 * radially separates the model into interactive 3D structural sub-parts.
 */
function getOrBuildSegmentedParts(geo: BufferGeometry, isBlender = false): CachedSubPart[] | null {
  const cacheKey = isBlender ? '_skSegmentedPartsBlender' : '_skSegmentedParts';
  if (geo.userData?.[cacheKey]) {
    return geo.userData[cacheKey] as CachedSubPart[];
  }
  const posAttr = geo.attributes.position;
  if (!posAttr || posAttr.count < 36) return null;

  if (!geo.boundingBox) geo.computeBoundingBox();
  const bbox = geo.boundingBox;
  if (!bbox || bbox.isEmpty()) return null;

  const minX = bbox.min.x, minY = bbox.min.y, minZ = bbox.min.z;
  const invSpanX = 1 / Math.max(1e-5, bbox.max.x - minX);
  const invSpanY = 1 / Math.max(1e-5, bbox.max.y - minY);
  const invSpanZ = 1 / Math.max(1e-5, bbox.max.z - minZ);

  const indexAttr = geo.index;
  const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);
  if (triCount < 12) return null;

  const activeZones = isBlender ? BLENDER_ZONES : STRUCTURAL_ZONES;
  const zoneCount = activeZones.length;
  const zoneU = new Float64Array(zoneCount * 3);
  for (let z = 0; z < zoneCount; z++) {
    zoneU[z * 3] = activeZones[z].u[0];
    zoneU[z * 3 + 1] = activeZones[z].u[1];
    zoneU[z * 3 + 2] = activeZones[z].u[2];
  }

  const triZones = new Uint8Array(triCount);
  const triCounts = new Int32Array(zoneCount);
  const centroidSumsX = new Float64Array(zoneCount);
  const centroidSumsY = new Float64Array(zoneCount);
  const centroidSumsZ = new Float64Array(zoneCount);
  const minBoundsX = new Float64Array(zoneCount).fill(Infinity);
  const minBoundsY = new Float64Array(zoneCount).fill(Infinity);
  const minBoundsZ = new Float64Array(zoneCount).fill(Infinity);
  const maxBoundsX = new Float64Array(zoneCount).fill(-Infinity);
  const maxBoundsY = new Float64Array(zoneCount).fill(-Infinity);
  const maxBoundsZ = new Float64Array(zoneCount).fill(-Infinity);

  const posArr = posAttr.array as ArrayLike<number>;
  const posStride = posAttr.itemSize || 3;
  const idxArr = indexAttr ? (indexAttr.array as ArrayLike<number>) : null;
  const oneThird = 1 / 3;

  // Pass 1: Fast zero-allocation typed-array classification & bounds computation
  for (let t = 0; t < triCount; t++) {
    const t3 = t * 3;
    const i0 = idxArr ? idxArr[t3] : t3;
    const i1 = idxArr ? idxArr[t3 + 1] : t3 + 1;
    const i2 = idxArr ? idxArr[t3 + 2] : t3 + 2;

    const p0 = i0 * posStride;
    const p1 = i1 * posStride;
    const p2 = i2 * posStride;

    const x0 = posArr[p0], y0 = posArr[p0 + 1], z0 = posArr[p0 + 2];
    const x1 = posArr[p1], y1 = posArr[p1 + 1], z1 = posArr[p1 + 2];
    const x2 = posArr[p2], y2 = posArr[p2 + 1], z2 = posArr[p2 + 2];

    const cx = (x0 + x1 + x2) * oneThird;
    const cy = (y0 + y1 + y2) * oneThird;
    const cz = (z0 + z1 + z2) * oneThird;

    const nx = (cx - minX) * invSpanX;
    const ny = (cy - minY) * invSpanY;
    const nz = (cz - minZ) * invSpanZ;

    let bestZone = 0;
    let bestDistSq = Infinity;
    if (isBlender) {
      // Respect crisp horizontal material boundaries between Lid (ny >= 0.855), Glass Jug (0.36..0.855), and Steel Base (ny < 0.36)
      const startZ = ny >= 0.855 ? 0 : ny >= 0.36 ? 1 : 5;
      const endZ = ny >= 0.855 ? 1 : ny >= 0.36 ? 5 : zoneCount;
      for (let z = startZ; z < endZ; z++) {
        const zu = z * 3;
        const dx = nx - zoneU[zu];
        const dy = ny - zoneU[zu + 1];
        const dz = nz - zoneU[zu + 2];
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestZone = z;
        }
      }
    } else {
      for (let z = 0; z < zoneCount; z++) {
        const zu = z * 3;
        const dx = nx - zoneU[zu];
        const dy = ny - zoneU[zu + 1];
        const dz = nz - zoneU[zu + 2];
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestZone = z;
        }
      }
    }

    triZones[t] = bestZone;
    triCounts[bestZone]++;
    centroidSumsX[bestZone] += cx;
    centroidSumsY[bestZone] += cy;
    centroidSumsZ[bestZone] += cz;

    const tMinX = x0 < x1 ? (x0 < x2 ? x0 : x2) : (x1 < x2 ? x1 : x2);
    const tMinY = y0 < y1 ? (y0 < y2 ? y0 : y2) : (y1 < y2 ? y1 : y2);
    const tMinZ = z0 < z1 ? (z0 < z2 ? z0 : z2) : (z1 < z2 ? z1 : z2);
    const tMaxX = x0 > x1 ? (x0 > x2 ? x0 : x2) : (x1 > x2 ? x1 : x2);
    const tMaxY = y0 > y1 ? (y0 > y2 ? y0 : y2) : (y1 > y2 ? y1 : y2);
    const tMaxZ = z0 > z1 ? (z0 > z2 ? z0 : z2) : (z1 > z2 ? z1 : z2);

    if (tMinX < minBoundsX[bestZone]) minBoundsX[bestZone] = tMinX;
    if (tMinY < minBoundsY[bestZone]) minBoundsY[bestZone] = tMinY;
    if (tMinZ < minBoundsZ[bestZone]) minBoundsZ[bestZone] = tMinZ;
    if (tMaxX > maxBoundsX[bestZone]) maxBoundsX[bestZone] = tMaxX;
    if (tMaxY > maxBoundsY[bestZone]) maxBoundsY[bestZone] = tMaxY;
    if (tMaxZ > maxBoundsZ[bestZone]) maxBoundsZ[bestZone] = tMaxZ;
  }

  // Pass 2: Preallocate exact-size typed index arrays & fill sequentially
  const useUint32 = posAttr.count > 65535;
  const typedBuckets: Array<Uint16Array | Uint32Array | null> = new Array(zoneCount).fill(null);
  const writePos = new Int32Array(zoneCount);

  for (let z = 0; z < zoneCount; z++) {
    const c = triCounts[z];
    if (c > 0) {
      typedBuckets[z] = useUint32 ? new Uint32Array(c * 3) : new Uint16Array(c * 3);
    }
  }

  for (let t = 0; t < triCount; t++) {
    const z = triZones[t];
    const buf = typedBuckets[z];
    if (!buf) continue;
    const t3 = t * 3;
    const wp = writePos[z];
    buf[wp] = idxArr ? idxArr[t3] : t3;
    buf[wp + 1] = idxArr ? idxArr[t3 + 1] : t3 + 1;
    buf[wp + 2] = idxArr ? idxArr[t3 + 2] : t3 + 2;
    writePos[z] = wp + 3;
  }

  const parts: CachedSubPart[] = [];
  for (let z = 0; z < zoneCount; z++) {
    const typedIndices = typedBuckets[z];
    const count = triCounts[z];
    if (!typedIndices || count === 0) continue;

    const subGeo = new BufferGeometry();
    for (const attrName of Object.keys(geo.attributes)) {
      subGeo.setAttribute(attrName, geo.attributes[attrName]);
    }
    subGeo.setIndex(new BufferAttribute(typedIndices, 1));
    const zoneBox = new Box3(
      new Vector3(minBoundsX[z], minBoundsY[z], minBoundsZ[z]),
      new Vector3(maxBoundsX[z], maxBoundsY[z], maxBoundsZ[z])
    );
    subGeo.boundingBox = zoneBox;
    subGeo.boundingSphere = zoneBox.getBoundingSphere(new Sphere());

    const localCenter = new Vector3(
      centroidSumsX[z] / count,
      centroidSumsY[z] / count,
      centroidSumsZ[z] / count
    );

    parts.push({
      name: activeZones[z].name.replace(/\s+/g, ''),
      geometry: subGeo,
      localCenter,
      isGlass: isBlender ? Boolean(BLENDER_ZONES[z]?.isGlass) : false,
    });
  }

  if (parts.length <= 1) return null;
  geo.userData = geo.userData || {};
  geo.userData[cacheKey] = parts;
  return parts;
}

/** Clone transforms and materials; retain shared, loader-owned geometries/textures. */
export function createModelInstance(source: Object3D, modelId: string, modelName?: string) {
  let root = clone(source);
  const isBlenderModel = Boolean(modelName && /blender/i.test(modelName));

  // If the model contains only a single Mesh (typical for AI-generated GLBs),
  // automatically segment it into structural sub-meshes sharing the original vertex buffers.
  const allMeshes: Mesh[] = [];
  root.traverse((n) => {
    if (n instanceof Mesh) allMeshes.push(n);
  });

  if (allMeshes.length === 1) {
    const singleMesh = allMeshes[0];
    const segmented = getOrBuildSegmentedParts(singleMesh.geometry, isBlenderModel);
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
          _skGlassZone: Boolean(part.isGlass),
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
  const opaqueMaterialMap = new Map<Material, Material>();
  const glassMaterialMap = new Map<Material, Material>();
  const copy = (material: Material, isGlass = false) => {
    const map = isGlass ? glassMaterialMap : opaqueMaterialMap;
    let cloned = map.get(material);
    if (!cloned) {
      cloned = material.clone();
      map.set(material, cloned);
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
      const isGlass = Boolean(node.userData._skGlassZone);
      node.material = Array.isArray(node.material)
        ? node.material.map((m) => copy(m, isGlass))
        : copy(node.material, isGlass);
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
