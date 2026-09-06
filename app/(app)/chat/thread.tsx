import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Chat, type MessageOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loading, Screen } from "@/components/ui";
import { C } from "@/lib/theme";

const POLL_MS = 3000;

export default function Thread() {
  const { type, id, title } = useLocalSearchParams<{
    type: "group" | "dm";
    id: string;
    title?: string;
  }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageOut[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageOut>>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const rows =
        type === "group" ? await Chat.groupMessages(id) : await Chat.dmMessages(id);
      setMessages(rows);
    } catch {
      /* keep last good state */
    }
  }, [id, type]);

  useEffect(() => {
    fetchMessages();
    const h = setInterval(fetchMessages, POLL_MS);
    return () => clearInterval(h);
  }, [fetchMessages]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body) return;
    const wasEditing = editingId;
    setText("");
    setEditingId(null);
    setSending(true);
    try {
      if (wasEditing && type === "group") {
        const msg = await Chat.editGroup(id, wasEditing, body);
        setMessages((prev) => (prev ?? []).map((m) => (m.id === msg.id ? msg : m)));
      } else {
        const msg =
          type === "group" ? await Chat.postGroup(id, body) : await Chat.postDm(id, body);
        setMessages((prev) => [...(prev ?? []), msg]);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
    } catch {
      setText(body);
      setEditingId(wasEditing);
    } finally {
      setSending(false);
    }
  }, [id, text, type, editingId]);

  const onMessageLongPress = useCallback(
    (m: MessageOut) => {
      if (type !== "group" || m.sender.id !== user?.id || m.deleted) return;
      Alert.alert("Message", undefined, [
        { text: "Edit", onPress: () => { setEditingId(m.id); setText(m.body); } },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const msg = await Chat.deleteGroup(id, m.id);
              setMessages((prev) => (prev ?? []).map((x) => (x.id === msg.id ? msg : x)));
            } catch {
              /* ignore */
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [id, type, user?.id],
  );

  if (!messages) return <Screen><Loading label="Loading messages…" /></Screen>;

  return (
    <Screen pad={false}>
      <Stack.Screen options={{ title: (title as string) || "Chat" }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender.id === user?.id;
            return (
              <Pressable
                onLongPress={() => onMessageLongPress(item)}
                style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}
              >
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {!mine && type === "group" ? (
                    <Text style={styles.sender}>{item.sender.display_name || item.sender.username}</Text>
                  ) : null}
                  <Text style={[styles.body, mine && { color: "#fff" }]}>
                    {item.deleted ? "(deleted)" : item.body}
                  </Text>
                  {item.edited_at && !item.deleted ? (
                    <Text style={[styles.edited, mine && { color: "rgba(255,255,255,0.7)" }]}>edited</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={editingId ? "Edit message…" : "Message…"}
            placeholderTextColor={C.sub}
            style={styles.input}
            multiline
          />
          {editingId ? (
            <Pressable onPress={() => { setEditingId(null); setText(""); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>✕</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={send}
            disabled={sending || !text.trim()}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
          >
            <Text style={styles.sendText}>{editingId ? "Update" : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "80%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: C.brand, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 4 },
  sender: { fontSize: 11, fontWeight: "700", color: C.sub, marginBottom: 2 },
  body: { fontSize: 15, color: C.ink },
  edited: { fontSize: 10, color: C.sub, marginTop: 2 },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    color: C.ink,
    backgroundColor: C.bg,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontWeight: "700" },
  cancelBtn: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  cancelText: { color: C.sub, fontWeight: "800" },
});
