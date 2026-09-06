import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  Notebooks,
  Pdfs,
  SubscriptionRequiredError,
  type NotebookDetail,
  type PageOut,
  type PdfOut,
} from "@/lib/api";
import { DrawTool } from "@/lib/annot";
import { ErrorNote, Loading, Screen } from "@/components/ui";
import { NotebookPane, type NotebookPaneHandle } from "@/components/NotebookPane";
import { InkToolbar } from "@/components/InkToolbar";
import { C, INK_COLORS, PEN_WIDTHS } from "@/lib/theme";

export default function NotebookEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [nb, setNb] = useState<NotebookDetail | null>(null);
  const [pages, setPages] = useState<PageOut[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(PEN_WIDTHS[1]);
  const [pencilOnly, setPencilOnly] = useState(false);
  const [, force] = useState(0);

  const paneRef = useRef<NotebookPaneHandle>(null);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfs, setPdfs] = useState<PdfOut[] | null>(null);
  const [uploading, setUploading] = useState(false);

  const [reorderOpen, setReorderOpen] = useState(false);
  const [draft, setDraft] = useState<PageOut[]>([]);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const detail = await Notebooks.get(id);
      detail.pages.sort((a, b) => a.order - b.order);
      setNb(detail);
      setPages(detail.pages);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open notebook");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const addPage = useCallback(async () => {
    if (!nb) return;
    try {
      const page = await Notebooks.addPage(id, nb.page_type);
      setPages((prev) => [...prev, page]);
    } catch (e) {
      if (e instanceof SubscriptionRequiredError) router.push("/(app)/account");
    }
  }, [id, nb, router]);

  const openPdfDrawer = useCallback(async () => {
    setPdfOpen(true);
    if (!pdfs) {
      try {
        setPdfs(await Pdfs.listForNotebook(id));
      } catch {
        setPdfs([]);
      }
    }
  }, [id, pdfs]);

  const pickPdf = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const doc = await Pdfs.upload(id, {
        uri: a.uri,
        name: a.name ?? "upload.pdf",
        type: a.mimeType ?? "application/pdf",
      });
      setPdfs((prev) => [doc, ...(prev ?? [])]);
    } catch (e) {
      if (e instanceof SubscriptionRequiredError) router.push("/(app)/account");
    } finally {
      setUploading(false);
    }
  }, [id, router]);

  const openReorder = () => {
    setDraft(pages);
    setReorderOpen(true);
  };
  const moveDraft = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };
  const saveReorder = async () => {
    setReorderOpen(false);
    setPages(draft);
    try {
      const detail = await Notebooks.reorder(id, draft.map((p) => p.id));
      detail.pages.sort((a, b) => a.order - b.order);
      setPages(detail.pages);
    } catch {
      load();
    }
  };

  if (err && !nb) return <Screen><ErrorNote message={err} onRetry={load} /></Screen>;
  if (!nb) return <Screen><Loading label="Opening notebook…" /></Screen>;

  return (
    <Screen pad={false}>
      <Stack.Screen
        options={{
          title: nb.title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              {saving ? <ActivityIndicator size="small" color={C.sub} /> : null}
              <Pressable onPress={() => router.push({ pathname: "/(app)/workspace/[id]", params: { id } })} hitSlop={6}>
                <Text style={styles.h}>Split</Text>
              </Pressable>
              <Pressable onPress={openReorder} hitSlop={6}><Text style={styles.h}>⇅</Text></Pressable>
              <Pressable onPress={openPdfDrawer} hitSlop={6}><Text style={styles.h}>PDFs</Text></Pressable>
              <Pressable onPress={addPage} hitSlop={6}><Text style={styles.h}>+ Page</Text></Pressable>
            </View>
          ),
        }}
      />

      <NotebookPane
        ref={paneRef}
        notebookId={id}
        pages={pages}
        defaultRuling={nb.page_type}
        width={width}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        pencilOnly={pencilOnly}
        onSavingChange={setSaving}
        onAccountRedirect={() => router.push("/(app)/account")}
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
        onUndo={() => {
          paneRef.current?.undo();
          force((n) => n + 1);
        }}
        onRedo={() => {
          paneRef.current?.redo();
          force((n) => n + 1);
        }}
        onClear={() => paneRef.current?.clear()}
      />

      {/* PDF drawer */}
      <Modal visible={pdfOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPdfOpen(false)}>
        <Screen>
          <View style={styles.drawerHead}>
            <Text style={styles.drawerTitle}>PDFs in this notebook</Text>
            <Pressable onPress={() => setPdfOpen(false)}><Text style={styles.h}>Done</Text></Pressable>
          </View>
          <Pressable style={styles.uploadBtn} onPress={pickPdf} disabled={uploading}>
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadText}>＋ Upload PDF or image</Text>}
          </Pressable>
          <FlatList
            data={pdfs ?? []}
            keyExtractor={(p) => p.id}
            style={{ marginTop: 12 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.pdfRow}
                onPress={() => {
                  setPdfOpen(false);
                  router.push({ pathname: "/(app)/pdf/[id]", params: { id: item.id, name: item.filename } });
                }}
              >
                <Text style={styles.pdfName} numberOfLines={1}>{item.filename}</Text>
                <Text style={styles.pdfMeta}>{item.page_count} pages · tap to annotate</Text>
              </Pressable>
            )}
            ListEmptyComponent={pdfs === null ? <Loading /> : <Text style={styles.muted}>No PDFs yet.</Text>}
          />
        </Screen>
      </Modal>

      {/* Reorder */}
      <Modal visible={reorderOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReorderOpen(false)}>
        <Screen>
          <View style={styles.drawerHead}>
            <Text style={styles.drawerTitle}>Reorder pages</Text>
            <Pressable onPress={saveReorder}><Text style={styles.h}>Save</Text></Pressable>
          </View>
          <FlatList
            data={draft}
            keyExtractor={(p) => p.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item, index }) => (
              <View style={styles.reRow}>
                <Text style={styles.reName}>Page {index + 1} · {item.page_type}</Text>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => moveDraft(index, -1)} style={styles.reBtn}><Text style={styles.reBtnText}>↑</Text></Pressable>
                <Pressable onPress={() => moveDraft(index, 1)} style={styles.reBtn}><Text style={styles.reBtnText}>↓</Text></Pressable>
              </View>
            )}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { color: C.brand, fontWeight: "700", fontSize: 14 },
  drawerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  drawerTitle: { fontSize: 17, fontWeight: "800", color: C.ink },
  uploadBtn: { backgroundColor: C.brand, borderRadius: 12, height: 46, alignItems: "center", justifyContent: "center" },
  uploadText: { color: "#fff", fontWeight: "700" },
  pdfRow: { backgroundColor: C.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.line },
  pdfName: { fontWeight: "700", color: C.ink },
  pdfMeta: { color: C.sub, fontSize: 12, marginTop: 2 },
  muted: { color: C.sub, textAlign: "center", padding: 24 },
  reRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 12 },
  reName: { fontWeight: "700", color: C.ink },
  reBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  reBtnText: { fontSize: 18, color: C.ink, fontWeight: "800" },
});
