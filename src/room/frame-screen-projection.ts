interface FrameScreenCorner {
  readonly x: number;
  readonly y: number;
}

/** Screen corners in canvas-relative CSS pixels: top-left, top-right, bottom-right, bottom-left. */
export interface FrameScreenProjection {
  readonly corners: readonly [FrameScreenCorner, FrameScreenCorner, FrameScreenCorner, FrameScreenCorner];
  readonly visible: boolean;
}

/** Map the iframe's actual document plane onto the modeled display, including perspective. */
export function frameScreenTransform(projection: FrameScreenProjection, width = 1280, height = 800): string | null {
  if (!projection.visible || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const [p0, p1, p2, p3] = projection.corners;
  if (projection.corners.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  let orientation = 0;
  for (let i = 0; i < 4; i++) {
    const a = projection.corners[i];
    const b = projection.corners[(i + 1) % 4];
    const c = projection.corners[(i + 2) % 4];
    if (!a || !b || !c) return null;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.001 || (orientation && Math.sign(cross) !== orientation)) return null;
    orientation = Math.sign(cross);
  }
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(dx3) + Math.abs(dy3) > 0.000001) {
    const determinant = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(determinant) < 0.000001) return null;
    g = (dx3 * dy2 - dx2 * dy3) / determinant;
    h = (dx1 * dy3 - dx3 * dy1) / determinant;
  }
  if ([1 + g, 1 + h, 1 + g + h].some((v) => v <= 0.000001)) return null;
  const matrix = [
    (p1.x - p0.x + g * p1.x) / width, (p1.y - p0.y + g * p1.y) / width, 0, g / width,
    (p3.x - p0.x + h * p3.x) / height, (p3.y - p0.y + h * p3.y) / height, 0, h / height,
    0, 0, 1, 0,
    p0.x, p0.y, 0, 1,
  ];
  if (matrix.some((value) => !Number.isFinite(value))) return null;
  return `matrix3d(${matrix.join(',')})`;
}
