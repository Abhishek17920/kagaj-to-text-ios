import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DrawTool } from "@/lib/annot";
import { C, HL_COLORS, HL_WIDTHS, INK_COLORS, PEN_WIDTHS } from "@/lib/theme";

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

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "highlighter", label: "Marker" },
  { id: "eraser", label: "Eraser" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "rect", label: "Box" },
  { id: "ellipse", label: "Oval" },
  { id: "text", label: "Text" },
  { id: "sticky", label: "Note" },
  { id: "select", label: "Move" },
];

const NO_STYLE_TOOLS: DrawTool[] = ["eraser", "text", "sticky", "select"];

function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      hitSlop={6}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function InkToolbar(p: InkToolbarProps) {
  const isHl = p.tool === "highlighter";
  const swatches = isHl ? HL_COLORS : INK_COLORS;
  const widths = isHl ? HL_WIDTHS : PEN_WIDTHS;

  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TOOLS.map((t) => (
          <Chip key={t.id} active={p.tool === t.id} label={t.label} onPress={() => p.onTool(t.id)} />
        ))}
      </ScrollView>

      {!NO_STYLE_TOOLS.includes(p.tool) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {swatches.map((c) => (
            <Pressable
              key={c}
              onPress={() => p.onColor(c)}
              style={[
                styles.swatch,
                { backgroundColor: c },
                p.color === c && styles.swatchActive,
              ]}
            />
          ))}
          <View style={styles.sep} />
          {widths.map((w) => (
            <Pressable
              key={w}
              onPress={() => p.onWidth(w)}
              style={[styles.widthBtn, p.strokeWidth === w && styles.widthActive]}
            >
              <View style={{ width: w + 4, height: w + 4, borderRadius: 99, backgroundColor: C.ink }} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.row}>
        <Chip active={p.pencilOnly} label="✎ Pencil only" onPress={() => p.onPencilOnly(!p.pencilOnly)} />
        <View style={{ flex: 1 }} />
        <Chip active={false} label="Undo" onPress={p.onUndo} />
        <Chip active={false} label="Redo" onPress={p.onRedo} />
        <Chip active={false} label="Clear" onPress={p.onClear} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderColor: C.line,
    paddingVertical: 6,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipActive: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { fontSize: 13, fontWeight: "600", color: C.sub },
  chipTextActive: { color: "#fff" },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: { borderColor: C.ink },
  sep: { width: 1, height: 24, backgroundColor: C.line, marginHorizontal: 4 },
  widthBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
  },
  widthActive: { borderColor: C.brand, backgroundColor: C.brandSoft },
});
