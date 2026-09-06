import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Notebooks, type Catalog, type NotebookOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { coverById, coverColor } from "@/lib/cover";
import { Button, ErrorNote, Loading, Screen } from "@/components/ui";
import { C } from "@/lib/theme";

export default function Dashboard() {
  const router = useRouter();
  const { user, subscription } = useAuth();
  const { width } = useWindowDimensions();
  const cols = width > 900 ? 4 : width > 600 ? 3 : 2;

  const [books, setBooks] = useState<NotebookOut[] | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [list, cat] = await Promise.all([Notebooks.list(), Notebooks.catalog()]);
      setBooks(list);
      setCatalog(cat);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load notebooks");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (err && !books) return <Screen><ErrorNote message={err} onRetry={load} /></Screen>;
  if (!books || !catalog) return <Screen><Loading label="Loading notebooks…" /></Screen>;

  const trialDays = subscription?.days_left ?? 0;
  const trialActive = subscription?.is_active;

  return (
    <Screen pad={false}>
      <FlatList
        data={books}
        key={cols}
        numColumns={cols}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 4 }}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.hi}>Hi {user?.display_name || user?.username}</Text>
                <Text style={styles.handle}>@{user?.username}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={styles.pill} onPress={() => router.push("/(app)/chat")}>
                  <Text style={styles.pillText}>Chat</Text>
                </Pressable>
                <Pressable style={styles.pill} onPress={() => router.push("/(app)/account")}>
                  <Text style={styles.pillText}>Account</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => router.push("/(app)/account")}
              style={[styles.banner, { backgroundColor: trialActive ? C.brandSoft : "#fee2e2" }]}
            >
              <Text style={[styles.bannerText, { color: trialActive ? C.brand : C.danger }]}>
                {subscription?.plan === "trial"
                  ? trialActive
                    ? `Free trial · ${trialDays} day${trialDays === 1 ? "" : "s"} left`
                    : "Your free trial has ended — tap to subscribe"
                  : trialActive
                    ? `${subscription?.plan} plan · ${trialDays} days left`
                    : "Subscription expired — tap to renew"}
              </Text>
            </Pressable>

            <Button title="+  New notebook" onPress={() => router.push("/(app)/new")} />
          </View>
        }
        renderItem={({ item }) => {
          const cov = coverById(catalog.covers, item.cover);
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: "/(app)/notebook/[id]", params: { id: item.id } })}
            >
              <View style={[styles.cover, { backgroundColor: coverColor(cov?.value) }]}>
                <View style={styles.spine} />
                <Text style={styles.coverLabel} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>{cov?.name ?? item.cover}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No notebooks yet. Create your first one above.</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hi: { fontSize: 20, fontWeight: "800", color: C.ink },
  handle: { color: C.sub, marginTop: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  pillText: { fontWeight: "700", color: C.ink, fontSize: 13 },
  banner: { padding: 12, borderRadius: 12 },
  bannerText: { fontWeight: "700", fontSize: 13 },
  card: { flex: 1, gap: 4 },
  cover: {
    aspectRatio: 0.75,
    borderRadius: 12,
    padding: 12,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  spine: { position: "absolute", left: 10, top: 0, bottom: 0, width: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  coverLabel: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cardTitle: { fontWeight: "700", color: C.ink, fontSize: 14 },
  cardMeta: { color: C.sub, fontSize: 12 },
  empty: { color: C.sub, textAlign: "center", padding: 40 },
});
