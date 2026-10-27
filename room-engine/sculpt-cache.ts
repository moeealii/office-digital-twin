import * as THREE from 'three';

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
interface Attribute { type: 'f32' | 'u16' | 'u32'; itemSize: number; normalized: boolean; offset: number; length: number; encoding?: 'xor-shuffle' }
interface GeometrySpec {
  attributes: Record<string, Attribute>;
  index: Attribute | null;
  groups: { start: number; count: number; materialIndex: number }[];
}
interface Manifest {
  version: 1;
  sourceHash: string;
  binaryHash: string;
  file: string;
  byteLength: number;
  compression: 'gzip' | null;
  geometries: Record<string, GeometrySpec>;
}
const prototypes = new Map<string, THREE.BufferGeometry>();
let loadedHash = '';
const instances = new Set<ProgressiveGeometry>();

/** Preserve every source-side mutation while replacing only the sampling tier. */
class ProgressiveGeometry extends THREE.BufferGeometry {
  private readonly mutations: THREE.Matrix4[] = [];
  private readonly removed = new Set<string>();
  readonly sculptKey: string;
  constructor(sculptKey: string, base: THREE.BufferGeometry) {
    super(); this.sculptKey = sculptKey; super.copy(base); instances.add(this);
  }
  override applyMatrix4(matrix: THREE.Matrix4): this {
    this.mutations.push(matrix.clone());
    return super.applyMatrix4(matrix);
  }
  override deleteAttribute(name: string): this {
    this.removed.add(name);
    return super.deleteAttribute(name);
  }
  override clone(): this {
    const copy = new ProgressiveGeometry(this.sculptKey, this);
    copy.mutations.push(...this.mutations.map((matrix) => matrix.clone()));
    this.removed.forEach((name) => copy.removed.add(name));
    return copy as this;
  }
  refine(base: THREE.BufferGeometry): void {
    const exact = base.clone();
    // Replay separately: composing matrices would change Float32 rounding versus the source.
    this.mutations.forEach((matrix) => exact.applyMatrix4(matrix));
    this.removed.forEach((name) => exact.deleteAttribute(name));
    this.dispose(); // release the old GPU buffers before replacing their layout
    super.copy(exact);
  }
}

export function isProgressiveSculpt(geometry: unknown): boolean {
  return geometry instanceof ProgressiveGeometry;
}

interface TransferAttribute { name: string; array: THREE.TypedArray; itemSize: number; normalized: boolean }
export interface SculptTransfer {
  key: string; attributes: TransferAttribute[]; index: TransferAttribute | null;
  groups: { start: number; count: number; materialIndex: number }[];
}

/** Worker-only handoff; attributes are transferred, not copied into JSON numbers. */
export function preparedSculptures(): SculptTransfer[] {
  const pack = (name: string, a: THREE.BufferAttribute): TransferAttribute => ({ name, array: a.array, itemSize: a.itemSize, normalized: a.normalized });
  return [...prototypes].map(([key, geometry]) => ({ key,
    attributes: Object.entries(geometry.attributes).map(([name, a]) => {
      if (!(a instanceof THREE.BufferAttribute)) throw new Error('Unexpected interleaved sculpture');
      return pack(name, a);
    }), index: geometry.index ? pack('index', geometry.index) : null,
    groups: geometry.groups.map((g) => ({ start: g.start, count: g.count, materialIndex: g.materialIndex ?? 0 })),
  }));
}

/** Geometry uploads are separately checkpointed after the worker finishes decoding. */
export async function applyPreparedSculptures(data: readonly SculptTransfer[], checkpoint: () => Promise<boolean>, changed: () => void = () => undefined): Promise<boolean> {
  for (const item of data) {
    if (!await checkpoint()) return false;
    const geometry = new THREE.BufferGeometry();
    item.attributes.forEach((a) => geometry.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized)));
    if (item.index) geometry.setIndex(new THREE.BufferAttribute(item.index.array, item.index.itemSize, item.index.normalized));
    item.groups.forEach((g) => { geometry.addGroup(g.start, g.count, g.materialIndex); });
    prototypes.get(item.key)?.dispose(); prototypes.set(item.key, geometry);
    for (const instance of instances) {
      if (instance.sculptKey !== item.key) continue;
      if (!await checkpoint()) return false;
      instance.refine(geometry); changed();
    }
  }
  loadedHash = '';
  return true;
}

function attribute(v: unknown, bytes: number): Attribute {
  if (!object(v)) throw new Error('invalid sculpture attribute');
  const { type, itemSize, normalized, offset, length } = v;
  if ((type !== 'f32' && type !== 'u16' && type !== 'u32') || !integer(itemSize) || itemSize < 1 || itemSize > 4
    || typeof normalized !== 'boolean' || !integer(offset) || !integer(length)) throw new Error('invalid sculpture attribute');
  const width = type === 'u16' ? 2 : 4;
  if (offset % width || length % itemSize || offset + length * width > bytes) throw new Error('sculpture attribute out of bounds');
  const encoding = v['encoding'];
  if (encoding !== undefined && encoding !== 'xor-shuffle') throw new Error('unknown sculpture encoding');
  return { type, itemSize, normalized, offset, length, ...(encoding ? { encoding } : {}) };
}

