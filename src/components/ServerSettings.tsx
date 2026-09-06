import React, { useEffect, useState } from "react";
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
import { pingHealth } from "@/lib/api";
import { resolveApiBase, saveApiBase } from "@/lib/config";
import { C } from "@/lib/theme";

export function ServerSettings({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setUrl(resolveApiBase());
      setResult(null);
    }
  }, [visible]);

  const test = async () => {
    setTesting(true);
    setResult(null);
    setResult(await pingHealth(url));
    setTesting(false);
  };

  const save = async () => {
    await saveApiBase(url);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrap}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Server address</Text>
          <Text style={styles.hint}>
            Where the backend is reachable from this device. Same Wi-Fi:{" "}
            <Text style={styles.mono}>http://192.168.1.8:8010</Text>. Cloudflare tunnel:{" "}
            <Text style={styles.mono}>https://xxxx.trycloudflare.com/api</Text>.
          </Text>

          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://…"
            placeholderTextColor={C.sub}
            style={styles.input}
          />

          <Pressable onPress={test} style={styles.testBtn} disabled={testing}>
            <Text style={styles.testText}>{testing ? "Testing…" : "Test connection"}</Text>
          </Pressable>

          {result ? (
            <Text style={[styles.result, { color: result.ok ? C.ok : C.danger }]}>
              {result.ok ? "✓ Reachable — " : "✕ Failed — "}
              {result.detail}
            </Text>
          ) : null}

          <View style={styles.row}>
            <Pressable
              onPress={async () => {
                await saveApiBase("");
                setUrl(resolveApiBase());
                setResult(null);
              }}
              style={[styles.btn, { backgroundColor: C.bg }]}
            >
              <Text style={styles.btnText}>Reset</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: C.bg }]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={[styles.btn, { backgroundColor: C.brand }]}>
              <Text style={[styles.btnText, { color: "#fff" }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontWeight: "800", fontSize: 16, color: C.ink },
  hint: { color: C.sub, fontSize: 12, lineHeight: 17 },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11, color: C.ink },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: C.bg,
    color: C.ink,
  },
  testBtn: {
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  testText: { color: C.brand, fontWeight: "700" },
  result: { fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  btnText: { fontWeight: "700", fontSize: 13, color: C.sub },
});
