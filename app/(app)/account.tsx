import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Billing } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Screen } from "@/components/ui";
import { C } from "@/lib/theme";
import { API_BASE } from "@/lib/config";

export default function Account() {
  const { user, subscription, refresh, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<"monthly" | "yearly" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const subscribe = async (plan: "monthly" | "yearly") => {
    setBusy(plan);
    setMsg(null);
    try {
      await Billing.subscribe(plan);
      await refresh();
      setMsg("Subscription active. Enjoy!");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  };

  const row = (k: string, v: string) => (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );

  return (
    <Screen pad={false}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <View style={styles.card}>
          <Text style={styles.title}>{user?.display_name || user?.username}</Text>
          {row("Username", `@${user?.username}`)}
          {row("Email", user?.email ?? "")}
          {row("Plan", subscription?.plan ?? "—")}
          {row("Status", subscription?.is_active ? "Active" : "Inactive")}
          {row("Days left", String(subscription?.days_left ?? 0))}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Subscribe</Text>
          <Text style={styles.muted}>
            Demo checkout — no real card is charged. Unlocks editing after the free trial.
          </Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button title="Monthly plan" onPress={() => subscribe("monthly")} loading={busy === "monthly"} />
            <Button
              title="Yearly plan"
              variant="ghost"
              onPress={() => subscribe("yearly")}
              loading={busy === "yearly"}
            />
          </View>
          {msg ? <Text style={[styles.muted, { color: C.ok, marginTop: 8 }]}>{msg}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.muted}>API: {API_BASE}</Text>
        </View>

        <Button
          title="Sign out"
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/login");
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 6, borderWidth: 1, borderColor: C.line },
  title: { fontWeight: "800", fontSize: 16, color: C.ink, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  k: { color: C.sub },
  v: { color: C.ink, fontWeight: "600" },
  muted: { color: C.sub, fontSize: 13 },
});
