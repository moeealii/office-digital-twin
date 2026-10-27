const MAX_BYTES = 20 * 1024 * 1024;
const EXTENSIONS = new Set(['KHR_materials_unlit', 'KHR_texture_transform']);
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const fail = (message: string): never => { throw new Error(`Local model: ${message}`); };
function integer(value: unknown, maximum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) return fail(`invalid ${label}.`);
  return value;
}
function list(root: RecordValue, name: string, maximum: number): RecordValue[] {
  const value = root[name] ?? [];
  if (!Array.isArray(value) || value.length > maximum || !value.every(record)) return fail(`invalid or oversized ${name}.`);
  return value;
}
function index(value: unknown, length: number, label: string): number { return integer(value, length - 1, label); }

function imageSize(bytes: Uint8Array, mime: unknown): { width: number; height: number } {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png' && bytes.length >= 24 && data.getUint32(0) === 0x89504e47 && data.getUint32(4) === 0x0d0a1a0a
    && data.getUint32(8) === 13 && data.getUint32(12) === 0x49484452) return { width: data.getUint32(16), height: data.getUint32(20) };
  if (mime === 'image/jpeg' && bytes.length >= 4 && data.getUint16(0) === 0xffd8) {
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at] !== 0xff) break;
      const marker = bytes[at + 1];
      if (marker === 0xff) { at++; continue; }
      if (marker === 0xda || marker === 0xd9) break;
      const length = data.getUint16(at + 2);
      if (length < 2 || at + 2 + length > bytes.length) break;
      if (marker !== undefined && [0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) return { width: data.getUint16(at + 7), height: data.getUint16(at + 5) };
      at += 2 + length;
    }
  }
  return fail('embedded textures must be valid PNG or JPEG images.');
}

