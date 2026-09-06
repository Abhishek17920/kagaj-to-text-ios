import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Chat, type DMThreadOut, type GroupOut, type PublicUser } from "@/lib/api";
import { Button, ErrorNote, Loading, Screen } from "@/components/ui";
import { C } from "@/lib/theme";

export default function ChatHome() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupOut[] | null>(null);
  const [dms, setDms] = useState<DMThreadOut[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);

  const [makeOpen, setMakeOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupHandles, setGroupHandles] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [g, d] = await Promise.all([Chat.groups(), Chat.dms()]);
      setGroups(g);
      setDms(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load chat");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runSearch = useCallback(async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await Chat.search(text.trim()));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const openDm = useCallback(
    async (username: string) => {
      const t = await Chat.openDm(username);
      router.push({
        pathname: "/(app)/chat/thread",
        params: { type: "dm", id: t.id, title: `@${t.other.username}` },
      });
    },
    [router],
  );

  const createGroup = useCallback(async () => {
    if (!groupName.trim()) return;
    setCreating(true);
    try {
      const handles = groupHandles
        .split(/[\s,]+/)
        .map((h) => h.replace(/^@/, "").trim())
        .filter(Boolean);
      const g = await Chat.createGroup(groupName.trim(), handles);
      setMakeOpen(false);
      setGroupName("");
      setGroupHandles("");
      await load();
      router.push({
        pathname: "/(app)/chat/thread",
        params: { type: "group", id: g.id, title: g.name },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create group");
    } finally {
      setCreating(false);
    }
  }, [groupHandles, groupName, load, router]);

  if (err && !groups) return <Screen><ErrorNote message={err} onRetry={load} /></Screen>;
  if (!groups || !dms) return <Screen><Loading label="Loading chat…" /></Screen>;

  return (
    <Screen pad={false}>
      <ScrollView keyboardShouldPersistTaps="handled">
          <View style={{ padding: 16, gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.h}>Find people</Text>
              <TextInput
                value={q}
                onChangeText={runSearch}
                placeholder="Search @username or name"
                placeholderTextColor={C.sub}
                autoCapitalize="none"
                style={styles.input}
              />
              {searching ? <ActivityIndicator color={C.brand} /> : null}
              {results.map((u) => (
                <Pressable key={u.id} style={styles.row} onPress={() => openDm(u.username)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{u.display_name?.[0] ?? u.username[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{u.display_name || u.username}</Text>
                    <Text style={styles.rowSub}>@{u.username}</Text>
                  </View>
                  <Text style={styles.link}>Message</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <View style={styles.headRow}>
                <Text style={styles.h}>Groups</Text>
                <Pressable onPress={() => setMakeOpen(true)}>
                  <Text style={styles.link}>+ New group</Text>
                </Pressable>
              </View>
              {groups.length === 0 ? <Text style={styles.muted}>No groups yet.</Text> : null}
              {groups.map((g) => (
                <Pressable
                  key={g.id}
                  style={styles.row}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/chat/thread",
                      params: { type: "group", id: g.id, title: g.name },
                    })
                  }
                >
                  <View style={[styles.avatar, { backgroundColor: C.brand }]}>
                    <Text style={styles.avatarText}>{g.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{g.name}</Text>
                    <Text style={styles.rowSub}>{g.members.length} members</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.h}>Direct messages</Text>
              {dms.length === 0 ? <Text style={styles.muted}>No conversations yet.</Text> : null}
              {dms.map((t) => (
                <Pressable
                  key={t.id}
                  style={styles.row}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/chat/thread",
                      params: { type: "dm", id: t.id, title: `@${t.other.username}` },
                    })
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {t.other.display_name?.[0] ?? t.other.username[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{t.other.display_name || t.other.username}</Text>
                    <Text style={styles.rowSub}>@{t.other.username}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
      </ScrollView>

      <Modal visible={makeOpen} transparent animationType="fade" onRequestClose={() => setMakeOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.h}>New group</Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name"
              placeholderTextColor={C.sub}
              style={styles.input}
            />
            <TextInput
              value={groupHandles}
              onChangeText={setGroupHandles}
              placeholder="@usernames, comma or space separated"
              placeholderTextColor={C.sub}
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="ghost" onPress={() => setMakeOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Create" onPress={createGroup} loading={creating} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 16, fontWeight: "800", color: C.ink },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: C.card,
    color: C.ink,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: C.sub,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800" },
  rowTitle: { fontWeight: "700", color: C.ink },
  rowSub: { color: C.sub, fontSize: 12 },
  link: { color: C.brand, fontWeight: "700" },
  muted: { color: C.sub },
  modalWrap: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 },
});
