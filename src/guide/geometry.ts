/** Screen rectangles for the guide's spotlight: what stays lit, what gets dimmed, where the bubble goes. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const contains = (r: Rect, px: number, py: number): boolean => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

export const insideAny = (holes: readonly Rect[], px: number, py: number): boolean => holes.some(h => contains(h, px, py));

/** Overlapping area of two rectangles (0 when apart). */
export function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The dark cover around the lit holes, as plain rectangles: the screen is cut into bands at every
 * hole's top and bottom edge, and each band is filled wherever no hole crosses it.
 */
export function dimRects(holes: readonly Rect[], width: number, height: number): Rect[] {
  const clip = holes.map(h => ({ x0: Math.max(0, h.x), y0: Math.max(0, h.y), x1: Math.min(width, h.x + h.w), y1: Math.min(height, h.y + h.h) })).filter(h => h.x1 > h.x0 && h.y1 > h.y0);
  const ys = [...new Set([0, height, ...clip.flatMap(h => [h.y0, h.y1])])].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const top = ys[i];
    const bottom = ys[i + 1];
    const spans = clip
      .filter(h => h.y0 <= top && h.y1 >= bottom)
      .map(h => [h.x0, h.x1] as const)
      .sort((a, b) => a[0] - b[0]);
    let x = 0;
    for (const [s, e] of spans) {
      if (s > x) out.push(rect(x, top, s - x, bottom - top));
      x = Math.max(x, e);
    }
    if (x < width) out.push(rect(x, top, width - x, bottom - top));
  }
  return out;
}

/** The first spot (in order of preference) that covers the least of the lit holes. */
export function pickSpot(holes: readonly Rect[], spots: readonly Rect[]): Rect {
  let best = spots[0];
  let bestCover = Infinity;
  for (const s of spots) {
    const cover = holes.reduce((sum, h) => sum + overlap(s, h), 0);
    if (cover < bestCover) [best, bestCover] = [s, cover];
  }
  return best;
}

/** Rectangle around several others (null for none). */
export function bounds(list: readonly Rect[]): Rect | null {
  if (list.length === 0) return null;
  const x0 = Math.min(...list.map(r => r.x));
  const y0 = Math.min(...list.map(r => r.y));
  const x1 = Math.max(...list.map(r => r.x + r.w));
  const y1 = Math.max(...list.map(r => r.y + r.h));
  return rect(x0, y0, x1 - x0, y1 - y0);
}
