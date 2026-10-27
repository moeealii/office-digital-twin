/** Warm decoded images without starving the larger critical geometry download.
 * THREE.ImageLoader populates THREE.Cache; no duplicate GPU textures are made. */
export async function warmRoomAssets(
  paths: readonly string[], baseUrl: string, load: (url: string) => Promise<unknown>, concurrency = 3,
): Promise<void> {
  const urls = [...new Set(paths.map((path) => new URL(path, baseUrl).href))];
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      if (!url) return;
      try { await load(url); } catch { /* Original room loaders can retry optional warm-ups. */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(concurrency)), urls.length) }, worker));
}
