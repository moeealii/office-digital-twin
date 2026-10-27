import * as THREE from 'three';
import { isSceneSaveEnvelope, SCENE_SAVE_VERSION, sceneSaveLimits } from '../src/room/scene-save-store';
import type { SceneNodeOrigin, SceneSaveNode, SceneSaveRecord } from '../src/room/scene-save-store';
import { validateLocalGlb } from './local-glb';

interface Identity { readonly id: string; readonly origin: SceneNodeOrigin }
interface Asset { readonly id: string; readonly bytes: ArrayBuffer }
interface AssetStats { bytes: number; triangles: number; texturePixels: number }
interface RestoreOptions {
  readonly parseAsset: (validatedBytes: ArrayBuffer, assetId: string) => Promise<THREE.Object3D>;
  readonly cloneObject?: (source: THREE.Object3D) => THREE.Object3D;
  readonly signal?: AbortSignal;
}
function fail(message: string): never { throw new Error(`Local scene: ${message}`); }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const pathKey = (path: readonly number[]) => path.join('/');
const originalId = (path: readonly number[]) => `o:${pathKey(path)}`;
const validId = (id: unknown): id is string => typeof id === 'string' && /^(?:o:(?:\d+(?:\/\d+)*)?|n:[1-9]\d{0,8})$/.test(id);
const validAssetId = (id: unknown): id is string => typeof id === 'string' && /^[\w.-]{1,128}$/.test(id);
const vector = (value: unknown, length: number, limit: number): boolean => Array.isArray(value) && value.length === length
  && value.every((entry: unknown) => typeof entry === 'number' && Number.isFinite(entry) && Math.abs(entry) <= limit);
const affine = (matrix: unknown): boolean => Array.isArray(matrix) && matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1;
const validPath = (path: unknown): path is number[] => Array.isArray(path) && path.length <= sceneSaveLimits.depth
  && path.every((index: unknown) => typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index < sceneSaveLimits.nodes);
const abortError = () => new DOMException('Scene restoration cancelled.', 'AbortError');

