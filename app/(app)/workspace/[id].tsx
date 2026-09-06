import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
import { ErrorNote, Loading, Screen } from "@/components/ui";
import { NotebookPane, type NotebookPaneHandle } from "@/components/NotebookPane";
import { PdfPane, type PaneHandle } from "@/components/PdfPane";
import { InkToolbar } from "@/components/InkToolbar";
import { FloatingTools } from "@/components/FloatingTools";
import { ConnectorLine, type XY } from "@/components/ConnectorLine";
import { useDrawTools } from "@/lib/useDrawTools";
import { C } from "@/lib/theme";

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

  const {
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setWidth: setStrokeWidth,
    pencilOnly,
    setPencilOnly,
    shapeAssist,
    setShapeAssist,
    favorites,
    pinCurrent,
    applyFavorite,
    removeFavorite,
  } = useDrawTools();
  const [, force] = useState(0);

  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [linkingNote, setLinkingNote] = useState<NoteOut | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [nbPageIdx, setNbPageIdx] = useState(0);
  const [groups, setGroups] = useState<string[][]>([]);
  const [selLinks, setSelLinks] = useState<string[]>([]);
  const [splitPct, setSplitPct] = useState(0.5);
  const splitStart = useRef(0.5);
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
      if (!pdfId) return;
      try {
        if (linkingNote) {
          // link an existing note to this region
          await Notes.link(linkingNote.id, { pdf_id: pdfId, pdf_page: page, ...r });
        } else if (linkMode) {
          // direct: drop a linked note on the current notebook page
          const pageId = nb?.pages[nbPageIdx]?.id ?? nb?.pages[0]?.id ?? null;
          const note = await Notes.create(id, {
            page_id: pageId,
            body: "",
            display_mode: "linked",
            color: "#f4d35e",
            x: 0.06 + (notes.length % 4) * 0.02,
            y: 0.06 + (notes.length % 6) * 0.03,
            w: 0.3,
            h: 0.14,
          });
          await Notes.link(note.id, { pdf_id: pdfId, pdf_page: page, ...r });
        }
      } catch {
        /* ignore */
      }
      setLinkingNote(null);
      setLinkMode(false);
      setFlash({ page, ...r });
      if (connTimer.current) clearTimeout(connTimer.current);
      connTimer.current = setTimeout(() => setFlash(null), 2200);
      nbRef.current?.reloadNotes();
    },
    [linkingNote, linkMode, pdfId, id, nb, nbPageIdx, notes.length],
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

  const unlink = useCallback(
    async (noteId: string, linkId: string) => {
      try {
        await Notes.unlink(noteId, linkId);
      } catch {
        /* ignore */
      }
      nbRef.current?.reloadNotes();
    },
    [],
  );

  const editLinkedBody = useCallback((noteId: string, body: string) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, body } : n)));
    Notes.patch(noteId, { body }).catch(() => {});
  }, []);

  const linkCards = useMemo(
    () =>
      notes.flatMap((n) =>
        n.links
          .filter((l) => l.pdf_id === pdfId)
          .map((l) => ({ link: l, noteId: n.id, body: n.body })),
      ),
    [notes, pdfId],
  );

  const GROUP_COLORS = ["#2563eb", "#e11d48", "#059669", "#9333ea", "#d97706"];
  const groupColors = useMemo(() => {
    const map: Record<string, string> = {};
    groups.forEach((g, i) => g.forEach((id) => (map[id] = GROUP_COLORS[i % GROUP_COLORS.length])));
    return map;
  }, [groups]);

  const groupSelected = () => {
    if (selLinks.length < 2) return;
    setGroups((prev) => [
      ...prev.filter((g) => !g.some((id) => selLinks.includes(id))),
      [...selLinks],
    ]);
    setSelLinks([]);
  };
  const toggleSel = (id: string) =>
    setSelLinks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (err && !nb) return <Screen><ErrorNote message={err} /></Screen>;
  if (!nb) return <Screen><Loading label="Opening split view…" /></Screen>;

  const DIV = 10;
  const nbW = isWide ? Math.round((width - DIV) * splitPct) : width;
  const pdfW = isWide ? width - DIV - nbW : width;
  const showNb = isWide || tab === "notebook";
  const showPdf = isWide || tab === "pdf";

  const divider = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      splitStart.current = splitPct;
    })
    .onUpdate((e) => {
      const next = splitStart.current + e.translationX / width;
      setSplitPct(Math.max(0.28, Math.min(0.72, next)));
    });

  const notebookPane = (
    <NotebookPane
      ref={nbRef}
      notebookId={id}
      pages={nb.pages}
      defaultRuling={nb.page_type}
      width={nbW}
      tool={tool}
      color={color}
      strokeWidth={strokeWidth}
      pencilOnly={pencilOnly}
      shapeAssist={shapeAssist}
      onFocus={() => setFocused("notebook")}
      onActiveIndexChange={setNbPageIdx}
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
      width={pdfW}
      tool={tool}
      color={color}
      strokeWidth={strokeWidth}
      pencilOnly={pencilOnly}
      shapeAssist={shapeAssist}
      onFocus={() => setFocused("pdf")}
      regions={regions}
      groupColors={groupColors}
      highlight={flash}
      linkMode={linkMode || !!linkingNote}
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
      <Stack.Screen
        options={{
          title: nb.title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              <Pressable
                onPress={() => {
                  setLinkMode((v) => !v);
                  setLinkingNote(null);
                  setFocused("pdf");
                  if (!isWide) setTab("pdf");
                }}
                hitSlop={6}
              >
                <Text style={[styles.hBtn, linkMode && { color: C.amber }]}>🔗 Link</Text>
              </Pressable>
              <Pressable onPress={() => setLinksOpen(true)} hitSlop={6}>
                <Text style={styles.hBtn}>Links {linkCards.length ? `(${linkCards.length})` : ""}</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {pdfs.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pdfBar}
          contentContainerStyle={{ paddingHorizontal: 6, alignItems: "flex-end" }}
        >
          {pdfs.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPdfId(p.id)}
              style={[styles.pdfTab, p.id === pdfId && styles.pdfTabOn]}
            >
              <Text style={styles.pdfTabIcon}>📄</Text>
              <Text
                style={[styles.pdfTabText, p.id === pdfId && { color: C.brand }]}
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

      <InkToolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        pencilOnly={pencilOnly}
        canUndo={!!paneRef()?.canUndo()}
        canRedo={!!paneRef()?.canRedo()}
        shapeAssist={shapeAssist}
        favorites={favorites}
        onShapeAssist={setShapeAssist}
        onPin={pinCurrent}
        onApplyFavorite={applyFavorite}
        onRemoveFavorite={removeFavorite}
        onTool={setTool}
        onColor={setColor}
        onWidth={setStrokeWidth}
        onPencilOnly={setPencilOnly}
        onUndo={() => { paneRef()?.undo(); force((n) => n + 1); }}
        onRedo={() => { paneRef()?.redo(); force((n) => n + 1); }}
        onClear={() => paneRef()?.clear()}
      />

      <View style={styles.focusHint}>
        <Text style={styles.focusHintText}>
          Tools act on: {focused === "notebook" ? "Notebook" : "PDF"}
        </Text>
      </View>

      {linkingNote || linkMode ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={1}>
            {linkingNote
              ? `Linking "${linkingNote.body || "note"}" — drag a box on the PDF`
              : "Link mode — drag a box on the PDF; a linked note appears in the notebook"}
          </Text>
          <Pressable onPress={() => { setLinkingNote(null); setLinkMode(false); }} hitSlop={8}>
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
            style={{ width: isWide ? nbW : "100%", flex: isWide ? undefined : 1 }}
            onTouchStart={() => setFocused("notebook")}
          >
            {notebookPane}
          </View>
        ) : null}
        {isWide ? (
          <GestureDetector gesture={divider}>
            <View style={styles.divider}>
              <View style={styles.dividerGrip} />
            </View>
          </GestureDetector>
        ) : null}
        {showPdf ? (
          <View
            style={{ width: isWide ? pdfW : "100%", flex: isWide ? undefined : 1 }}
            onTouchStart={() => setFocused("pdf")}
          >
            {pdfPane}
          </View>
        ) : null}
      </View>

      <FloatingTools
        tool={tool}
        color={color}
        canUndo={!!paneRef()?.canUndo()}
        canRedo={!!paneRef()?.canRedo()}
        onTool={setTool}
        onUndo={() => { paneRef()?.undo(); force((n) => n + 1); }}
        onRedo={() => { paneRef()?.redo(); force((n) => n + 1); }}
      />

      {isWide && activeLink ? <ConnectorLine from={noteAnchor} to={regionAnchor} /> : null}

      <Modal
        visible={linksOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLinksOpen(false)}
      >
        <Screen>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Connected PDF regions ({linkCards.length})</Text>
            <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              {selLinks.length >= 2 ? (
                <Pressable onPress={groupSelected}>
                  <Text style={styles.hBtn}>⛓ Group ({selLinks.length})</Text>
                </Pressable>
              ) : null}
              {groups.length ? (
                <Pressable onPress={() => { setGroups([]); setSelLinks([]); }}>
                  <Text style={[styles.hBtn, { color: C.danger }]}>Ungroup all</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setLinksOpen(false)}>
                <Text style={styles.hBtn}>Done</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
            {linkCards.length === 0 ? (
              <Text style={styles.muted}>
                No links yet. Tap 🔗 Link, then drag a box on the PDF.
              </Text>
            ) : null}
            {linkCards.map(({ link, noteId, body }) => (
              <View
                key={link.id}
                style={[
                  styles.card,
                  groupColors[link.id] ? { borderColor: groupColors[link.id], borderWidth: 2 } : null,
                ]}
              >
                <View style={styles.cardTop}>
                  <Pressable
                    onPress={() => toggleSel(link.id)}
                    style={[styles.check, selLinks.includes(link.id) && styles.checkOn]}
                  >
                    <Text style={styles.checkTxt}>{selLinks.includes(link.id) ? "✓" : ""}</Text>
                  </Pressable>
                  <Text style={styles.cardPage}>PDF page {link.pdf_page}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    <Pressable
                      onPress={() => {
                        setLinksOpen(false);
                        jumpToLink(link);
                      }}
                    >
                      <Text style={styles.cardAction}>Jump</Text>
                    </Pressable>
                    <Pressable onPress={() => unlink(noteId, link.id)}>
                      <Text style={[styles.cardAction, { color: C.danger }]}>Unlink</Text>
                    </Pressable>
                  </View>
                </View>
                <TextInput
                  defaultValue={body}
                  onChangeText={(t) => editLinkedBody(noteId, t)}
                  placeholder="Type the linked annotation…"
                  placeholderTextColor={C.sub}
                  multiline
                  style={styles.cardInput}
                />
              </View>
            ))}
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: C.sub, textAlign: "center", lineHeight: 20 },
  pdfBar: { flexGrow: 0, backgroundColor: C.card, borderBottomWidth: 1, borderColor: C.line },
  pdfTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  pdfTabOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  pdfTabIcon: { fontSize: 12 },
  pdfTabText: { fontSize: 12, fontWeight: "700", color: C.sub },
  tabs: { flexDirection: "row", backgroundColor: C.card, borderBottomWidth: 1, borderColor: C.line },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderColor: "transparent" },
  tabOn: { borderColor: C.brand },
  tabText: { fontWeight: "700", color: C.sub },
  divider: {
    width: 10,
    backgroundColor: C.bg,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerGrip: { width: 3, height: 44, borderRadius: 999, backgroundColor: C.sub },
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
  hBtn: { color: C.brand, fontWeight: "700", fontSize: 14 },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  panelTitle: { fontSize: 16, fontWeight: "800", color: C.ink },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    gap: 8,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.sub,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: C.brand, borderColor: C.brand },
  checkTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  cardPage: { fontWeight: "700", color: C.ink, fontSize: 12 },
  cardAction: { color: C.brand, fontWeight: "700", fontSize: 13 },
  cardInput: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    textAlignVertical: "top",
    color: C.ink,
  },
});
