import React from "react";
import { View } from "react-native";
import { Canvas, Group, Line, Rect, vec } from "@shopify/react-native-skia";

/**
 * Page rulings, drawn as Skia nodes so they live in the same <Canvas> as the
 * ink. `type` ids match the backend PAGE_TYPES catalogue.
 */
export function Ruling({ type, w, h }: { type: string; w: number; h: number }) {
  const nodes: React.ReactNode[] = [];
  const faint = "#dbe4f0";
  const blue = "#cdddf2";
  const red = "#f6c9c9";

  const hLines = (gap: number, color = blue, from = 0) => {
    for (let y = gap; y < h; y += gap) {
      nodes.push(
        <Line key={`h${y}`} p1={vec(from, y)} p2={vec(w, y)} color={color} strokeWidth={1} />,
      );
    }
  };
  const vLines = (gap: number, color = faint) => {
    for (let x = gap; x < w; x += gap) {
      nodes.push(<Line key={`v${x}`} p1={vec(x, 0)} p2={vec(x, h)} color={color} strokeWidth={1} />);
    }
  };
  const dots = (gap: number) => {
    for (let y = gap; y < h; y += gap) {
      for (let x = gap; x < w; x += gap) {
        nodes.push(
          <Line
            key={`d${x}-${y}`}
            p1={vec(x, y)}
            p2={vec(x + 1.4, y)}
            color="#c3d0e0"
            strokeWidth={2.4}
            strokeCap="round"
          />,
        );
      }
    }
  };

  const unit = w / 34; // ~0.42cm at page width — scales with render size

  switch (type) {
    case "plain":
      break;
    case "grid":
      hLines(unit, faint);
      vLines(unit, faint);
      break;
    case "dotted":
      dots(unit);
      break;
    case "legal":
      hLines(unit * 1.15, blue);
      nodes.push(
        <Line key="margin" p1={vec(w * 0.12, 0)} p2={vec(w * 0.12, h)} color={red} strokeWidth={1.5} />,
      );
      break;
    case "cornell": {
      const cue = w * 0.28;
      const summary = h * 0.82;
      hLines(unit * 1.15, blue);
      nodes.push(
        <Line key="cue" p1={vec(cue, 0)} p2={vec(cue, summary)} color={red} strokeWidth={1.5} />,
      );
      nodes.push(
        <Line key="sum" p1={vec(0, summary)} p2={vec(w, summary)} color={red} strokeWidth={1.5} />,
      );
      break;
    }
    case "music": {
      const staffGap = unit * 0.5;
      for (let s = unit * 2; s < h; s += unit * 3.4) {
        for (let i = 0; i < 5; i++) {
          const y = s + i * staffGap;
          nodes.push(
            <Line key={`m${s}-${i}`} p1={vec(0, y)} p2={vec(w, y)} color="#c9d3e0" strokeWidth={1} />,
          );
        }
      }
      break;
    }
    case "ruled":
    default:
      hLines(unit * 1.15, blue);
      break;
  }

  return <Group>{nodes}</Group>;
}

/** A small white "sheet of paper" preview of a ruling, for pickers. */
export function RulingThumb({
  type,
  width = 52,
  height = 68,
}: {
  type: string;
  width?: number;
  height?: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 6,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        backgroundColor: "#fff",
      }}
    >
      <Canvas style={{ width, height }}>
        <Rect x={0} y={0} width={width} height={height} color="#ffffff" />
        <Ruling type={type} w={width} h={height} />
      </Canvas>
    </View>
  );
}