function enumerate(root: THREE.Object3D): Map<string, THREE.Object3D> {
  if (!(root instanceof THREE.Object3D)) return fail('foreign scene runtime.');
  const result = new Map<string, THREE.Object3D>(), seen = new Set<THREE.Object3D>();
  const pending = [{ node: root, path: [] as number[] }];
  while (pending.length) {
    const entry = pending.pop(); if (!entry) break;
    if (seen.has(entry.node) || seen.size >= sceneSaveLimits.nodes || entry.path.length > sceneSaveLimits.depth) fail('oversized or cyclic scene graph.');
    seen.add(entry.node); result.set(pathKey(entry.path), entry.node);
    for (let i = entry.node.children.length - 1; i >= 0; i--) {
      const child = entry.node.children[i]; if (child) pending.push({ node: child, path: [...entry.path, i] });
    }
  }
  return result;
}
function signature(nodes: ReadonlyMap<string, THREE.Object3D>): string {
  let hash = 2166136261;
  for (const [path, node] of nodes) for (const char of `${path}:${node.type};`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${nodes.size}:${(hash >>> 0).toString(16)}`;
}
function validateAssets(assets: readonly Asset[]): AssetStats {
  const stats = { bytes: 0, triangles: 0, texturePixels: 0 }, ids = new Set<string>();
  // Check the entire retained byte budget before the first GLB validation/parser allocation.
  for (const asset of assets) {
    if (!validAssetId(asset.id) || ids.has(asset.id) || !(asset.bytes instanceof ArrayBuffer)
      || asset.bytes.byteLength > sceneSaveLimits.assetBytes) fail('invalid or duplicate retained asset.');
    ids.add(asset.id); stats.bytes += asset.bytes.byteLength;
  }
  if (assets.length > sceneSaveLimits.assets || stats.bytes > sceneSaveLimits.totalBytes) fail('retained asset byte budget exceeded.');
  let viewBytes = 0, imageBytes = 0;
  for (const asset of assets) {
    const info = validateLocalGlb(asset.bytes);
    stats.triangles += info.triangles; stats.texturePixels += info.texturePixels;
    // The existing validator bounds these allocations per asset. Also bound the
    // aggregate retained copies, including overlapping views/repeated images.
    const json: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(asset.bytes, 20, new DataView(asset.bytes).getUint32(12, true))));
    if (!object(json)) fail('invalid validated asset.');
    const views: unknown[] = Array.isArray(json['bufferViews']) ? json['bufferViews'] : [];
    const lengths = views.map((view) => object(view) && typeof view['byteLength'] === 'number' ? view['byteLength'] : 0);
    viewBytes += lengths.reduce((sum, length) => sum + length, 0);
    const images: unknown[] = Array.isArray(json['images']) ? json['images'] : [];
    for (const image of images) if (object(image) && typeof image['bufferView'] === 'number') imageBytes += lengths[image['bufferView']] ?? 0;
    if (stats.triangles > sceneSaveLimits.triangles || stats.texturePixels > sceneSaveLimits.texturePixels
      || viewBytes > sceneSaveLimits.totalBytes || imageBytes > sceneSaveLimits.totalBytes) fail('retained model resource budget exceeded.');
  }
  return stats;
}

/** Safe edit data, not a serialized Three scene and never a competing undo stack. */
export function createSceneAutosaveAdapter({ root, sourceKey }: { readonly root: THREE.Object3D; readonly sourceKey: string }) {
  if (!sourceKey || sourceKey.length > 256) fail('invalid model source binding.');
  const originals = enumerate(root), baselineSignature = signature(originals);
  const identities = new Map<THREE.Object3D, Identity>(), initialVisibility = new Map<THREE.Object3D, boolean>();
  let assets = new Map<string, Asset>(), nextId = 1, revision = 0;
  for (const [path, node] of originals) {
    const indices = path ? path.split('/').map(Number) : [];
    identities.set(node, { id: originalId(indices), origin: { kind: 'original', path: indices } });
    initialVisibility.set(node, node.visible);
  }

  function validateRecord(value: unknown): SceneSaveRecord {
    if (!isSceneSaveEnvelope(value) || value.sourceKey !== sourceKey || value.baselineSignature !== baselineSignature) return fail('save belongs to a different model source or schema.');
    const nodes = new Map<string, SceneSaveNode>(), assetIds = new Set(value.assets.map((asset) => asset.id));
    if (assetIds.size !== value.assets.length) fail('duplicate asset identity.');
    const orders = new Map<string | null, Set<number>>();
    const originalIds = new Set([...originals.keys()].map((path) => `o:${path}`));
    for (const entry of value.nodes as readonly unknown[]) {
      if (!object(entry) || !validId(entry['id']) || nodes.has(entry['id']) || typeof entry['type'] !== 'string' || entry['type'].length > 64
        || !(entry['parent'] === null || validId(entry['parent'])) || typeof entry['index'] !== 'number' || !Number.isSafeInteger(entry['index']) || entry['index'] < 0 || entry['index'] >= sceneSaveLimits.nodes
        || typeof entry['name'] !== 'string' || entry['name'].length > 512 || !vector(entry['position'], 3, 10_000) || !vector(entry['rotation'], 3, 10_000)
        || !['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'].includes(String(entry['rotationOrder'])) || !vector(entry['scale'], 3, 10_000)
        || !vector(entry['matrix'], 16, 1_000_000) || !affine(entry['matrix']) || typeof entry['matrixAutoUpdate'] !== 'boolean' || typeof entry['visible'] !== 'boolean'
        || !object(entry['origin']) || !validPath(entry['origin']['path'])) fail('invalid node schema or transform.');
      const origin = entry['origin'];
      if (origin['kind'] === 'original') {
        const template = originals.get(pathKey(origin['path'] as number[]));
        if (template?.type !== entry['type']) fail('unknown original node origin/type.');
        if (entry['id'].startsWith('o:') && entry['id'] !== originalId(origin['path'] as number[])) fail('original identity was changed.');
      } else if (origin['kind'] !== 'asset' || !validAssetId(origin['assetId']) || !assetIds.has(origin['assetId']) || entry['id'].startsWith('o:')) fail('unknown asset origin.');
      const node = entry as unknown as SceneSaveNode;
      nodes.set(node.id, node);
      const order = orders.get(node.parent) ?? new Set<number>();
      if (order.has(node.index)) fail('duplicate sibling order.');
      order.add(node.index); orders.set(node.parent, order);
      originalIds.delete(node.id);
    }
    if (originalIds.size || nodes.get('o:')?.parent !== null) fail('incomplete original graph.');
    for (const order of orders.values()) for (let i = 0; i < order.size; i++) if (!order.has(i)) fail('invalid sibling order.');
    for (const node of nodes.values()) {
      let parent = node.parent, depth = 0;
      const visited = new Set([node.id]);
      while (parent !== null) {
        if (visited.has(parent) || ++depth > sceneSaveLimits.depth) fail('cyclic or excessively deep parent graph.');
        visited.add(parent);
        const ancestor = nodes.get(parent); if (!ancestor) return fail('unknown parent identity.');
        parent = ancestor.parent;
      }
    }
    const worldMatrices = new Map<string, THREE.Matrix4>();
    for (const node of nodes.values()) {
      const chain: SceneSaveNode[] = [];
      let ancestor: SceneSaveNode | undefined = node;
      while (ancestor && !worldMatrices.has(ancestor.id)) { chain.push(ancestor); ancestor = ancestor.parent === null ? undefined : nodes.get(ancestor.parent); }
      while (chain.length) {
        const entry = chain.pop(); if (!entry) break;
        const local = entry.matrixAutoUpdate ? new THREE.Matrix4().compose(new THREE.Vector3().fromArray(entry.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(entry.rotation[0], entry.rotation[1], entry.rotation[2], entry.rotationOrder)), new THREE.Vector3().fromArray(entry.scale))
          : new THREE.Matrix4().fromArray(entry.matrix);
        const parent = entry.parent === null ? undefined : worldMatrices.get(entry.parent);
        const world = parent ? parent.clone().multiply(local) : local;
        if (world.elements.some((number) => !Number.isFinite(number) || Math.abs(number) > 1_000_000)) fail('unbounded compounded world transform.');
        worldMatrices.set(entry.id, world);
      }
    }
    const visibilityIds = new Set<string>();
    for (const entry of value.visibility as readonly unknown[]) {
      if (!object(entry) || !validId(entry['id']) || !nodes.has(entry['id']) || visibilityIds.has(entry['id']) || typeof entry['visible'] !== 'boolean') fail('invalid visibility override.');
      visibilityIds.add(entry['id']);
    }
    return value;
  }

  return {
    registerClone(source: THREE.Object3D, copy: THREE.Object3D): void {
      const sourceNodes = enumerate(source), copyNodes = enumerate(copy);
      if (sourceNodes.size !== copyNodes.size || identities.size + copyNodes.size > sceneSaveLimits.nodes) fail('clone graph does not match its source.');
      const pending: [THREE.Object3D, Identity][] = [];
      for (const [path, node] of copyNodes) {
        const sourceNode = sourceNodes.get(path), identity = sourceNode && identities.get(sourceNode);
        if (!identity || identities.has(node) || sourceNode.type !== node.type) fail('clone has an unsupported source.');
        pending.push([node, { id: `n:${nextId++}`, origin: identity.origin }]);
      }
      pending.forEach(([node, identity]) => { identities.set(node, identity); }); revision++;
    },
    registerImportedAsset(asset: { readonly id: string; readonly bytes: ArrayBuffer; readonly root: THREE.Object3D }): void {
      if (assets.has(asset.id)) fail('duplicate retained asset identity.');
      validateAssets([...assets.values(), asset]);
      const nodes = enumerate(asset.root);
      if (identities.size + nodes.size > sceneSaveLimits.nodes || [...nodes.values()].some((node) => identities.has(node))) fail('imported graph exceeds the node budget or is already registered.');
      const retained = { id: asset.id, bytes: asset.bytes.slice(0) };
      assets.set(asset.id, retained);
      for (const [path, node] of nodes) identities.set(node, { id: `n:${nextId++}`, origin: { kind: 'asset', assetId: asset.id, path: path ? path.split('/').map(Number) : [] } });
      revision++;
    },
    capture(visibility: ReadonlyMap<THREE.Object3D, boolean> = new Map()): SceneSaveRecord {
      // Runtime Undo still owns every registered object/resource. A durable save
      // needs only the active graph, canonical deletion state and its ancestors.
      const kept = new Set(enumerate(root).values());
      for (const node of kept) if (!identities.has(node)) fail('unregistered scene child cannot be saved.');
      for (const original of originals.values()) {
        let node: THREE.Object3D | null = original, depth = 0;
        while (node && !kept.has(node)) {
          if (!identities.has(node)) fail('unregistered scene parent cannot be saved.');
          if (++depth > sceneSaveLimits.depth) fail('excessively deep parent graph.');
          kept.add(node); node = node.parent;
        }
      }
      const siblingIndices = new Map<THREE.Object3D, number>();
      for (const parent of kept) {
        let index = 0;
        for (const child of parent.children) if (kept.has(child)) siblingIndices.set(child, index++);
      }
      const records: SceneSaveNode[] = [], referencedAssets = new Set<string>();
      let rootIndex = 0;
      for (const [node, identity] of identities) {
        if (!kept.has(node)) continue;
        const parent = node === root || node.parent === null ? null : identities.get(node.parent)?.id;
        if (parent === undefined) fail('unregistered scene parent cannot be saved.');
        const index = parent === null ? rootIndex++ : siblingIndices.get(node);
        if (index === undefined) fail('missing saved sibling order.');
        if (node.matrixAutoUpdate) node.updateMatrix();
        const origin: SceneNodeOrigin = identity.origin.kind === 'original' ? { kind: 'original', path: [...identity.origin.path] }
          : { kind: 'asset', assetId: identity.origin.assetId, path: [...identity.origin.path] };
        if (origin.kind === 'asset') referencedAssets.add(origin.assetId);
        records.push({ id: identity.id, origin, type: node.type, parent, index, name: node.name,
          position: node.position.toArray(), rotation: [node.rotation.x, node.rotation.y, node.rotation.z], rotationOrder: node.rotation.order,
          scale: node.scale.toArray(), matrix: node.matrix.toArray(), matrixAutoUpdate: node.matrixAutoUpdate,
          visible: visibility.get(node) ?? initialVisibility.get(node) ?? node.visible });
      }
      const overrides = [...visibility].flatMap(([node, visible]) => {
        const identity = identities.get(node); if (!identity) return fail('unknown visibility target.');
        return kept.has(node) ? [{ id: identity.id, visible }] : [];
      });
      return validateRecord({ version: SCENE_SAVE_VERSION, sourceKey, baselineSignature, savedAt: Date.now(), nodes: records,
        // Registered buffers are privately owned and immutable by contract. Reuse
        // them across transform saves; IndexedDB performs the durable copy.
        assets: [...assets.values()].filter((asset) => referencedAssets.has(asset.id)).map((asset) => ({ id: asset.id, bytes: asset.bytes })), visibility: overrides });
    },
    async restore(value: unknown, options: RestoreOptions): Promise<{ visibility: Map<THREE.Object3D, boolean>; assets: AssetStats }> {
      const ticket = ++revision;
      const check = () => { if (options.signal?.aborted || revision !== ticket) throw abortError(); };
      check();
      const record = structuredClone(validateRecord(value)), stats = validateAssets(record.assets);
      const templates = new Map<string, Map<string, THREE.Object3D>>();
      for (const asset of record.assets) {
        check();
        // Pass a private copy: neither a loader nor a concurrent caller can mutate retained bytes.
        const imported = await options.parseAsset(asset.bytes.slice(0), asset.id);
        check(); templates.set(asset.id, enumerate(imported));
      }
      const restored = new Map<string, THREE.Object3D>(), newIdentities = new Map<THREE.Object3D, Identity>();
      const templateObjects = new Set([...originals.values(), ...[...templates.values()].flatMap((nodes) => [...nodes.values()])]);
      for (const entry of record.nodes) {
        const template = entry.origin.kind === 'original' ? originals.get(pathKey(entry.origin.path)) : templates.get(entry.origin.assetId)?.get(pathKey(entry.origin.path));
        if (template?.type !== entry.type) fail('asset descendant origin/type no longer matches.');
        const shallow = entry.id.startsWith('o:') ? template : template.clone(false);
        const node = entry.id.startsWith('o:') || !options.cloneObject ? shallow : options.cloneObject(shallow);
        if (!(node instanceof THREE.Object3D) || node.type !== entry.type || (node !== template && templateObjects.has(node))
          || (!entry.id.startsWith('o:') && (node === template || node.parent !== null)) || newIdentities.has(node)) fail('clone callback returned an unsafe object.');
        if (!entry.id.startsWith('o:')) node.clear();
        restored.set(entry.id, node); newIdentities.set(node, { id: entry.id, origin: entry.origin });
      }
      check();
      // No awaits below: validation, parsing and cancellation finish before the atomic graph replacement.
      const oldNodes = new Set([...identities.keys(), ...enumerate(root).values()]);
      for (const node of oldNodes) for (const child of [...node.children]) node.remove(child);
      for (const entry of record.nodes) {
        const node = restored.get(entry.id); if (!node) return fail('missing restored identity.');
        node.name = entry.name; node.visible = entry.visible;
        node.position.fromArray(entry.position); node.rotation.set(entry.rotation[0] ?? 0, entry.rotation[1] ?? 0, entry.rotation[2] ?? 0, entry.rotationOrder);
        node.scale.fromArray(entry.scale); node.matrix.fromArray(entry.matrix); node.matrixAutoUpdate = entry.matrixAutoUpdate;
      }
      for (const entry of [...record.nodes].sort((a, b) => a.index - b.index)) {
        if (entry.parent === null) continue;
        const node = restored.get(entry.id), parent = restored.get(entry.parent);
        if (node && parent) parent.add(node);
      }
      identities.clear(); newIdentities.forEach((identity, node) => { identities.set(node, identity); });
      assets = new Map(record.assets.map((asset) => [asset.id, { id: asset.id, bytes: asset.bytes.slice(0) }]));
      nextId = Math.max(0, ...record.nodes.filter((entry) => entry.id.startsWith('n:')).map((entry) => Number(entry.id.slice(2)))) + 1;
      root.updateMatrixWorld(true);
      return { visibility: new Map(record.visibility.map((entry) => [restored.get(entry.id) ?? root, entry.visible])), assets: stats };
    },
  };
}
