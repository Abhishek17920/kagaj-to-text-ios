/**
 * Annotation model — a straight port of the web app's `src/lib/annot.ts`
 * (kagaj-to-text-front) so a page drawn on iPad opens byte-compatible on the
 * web and vice-versa.
 *
 * All coordinates are fractions of the surface (0..1) so ink scales with zoom
 * and with whatever pixel size the page is rendered at.
 */

export type DrawTool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "sticky"
  | "select"
  | "laser";

export interface Stroke {
  k: "stroke";
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  points: [number, number][];
  /** Per-point Apple Pencil pressure (0..1). Absent = constant width. */
  pressures?: number[];
}

export interface Shape {
  k: "shape";
  id: string;
  kind: "line" | "arrow" | "rect" | "ellipse";
  color: string;
  width: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextBox {
  k: "text";
  id: string;
  sticky: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  html: string;
  color: string;
  fontSize: number;
  background?: string;
  borderColor?: string;
}

export type Item = Stroke | Shape | TextBox;

export interface Ann {
  items: Item[];
}

export const emptyAnn = (): Ann => ({ items: [] });

export const uid = () => Math.random().toString(36).slice(2, 10);

export function parseAnn(raw: string | null | undefined): Ann {
  if (!raw) return emptyAnn();
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return emptyAnn();
  }

  // Current shape: { items: Item[] }
  if (v && typeof v === "object" && Array.isArray((v as Ann).items)) {
    return {
      items: (v as Ann).items.map((item) =>
        item.k === "stroke" && !item.id ? { ...item, id: uid() } : item,
      ),
    };
  }

  // Legacy: a bare array of freehand strokes, possibly in 794x1123 page space.
  if (Array.isArray(v)) {
    const items: Item[] = [];
    for (const s of v as Record<string, unknown>[]) {
      const pts = ((s.points as [number, number][]) || []) as [number, number][];
      const legacyPageSpace = pts.some(([x, y]) => x > 1.5 || y > 1.5);
      const norm: [number, number][] = legacyPageSpace
        ? pts.map(([x, y]) => [x / 794, y / 1123] as [number, number])
        : pts;
      items.push({
        k: "stroke",
        id: uid(),
        tool: (s.tool as string) === "highlighter" ? "highlighter" : "pen",
        color: (s.color as string) || "#111827",
        width: (s.width as number) || 3,
        points: norm,
      });
    }
    return { items };
  }

  return emptyAnn();
}

export const serialiseAnn = (a: Ann): string => JSON.stringify(a);

/* ------------------------------------------------------------------ *
 * Geometry helpers for the select tool and shape recognition.
 * All work in FRACTION space (0..1) unless a caller scales first.
 * ------------------------------------------------------------------ */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bboxOfItem(it: Item): Box {
  if (it.k === "stroke") {
    let x0 = 1;
    let y0 = 1;
    let x1 = 0;
    let y1 = 0;
    for (const [x, y] of it.points) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  }
  if (it.k === "shape") {
    return {
      x: Math.min(it.x0, it.x1),
      y: Math.min(it.y0, it.y1),
      w: Math.abs(it.x1 - it.x0),
      h: Math.abs(it.y1 - it.y0),
    };
  }
  return { x: it.x, y: it.y, w: it.w, h: it.h };
}

/** Move an item by a fraction-space delta; returns a new item. */
export function translateItem(it: Item, dx: number, dy: number): Item {
  if (it.k === "stroke") {
    return { ...it, points: it.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
  }
  if (it.k === "shape") {
    return { ...it, x0: it.x0 + dx, y0: it.y0 + dy, x1: it.x1 + dx, y1: it.y1 + dy };
  }
  return { ...it, x: it.x + dx, y: it.y + dy };
}

/** Hit test in PIXEL space — caller passes the surface size. */
export function hitItemPx(it: Item, px: number, py: number, w: number, h: number, pad = 12): boolean {
  const b = bboxOfItem(it);
  return (
    px >= b.x * w - pad &&
    px <= (b.x + b.w) * w + pad &&
    py >= b.y * h - pad &&
    py <= (b.y + b.h) * h + pad
  );
}

/**
 * Cheap handwriting-shape recognition for a freehand pen stroke (pixel space).
 * Returns a Shape kind when the stroke closely matches, else null.
 */
export function recogniseShape(
  pts: [number, number][],
): { kind: "line" | "rect" | "ellipse"; x0: number; y0: number; x1: number; y1: number } | null {
  if (pts.length < 4) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let path = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (i) path += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const diag = Math.hypot(w, h);
  if (diag < 0.04) return null;

  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const closed = Math.hypot(ex - sx, ey - sy) < diag * 0.25;

  // straight line: end-to-end distance ≈ path length, and not closed
  const span = Math.hypot(ex - sx, ey - sy);
  if (!closed && span > path * 0.9) {
    return { kind: "line", x0: sx, y0: sy, x1: ex, y1: ey };
  }
  if (!closed) return null;

  // closed loop → rect vs ellipse by how much of the bbox the path "fills"
  const rectPerim = 2 * (w + h);
  const ellipsePerim = Math.PI * (1.5 * (w + h) - Math.sqrt(w * h * 4));
  const dRect = Math.abs(path - rectPerim);
  const dEll = Math.abs(path - ellipsePerim);
  if (Math.min(dRect, dEll) > diag * 0.9) return null;
  const kind = dEll < dRect ? "ellipse" : "rect";
  return { kind, x0: minX, y0: minY, x1: maxX, y1: maxY };
}

/** Distance from point p to segment ab, all in the same coordinate space. */
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
