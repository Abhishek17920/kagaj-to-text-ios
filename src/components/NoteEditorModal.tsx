import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NoteLinkOut, NoteOut } from "@/lib/api";
import { C, INK_COLORS } from "@/lib/theme";

export interface NoteEditorModalProps {
  note: NoteOut | null;
  onClose: () => void;
  onSave: (patch: { body: string; color: string }) => void;
  onDelete: () => void;
  onRequestLink?: () => void;
  onJumpToLink?: (link: NoteLinkOut) => void;
  onUnlink?: (link: NoteLinkOut) => void;
}

export function NoteEditorModal({
  note,
  onClose,
  onSave,
  onDelete,
  onRequestLink,
  onJumpToLink,
  onUnlink,
}: NoteEditorModalProps) {
  const [body, setBody] = useState("");
  const [color, setColor] = useState<string>(INK_COLORS[0]);

  useEffect(() => {
    if (note) {
      setBody(note.body);
      setColor(note.color || INK_COLORS[0]);
    }
  }, [note]);

  return (
    <Modal visible={!!note} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrap}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Note</Text>
          <TextInput
            autoFocus
            multiline
            value={body}
            onChangeText={setBody}
            placeholder="Write your note…"
            placeholderTextColor={C.sub}
            style={styles.input}
          />

          <View style={styles.swatchRow}>
            {INK_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]}
              />
            ))}
          </View>

          {note && note.links.length > 0 ? (
            <ScrollView style={{ maxHeight: 140 }}>
              {note.links.map((l) => (
                <View key={l.id} style={styles.linkRow}>
                  <Text style={styles.linkText}>PDF page {l.pdf_page}</Text>
                  <View style={{ flex: 1 }} />
                  {onJumpToLink ? (
                    <Pressable onPress={() => onJumpToLink(l)} hitSlop={6}>
                      <Text style={styles.linkAction}>Jump</Text>
                    </Pressable>
                  ) : null}
                  {onUnlink ? (
                    <Pressable onPress={() => onUnlink(l)} hitSlop={6}>
                      <Text style={[styles.linkAction, { color: C.danger }]}>Unlink</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          ) : null}

          {onRequestLink ? (
            <Pressable
              onPress={() => {
                onSave({ body, color });
                onRequestLink();
              }}
              style={styles.linkBtn}
            >
              <Text style={styles.linkBtnText}>＋ Link to a PDF region</Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onDelete} style={[styles.btn, { backgroundColor: C.bg }]}>
              <Text style={[styles.btnText, { color: C.danger }]}>Delete</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: C.bg }]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave({ body, color })}
              style={[styles.btn, { backgroundColor: C.brand }]}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "center", padding: 22 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontWeight: "800", fontSize: 15, color: C.ink },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    textAlignVertical: "top",
    color: C.ink,
  },
  swatchRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  swatch: { width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: "transparent" },
  swatchOn: { borderColor: C.ink },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: C.line,
  },
  linkText: { color: C.ink, fontWeight: "600", fontSize: 13 },
  linkAction: { color: C.brand, fontWeight: "700", fontSize: 13 },
  linkBtn: {
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  linkBtnText: { color: C.brand, fontWeight: "700", fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  btnText: { fontWeight: "700", fontSize: 13, color: C.sub },
});
