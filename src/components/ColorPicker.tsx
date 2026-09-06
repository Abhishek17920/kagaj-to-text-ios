import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { C } from "@/lib/theme";

function hsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const HUES = [0, 20, 40, 55, 90, 140, 170, 195, 215, 240, 270, 300, 330];
const SHADES: Array<[number, number]> = [
  [90, 92],
  [75, 82],
  [70, 62],
  [72, 45],
  [78, 30],
  [85, 18],
];
const NEUTRALS = ["#000000", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#ffffff"];

export function ColorPicker({
  visible,
  initial,
  onClose,
  onPick,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onPick: (hex: string) => void;
}) {
  const [hue, setHue] = useState(215);
  const [value, setValue] = useState(initial);
  const swatches = useMemo(() => SHADES.map(([s, l]) => hsl(hue, s, l)), [hue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>Colour</Text>
            <View style={[styles.preview, { backgroundColor: value }]} />
            <Text style={styles.hex}>{value.toUpperCase()}</Text>
          </View>

          <Text style={styles.label}>Hue</Text>
          <View style={styles.row}>
            {HUES.map((h) => (
              <Pressable
                key={h}
                onPress={() => setHue(h)}
                style={[styles.hueDot, { backgroundColor: hsl(h, 80, 55) }, hue === h && styles.hueOn]}
              />
            ))}
          </View>

          <Text style={styles.label}>Shade</Text>
          <View style={styles.row}>
            {swatches.map((c) => (
              <Pressable
                key={c}
                onPress={() => setValue(c)}
                style={[styles.shade, { backgroundColor: c }, value === c && styles.shadeOn]}
              />
            ))}
          </View>

          <Text style={styles.label}>Neutral</Text>
          <View style={styles.row}>
            {NEUTRALS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setValue(c)}
                style={[styles.shade, { backgroundColor: c }, value === c && styles.shadeOn]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: C.bg }]}>
              <Text style={styles.btnTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onPick(value);
                onClose();
              }}
              style={[styles.btn, { backgroundColor: C.brand }]}
            >
              <Text style={[styles.btnTxt, { color: "#fff" }]}>Use colour</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "center", padding: 22 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  title: { fontWeight: "800", fontSize: 15, color: C.ink, flex: 1 },
  preview: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: C.line },
  hex: { fontSize: 12, fontWeight: "700", color: C.sub, fontVariant: ["tabular-nums"] },
  label: { fontSize: 11, fontWeight: "700", color: C.sub, marginTop: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hueDot: { width: 26, height: 26, borderRadius: 999, borderWidth: 2, borderColor: "transparent" },
  hueOn: { borderColor: C.ink },
  shade: { width: 36, height: 30, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  shadeOn: { borderColor: C.ink },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: "center" },
  btnTxt: { fontWeight: "700", fontSize: 13, color: C.sub },
});
