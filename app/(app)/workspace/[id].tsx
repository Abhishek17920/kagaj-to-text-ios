import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Notebooks,
  Notes,
  Pdfs,
  loadToken,
  type NoteLinkOut,
  type NoteOut,
  type NotebookDetail,
  type PdfOut,
} from "@/lib/api";
import { DrawTool } from "@/lib/annot";
import { ErrorNote, Loading, Screen } from "@/components/ui";
import { NotebookPane, type NotebookPaneHandle } from "@/components/NotebookPane";
import { PdfPane, type PaneHandle } from "@/components/PdfPane";
import { InkToolbar } from "@/components/InkToolbar";
import { ConnectorLine, type XY } from "@/components/ConnectorLine";
import { C, INK_COLORS, PEN_WIDTHS } from "@/lib/theme";

type Flash = { page: number; rx: number; ry: number; rw: number; rh: number };

export default function Workspace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 840;

  const [nb, setNb] = useState<NotebookDetail | null>(null);
  const [pdfs, setPdfs] = useState<PdfOut[]>([]);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<"notebook" | "pdf">("notebook");
  const [focused, setFocused] = useState<"notebook" | "pdf">("notebook");

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(PEN_WIDTHS[1]);
  const [pencilOnly, setPencilOnly] = useState(false);
  const [, force] = useState(0);

  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [linkingNote, setLinkingNote] = useState<NoteOut | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [connector, setConnector] = useState<string | null>(null);
  const [activeLink, setActiveLink] = useState<{ id: string; noteId: string } | null>(null);
  const [noteAnchor, setNoteAnchor] = useState<XY | null>(null);
  const [regionAnchor, setRegionAnchor] = useState<XY | null>(null);
  const connTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nbRef = useRef<NotebookPaneHandle>(null);
  const pdfRef = useRef<PaneHandle>(null);

  useEffect(() => {
    (async () => {
      setToken(await loadToken());
      try {
        const [detail, list] = await Promise.all([
          Notebooks.get(id),
          Pdfs.listForNotebook(id),
        ]);
        detail.pages.sort((a, b) => a.order - b.order);
        setNb(detail);
        setPdfs(list);
        setPdfId(list[0]?.id ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not open workspace");
      }
    })();
  }, [id]);

  const activePdf = pdfs.find((p) => p.id === pdfId) ?? null;
  const regions = useMemo(
    () => notes.flatMap((n) => n.links).filter((l) => l.pdf_id === pdfId),
    [notes, pdfId],
  );

  const paneRef = () => (focused === "notebook" ? nbRef.current : pdfRef.current);

  const startLink = useCallback(
    (note: NoteOut) => {
      if (!pdfId) return;
      setLinkingNote(note);
      setFocused("pdf");
      if (!isWide) setTab("pdf");
    },
    [pdfId, isWide],
  );

  const pickRegion = useCallback(
    async (page: number, r: { rx: number; ry: number; rw: number; rh: number }) => {
      if (!linkingNote || !pdfId) return;
      try {
        await Notes.link(linkingNote.id, { pdf_id: pdfId, pdf_page: page, ...r });
      } catch {
        /* ignore */
      }
      setLinkingNote(null);
      nbRef.current?.reloadNotes();
    },
    [linkingNote, pdfId],
  );

  const jumpToLink = useCallback(
    (link: NoteLinkOut) => {
      if (link.pdf_id !== pdfId) setPdfId(link.pdf_id);
      setFocused("pdf");
      if (!isWide) setTab("pdf");
      setTimeout(() => pdfRef.current?.scrollTo(link.pdf_page), 120);
      setFlash({ page: link.pdf_page, rx: link.rx, ry: link.ry, rw: link.rw, rh: link.rh });
      const owner = notes.find((n) => n.links.some((l) => l.id === link.id));
      setConnector(`${(owner?.body || "Note").slice(0, 40)}  ↔  PDF page ${link.pdf_page}`);
      if (owner && isWide) setActiveLink({ id: link.id, noteId: owner.id });
      if (connTimer.current) clearTimeout(connTimer.current);
      connTimer.current = setTimeout(() => {
        setFlash(null);
        setConnector(null);
        setActiveLink(null);
        setNoteAnchor(null);
        setRegionAnchor(null);
      }, 4000);
    },
    [pdfId, isWide, notes],
  );

  if (err && !nb) return <Screen><ErrorNote message={err} /></Screen>;
  if (!nb) return <Screen><Loading label="Opening split view…" /></Screen>;

  const panW = isWide ? Math.floor((width - 1) / 2) : width;
  const showNb = isWide || tab === "notebook";
  const showPdf = isWide || tab === "pdf";

  const notebookPane = (
    <NotebookPane
      ref={nbRef}
      notebookId={id}
      pages={nb.pages}
      defaultRuling={nb.page_type}
      width={panW}
      tool={tool}
      color={color}
      strokeWidth={strokeWidth}
      pencilOnly={pencilOnly}
      onFocus={() => setFocused("notebook")}
      onNotesChange={setNotes}
      onRequestLink={startLink}
      onJumpToLink={jumpToLink}
      trackNoteId={activeLink?.noteId ?? null}
      onNoteAnchor={setNoteAnchor}
      onAccountRedirect={() => router.push("/(app)/account")}
    />
  );

  const pdfPane = activePdf ? (
    <PdfPane
      ref={pdfRef}
      pdfId={activePdf.id}
      pageCount={activePdf.page_count}
      token={token}
      width={panW}
      tool={tool}
      color={color}
      strokeWidth={strokeWidth}
      pencilOnly={pencilOnly}
      onFocus={() => setFocused("pdf")}
      regions={regions}
      highlight={flash}
      linkMode={!!linkingNote}
      onPickRegion={pickRegion}
      trackLinkId={activeLink?.id ?? null}
      onLinkAnchor={setRegionAnchor}
      onAccountRedirect={() => router.push("/(app)/account")}
    />
  ) : (
    <View style={styles.center}>
      <Text style={styles.muted}>No PDF in this notebook yet.{"\n"}Add one from the notebook screen.</Text>
    </View>
  );

  return (
    <Screen pad={false}>
      <Stack.Screen options={{ title: nb.title }} />

      {pdfs.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pdfBar}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, alignItems: "center" }}
        >
          {pdfs.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPdfId(p.id)}
              style={[styles.pdfChip, p.id === pdfId && styles.pdfChipOn]}
            >
              <Text
                style={[styles.pdfChipText, p.id === pdfId && { color: "#fff" }]}
                numberOfLines={1}
              >
                {p.filename}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {!isWide ? (
        <View style={styles.tabs}>
          {(["notebook", "pdf"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                setFocused(t);
              }}
              style={[styles.tab, tab === t && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === t && { color: C.brand }]}>
                {t === "notebook" ? "Notebook" : "PDF"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {linkingNote ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={1}>
            Linking: "{linkingNote.body || "note"}" — draw a box on the PDF
          </Text>
          <Pressable onPress={() => setLinkingNote(null)} hitSlop={8}>
            <Text style={styles.bannerCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {connector ? (
        <View style={[styles.banner, { backgroundColor: C.amber }]}>
          <Text style={styles.bannerText} numberOfLines={1}>🔗 {connector}</Text>
        </View>
      ) : null}

      <View style={{ flex: 1, flexDirection: "row" }}>
        {showNb ? (
          <View
            style={{ width: isWide ? panW : "100%", flex: isWide ? undefined : 1 }}
            onTouchStart={() => setFocused("notebook")}
          >
            {notebookPane}
          </View>
        ) : null}
        {isWide ? <View style={styles.divider} /> : null}
        {showPdf ? (
          <View
            style={{ width: isWide ? panW : "100%", flex: isWide ? undefined : 1 }}
            onTouchStart={() => setFocused("pdf")}
          >
            {pdfPane}
          </View>
        ) : null}
      </View>

      {isWide && activeLink ? <ConnectorLine from={noteAnchor} to={regionAnchor} /> : null}

      <View style={styles.focusHint}>
        <Text style={styles.focusHintText}>
          Tools act on: {focused === "notebook" ? "Notebook" : "PDF"}
        </Text>
      </View>

      <InkToolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        pencilOnly={pencilOnly}
        canUndo={!!paneRef()?.canUndo()}
        canRedo={!!paneRef()?.canRedo()}
        onTool={setTool}
        onColor={setColor}
        onWidth={setStrokeWidth}
        onPencilOnly={setPencilOnly}
        onUndo={() => { paneRef()?.undo(); force((n) => n + 1); }}
        onRedo={() => { paneRef()?.redo(); force((n) => n + 1); }}
        onClear={() => paneRef()?.clear()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: C.sub, textAlign: "center", lineHeight: 20 },
  pdfBar: { flexGrow: 0, backgroundColor: C.card, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 8 },
  pdfChip: {
    maxWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
  },
  pdfChipOn: { backgroundColor: C.brand, borderColor: C.brand },
  pdfChipText: { fontSize: 12, fontWeight: "700", color: C.sub },
  tabs: { flexDirection: "row", backgroundColor: C.card, borderBottomWidth: 1, borderColor: C.line },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderColor: "transparent" },
  tabOn: { borderColor: C.brand },
  tabText: { fontWeight: "700", color: C.sub },
  divider: { width: 1, backgroundColor: C.line },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerText: { color: "#fff", fontWeight: "700", fontSize: 12, flex: 1 },
  bannerCancel: { color: "#fff", fontWeight: "800", fontSize: 12, textDecorationLine: "underline" },
  focusHint: { alignItems: "center", paddingVertical: 2, backgroundColor: C.card },
  focusHintText: { fontSize: 10, color: C.sub, fontWeight: "600" },
});
