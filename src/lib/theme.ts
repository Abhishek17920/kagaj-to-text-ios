/** Shared palette — mirrors the web app's indigo/slate look. */
export const C = {
  bg: "#f1f5f9",
  card: "#ffffff",
  ink: "#0f172a",
  sub: "#64748b",
  line: "#e2e8f0",
  brand: "#4f46e5",
  brandSoft: "#eef2ff",
  danger: "#e11d48",
  ok: "#059669",
  amber: "#d97706",
} as const;

/** Ink colours offered in the drawing toolbar. */
export const INK_COLORS = [
  "#0f172a",
  "#1d4ed8",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
] as const;

/** Highlighter colours (used at ~30% opacity). */
export const HL_COLORS = ["#fde047", "#86efac", "#93c5fd", "#fca5a5", "#f9a8d4"] as const;

export const PEN_WIDTHS = [2, 3, 5, 8] as const;
export const HL_WIDTHS = [14, 20, 28] as const;