/** Strict static, embedded-only GLB preflight. Never instantiate a permissive stock URL loader first. */
export function validateLocalGlb(buffer: ArrayBuffer): { triangles: number; texturePixels: number } {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_BYTES) fail('use a GLB no larger than 20 MiB.');
  const data = new DataView(buffer);
  if (data.getUint32(0, true) !== 0x46546c67 || data.getUint32(4, true) !== 2 || data.getUint32(8, true) !== buffer.byteLength) fail('invalid GLB v2 container.');
  let offset = 12, json: unknown, binary = new Uint8Array();
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) fail('truncated chunk.');
    const length = data.getUint32(offset, true), type = data.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > buffer.byteLength) fail('invalid chunk size.');
    if (offset === 12 && type === 0x4e4f534a && length <= 1024 * 1024) {
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer, offset + 8, length))); }
      catch { fail('invalid JSON chunk.'); }
    } else if (json !== undefined && type === 0x004e4942 && binary.length === 0) binary = new Uint8Array(buffer, offset + 8, length);
    else fail('unsupported or duplicate chunk.');
    offset += 8 + length;
  }
  if (!record(json) || !record(json['asset']) || json['asset']['version'] !== '2.0') return fail('invalid glTF 2.0 asset.');
  const root = json;
  const pending: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }];
  while (pending.length) {
    const entry = pending.pop(); if (!entry) break;
    if (entry.depth > 64) fail('JSON nesting limit exceeded.');
    if (typeof entry.value === 'number' && !Number.isFinite(entry.value)) fail('nonfinite JSON values are not supported.');
    if (Array.isArray(entry.value)) entry.value.forEach((value: unknown) => { pending.push({ value, depth: entry.depth + 1 }); });
    else if (record(entry.value)) for (const [key, value] of Object.entries(entry.value)) {
      if (key === 'uri' || /^(?:__proto__|constructor|prototype|scripts?|onBeforeCompile|onBeforeRender|onAfterRender)$/i.test(key)) fail('external resources, scripts and data URLs are not allowed.');
      if (key === 'extensions') {
        if (!record(value) || Object.keys(value).some((name) => !EXTENSIONS.has(name))) fail('unsupported extension; export an uncompressed static GLB.');
      }
      pending.push({ value, depth: entry.depth + 1 });
    }
  }
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    const values = root[key] ?? [];
    if (!Array.isArray(values) || values.some((value: unknown) => typeof value !== 'string' || !EXTENSIONS.has(value))) fail('unsupported extension; export an uncompressed static GLB.');
  }
  if (list(root, 'skins', 0).length || list(root, 'animations', 0).length || list(root, 'cameras', 0).length) fail('only static mesh GLBs are supported.');
  const buffers = list(root, 'buffers', 1), views = list(root, 'bufferViews', 2048), accessors = list(root, 'accessors', 2048);
  if (buffers.length !== 1 || integer(buffers[0]?.['byteLength'], MAX_BYTES, 'buffer size') > binary.length) fail('a single embedded BIN buffer is required.');
  const declaredBytes = integer(buffers[0]?.['byteLength'], binary.length, 'buffer size');
  let copiedBytes = 0;
  const ranges = views.map((view) => {
    if (view['buffer'] !== 0) fail('invalid buffer reference.');
    const start = integer(view['byteOffset'] ?? 0, declaredBytes, 'buffer offset'), length = integer(view['byteLength'], declaredBytes, 'buffer view size');
    if (start + length > declaredBytes) fail('buffer view exceeds BIN data.');
    // GLTFLoader slices each distinct view, even when their BIN ranges overlap.
    copiedBytes += length;
    if (copiedBytes > MAX_BYTES) fail('buffer view allocation budget exceeded.');
    return { start, length, stride: integer(view['byteStride'] ?? 0, 252, 'buffer stride') };
  });
  const components: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const widths: Record<string, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  let totalComponents = 0;
  const attributes = accessors.map((accessor) => {
    if ('sparse' in accessor) fail('sparse accessors are not supported.');
    const range = ranges[index(accessor['bufferView'], ranges.length, 'accessor buffer view')];
    const count = integer(accessor['count'], 1_000_000, 'accessor count');
    const width = widths[String(accessor['componentType'])], size = components[String(accessor['type'])];
    if (!range || !width || !size) return fail('unsupported accessor layout.');
    const start = integer(accessor['byteOffset'] ?? 0, range.length, 'accessor offset'), stride = range.stride || width * size;
    if (start % width || range.start % width || stride < width * size || stride % width || start + (count ? (count - 1) * stride + width * size : 0) > range.length) fail('accessor exceeds its buffer view.');
    totalComponents += count * size;
    if (totalComponents > 8_000_000) fail('vertex data limit exceeded.');
    if (accessor['componentType'] === 5126) for (let i = 0; i < count; i++) for (let k = 0; k < size; k++) {
      const value = data.getFloat32(binary.byteOffset + range.start + start + i * stride + k * width, true);
      if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) fail('invalid or unbounded vertex values.');
    }
    return { count, size, componentType: accessor['componentType'], start: binary.byteOffset + range.start + start, stride, width };
  });
  const meshes = list(root, 'meshes', 256);
  const triangleCounts = meshes.map((mesh) => {
    if (!Array.isArray(mesh['primitives']) || mesh['primitives'].length > 128) return fail('invalid mesh primitives.');
    let triangles = 0;
    for (const value of mesh['primitives']) {
      if (!record(value) || (value['mode'] ?? 4) !== 4 || 'targets' in value || !record(value['attributes'])) return fail('only static triangle meshes are supported.');
      const position = attributes[index(value['attributes']['POSITION'], attributes.length, 'POSITION accessor')];
      if (position?.size !== 3 || position.componentType !== 5126) return fail('invalid POSITION accessor.');
      let count = position.count;
      if ('indices' in value) {
        const indices = attributes[index(value['indices'], attributes.length, 'index accessor')];
        if (indices?.size !== 1 || ![5121, 5123, 5125].includes(Number(indices.componentType))) return fail('invalid triangle indices.');
        count = indices.count;
        for (let i = 0; i < count; i++) {
          const at = indices.start + i * indices.stride;
          const vertex = indices.width === 1 ? data.getUint8(at) : indices.width === 2 ? data.getUint16(at, true) : data.getUint32(at, true);
          if (vertex >= position.count) fail('triangle index exceeds vertex data.');
        }
      }
      if (count % 3) fail('incomplete triangle data.');
      triangles += count / 3;
    }
    return triangles;
  });
  const nodes = list(root, 'nodes', 1000), children = nodes.map((node) => {
    if ('skin' in node || 'camera' in node || 'weights' in node) fail('only static mesh nodes are supported.');
    const values = node['children'] ?? [];
    if (!Array.isArray(values)) return fail('invalid node children.');
    for (const field of ['matrix', 'translation', 'rotation', 'scale']) if (field in node) {
      const values = node[field], length = field === 'matrix' ? 16 : field === 'rotation' ? 4 : 3;
      if (!Array.isArray(values) || values.length !== length || values.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10_000)) fail('invalid node transform.');
    }
    return values.map((value: unknown) => index(value, nodes.length, 'child node'));
  });
  let triangles = 0;
  for (const node of nodes) if ('mesh' in node) triangles += triangleCounts[index(node['mesh'], meshes.length, 'node mesh')] ?? 0;
  if (triangles === 0 || triangles > 500_000) fail('model must contain at most 500,000 rendered triangles.');
  const parents = new Set<number>();
  for (const values of children) for (const child of values) { if (parents.has(child)) fail('nodes cannot have multiple parents.'); parents.add(child); }
  for (let i = 0; i < nodes.length; i++) {
    const active = new Set<number>(), stack: { node: number; exit: boolean }[] = [{ node: i, exit: false }];
    while (stack.length) {
      const entry = stack.pop(); if (!entry) break;
      if (entry.exit) { active.delete(entry.node); continue; }
      if (active.has(entry.node) || active.size >= 64) fail('cyclic or excessively deep node hierarchy.');
      active.add(entry.node); stack.push({ node: entry.node, exit: true });
      for (const child of children[entry.node] ?? []) stack.push({ node: child, exit: false });
    }
  }
  const images = list(root, 'images', 64); let pixels = 0, imageBytes = 0;
  for (const image of images) {
    const range = ranges[index(image['bufferView'], ranges.length, 'image buffer view')];
    if (!range) return fail('invalid image data.');
    // Separate image sources can each create a Blob from the same cached view.
    imageBytes += range.length;
    if (imageBytes > MAX_BYTES) fail('embedded image allocation budget exceeded.');
    const { width, height } = imageSize(binary.subarray(range.start, range.start + range.length), image['mimeType']);
    pixels += width * height;
    if (!width || !height || width > 4096 || height > 4096 || pixels > 8_000_000) fail('embedded texture pixel budget exceeded.');
  }
  list(root, 'materials', 256); list(root, 'textures', 128); list(root, 'samplers', 128);
  const scenes = list(root, 'scenes', 32);
  for (const scene of scenes) {
    const roots = scene['nodes'];
    if (!Array.isArray(roots)) return fail('invalid scene roots.');
    for (const value of roots) index(value, nodes.length, 'scene root');
  }
  if ('scene' in root) index(root['scene'], scenes.length, 'default scene');
  return { triangles, texturePixels: pixels };
}
