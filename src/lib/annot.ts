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
  | "select";

export interface Stroke {
  k: "stroke";
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  points: [number, number][];
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
