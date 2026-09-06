import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Button, Field, Screen } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ServerSettings } from "@/components/ServerSettings";
import { C } from "@/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(app)/dashboard");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen pad={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.word}>kagaj</Text>
            <View style={styles.mark}>
              <Text style={styles.markText}>✑</Text>
            </View>
            <Text style={styles.word}>text</Text>
          </View>
          <Text style={styles.sub}>Sign in to your notebooks, PDFs and chat.</Text>

          <View style={{ gap: 14, marginTop: 8 }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Button title="Sign in" onPress={submit} loading={busy} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.muted}>New here? </Text>
            <Link href="/(auth)/signup" style={styles.link}>
              Create an account
            </Link>
          </View>

          <Pressable onPress={() => setServerOpen(true)} style={styles.serverLink} hitSlop={8}>
            <Text style={styles.muted}>⚙︎ Server settings</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <ServerSettings visible={serverOpen} onClose={() => setServerOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 72, gap: 8, flexGrow: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: "#fff", fontSize: 20, transform: [{ rotate: "-8deg" }] },
  sub: { color: C.sub, fontSize: 14, marginBottom: 12 },
  err: { color: C.danger, fontSize: 13 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 22 },
  muted: { color: C.sub },
  link: { color: C.brand, fontWeight: "700" },
  serverLink: { alignItems: "center", marginTop: 28 },
});