function manifest(value: unknown, expectedHash: string): Manifest {
  if (!object(value) || value['version'] !== 1 || value['sourceHash'] !== expectedHash
    || typeof value['binaryHash'] !== 'string' || !/^[a-f0-9]{64}$/.test(value['binaryHash'])
    || typeof value['file'] !== 'string' || !/^sculpts-[a-f0-9-]+\.bin(?:\.gz)?$/.test(value['file'])
    || !integer(value['byteLength']) || !object(value['geometries'])) throw new Error('sculpture cache/source mismatch');
  const bytes = value['byteLength'];
  const geometries: Record<string, GeometrySpec> = {};
  for (const [key, raw] of Object.entries(value['geometries'])) {
    if (!object(raw) || !object(raw['attributes']) || !Array.isArray(raw['groups'])) throw new Error('invalid sculpture geometry');
    const attributes: Record<string, Attribute> = {};
    for (const [name, v] of Object.entries(raw['attributes'])) attributes[name] = attribute(v, bytes);
    if (attributes['position']?.itemSize !== 3) throw new Error('sculpture position missing');
    const index = raw['index'] === null ? null : attribute(raw['index'], bytes);
    if (index && (index.type === 'f32' || index.itemSize !== 1)) throw new Error('invalid sculpture index');
    const groups = raw['groups'].map((g: unknown) => {
      if (!object(g) || !integer(g['start']) || !integer(g['count']) || !integer(g['materialIndex'])) throw new Error('invalid sculpture group');
      return { start: g['start'], count: g['count'], materialIndex: g['materialIndex'] };
    });
    geometries[key] = { attributes, index, groups };
  }
  if (!Object.keys(geometries).length) throw new Error('empty sculpture cache');
  if (value['compression'] !== undefined && value['compression'] !== 'gzip') throw new Error('unknown sculpture compression');
  return { version: 1, sourceHash: expectedHash, binaryHash: value['binaryHash'], file: value['file'], byteLength: bytes,
    compression: value['compression'] === 'gzip' ? 'gzip' : null, geometries };
}

/** Reversible integer XOR of IEEE float bits + byte shuffling; never changes numeric precision. */
export function encodeSculptBytes(bytes: Uint8Array, width: 2 | 4, stride: number): Uint8Array {
  const copy = new Uint8Array(bytes);
  const words = width === 2 ? new Uint16Array(copy.buffer) : new Uint32Array(copy.buffer);
  for (let i = words.length - 1; i >= stride; i--) words[i] = (words[i] ?? 0) ^ (words[i - stride] ?? 0);
  const output = new Uint8Array(copy.length);
  for (let b = 0; b < width; b++) for (let i = 0; i < words.length; i++) output[b * words.length + i] = copy[i * width + b] ?? 0;
  return output;
}

/** Hydrate original typed arrays, with no quantization, resampling or decimation. */
export function decodeSculpture(buffer: ArrayBuffer, spec: GeometrySpec): THREE.BufferGeometry {
  const decode = (a: Attribute) => {
    const width = a.type === 'u16' ? 2 : 4;
    let data = buffer;
    let offset = a.offset;
    if (a.encoding) {
      const source = new Uint8Array(buffer, a.offset, a.length * width);
      const restored = new Uint8Array(source.length);
      for (let b = 0; b < width; b++) for (let i = 0; i < a.length; i++) restored[i * width + b] = source[b * a.length + i] ?? 0;
      const words = width === 2 ? new Uint16Array(restored.buffer) : new Uint32Array(restored.buffer);
      for (let i = a.itemSize; i < words.length; i++) words[i] = (words[i] ?? 0) ^ (words[i - a.itemSize] ?? 0);
      data = restored.buffer; offset = 0;
    }
    return new THREE.BufferAttribute(a.type === 'f32' ? new Float32Array(data, offset, a.length)
      : a.type === 'u16' ? new Uint16Array(data, offset, a.length) : new Uint32Array(data, offset, a.length), a.itemSize, a.normalized);
  };
  const geometry = new THREE.BufferGeometry();
  for (const [key, a] of Object.entries(spec.attributes)) geometry.setAttribute(key, decode(a));
  if (spec.index) geometry.setIndex(decode(spec.index));
  for (const g of spec.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  return geometry;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
}

/** Called before assembly. A failed/stale cache honestly falls back to the exact original sculpt. */
export async function prepareSculptCache(
  value: unknown, expectedHash: string, baseUrl: string, fetcher: typeof fetch = fetch, priority: RequestPriority = 'high',
): Promise<boolean> {
  const clear = () => { prototypes.forEach((g) => { g.dispose(); }); prototypes.clear(); loadedHash = ''; };
  if (value === null) { clear(); instances.clear(); return false; }
  try {
    const info = manifest(value, expectedHash);
    const key = `${info.sourceHash}:${info.binaryHash}`;
    if (loadedHash === key && prototypes.size) return true;
    clear();
    const response = await fetcher(new URL(info.file, baseUrl), { cache: 'force-cache', priority });
    if (!response.ok) throw new Error('sculpture cache unavailable');
    const transferred = await response.arrayBuffer();
    // Some hosts serve .gz with Content-Encoding; fetch has already decoded it in that case.
    const buffer = info.compression === 'gzip' && transferred.byteLength !== info.byteLength
      ? await new Response(new Blob([transferred]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : transferred;
    if (buffer.byteLength !== info.byteLength || await sha256(buffer) !== info.binaryHash) throw new Error('sculpture cache checksum failed');
    const decoded = Object.entries(info.geometries).map(([key, spec]) => [key, decodeSculpture(buffer, spec)] as const);
    for (const [key, geometry] of decoded) prototypes.set(key, geometry);
    loadedHash = key;
    return true;
  } catch {
    clear();
    console.warn('Sculpture cache unavailable; assembling original geometry locally.');
    return false;
  }
}

/** Export-time call-site transform passes the untouched source function as the fallback. */
export function cachedSculpt<T extends unknown[]>(key: string, source: (...args: T) => THREE.BufferGeometry, ...args: T): THREE.BufferGeometry {
  // Callers mutate/rotate/delete attributes after sculpt(): never hand them the stored prototype.
  const base = prototypes.get(key);
  return base ? new ProgressiveGeometry(key, base) : source(...args);
}
