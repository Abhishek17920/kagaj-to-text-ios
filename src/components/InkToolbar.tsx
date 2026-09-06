import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { DrawTool } from "@/lib/annot";
import { C, ERASER_WIDTHS, HL_COLORS, HL_WIDTHS, INK_COLORS, PEN_WIDTHS } from "@/lib/theme";

export interface InkToolbarProps {
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  pencilOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (t: DrawTool) => void;
  onColor: (c: string) => void;
  onWidth: (w: number) => void;
  onPencilOnly: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const TOOLS: { id: DrawTool; label: string; glyph: string }[] = [
  { id: "pen", label: "Pen", glyph: "✎" },
  { id: "highlighter", label: "Marker", glyph: "▤" },
  { id: "eraser", label: "Eraser", glyph: "⌫" },
  { id: "line", label: "Line", glyph: "╱" },
  { id: "arrow", label: "Arrow", glyph: "→" },
  { id: "rect", label: "Box", glyph: "▭" },
  { id: "ellipse", label: "Oval", glyph: "◯" },
  { id: "text", label: "Text", glyph: "T" },
  { id: "sticky", label: "Note", glyph: "✦" },
  { id: "select", label: "Move", glyph: "✥" },
];

const STYLE_TOOLS: DrawTool[] = ["pen", "highlighter", "eraser", "line", "arrow", "rect", "ellipse"];

function IconBtn({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.iconBtn, disabled && { opacity: 0.35 }]}
    >
      <Text style={[styles.iconTxt, danger && { color: C.danger }]}>{label}</Text>
    </Pressable>
  );
}

export function InkToolbar(p: InkToolbarProps) {
  const isHl = p.tool === "highlighter";
  const isEraser = p.tool === "eraser";
  const swatches = isEraser ? [] : isHl ? HL_COLORS : INK_COLORS;
  const widths = isEraser ? ERASER_WIDTHS : isHl ? HL_WIDTHS : PEN_WIDTHS;
  const showStyle = STYLE_TOOLS.includes(p.tool);

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <Pressable
          onPress={() => p.onPencilOnly(!p.pencilOnly)}
          style={[styles.pencil, p.pencilOnly && styles.pencilOn]}
          hitSlop={4}
        >
          <Text style={[styles.pencilTxt, p.pencilOnly && { color: "#fff" }]}>✎</Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tools}
        >
          {TOOLS.map((t) => {
            const active = p.tool === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => p.onTool(t.id)}
                style={[styles.chip, active && styles.chipOn]}
              >
                <Text style={[styles.chipGlyph, active && { color: "#fff" }]}>{t.glyph}</Text>
                <Text style={[styles.chipTxt, active && { color: "#fff" }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <IconBtn label="↶" onPress={p.onUndo} disabled={!p.canUndo} />
          <IconBtn label="↷" onPress={p.onRedo} disabled={!p.canRedo} />
          <IconBtn label="✕" onPress={p.onClear} danger />
        </View>
      </View>

      {showStyle ? (
        <Animated.View
          entering={FadeInUp.duration(150)}
          exiting={FadeOutUp.duration(110)}
          style={styles.styleRow}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tools}
          >
            {swatches.map((c) => (
              <Pressable
                key={c}
                onPress={() => p.onColor(c)}
                style={[styles.swatch, { backgroundColor: c }, p.color === c && styles.swatchOn]}
              />
            ))}
            {swatches.length ? <View style={styles.sep} /> : null}
            {widths.map((w) => {
              const dot = Math.max(6, Math.min(20, isEraser ? w / 3 : w + 3));
              return (
                <Pressable
                  key={w}
                  onPress={() => p.onWidth(w)}
                  style={[styles.widthBtn, p.strokeWidth === w && styles.widthOn]}
                >
                  <View
                    style={{
                      width: dot,
                      height: dot,
                      borderRadius: 999,
                      borderWidth: isEraser ? 1.5 : 0,
                      borderColor: C.sub,
                      backgroundColor: isEraser ? "transparent" : isHl ? p.color : C.ink,
                    }}
                  />
                </Pressable>
              );
            })}
            {isEraser ? <Text style={styles.hintTxt}>eraser size</Text> : null}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingVertical: 6,
    gap: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 6 },
  tools: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipGlyph: { fontSize: 12, color: C.sub, width: 13, textAlign: "center" },
  chipTxt: { fontSize: 12.5, fontWeight: "700", color: C.sub },
  pencil: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
  },
  pencilOn: { backgroundColor: C.brand, borderColor: C.brand },
  pencilTxt: { fontSize: 15, color: C.sub },
  actions: { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 4 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTxt: { fontSize: 16, color: C.ink, fontWeight: "700" },
  styleRow: { paddingHorizontal: 8 },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchOn: { borderColor: C.ink },
  sep: { width: 1, height: 22, backgroundColor: C.line, marginHorizontal: 4 },
  hintTxt: { fontSize: 11, color: C.sub, fontWeight: "600", marginLeft: 4 },
  widthBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
  },
  widthOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
});
