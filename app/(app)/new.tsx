import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Notebooks, SubscriptionRequiredError, type Catalog } from "@/lib/api";
import { coverColor } from "@/lib/cover";
import { Button, Field, Loading, Screen } from "@/components/ui";
import { RulingThumb } from "@/components/Ruling";
import { C } from "@/lib/theme";

export default function NewNotebook() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [title, setTitle] = useState("Untitled notebook");
  const [cover, setCover] = useState("indigo");
  const [pageType, setPageType] = useState("ruled");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Notebooks.catalog().then(setCatalog).catch(() => setErr("Could not load styles"));
  }, []);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const nb = await Notebooks.create(title.trim() || "Untitled notebook", cover, pageType);
      router.replace({ pathname: "/(app)/notebook/[id]", params: { id: nb.id } });
    } catch (e) {
      if (e instanceof SubscriptionRequiredError) {
        router.replace("/(app)/account");
        return;
      }
      setErr(e instanceof Error ? e.message : "Could not create notebook");
    } finally {
      setBusy(false);
    }
  };

  if (!catalog) return <Screen><Loading /></Screen>;

  return (
    <Screen pad={false}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Case notes — Feb" />

        <View style={{ gap: 10 }}>
          <Text style={styles.section}>Cover</Text>
          <View style={styles.grid}>
            {catalog.covers.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCover(c.id)}
                style={[styles.coverTile, { backgroundColor: coverColor(c.value) }, cover === c.id && styles.selected]}
              >
                <Text style={styles.coverName}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={styles.section}>Page ruling</Text>
          <View style={styles.ruleGrid}>
            {catalog.page_types.map((p) => {
              const on = pageType === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPageType(p.id)}
                  style={[styles.ruleCard, on && styles.ruleSelected]}
                >
                  <RulingThumb type={p.id} width={60} height={78} />
                  <Text style={[styles.ruleName, on && { color: C.brand }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.ruleDesc}>
            {catalog.page_types.find((p) => p.id === pageType)?.desc}
          </Text>
        </View>

        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Button title="Create notebook" onPress={create} loading={busy} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: "800", color: C.ink, fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  coverTile: {
    width: 96,
    height: 120,
    borderRadius: 12,
    padding: 10,
    justifyContent: "flex-end",
    borderWidth: 3,
    borderColor: "transparent",
  },
  selected: { borderColor: C.ink },
  coverName: { color: "#fff", fontWeight: "700", fontSize: 12 },
  ruleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ruleCard: {
    width: 84,
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 2,
    borderColor: "transparent",
  },
  ruleSelected: { borderColor: C.brand, backgroundColor: C.brandSoft },
  ruleName: { fontWeight: "700", color: C.ink, fontSize: 12 },
  ruleDesc: { color: C.sub, fontSize: 12, marginTop: 2 },
  err: { color: C.danger },
});
