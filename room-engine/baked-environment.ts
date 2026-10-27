import * as THREE from 'three';

interface EnvironmentDescriptor {
  version: 1; sourceHash: string; bindingHash: string; binaryHash: string; file: string;
  width: number; height: number; intensity: number; byteLength: number; revision: string;
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function environmentDescriptor(value: unknown, sourceHash: string, bindingHash: string): EnvironmentDescriptor | null {
  if (!object(value) || value['version'] !== 1 || value['sourceHash'] !== sourceHash || value['bindingHash'] !== bindingHash
    || value['format'] !== 'rgba16f-cubeuv' || value['compression'] !== 'gzip' || value['revision'] !== THREE.REVISION
    || typeof value['binaryHash'] !== 'string' || !/^[a-f0-9]{64}$/.test(value['binaryHash'])
    || value['file'] !== `environment-${value['binaryHash']}.bin.gz`) return null;
  const { width, height, intensity, byteLength } = value;
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 48 || width > 4096 || height < 64 || height > 4096 || width * 4 !== height * 3
    || byteLength !== width * height * 8 || typeof intensity !== 'number' || !Number.isFinite(intensity) || intensity < 0 || intensity > 10) return null;
  return { version: 1, sourceHash, bindingHash, binaryHash: value['binaryHash'], file: value['file'], width, height, intensity, byteLength, revision: THREE.REVISION };
}

/** The expensive source cube bake has already happened at export, never in the visitor's event loop. */
export async function loadBakedEnvironment(base: string, sourceHash: string, bindingHash: string, fetcher: typeof fetch = fetch): Promise<{ texture: THREE.DataTexture; intensity: number } | null> {
  try {
    const descriptorResponse = await fetcher(new URL('environment.json', base), { cache: 'no-cache', priority: 'low' });
    if (!descriptorResponse.ok) return null;
    const raw: unknown = await descriptorResponse.json();
    const descriptor = environmentDescriptor(raw, sourceHash, bindingHash);
    if (!descriptor) return null;
    const response = await fetcher(new URL(descriptor.file, base), { cache: 'force-cache', priority: 'low' });
    if (!response.ok) return null;
    const transferred = await response.arrayBuffer();
    const buffer = transferred.byteLength === descriptor.byteLength ? transferred
      : await new Response(new Blob([transferred]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if (buffer.byteLength !== descriptor.byteLength) return null;
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
    if (hash !== descriptor.binaryHash) return null;
    const texture = new THREE.DataTexture(new Uint16Array(buffer), descriptor.width, descriptor.height, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.mapping = THREE.CubeUVReflectionMapping;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; texture.flipY = false; texture.needsUpdate = true;
    return { texture, intensity: descriptor.intensity };
  } catch { return null; }
}
