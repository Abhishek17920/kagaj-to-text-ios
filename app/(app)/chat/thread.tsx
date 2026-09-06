import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import Animated, { FadeInUp } from "react-native-reanimated";
import { Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { Chat, type Attachment, type MessageOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loading, Screen } from "@/components/ui";
import { AttachmentBubble } from "@/components/AttachmentBubble";
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
  const [pendingAtt, setPendingAtt] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<FlatList<MessageOut>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recStart = useRef(0);
  const seenIds = useRef<Set<string>>(new Set());

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

  const canSend = !!text.trim() || !!pendingAtt;

  const send = useCallback(async () => {
    const body = text.trim();
    const att = pendingAtt;
    if (!body && !att) return;
    const wasEditing = editingId;
    setText("");
    setEditingId(null);
    setPendingAtt(null);
    setSending(true);
    try {
      if (wasEditing && type === "group") {
        const msg = await Chat.editGroup(id, wasEditing, body);
        setMessages((prev) => (prev ?? []).map((m) => (m.id === msg.id ? msg : m)));
      } else {
        const msg =
          type === "group"
            ? await Chat.postGroup(id, body, att)
            : await Chat.postDm(id, body, att);
        setMessages((prev) => [...(prev ?? []), msg]);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
    } catch {
      setText(body);
      setPendingAtt(att);
      setEditingId(wasEditing);
    } finally {
      setSending(false);
    }
  }, [id, text, type, editingId, pendingAtt]);

  const uploadFile = useCallback(async (file: { uri: string; name: string; type: string }) => {
    setUploading(true);
    try {
      setPendingAtt(await Chat.uploadAttachment(file));
    } catch {
      Alert.alert("Upload failed", "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  }, []);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await uploadFile({ uri: a.uri, name: a.fileName ?? "photo.jpg", type: a.mimeType ?? "image/jpeg" });
  }, [uploadFile]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await uploadFile({ uri: a.uri, name: a.fileName ?? "photo.jpg", type: a.mimeType ?? "image/jpeg" });
  }, [uploadFile]);

  const pickDoc = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await uploadFile({
      uri: a.uri,
      name: a.name ?? "file",
      type: a.mimeType ?? "application/octet-stream",
    });
  }, [uploadFile]);

  const attachMenu = useCallback(() => {
    Alert.alert("Attach", undefined, [
      { text: "Photo library", onPress: pickImage },
      { text: "Camera", onPress: takePhoto },
      { text: "Document", onPress: pickDoc },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [pickImage, takePhoto, pickDoc]);

  const startRec = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStart.current = Date.now();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, [recorder]);

  const stopRecAndSend = useCallback(async () => {
    if (!recording) return;
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const secs = (Date.now() - recStart.current) / 1000;
      if (!uri || secs < 0.6) return;
      setUploading(true);
      const att = await Chat.uploadAttachment({ uri, name: "voice-note.m4a", type: "audio/m4a" });
      att.duration = Math.round(secs);
      const msg =
        type === "group" ? await Chat.postGroup(id, "", att) : await Chat.postDm(id, "", att);
      setMessages((prev) => [...(prev ?? []), msg]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  }, [recording, recorder, id, type]);

  const onMessageLongPress = useCallback(
    (m: MessageOut) => {
      if (type !== "group" || m.sender.id !== user?.id || m.deleted) return;
      Alert.alert("Message", undefined, [
        ...(m.body
          ? [{ text: "Edit", onPress: () => { setEditingId(m.id); setText(m.body); } }]
          : []),
        {
          text: "Delete",
          style: "destructive" as const,
          onPress: async () => {
            try {
              const msg = await Chat.deleteGroup(id, m.id);
              setMessages((prev) => (prev ?? []).map((x) => (x.id === msg.id ? msg : x)));
            } catch {
              /* ignore */
            }
          },
        },
        { text: "Cancel", style: "cancel" as const },
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
            const fresh = !seenIds.current.has(item.id);
            seenIds.current.add(item.id);
            const Row = fresh ? Animated.View : View;
            return (
              <Row
                {...(fresh ? { entering: FadeInUp.duration(160) } : {})}
                style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}
              >
                <Pressable
                  onLongPress={() => onMessageLongPress(item)}
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                >
                  {!mine && type === "group" ? (
                    <Text style={styles.sender}>
                      {item.sender.display_name || item.sender.username}
                    </Text>
                  ) : null}
                  {item.attachment && !item.deleted ? (
                    <View style={{ marginBottom: item.body ? 6 : 0 }}>
                      <AttachmentBubble att={item.attachment} mine={mine} />
                    </View>
                  ) : null}
                  {item.deleted || item.body ? (
                    <Text style={[styles.body, mine && { color: "#fff" }]}>
                      {item.deleted ? "(deleted)" : item.body}
                    </Text>
                  ) : null}
                  {item.edited_at && !item.deleted ? (
                    <Text style={[styles.edited, mine && { color: "rgba(255,255,255,0.7)" }]}>
                      edited
                    </Text>
                  ) : null}
                </Pressable>
              </Row>
            );
          }}
        />

        {pendingAtt ? (
          <View style={styles.pending}>
            <Text style={styles.pendingText} numberOfLines={1}>
              📎 {pendingAtt.name}
            </Text>
            <Pressable onPress={() => setPendingAtt(null)} hitSlop={8}>
              <Text style={styles.pendingX}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable onPress={attachMenu} style={styles.attachBtn} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color={C.brand} />
            ) : (
              <Text style={styles.attachGlyph}>＋</Text>
            )}
          </Pressable>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={editingId ? "Edit message…" : recording ? "Recording…" : "Message…"}
            placeholderTextColor={C.sub}
            style={styles.input}
            multiline
            editable={!recording}
          />

          {editingId ? (
            <Pressable onPress={() => { setEditingId(null); setText(""); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>✕</Text>
            </Pressable>
          ) : null}

          {canSend || editingId ? (
            <Pressable
              onPress={send}
              disabled={sending || (!canSend && !editingId)}
              style={[styles.sendBtn, sending && { opacity: 0.5 }]}
            >
              <Text style={styles.sendText}>{editingId ? "Update" : "Send"}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPressIn={startRec}
              onPressOut={stopRecAndSend}
              style={[styles.micBtn, recording && styles.micBtnOn]}
            >
              <Text style={[styles.micGlyph, recording && { color: "#fff" }]}>
                {recording ? "●" : "🎙"}
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: C.brand, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 4 },
  sender: { fontSize: 11, fontWeight: "700", color: C.sub, marginBottom: 2 },
  body: { fontSize: 15, color: C.ink },
  edited: { fontSize: 10, color: C.sub, marginTop: 2 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 10,
    marginBottom: 4,
    padding: 8,
    borderRadius: 10,
    backgroundColor: C.brandSoft,
  },
  pendingText: { flex: 1, fontSize: 12, fontWeight: "600", color: C.brand },
  pendingX: { fontSize: 13, fontWeight: "800", color: C.brand },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "flex-end",
  },
  attachBtn: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  attachGlyph: { fontSize: 20, color: C.brand, fontWeight: "800" },
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
  micBtn: {
    height: 40,
    width: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnOn: { backgroundColor: C.danger, borderColor: C.danger },
  micGlyph: { fontSize: 17, color: C.ink },
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
