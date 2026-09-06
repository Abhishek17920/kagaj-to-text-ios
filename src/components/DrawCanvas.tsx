import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type PointerEvent as RNPointerEvent } from "react-native";
import {
  Canvas,
  Circle,
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
  bboxOfItem,
  distToSegment,
  emptyAnn,
  hitItemPx,
  recogniseShape,
  translateItem,
  uid,
} from "@/lib/annot";
import { Ruling } from "./Ruling";
import { C } from "@/lib/theme";

type Pt = { x: number; y: number };

export interface DrawCanvasProps {
  width: number;
  height: number;
  ann: Ann;
  onCommit: (next: Ann) => void;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  pencilOnly: boolean;
  /** Recognise rough pen strokes and snap them to line / rect / ellipse. */
  shapeAssist?: boolean;
  rulingType?: string;
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

const halfWidth = (base: number, pr: number) => (base * (0.32 + 1.05 * pr)) / 2;

function ribbonPath(pts: Pt[], base: number, pressures: number[]): SkPath {
  const p = Skia.Path.Make();
  if (pts.length < 2) return p;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const hw = halfWidth(base, pressures[i] ?? 0.5);
    left.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
    right.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
  }
  p.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) p.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i].x, right[i].y);
  p.close();
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

const hasVariation = (pr: number[]) => {
  if (pr.length < 2) return false;
  let lo = 1;
  let hi = 0;
  for (const v of pr) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo > 0.08;
};

