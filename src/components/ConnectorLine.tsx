import React from "react";
import { StyleSheet, View } from "react-native";
import { C } from "@/lib/theme";

export interface XY {
  x: number;
  y: number;
}

/**
 * A straight line drawn between two window-space points — used in the split
 * workspace to join a note to its linked PDF region. Purely decorative;
 * never intercepts touches.
 */
export function ConnectorLine({ from, to }: { from: XY | null; to: XY | null }) {
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!isFinite(length) || length < 1) return null;
  const angle = `${Math.atan2(dy, dx)}rad`;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.line,
          {
            left: from.x,
            top: from.y,
            width: length,
            transform: [{ rotateZ: angle }],
          },
        ]}
      />
      <View style={[styles.dot, { left: from.x - 5, top: from.y - 5 }]} />
      <View style={[styles.dot, { left: to.x - 5, top: to.y - 5 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: "absolute",
    height: 2.5,
    backgroundColor: C.amber,
    transformOrigin: "left center",
    opacity: 0.9,
  },
  dot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: C.amber,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
