import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ann, Box, DrawTool, Item, emptyAnn, mapItemToRegion } from "@/lib/annot";
import { DrawCanvas } from "./DrawCanvas";
import { C } from "@/lib/theme";

export interface ZoomWriteBoxProps {
  pageW: number;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  pencilOnly: boolean;
  shapeAssist?: boolean;
  /** Append transformed items to the current page. */
  onAdd: (items: Item[]) => void;
  onClose: () => void;
}

const START: Box = { x: 0.07, y: 0.09, w: 0.86, h: 0.075 };

/**
 * Notability-style zoom writing: write large in the strip, the ink is mapped
 * into a small moving band on the page. "Next line" advances the band.
 */
export function ZoomWriteBox({
  pageW,
  tool,
  color,
  strokeWidth,
  pencilOnly,
  shapeAssist,
  onAdd,
  onClose,
}: ZoomWriteBoxProps) {
  const boxW = pageW;
  const boxH = 150;
  const [boxAnn, setBoxAnn] = useState<Ann>(emptyAnn());
  const [target, setTarget] = useState<Box>(START);
  const seen = useRef(0);

  const onBoxCommit = (next: Ann) => {
    const fresh = next.items.slice(seen.current);
    seen.current = next.items.length;
    setBoxAnn(next);
    if (fresh.length) onAdd(fresh.map((it) => mapItemToRegion(it, target)));
  };

  const clearBox = () => {
    seen.current = 0;
    setBoxAnn(emptyAnn());
  };

  const nextLine = () => {
    clearBox();
    setTarget((t) => {
      const y = t.y + t.h * 1.25;
      return y + t.h > 0.98 ? { ...t, y: START.y } : { ...t, y };
    });
  };

  const nudge = (dx: number, dy: number) =>
    setTarget((t) => ({
      ...t,
      x: Math.max(0, Math.min(1 - t.w, t.x + dx)),
      y: Math.max(0, Math.min(1 - t.h, t.y + dy)),
    }));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Zoom write</Text>
        <View style={styles.miniMap}>
          <View
            style={[
              styles.band,
              {
                left: `${target.x * 100}%`,
                top: `${target.y * 100}%`,
                width: `${target.w * 100}%`,
                height: `${target.h * 100}%`,
              },
            ]}
          />
        </View>
        <View style={styles.arrows}>
          <Pressable onPress={() => nudge(0, -0.03)} style={styles.arrow}><Text style={styles.arrowTxt}>▲</Text></Pressable>
          <Pressable onPress={() => nudge(0, 0.03)} style={styles.arrow}><Text style={styles.arrowTxt}>▼</Text></Pressable>
          <Pressable onPress={() => nudge(-0.04, 0)} style={styles.arrow}><Text style={styles.arrowTxt}>◀</Text></Pressable>
          <Pressable onPress={() => nudge(0.04, 0)} style={styles.arrow}><Text style={styles.arrowTxt}>▶</Text></Pressable>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={nextLine} style={styles.btn}><Text style={styles.btnTxt}>Next line ⏎</Text></Pressable>
        <Pressable onPress={clearBox} style={styles.btn}><Text style={styles.btnTxt}>Clear</Text></Pressable>
        <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: C.brand }]}>
          <Text style={[styles.btnTxt, { color: "#fff" }]}>Done</Text>
        </Pressable>
      </View>
      <View style={[styles.canvas, { width: boxW, height: boxH }]}>
        <DrawCanvas
          width={boxW}
          height={boxH}
          ann={boxAnn}
          onCommit={onBoxCommit}
          tool={tool === "eraser" || tool === "select" || tool === "laser" ? "pen" : tool}
          color={color}
          strokeWidth={strokeWidth * 2.4}
          pencilOnly={pencilOnly}
          shapeAssist={shapeAssist}
          rulingType="ruled"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: C.card, borderTopWidth: 1, borderColor: C.line },
  head: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  title: { fontSize: 12, fontWeight: "800", color: C.ink },
  miniMap: {
    width: 34,
    height: 46,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#fff",
  },
  band: { position: "absolute", backgroundColor: "rgba(79,70,229,0.5)", borderRadius: 1 },
  arrows: { flexDirection: "row", gap: 3 },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowTxt: { fontSize: 11, color: C.ink },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
  },
  btnTxt: { fontSize: 11, fontWeight: "700", color: C.ink },
  canvas: { backgroundColor: "#fff" },
});
