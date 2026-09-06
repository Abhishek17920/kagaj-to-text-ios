import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { C } from "@/lib/theme";

export interface RegionPickerProps {
  width: number;
  height: number;
  onPick: (r: { rx: number; ry: number; rw: number; rh: number }) => void;
}

/** One drag → a rectangle, reported as fractions of the surface. */
export function RegionPicker({ width, height, onPick }: RegionPickerProps) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => setRect({ x: e.x, y: e.y, w: 0, h: 0 }))
    .onUpdate((e) =>
      setRect((r) => (r ? { ...r, w: e.x - r.x, h: e.y - r.y } : r)),
    )
    .onEnd(() => {
      setRect((r) => {
        if (r && Math.abs(r.w) > 8 && Math.abs(r.h) > 8) {
          const x = Math.min(r.x, r.x + r.w);
          const y = Math.min(r.y, r.y + r.h);
          onPick({
            rx: Math.max(0, x / width),
            ry: Math.max(0, y / height),
            rw: Math.min(1, Math.abs(r.w) / width),
            rh: Math.min(1, Math.abs(r.h) / height),
          });
        }
        return null;
      });
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[StyleSheet.absoluteFill, styles.veil]}>
        {rect ? (
          <View
            style={[
              styles.box,
              {
                left: Math.min(rect.x, rect.x + rect.w),
                top: Math.min(rect.y, rect.y + rect.h),
                width: Math.abs(rect.w),
                height: Math.abs(rect.h),
              },
            ]}
          />
        ) : (
          <View style={styles.hint}>
            <Text style={styles.hintText}>Drag a box over the area to link</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: "rgba(79,70,229,0.06)" },
  box: {
    position: "absolute",
    borderWidth: 2,
    borderColor: C.brand,
    backgroundColor: "rgba(79,70,229,0.15)",
    borderRadius: 4,
  },
  hint: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  hintText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
