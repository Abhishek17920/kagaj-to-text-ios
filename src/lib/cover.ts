import type { Cover } from "./api";

/** First usable colour out of a catalogue cover `value` (solid / gradient / texture). */
export function coverColor(value: string | undefined): string {
  if (!value) return "#4f46e5";
  if (value.startsWith("#")) return value;
  const m = value.match(/#([0-9a-fA-F]{3,8})/);
  return m ? `#${m[1]}` : "#4f46e5";
}

export function coverById(covers: Cover[], id: string): Cover | undefined {
  return covers.find((c) => c.id === id);
}
