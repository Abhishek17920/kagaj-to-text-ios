import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Canvas,
  Group,
  Path,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import {
  Gesture,
  GestureDetector,
  PointerType,
} from "react-native-gesture-handler";
import {
  Ann,
  DrawTool,
  Item,
  Shape,
  Stroke,
  distToSegment,
  emptyAnn,
  uid,
} from "@/lib/annot";
import { Ruling } from "./Ruling";

type Pt = { x: number; y: number };

export interface DrawCanvasProps {
  width: number;
  height: number;
  ann: Ann;
  onCommit: (next: Ann) => void;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  /** Ignore finger input — only Apple Pencil draws (palm rejection). */
  pencilOnly: boolean;
  rulingType?: string;
  /** Optional Skia node drawn under the ink (e.g. a PDF page image). */
  backgroundNode?: React.ReactNode;
}

const HL_OPACITY = 0.3;

function toPixels(pts: [number, number][], w: number, h: number): Pt[] {
  return pts.map(([fx, fy]) => ({ x: fx * w, y: fy * h }));
}

function smoothPath(pts: Pt[]): SkPath {
  const p = Skia.Path.Make();
  if (!pts.length) return p;
  p.moveTo(pts[0].x, pts[0].y);
  if (pts.length < 3) {
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    return p;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i];
    const n = pts[i + 1];
    p.quadTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
  }
  const last = pts[pts.length - 1];
  p.lineTo(last.x, last.y);
  return p;
}

function shapePath(s: Shape, w: number, h: number): SkPath {
  const p = Skia.Path.Make();
  const x0 = s.x0 * w;
  const y0 = s.y0 * h;
  const x1 = s.x1 * w;
  const y1 = s.y1 * h;
  if (s.kind === "rect") {
    p.addRect(Skia.XYWHRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)));
  } else if (s.kind === "ellipse") {
    p.addOval(Skia.XYWHRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)));
  } else {
    p.moveTo(x0, y0);
    p.lineTo(x1, y1);
    if (s.kind === "arrow") {
      const a = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(10, s.width * 3);
      p.moveTo(x1, y1);
      p.lineTo(x1 - head * Math.cos(a - Math.PI / 7), y1 - head * Math.sin(a - Math.PI / 7));
      p.moveTo(x1, y1);
      p.lineTo(x1 - head * Math.cos(a + Math.PI / 7), y1 - head * Math.sin(a + Math.PI / 7));
    }
  }
  return p;
}

