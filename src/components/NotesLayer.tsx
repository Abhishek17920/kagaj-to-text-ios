import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { NoteOut } from "@/lib/api";
import { C } from "@/lib/theme";

/** Notes store x/y as a fraction of the page; older web rows used pixels on an
 * ~800px page, so anything > 1.5 is treated as legacy pixels. */
const frac = (v: number) => (v > 1.5 ? v / 800 : v);

export interface NotesLayerProps {
  pageId: string;
  pageW: number;
  pageH: number;
  notes: NoteOut[];
  active: boolean;
  onCreate: (pageId: string, fx: number, fy: number) => void;
  onMove: (noteId: string, fx: number, fy: number) => void;
  onEdit: (note: NoteOut) => void;
}

function NoteCard({
  note,
  pageW,
  pageH,
  active,
  onMove,
  onEdit,
}: {
  note: NoteOut;
  pageW: number;
  pageH: number;
  active: boolean;
  onMove: (id: string, fx: number, fy: number) => void;
  onEdit: (n: NoteOut) => void;
}) {
  const baseX = frac(note.x) * pageW;
  const baseY = frac(note.y) * pageH;
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });

  const pan = Gesture.Pan()
    .enabled(active)
    .runOnJS(true)
    .onBegin(() => {
      start.current = { x: 0, y: 0 };
    })
    .onUpdate((e) => setDrag({ x: e.translationX, y: e.translationY }))
    .onEnd((e) => {
      const nx = Math.max(0, Math.min(0.95, (baseX + e.translationX) / pageW));
      const ny = Math.max(0, Math.min(0.95, (baseY + e.translationY) / pageH));
      setDrag({ x: 0, y: 0 });
      onMove(note.id, nx, ny);
    });

  return (
    <GestureDetector gesture={pan}>
      <Pressable
        onPress={() => onEdit(note)}
        style={[
          styles.card,
          {
            left: baseX + drag.x,
            top: baseY + drag.y,
            width: Math.max(120, (note.w || 0.28) * (note.w > 1.5 ? 1 : pageW)),
            borderColor: note.color || "#f4d35e",
          },
        ]}
      >
        <Text numberOfLines={4} style={styles.body}>
          {note.body || "Empty note"}
        </Text>
        {note.links.length > 0 ? (
          <View style={styles.linkBadge}>
            <Text style={styles.linkBadgeText}>🔗 {note.links.length}</Text>
          </View>
        ) : null}
      </Pressable>
    </GestureDetector>
  );
}

export function NotesLayer({
  pageId,
  pageW,
  pageH,
  notes,
  active,
  onCreate,
  onMove,
  onEdit,
}: NotesLayerProps) {
  const mine = notes.filter((n) => n.page_id === pageId);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {active ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            onCreate(
              pageId,
              Math.max(0, Math.min(0.9, locationX / pageW)),
              Math.max(0, Math.min(0.9, locationY / pageH)),
            );
          }}
        />
      ) : null}
      {mine.map((n) => (
        <NoteCard
          key={n.id}
          note={n}
          pageW={pageW}
          pageH={pageH}
          active={active}
          onMove={onMove}
          onEdit={onEdit}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    backgroundColor: "#fff8d6",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  body: { fontSize: 12, color: C.ink },
  linkBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: C.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  linkBadgeText: { fontSize: 10, fontWeight: "700", color: C.brand },
});
