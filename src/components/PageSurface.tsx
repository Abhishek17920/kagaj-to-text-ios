import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ann, DrawTool, TextBox, uid } from "@/lib/annot";
import { C } from "@/lib/theme";
import { DrawCanvas } from "./DrawCanvas";

export interface PageSurfaceProps {
  width: number;
  height: number;
  ann: Ann;
  onCommit: (next: Ann) => void;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  pencilOnly: boolean;
  shapeAssist?: boolean;
  rulingType?: string;
  backgroundNode?: React.ReactNode;
}

/** DrawCanvas + a plain-text sticky/text-box layer on top. */
export function PageSurface(p: PageSurfaceProps) {
  const [editing, setEditing] = useState<TextBox | null>(null);
  const texts = p.ann.items.filter((i) => i.k === "text") as TextBox[];

  const upsert = (tb: TextBox) => {
    const rest = p.ann.items.filter((i) => i.id !== tb.id);
    const body = tb.html.trim();
    p.onCommit({ items: body ? [...rest, tb] : rest });
  };

  const onSurfacePress = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (p.tool !== "text") return;
    const { locationX, locationY } = e.nativeEvent;
    const tb: TextBox = {
      k: "text",
      id: uid(),
      sticky: true,
      x: Math.max(0, Math.min(0.9, locationX / p.width)),
      y: Math.max(0, Math.min(0.92, locationY / p.height)),
      w: 0.42,
      h: 0.12,
      html: "",
      color: p.color,
      fontSize: 16,
      background: "#fff7cc",
      borderColor: "#f4d35e",
    };
    setEditing(tb);
  };

  return (
    <View style={{ width: p.width, height: p.height }}>
      <DrawCanvas
        width={p.width}
        height={p.height}
        ann={p.ann}
        onCommit={p.onCommit}
        tool={p.tool}
        color={p.color}
        strokeWidth={p.strokeWidth}
        pencilOnly={p.pencilOnly}
        shapeAssist={p.shapeAssist}
        rulingType={p.rulingType}
        backgroundNode={p.backgroundNode}
      />

      {/* Text tool: capture taps to drop a new box. */}
      {p.tool === "text" ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={onSurfacePress} />
      ) : null}

      {texts.map((tb) => (
        <Pressable
          key={tb.id}
          onPress={() => (p.tool === "text" || p.tool === "select") && setEditing(tb)}
          style={[
            styles.textBox,
            {
              left: tb.x * p.width,
              top: tb.y * p.height,
              width: tb.w * p.width,
              backgroundColor: tb.background ?? "transparent",
              borderColor: tb.borderColor ?? "transparent",
            },
          ]}
        >
          <Text style={{ color: tb.color, fontSize: tb.fontSize }}>{tb.html}</Text>
        </Pressable>
      ))}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Text</Text>
            <TextInput
              autoFocus
              multiline
              defaultValue={editing?.html}
              onChangeText={(t) => editing && setEditing({ ...editing, html: t })}
              placeholder="Type…"
              style={styles.input}
            />
            <View style={styles.modalRow}>
              <Pressable
                onPress={() => {
                  if (editing) {
                    p.onCommit({ items: p.ann.items.filter((i) => i.id !== editing.id) });
                  }
                  setEditing(null);
                }}
                style={[styles.mBtn, { backgroundColor: C.bg }]}
              >
                <Text style={[styles.mBtnText, { color: C.danger }]}>Delete</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setEditing(null)} style={[styles.mBtn, { backgroundColor: C.bg }]}>
                <Text style={styles.mBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (editing) upsert(editing);
                  setEditing(null);
                }}
                style={[styles.mBtn, { backgroundColor: C.brand }]}
              >
                <Text style={[styles.mBtnText, { color: "#fff" }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  textBox: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  modalWrap: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12 },
  modalTitle: { fontWeight: "700", fontSize: 15, color: C.ink },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    textAlignVertical: "top",
    color: C.ink,
  },
  modalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  mBtnText: { fontWeight: "700", fontSize: 13, color: C.sub },
});
