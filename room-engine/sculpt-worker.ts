import { prepareSculptCache, preparedSculptures } from './sculpt-cache';

addEventListener('message', (event: MessageEvent<{ value: unknown; expectedHash: string; baseUrl: string }>) => {
  void (async () => {
    const { value, expectedHash, baseUrl } = event.data;
    if (!await prepareSculptCache(value, expectedHash, baseUrl, fetch, 'low')) { postMessage(null); return; }
    const sculptures = preparedSculptures();
    const transfer = new Set<ArrayBuffer>();
    for (const shape of sculptures) {
      for (const attribute of [...shape.attributes, ...(shape.index ? [shape.index] : [])]) {
        if (attribute.array.buffer instanceof ArrayBuffer) transfer.add(attribute.array.buffer);
      }
    }
    postMessage(sculptures, { transfer: [...transfer] });
  })().catch(() => { postMessage(null); });
});
