import { useCallback, useState } from "react";
import { DrawTool } from "./annot";
import { ERASER_WIDTHS, INK_COLORS, PEN_WIDTHS } from "./theme";

/**
 * Shared drawing-tool state for the notebook / PDF / workspace editors.
 * Pen and eraser keep independent widths so switching between them doesn't
 * carry a giant eraser size over to the pen (and vice-versa).
 */
export function useDrawTools() {
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(PEN_WIDTHS[1]);
  const [eraserWidth, setEraserWidth] = useState<number>(ERASER_WIDTHS[1]);
  const [pencilOnly, setPencilOnly] = useState(false);

  const strokeWidth = tool === "eraser" ? eraserWidth : penWidth;
  const setWidth = useCallback(
    (w: number) => (tool === "eraser" ? setEraserWidth(w) : setPenWidth(w)),
    [tool],
  );

  return {
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setWidth,
    pencilOnly,
    setPencilOnly,
  };
}
