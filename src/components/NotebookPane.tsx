import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { FlatList, StyleSheet, Text, View, type ViewToken } from "react-native";
import {
  Notebooks,
  Notes,
  SubscriptionRequiredError,
  type NoteLinkOut,
  type NoteOut,
  type PageOut,
} from "@/lib/api";
import { DrawTool, parseAnn, serialiseAnn } from "@/lib/annot";
import { usePageInk } from "@/lib/usePageInk";
import { PageSurface } from "./PageSurface";
import { NotesLayer } from "./NotesLayer";
import { NoteEditorModal } from "./NoteEditorModal";
import type { PaneHandle } from "./PdfPane";
import { C } from "@/lib/theme";

const RATIO = 1.414;

export interface NotebookPaneHandle extends PaneHandle {
  reloadNotes: () => void;
}

export interface NotebookPaneProps {
  notebookId: string;
  pages: PageOut[];
  defaultRuling: string;
  width: number;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  pencilOnly: boolean;
  onSavingChange?: (busy: boolean) => void;
  onActiveIndexChange?: (index: number) => void;
  onFocus?: () => void;
  onAccountRedirect?: () => void;
  onNotesChange?: (notes: NoteOut[]) => void;
  onRequestLink?: (note: NoteOut) => void;
  onJumpToLink?: (link: NoteLinkOut) => void;
}

export const NotebookPane = forwardRef<NotebookPaneHandle, NotebookPaneProps>(
  function NotebookPane(
    {
      notebookId,
      pages,
      defaultRuling,
      width,
      tool,
      color,
      strokeWidth,
      pencilOnly,
      onSavingChange,
      onActiveIndexChange,
      onFocus,
      onAccountRedirect,
      onNotesChange,
      onRequestLink,
      onJumpToLink,
    },
    ref,
  ) {
    const pageW = Math.min(width - 24, 820);
    const pageH = pageW * RATIO;
    const listRef = useRef<FlatList<PageOut>>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeId = pages[activeIndex]?.id ?? pages[0]?.id ?? "";

    const [notes, setNotes] = useState<NoteOut[]>([]);
    const [editing, setEditing] = useState<NoteOut | null>(null);
    const moveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const ink = usePageInk(async (key, ann) => {
      try {
        await Notebooks.patchPage(notebookId, String(key), { strokes_json: serialiseAnn(ann) });
      } catch (e) {
        if (e instanceof SubscriptionRequiredError) onAccountRedirect?.();
      }
    });

    useEffect(() => {
      for (const p of pages) ink.hydrate(p.id, parseAnn(p.strokes_json));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages]);

    useEffect(() => onSavingChange?.(ink.savingCount > 0), [ink.savingCount, onSavingChange]);

    const reloadNotes = useCallback(async () => {
      try {
        const rows = await Notes.list(notebookId);
        setNotes(rows);
        onNotesChange?.(rows);
      } catch {
        /* ignore */
      }
    }, [notebookId, onNotesChange]);

    useEffect(() => {
      reloadNotes();
    }, [reloadNotes]);

    useImperativeHandle(ref, () => ({
      undo: () => ink.undo(activeId),
      redo: () => ink.redo(activeId),
      clear: () => ink.clear(activeId),
      canUndo: () => ink.canUndo(activeId),
      canRedo: () => ink.canRedo(activeId),
      scrollTo: (n: number) => {
        const idx = Math.max(0, Math.min(pages.length - 1, n));
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
      },
      reloadNotes,
    }));

    const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
        onActiveIndexChange?.(first.index);
      }
    }).current;

    const createNote = useCallback(
      async (pageId: string, fx: number, fy: number) => {
        try {
          await Notes.create(notebookId, {
            page_id: pageId,
            body: "",
            display_mode: "sticky",
            color: "#f4d35e",
            x: fx,
            y: fy,
            w: 0.28,
            h: 0.14,
          });
          reloadNotes();
        } catch (e) {
          if (e instanceof SubscriptionRequiredError) onAccountRedirect?.();
        }
      },
      [notebookId, reloadNotes, onAccountRedirect],
    );

    const moveNote = useCallback(
      (noteId: string, fx: number, fy: number) => {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, x: fx, y: fy } : n)));
        clearTimeout(moveTimers.current[noteId]);
        moveTimers.current[noteId] = setTimeout(() => {
          Notes.patch(noteId, { x: fx, y: fy }).catch(() => {});
        }, 500);
      },
      [],
    );

    const saveNote = useCallback(
      async (patch: { body: string; color: string }) => {
        if (!editing) return;
        setNotes((prev) =>
          prev.map((n) => (n.id === editing.id ? { ...n, ...patch } : n)),
        );
        try {
          await Notes.patch(editing.id, patch);
        } catch {
          /* ignore */
        }
        setEditing(null);
        reloadNotes();
      },
      [editing, reloadNotes],
    );

    const deleteNote = useCallback(async () => {
      if (!editing) return;
      const id = editing.id;
      setEditing(null);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      try {
        await Notes.remove(id);
      } catch {
        /* ignore */
      }
      reloadNotes();
    }, [editing, reloadNotes]);

    const unlink = useCallback(
      async (link: NoteLinkOut) => {
        try {
          await Notes.unlink(link.note_id, link.id);
        } catch {
          /* ignore */
        }
        const fresh = await Notes.list(notebookId).catch(() => notes);
        setNotes(fresh);
        onNotesChange?.(fresh);
        setEditing((cur) => fresh.find((n) => n.id === cur?.id) ?? null);
      },
      [notebookId, notes, onNotesChange],
    );

    const notesActive = tool === "sticky" || tool === "select";

    const data = useMemo(() => pages, [pages]);

    return (
      <>
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 12, gap: 16, alignItems: "center" }}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
          windowSize={5}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToOffset({
                offset: (pageH + 16) * info.index,
                animated: true,
              });
            }, 60);
          }}
          renderItem={({ item, index }) => (
            <View style={[styles.pageCard, { width: pageW, height: pageH }]}>
              <View onTouchStart={onFocus} style={StyleSheet.absoluteFill}>
                <PageSurface
                  width={pageW}
                  height={pageH}
                  ann={ink.annOf(item.id)}
                  onCommit={(next) => ink.commit(item.id, next)}
                  tool={tool}
                  color={color}
                  strokeWidth={strokeWidth}
                  pencilOnly={pencilOnly}
                  rulingType={item.page_type || defaultRuling}
                />
              </View>
              <NotesLayer
                pageId={item.id}
                pageW={pageW}
                pageH={pageH}
                notes={notes}
                active={notesActive}
                onCreate={createNote}
                onMove={moveNote}
                onEdit={setEditing}
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {index + 1} / {pages.length}
                </Text>
              </View>
            </View>
          )}
        />

        <NoteEditorModal
          note={editing}
          onClose={() => setEditing(null)}
          onSave={saveNote}
          onDelete={deleteNote}
          onRequestLink={onRequestLink && editing ? () => onRequestLink(editing) : undefined}
          onJumpToLink={onJumpToLink}
          onUnlink={unlink}
        />
      </>
    );
  },
);

const styles = StyleSheet.create({
  pageCard: {
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  badge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(15,23,42,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