function itemPath(it: Stroke | Shape, w: number, h: number): { path: SkPath; fill: boolean } {
  if (it.k === "shape") return { path: shapePath(it, w, h), fill: false };
  const pix = toPixels(it.points, w, h);
  if (it.pressures && it.pressures.length === it.points.length) {
    return { path: ribbonPath(pix, it.width, it.pressures), fill: true };
  }
  return { path: smoothPath(pix), fill: false };
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
  shapeAssist,
  rulingType,
  backgroundNode,
}: DrawCanvasProps) {
  const [live, setLive] = useState<Pt[] | null>(null);
  const [livePr, setLivePr] = useState<number[]>([]);
  const [laser, setLaser] = useState<Pt[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  const liveRef = useRef<Pt[] | null>(null);
  const livePrRef = useRef<number[]>([]);
  const rejected = useRef(false);
  const modeRef = useRef<"draw" | "select" | "laser" | "none">("none");
  const dragStart = useRef<Pt | null>(null);
  const laserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annRef = useRef(ann);
  annRef.current = ann;

  const pressureRef = useRef(0.5);
  const onPointer = (e: RNPointerEvent) => {
    const n = e.nativeEvent as unknown as { pressure?: number };
    if (typeof n.pressure === "number" && n.pressure > 0) {
      pressureRef.current = Math.max(0.05, Math.min(1, n.pressure));
    }
  };

  const strokeAndShapeItems = useMemo(
    () => ann.items.filter((i) => i.k === "stroke" || i.k === "shape") as (Stroke | Shape)[],
    [ann],
  );
  const drawn = useMemo(
    () => strokeAndShapeItems.map((it) => ({ it, ...itemPath(it, width, height) })),
    [strokeAndShapeItems, width, height],
  );

  const selected = selectedId
    ? (ann.items.find((i) => i.id === selectedId) as Item | undefined)
    : undefined;

  const isShapeTool = tool === "line" || tool === "arrow" || tool === "rect" || tool === "ellipse";
  const isPassiveTool = tool === "sticky" || tool === "text";
  const eraseRadius = tool === "eraser" ? Math.max(10, strokeWidth) : 0;

  const eraseAt = (px: number, py: number) => {
    const hitR = eraseRadius || Math.max(10, strokeWidth * 2);
    const keep = annRef.current.items.filter((it) => {
      if (it.k === "stroke") {
        const pix = toPixels(it.points, width, height);
        for (let i = 1; i < pix.length; i++) {
          if (distToSegment(px, py, pix[i - 1].x, pix[i - 1].y, pix[i].x, pix[i].y) < hitR) return false;
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

  const commitStroke = (pts: Pt[], pr: number[]) => {
    if (pts.length < 2) return;
    const frac = pts.map(
      (p) => [
        Math.min(1, Math.max(0, p.x / width)),
        Math.min(1, Math.max(0, p.y / height)),
      ] as [number, number],
    );

    if (shapeAssist && tool === "pen") {
      const rec = recogniseShape(frac);
      if (rec) {
        const s: Shape = {
          k: "shape",
          id: uid(),
          kind: rec.kind === "line" ? "line" : rec.kind,
          color,
          width: strokeWidth,
          x0: rec.x0,
          y0: rec.y0,
          x1: rec.x1,
          y1: rec.y1,
        };
        onCommit({ items: [...annRef.current.items, s] });
        return;
      }
    }

    const stroke: Stroke = {
      k: "stroke",
      id: uid(),
      tool: tool === "highlighter" ? "highlighter" : "pen",
      color,
      width: strokeWidth,
      points: frac,
    };
    if (tool === "pen" && pr.length === pts.length && hasVariation(pr)) {
      stroke.pressures = pr.map((v) => Math.round(v * 100) / 100);
    }
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

  const hitTopmost = (px: number, py: number): string | null => {
    for (let i = annRef.current.items.length - 1; i >= 0; i--) {
      const it = annRef.current.items[i];
      if (it.k === "text") continue;
      if (hitItemPx(it, px, py, width, height)) return it.id;
    }
    return null;
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    onCommit({ items: annRef.current.items.filter((i) => i.id !== selectedId) });
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    const it = annRef.current.items.find((i) => i.id === selectedId);
    if (!it) return;
    const copy = { ...translateItem(it, 0.03, 0.03), id: uid() } as Item;
    onCommit({ items: [...annRef.current.items, copy] });
    setSelectedId(copy.id);
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

      if (tool === "select") {
        modeRef.current = "select";
        const hit = selectedId && hitItemPx(
          annRef.current.items.find((i) => i.id === selectedId)!,
          p.x,
          p.y,
          width,
          height,
        )
          ? selectedId
          : hitTopmost(p.x, p.y);
        setSelectedId(hit);
        dragStart.current = hit ? p : null;
        setDrag(hit ? { dx: 0, dy: 0 } : null);
        return;
      }
      if (tool === "laser") {
        modeRef.current = "laser";
        if (laserTimer.current) clearTimeout(laserTimer.current);
        setLaser([p]);
        return;
      }

      modeRef.current = "draw";
      if (tool === "eraser") {
        eraseAt(p.x, p.y);
        liveRef.current = [p];
        setLive([p]);
      } else {
        liveRef.current = [p];
        livePrRef.current = [pressureRef.current];
        setLive([p]);
        setLivePr([pressureRef.current]);
      }
    })
    .onUpdate((e) => {
      if (rejected.current) return;
      const p = { x: e.x, y: e.y };

      if (modeRef.current === "select") {
        if (dragStart.current) {
          setDrag({
            dx: (p.x - dragStart.current.x) / width,
            dy: (p.y - dragStart.current.y) / height,
          });
        }
        return;
      }
      if (modeRef.current === "laser") {
        setLaser((prev) => (prev ? [...prev.slice(-64), p] : [p]));
        return;
      }
      if (tool === "eraser") {
        eraseAt(p.x, p.y);
        liveRef.current = [p];
        setLive([p]);
        return;
      }
      const prev = liveRef.current;
      const next = !prev ? [p] : isShapeTool ? [prev[0], p] : [...prev, p];
      liveRef.current = next;
      setLive(next);
      if (!isShapeTool) {
        const nextPr = [...livePrRef.current, pressureRef.current];
        livePrRef.current = nextPr;
        setLivePr(nextPr);
      }
    })
    .onEnd(() => {
      if (rejected.current) {
        rejected.current = false;
        return;
      }
      if (modeRef.current === "select") {
        if (selectedId && drag && (Math.abs(drag.dx) > 0.001 || Math.abs(drag.dy) > 0.001)) {
          const items = annRef.current.items.map((i) =>
            i.id === selectedId ? translateItem(i, drag.dx, drag.dy) : i,
          );
          onCommit({ items });
        }
        setDrag(null);
        dragStart.current = null;
        modeRef.current = "none";
        return;
      }
      if (modeRef.current === "laser") {
        modeRef.current = "none";
        laserTimer.current = setTimeout(() => setLaser(null), 650);
        return;
      }
      const completed = liveRef.current;
      const completedPr = livePrRef.current;
      liveRef.current = null;
      livePrRef.current = [];
      setLive(null);
      setLivePr([]);
      modeRef.current = "none";
      if (completed && tool !== "eraser") {
        if (isShapeTool && completed.length >= 2) commitShape(completed[0], completed[completed.length - 1]);
        else if (!isShapeTool) commitStroke(completed, completedPr);
      }
    })
    .onFinalize(() => {
      rejected.current = false;
    });

  const livePath = useMemo(() => {
    if (!live || tool === "eraser" || tool === "select" || tool === "laser") return null;
    if (isShapeTool && live.length >= 2) {
      return {
        fill: false,
        path: shapePath(
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
        ),
      };
    }
    if (tool === "pen" && livePr.length === live.length && hasVariation(livePr)) {
      return { fill: true, path: ribbonPath(live, strokeWidth, livePr) };
    }
    return { fill: false, path: smoothPath(live) };
  }, [live, livePr, isShapeTool, tool, color, strokeWidth, width, height]);

  const eraserCursor = tool === "eraser" && live ? live[live.length - 1] : null;
  const laserPath = useMemo(() => (laser && laser.length > 1 ? smoothPath(laser) : null), [laser]);

  // selection bbox in pixels, including any live drag
  const selBox = useMemo(() => {
    if (!selected) return null;
    const moved = drag ? translateItem(selected, drag.dx, drag.dy) : selected;
    const b = bboxOfItem(moved);
    return { x: b.x * width, y: b.y * height, w: b.w * width, h: b.h * height };
  }, [selected, drag, width, height]);

  const selDrawPath = useMemo(() => {
    if (!selected || !drag || selected.k === "text") return null;
    const moved = translateItem(selected, drag.dx, drag.dy) as Stroke | Shape;
    return itemPath(moved, width, height);
  }, [selected, drag, width, height]);

  return (
    <View
      style={[styles.wrap, { width, height }]}
      onPointerDown={onPointer}
      onPointerMove={onPointer}
    >
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }}>
          {backgroundNode}
          {rulingType ? <Ruling type={rulingType} w={width} h={height} /> : null}

          <Group>
            {drawn.map(({ it, path, fill }) =>
              it.id === selectedId && drag ? null : fill ? (
                <Path key={it.id} path={path} style="fill" color={it.color} />
              ) : (
                <Path
                  key={it.id}
                  path={path}
                  style="stroke"
                  color={it.color}
                  strokeWidth={it.width}
                  strokeCap={it.k === "stroke" && it.tool === "highlighter" ? "square" : "round"}
                  strokeJoin="round"
                  opacity={it.k === "stroke" && it.tool === "highlighter" ? HL_OPACITY : 1}
                />
              ),
            )}
          </Group>

          {selDrawPath ? (
            selDrawPath.fill ? (
              <Path path={selDrawPath.path} style="fill" color={(selected as Stroke | Shape).color} />
            ) : (
              <Path
                path={selDrawPath.path}
                style="stroke"
                color={(selected as Stroke | Shape).color}
                strokeWidth={(selected as Stroke | Shape).width}
                strokeCap="round"
                strokeJoin="round"
              />
            )
          ) : null}

          {livePath ? (
            livePath.fill ? (
              <Path path={livePath.path} style="fill" color={color} />
            ) : (
              <Path
                path={livePath.path}
                style="stroke"
                color={color}
                strokeWidth={strokeWidth}
                strokeCap={tool === "highlighter" ? "square" : "round"}
                strokeJoin="round"
                opacity={tool === "highlighter" ? HL_OPACITY : 1}
              />
            )
          ) : null}

          {eraserCursor ? (
            <Circle cx={eraserCursor.x} cy={eraserCursor.y} r={eraseRadius} style="stroke" strokeWidth={1.5} color="#94a3b8" />
          ) : null}

          {laserPath ? (
            <Group>
              <Path path={laserPath} style="stroke" color="rgba(239,68,68,0.35)" strokeWidth={16} strokeCap="round" strokeJoin="round" />
              <Path path={laserPath} style="stroke" color="#ef4444" strokeWidth={5} strokeCap="round" strokeJoin="round" />
            </Group>
          ) : null}
        </Canvas>
      </GestureDetector>

      {selBox ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.selBox,
              { left: selBox.x - 6, top: selBox.y - 6, width: selBox.w + 12, height: selBox.h + 12 },
            ]}
          />
          {!drag ? (
            <View style={[styles.selActions, { left: Math.max(4, selBox.x - 6), top: Math.max(2, selBox.y - 40) }]}>
              <Pressable onPress={duplicateSelected} style={styles.selBtn}>
                <Text style={styles.selBtnTxt}>Duplicate</Text>
              </Pressable>
              <Pressable onPress={deleteSelected} style={[styles.selBtn, { backgroundColor: C.danger }]}>
                <Text style={[styles.selBtnTxt, { color: "#fff" }]}>Delete</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export const makeEmptyAnn = emptyAnn;
export type { Item };

const styles = StyleSheet.create({
  wrap: { backgroundColor: "transparent" },
  selBox: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: C.brand,
    borderStyle: "dashed",
    borderRadius: 4,
    backgroundColor: "rgba(79,70,229,0.06)",
  },
  selActions: { position: "absolute", flexDirection: "row", gap: 6 },
  selBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  selBtnTxt: { fontSize: 11, fontWeight: "700", color: C.ink },
});