export function DrawCanvas({
  width,
  height,
  ann,
  onCommit,
  tool,
  color,
  strokeWidth,
  pencilOnly,
  rulingType,
  backgroundNode,
}: DrawCanvasProps) {
  const [live, setLive] = useState<Pt[] | null>(null);
  const liveRef = useRef<Pt[] | null>(null);
  const rejected = useRef(false);
  const annRef = useRef(ann);
  annRef.current = ann;

  const strokeItems = useMemo(
    () => (ann.items.filter((i) => i.k === "stroke") as Stroke[]),
    [ann],
  );
  const shapeItems = useMemo(
    () => (ann.items.filter((i) => i.k === "shape") as Shape[]),
    [ann],
  );

  const strokePaths = useMemo(
    () =>
      strokeItems.map((s) => ({
        s,
        path: smoothPath(toPixels(s.points, width, height)),
      })),
    [strokeItems, width, height],
  );
  const shapePaths = useMemo(
    () => shapeItems.map((s) => ({ s, path: shapePath(s, width, height) })),
    [shapeItems, width, height],
  );

  const isShapeTool = tool === "line" || tool === "arrow" || tool === "rect" || tool === "ellipse";
  const isPassiveTool = tool === "sticky" || tool === "select" || tool === "text";

  const eraseAt = (px: number, py: number) => {
    const hitR = Math.max(10, strokeWidth * 2);
    const keep = annRef.current.items.filter((it) => {
      if (it.k === "stroke") {
        const pix = toPixels(it.points, width, height);
        for (let i = 1; i < pix.length; i++) {
          if (distToSegment(px, py, pix[i - 1].x, pix[i - 1].y, pix[i].x, pix[i].y) < hitR) {
            return false;
          }
        }
        if (pix.length === 1 && Math.hypot(pix[0].x - px, pix[0].y - py) < hitR) return false;
        return true;
      }
      if (it.k === "shape") {
        const d = distToSegment(px, py, it.x0 * width, it.y0 * height, it.x1 * width, it.y1 * height);
        return d >= hitR;
      }
      return true;
    });
    if (keep.length !== annRef.current.items.length) onCommit({ items: keep });
  };

  const commitStroke = (pts: Pt[]) => {
    if (pts.length < 2) return;
    const frac = pts.map((p) => [
      Math.min(1, Math.max(0, p.x / width)),
      Math.min(1, Math.max(0, p.y / height)),
    ]) as [number, number][];
    const stroke: Stroke = {
      k: "stroke",
      id: uid(),
      tool: tool === "highlighter" ? "highlighter" : "pen",
      color,
      width: strokeWidth,
      points: frac,
    };
    onCommit({ items: [...annRef.current.items, stroke] });
  };

  const commitShape = (a: Pt, b: Pt) => {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 4) return;
    const s: Shape = {
      k: "shape",
      id: uid(),
      kind: tool as Shape["kind"],
      color,
      width: strokeWidth,
      x0: a.x / width,
      y0: a.y / height,
      x1: b.x / width,
      y1: b.y / height,
    };
    onCommit({ items: [...annRef.current.items, s] });
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minPointers(1)
    .maxPointers(1)
    .minDistance(0)
    .averageTouches(false)
    .onBegin((e) => {
      rejected.current =
        isPassiveTool || (pencilOnly && e.pointerType !== PointerType.STYLUS);
      if (rejected.current) return;
      const p = { x: e.x, y: e.y };
      if (tool === "eraser") {
        eraseAt(p.x, p.y);
        liveRef.current = null;
        setLive(null);
      } else {
        liveRef.current = [p];
        setLive(liveRef.current);
      }
    })
    .onUpdate((e) => {
      if (rejected.current) return;
      const p = { x: e.x, y: e.y };
      if (tool === "eraser") {
        eraseAt(p.x, p.y);
        return;
      }
      const prev = liveRef.current;
      const next = !prev ? [p] : isShapeTool ? [prev[0], p] : [...prev, p];
      liveRef.current = next;
      setLive(next);
    })
    .onEnd(() => {
      if (rejected.current) {
        rejected.current = false;
        return;
      }
      const completed = liveRef.current;
      liveRef.current = null;
      setLive(null);
      if (completed && tool !== "eraser") {
        if (isShapeTool && completed.length >= 2) {
          commitShape(completed[0], completed[completed.length - 1]);
        } else if (!isShapeTool) {
          commitStroke(completed);
        }
      }
    })
    .onFinalize(() => {
      rejected.current = false;
    });

  const livePath = useMemo(() => {
    if (!live) return null;
    if (isShapeTool && live.length >= 2) {
      return shapePath(
        {
          k: "shape",
          id: "live",
          kind: tool as Shape["kind"],
          color,
          width: strokeWidth,
          x0: live[0].x / width,
          y0: live[0].y / height,
          x1: live[1].x / width,
          y1: live[1].y / height,
        },
        width,
        height,
      );
    }
    return smoothPath(live);
  }, [live, isShapeTool, tool, color, strokeWidth, width, height]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }}>
          {backgroundNode}
          {rulingType ? <Ruling type={rulingType} w={width} h={height} /> : null}

          {shapePaths.map(({ s, path }) => (
            <Path
              key={s.id}
              path={path}
              style="stroke"
              color={s.color}
              strokeWidth={s.width}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}

          <Group>
            {strokePaths.map(({ s, path }) => (
              <Path
                key={s.id}
                path={path}
                style="stroke"
                color={s.color}
                strokeWidth={s.width}
                strokeCap={s.tool === "highlighter" ? "square" : "round"}
                strokeJoin="round"
                opacity={s.tool === "highlighter" ? HL_OPACITY : 1}
              />
            ))}
          </Group>

          {livePath ? (
            <Path
              path={livePath}
              style="stroke"
              color={color}
              strokeWidth={strokeWidth}
              strokeCap={tool === "highlighter" ? "square" : "round"}
              strokeJoin="round"
              opacity={tool === "highlighter" ? HL_OPACITY : 1}
            />
          ) : null}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

export const makeEmptyAnn = emptyAnn;
export type { Item };

const styles = StyleSheet.create({
  wrap: { backgroundColor: "transparent" },
});
