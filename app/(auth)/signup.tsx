import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Button, Field, Screen } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { C } from "@/lib/theme";

export default function Signup() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace("/(app)/dashboard");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen pad={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.sub}>
            One month free. You get a unique @username for chat and groups.
          </Text>

          <View style={{ gap: 14, marginTop: 8 }}>
            <Field label="Display name" value={name} onChangeText={setName} placeholder="Aarav Sharma" autoCapitalize="words" />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Button title="Start free trial" onPress={submit} loading={busy} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.muted}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 72, gap: 8, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: "800", color: C.ink },
  sub: { color: C.sub, fontSize: 14, marginBottom: 12 },
  err: { color: C.danger, fontSize: 13 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 22 },
  muted: { color: C.sub },
  link: { color: C.brand, fontWeight: "700" },
});
