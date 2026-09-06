import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { DrawTool } from "@/lib/annot";
import { C } from "@/lib/theme";

export interface FloatingToolsProps {
  tool: DrawTool;
  color: string;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (t: DrawTool) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const QUICK: { id: DrawTool; glyph: string }[] = [
  { id: "pen", glyph: "✎" },
  { id: "highlighter", glyph: "▤" },
  { id: "eraser", glyph: "⌫" },
  { id: "sticky", glyph: "✦" },
  { id: "select", glyph: "✥" },
];

/**
 * A draggable quick-tools puck, à la GoodNotes/Notability. Tap to expand the
 * last-used tools + undo/redo without reaching for the top bar. (Apple Pencil
 * Pro "squeeze" would open this too — that hook needs a native module.)
 */
export function FloatingTools({
  tool,
  color,
  canUndo,
  canRedo,
  onTool,
  onUndo,
  onRedo,
}: FloatingToolsProps) {
  const [open, setOpen] = useState(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useRef({ x: 0, y: 0 });

  const drag = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      start.current = { x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      tx.value = start.current.x + e.translationX;
      ty.value = start.current.y + e.translationY;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const cur = QUICK.find((q) => q.id === tool);

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="box-none">
      {open ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(90)} style={styles.stack}>
          {QUICK.map((q) => (
            <Pressable
              key={q.id}
              onPress={() => {
                onTool(q.id);
                setOpen(false);
              }}
              style={[styles.item, tool === q.id && styles.itemOn]}
            >
              <Text style={[styles.glyph, tool === q.id && { color: "#fff" }]}>{q.glyph}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onUndo}
            disabled={!canUndo}
            style={[styles.item, !canUndo && { opacity: 0.3 }]}
          >
            <Text style={styles.glyph}>↶</Text>
          </Pressable>
          <Pressable
            onPress={onRedo}
            disabled={!canRedo}
            style={[styles.item, !canRedo && { opacity: 0.3 }]}
          >
            <Text style={styles.glyph}>↷</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={drag}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.puck}>
          <Text style={styles.puckGlyph}>{cur?.glyph ?? "✎"}</Text>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 14, bottom: 26, alignItems: "center", gap: 8 },
  stack: { alignItems: "center", gap: 8 },
  item: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  itemOn: { backgroundColor: C.brand, borderColor: C.brand },
  glyph: { fontSize: 15, color: C.ink, fontWeight: "700" },
  puck: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  puckGlyph: { fontSize: 18, color: "#fff", fontWeight: "800" },
  dot: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
