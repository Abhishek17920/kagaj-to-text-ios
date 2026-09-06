import React, { useCallback, useRef } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ZoomableViewProps {
  width: number;
  height: number;
  minScale?: number;
  maxScale?: number;
  /** Fires (once) when the view crosses in/out of the zoomed state. */
  onZoomChange?: (zoomed: boolean) => void;
  children: React.ReactNode;
}

/**
 * Pinch to zoom (1x–4x) a page, two-finger drag to pan while zoomed. Pinch
 * back to 1x to reset. Single-finger / Apple Pencil input passes straight
 * through to the drawing layer underneath (different pointer count).
 */
export function ZoomableView({
  width,
  height,
  minScale = 1,
  maxScale = 4,
  onZoomChange,
  children,
}: ZoomableViewProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const wasZoomed = useRef(false);
  const emit = useCallback(
    (z: boolean) => {
      if (z === wasZoomed.current) return;
      wasZoomed.current = z;
      onZoomChange?.(z);
    },
    [onZoomChange],
  );

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      "worklet";
      scale.value = Math.min(maxScale, Math.max(minScale, savedScale.value * e.scale));
    })
    .onEnd(() => {
      "worklet";
      if (scale.value <= minScale + 0.01) {
        scale.value = withTiming(minScale);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = minScale;
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(emit)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(emit)(true);
      }
    });

  const pan = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      "worklet";
      const limX = (width * (scale.value - 1)) / 2;
      const limY = (height * (scale.value - 1)) / 2;
      tx.value = Math.min(limX, Math.max(-limX, savedTx.value + e.translationX));
      ty.value = Math.min(limY, Math.max(-limY, savedTy.value + e.translationY));
    })
    .onEnd(() => {
      "worklet";
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.clip, { width, height }]}>
        <Animated.View style={[{ width, height }, animatedStyle]}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});
