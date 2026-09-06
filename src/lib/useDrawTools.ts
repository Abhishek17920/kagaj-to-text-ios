import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DrawTool } from "./annot";
import { ERASER_WIDTHS, INK_COLORS, PEN_WIDTHS } from "./theme";

export interface Preset {
  tool: DrawTool;
  color: string;
  width: number;
}

const FAV_KEY = "ktt.favPens";

/**
 * Shared drawing-tool state for the notebook / PDF / workspace editors.
 * Pen and eraser keep independent widths. Also holds "shape assist" and a
 * small set of pinned pen presets (persisted).
 */
export function useDrawTools() {
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(PEN_WIDTHS[2]);
  const [eraserWidth, setEraserWidth] = useState<number>(ERASER_WIDTHS[1]);
  const [pencilOnly, setPencilOnly] = useState(false);
  const [shapeAssist, setShapeAssist] = useState(false);
  const [favorites, setFavorites] = useState<Preset[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY)
      .then((raw) => {
        if (raw) setFavorites(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const persistFavs = useCallback((next: Preset[]) => {
    setFavorites(next);
    AsyncStorage.setItem(FAV_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const strokeWidth = tool === "eraser" ? eraserWidth : penWidth;
  const setWidth = useCallback(
    (w: number) => (tool === "eraser" ? setEraserWidth(w) : setPenWidth(w)),
    [tool],
  );

  const pinCurrent = useCallback(() => {
    if (tool === "eraser" || tool === "select" || tool === "laser") return;
    const p: Preset = { tool, color, width: penWidth };
    persistFavs(
      [p, ...favorites.filter((f) => !(f.tool === p.tool && f.color === p.color && f.width === p.width))].slice(0, 6),
    );
  }, [tool, color, penWidth, favorites, persistFavs]);

  const applyFavorite = useCallback((p: Preset) => {
    setTool(p.tool);
    setColor(p.color);
    setPenWidth(p.width);
  }, []);

  const removeFavorite = useCallback(
    (i: number) => persistFavs(favorites.filter((_, idx) => idx !== i)),
    [favorites, persistFavs],
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
    shapeAssist,
    setShapeAssist,
    favorites,
    pinCurrent,
    applyFavorite,
    removeFavorite,
  };
}
