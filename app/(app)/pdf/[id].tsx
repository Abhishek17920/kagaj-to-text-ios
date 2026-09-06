import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pdfs, loadToken, type PdfOut } from "@/lib/api";
import { DrawTool } from "@/lib/annot";
import { ErrorNote, Loading, Screen } from "@/components/ui";
import { PdfPane, type PaneHandle } from "@/components/PdfPane";
import { InkToolbar } from "@/components/InkToolbar";
import { C, INK_COLORS, PEN_WIDTHS } from "@/lib/theme";

function parseBookmarks(meta: string): number[] {
  try {
    const v = JSON.parse(meta || "{}");
    return Array.isArray(v.bookmarks) ? v.bookmarks.filter((n: unknown) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export default function PdfAnnotator() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [doc, setDoc] = useState<PdfOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [, force] = useState(0);

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(PEN_WIDTHS[1]);
  const [pencilOnly, setPencilOnly] = useState(false);

  const paneRef = useRef<PaneHandle>(null);

  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [bmOpen, setBmOpen] = useState(false);

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setToken(await loadToken());
      try {
        const all = await Pdfs.listAll();
        const found = all.find((p) => p.id === id) ?? null;
        if (!found) setErr("PDF not found");
        setDoc(found);
        if (found) setBookmarks(parseBookmarks(found.meta_json));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load PDF");
      }
    })();
  }, [id]);

  const toggleBookmark = useCallback(async () => {
    setBookmarks((prev) => {
      const next = prev.includes(activePage)
        ? prev.filter((n) => n !== activePage)
        : [...prev, activePage].sort((a, b) => a - b);
      const meta = { ...safeMeta(doc?.meta_json), bookmarks: next };
      Pdfs.setMeta(id, JSON.stringify(meta)).catch(() => {});
      return next;
    });
  }, [activePage, doc?.meta_json, id]);

  const runSummary = useCallback(async () => {
    setSummaryOpen(true);
    if (summary || summaryBusy) return;
    setSummaryBusy(true);
    try {
      const res = await Pdfs.summary(id);
      setSummary(res.summary || "No summary produced.");
    } catch (e) {
      setSummary(e instanceof Error ? e.message : "Could not summarise this PDF.");
    } finally {
      setSummaryBusy(false);
    }
  }, [id, summary, summaryBusy]);

  if (err && !doc) return <Screen><ErrorNote message={err} /></Screen>;
  if (!doc) return <Screen><Loading label="Loading PDF…" /></Screen>;

  const marked = bookmarks.includes(activePage);

  return (
    <Screen pad={false}>
      <Stack.Screen
        options={{
          title: (name as string) || doc.filename,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              {saving ? <ActivityIndicator size="small" color={C.sub} /> : null}
              <Pressable onPress={toggleBookmark} hitSlop={6}>
                <Text style={[styles.h, marked && { color: C.amber }]}>{marked ? "★" : "☆"}</Text>
              </Pressable>
              <Pressable onPress={() => setBmOpen(true)} hitSlop={6}><Text style={styles.h}>List</Text></Pressable>
              <Pressable onPress={runSummary} hitSlop={6}><Text style={styles.h}>Summary</Text></Pressable>
            </View>
          ),
        }}
      />

      <InkToolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        pencilOnly={pencilOnly}
        canUndo={!!paneRef.current?.canUndo()}
        canRedo={!!paneRef.current?.canRedo()}
        onTool={setTool}
        onColor={setColor}
        onWidth={setStrokeWidth}
        onPencilOnly={setPencilOnly}
        onUndo={() => { paneRef.current?.undo(); force((n) => n + 1); }}
        onRedo={() => { paneRef.current?.redo(); force((n) => n + 1); }}
        onClear={() => paneRef.current?.clear()}
      />

      <PdfPane
        ref={paneRef}
        pdfId={id}
        pageCount={doc.page_count}
        token={token}
        width={width}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        pencilOnly={pencilOnly}
        onActivePageChange={setActivePage}
        onSavingChange={setSaving}
        onAccountRedirect={() => router.push("/(app)/account")}
      />

      <Modal visible={bmOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBmOpen(false)}>
        <Screen>
          <View style={styles.head}>
            <Text style={styles.title}>Bookmarks</Text>
            <Pressable onPress={() => setBmOpen(false)}><Text style={styles.h}>Done</Text></Pressable>
          </View>
          <FlatList
            data={bookmarks}
            keyExtractor={(n) => String(n)}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.bmRow}
                onPress={() => {
                  setBmOpen(false);
                  paneRef.current?.scrollTo(item);
                }}
              >
                <Text style={styles.bmText}>Page {item}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.muted}>No bookmarks. Tap ☆ on a page.</Text>}
          />
        </Screen>
      </Modal>

      <Modal visible={summaryOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSummaryOpen(false)}>
        <Screen>
          <View style={styles.head}>
            <Text style={styles.title}>Summary</Text>
            <Pressable onPress={() => setSummaryOpen(false)}><Text style={styles.h}>Done</Text></Pressable>
          </View>
          {summaryBusy ? (
            <Loading label="Reading the document…" />
          ) : (
            <ScrollView>
              <Text style={styles.summaryText}>{summary}</Text>
            </ScrollView>
          )}
        </Screen>
      </Modal>
    </Screen>
  );
}

function safeMeta(meta: string | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(meta || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

const styles = StyleSheet.create({
  h: { color: C.brand, fontWeight: "700", fontSize: 15 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "800", color: C.ink },
  bmRow: { backgroundColor: C.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.line },
  bmText: { fontWeight: "700", color: C.ink },
  muted: { color: C.sub, textAlign: "center", padding: 24 },
  summaryText: { fontSize: 15, lineHeight: 22, color: C.ink },
});
