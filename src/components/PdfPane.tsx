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
import { Image } from "expo-image";
import { Pdfs, SubscriptionRequiredError, type NoteLinkOut } from "@/lib/api";
import { DrawTool, parseAnn, serialiseAnn } from "@/lib/annot";
import { usePageInk } from "@/lib/usePageInk";
import { PageSurface } from "./PageSurface";
import { RegionPicker } from "./RegionPicker";
import { ZoomableView } from "./ZoomableView";
import { C } from "@/lib/theme";

export interface PaneHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  scrollTo: (n: number) => void;
}

export interface PdfPaneProps {
  pdfId: string;
  pageCount: number;
  token: string | null;
  width: number;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  pencilOnly: boolean;
  shapeAssist?: boolean;
  onActivePageChange?: (page: number) => void;
  onSavingChange?: (busy: boolean) => void;
  onFocus?: () => void;
  /** Region to flash (e.g. a note's linked area). */
  highlight?: { page: number; rx: number; ry: number; rw: number; rh: number } | null;
  /** All link regions to outline faintly on their pages. */
  regions?: NoteLinkOut[];
  /** Per-link outline colour (from the Connected-regions grouping). */
  groupColors?: Record<string, string>;
  onAccountRedirect?: () => void;
  /** Region-pick mode: drawing a box reports it instead of inking. */
  linkMode?: boolean;
  onPickRegion?: (page: number, r: { rx: number; ry: number; rw: number; rh: number }) => void;
  /** Connector line: report the window-space centre of this link's region. */
  trackLinkId?: string | null;
  onLinkAnchor?: (xy: { x: number; y: number } | null) => void;
}

export const PdfPane = forwardRef<PaneHandle, PdfPaneProps>(function PdfPane(
  {
    pdfId,
    pageCount,
    token,
    width,
    tool,
    color,
    strokeWidth,
    pencilOnly,
    shapeAssist,
    onActivePageChange,
    onSavingChange,
    onFocus,
    highlight,
    regions,
    groupColors,
    onAccountRedirect,
    linkMode,
    onPickRegion,
    trackLinkId,
    onLinkAnchor,
  },
  ref,
) {
  const pageW = Math.min(width - 24, 900);
  const listRef = useRef<FlatList<number>>(null);
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [activePage, setActivePage] = useState(1);
  const [zoomCount, setZoomCount] = useState(0);
  const loaded = useRef<Set<number>>(new Set());
  const bumpZoom = useCallback(
    (z: boolean) => setZoomCount((n) => Math.max(0, n + (z ? 1 : -1))),
    [],
  );

  // Connector-line anchor: poll the tracked region's window position.
  const regionRefs = useRef<Map<string, View>>(new Map());
  useEffect(() => {
    if (!trackLinkId || !onLinkAnchor) return;
    const tick = () => {
      const v = regionRefs.current.get(trackLinkId);
      if (!v) return onLinkAnchor(null);
      v.measureInWindow((x, y, w, h) => onLinkAnchor({ x: x + w / 2, y: y + h / 2 }));
    };
    tick();
    const h = setInterval(tick, 250);
    return () => {
      clearInterval(h);
      onLinkAnchor(null);
    };
  }, [trackLinkId, onLinkAnchor]);

  const ink = usePageInk(async (key, ann) => {
    try {
      await Pdfs.saveAnnotations(pdfId, Number(key), serialiseAnn(ann));
    } catch (e) {
      if (e instanceof SubscriptionRequiredError) onAccountRedirect?.();
    }
  });

  useEffect(() => onSavingChange?.(ink.savingCount > 0), [ink.savingCount, onSavingChange]);

  useImperativeHandle(ref, () => ({
    undo: () => ink.undo(activePage),
    redo: () => ink.redo(activePage),
    clear: () => ink.clear(activePage),
    canUndo: () => ink.canUndo(activePage),
    canRedo: () => ink.canRedo(activePage),
    scrollTo: (n: number) => {
      const idx = Math.max(0, Math.min(pageCount - 1, n - 1));
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
    },
  }));

  const fetchPage = useCallback(
    async (page: number) => {
      if (loaded.current.has(page)) return;
      loaded.current.add(page);
      try {
        const res = await Pdfs.getAnnotations(pdfId, page);
        ink.hydrate(page, parseAnn(res.strokes_json));
      } catch {
        ink.hydrate(page, { items: [] });
      }
    },
    [pdfId, ink],
  );
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const v of viewableItems) fetchRef.current(v.item as number);
    const top = viewableItems[0]?.item as number | undefined;
    if (top) {
      setActivePage(top);
      onActivePageChange?.(top);
    }
  }).current;

  const pages = useMemo(
    () => Array.from({ length: Math.max(1, pageCount) }, (_, i) => i + 1),
    [pageCount],
  );
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  return (
    <FlatList
      ref={listRef}
      data={pages}
      keyExtractor={(p) => String(p)}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, gap: 16, alignItems: "center" }}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
      initialNumToRender={2}
      windowSize={5}
      scrollEnabled={zoomCount === 0}
      onScrollToIndexFailed={(info) => {
        setTimeout(() => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }, 60);
      }}
      renderItem={({ item: page }) => {
        const ratio = ratios[page] ?? 1.414;
        const pageH = pageW * ratio;
        const flash =
          highlight && highlight.page === page ? highlight : null;
        const onPage = (regions ?? []).filter((r) => r.pdf_page === page);
        return (
          <View style={[styles.pageCard, { width: pageW, height: pageH }]}>
            <ZoomableView width={pageW} height={pageH} onZoomChange={bumpZoom}>
              <Image
                style={StyleSheet.absoluteFill}
                source={{ uri: Pdfs.pageImageUrl(pdfId, page), headers }}
                contentFit="contain"
                transition={120}
                onLoad={(e) => {
                  const { width: iw, height: ih } = e.source;
                  if (iw && ih) {
                    const r = ih / iw;
                    setRatios((prev) => (prev[page] === r ? prev : { ...prev, [page]: r }));
                  }
                }}
              />

              {onPage.map((r) => (
                <View
                  key={r.id}
                  ref={(v) => {
                    if (v) regionRefs.current.set(r.id, v);
                    else regionRefs.current.delete(r.id);
                  }}
                  collapsable={false}
                  pointerEvents="none"
                  style={[
                    styles.region,
                    r.id === trackLinkId && styles.regionActive,
                    groupColors?.[r.id] ? { borderColor: groupColors[r.id], borderWidth: 2.5 } : null,
                    {
                      left: r.rx * pageW,
                      top: r.ry * pageH,
                      width: r.rw * pageW,
                      height: r.rh * pageH,
                    },
                  ]}
                />
              ))}
              {flash ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.flash,
                    {
                      left: flash.rx * pageW,
                      top: flash.ry * pageH,
                      width: flash.rw * pageW,
                      height: flash.rh * pageH,
                    },
                  ]}
                />
              ) : null}

              <View onTouchStart={onFocus} style={StyleSheet.absoluteFill}>
                <PageSurface
                  width={pageW}
                  height={pageH}
                  ann={ink.annOf(page)}
                  onCommit={(next) => ink.commit(page, next)}
                  tool={tool}
                  color={color}
                  strokeWidth={strokeWidth}
                  pencilOnly={pencilOnly}

                  shapeAssist={shapeAssist}
                />
              </View>

              {linkMode ? (
                <RegionPicker
                  width={pageW}
                  height={pageH}
                  onPick={(r) => onPickRegion?.(page, r)}
                />
              ) : null}
            </ZoomableView>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {page} / {pageCount}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
});

const styles = StyleSheet.create({
  pageCard: {
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  region: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(79,70,229,0.5)",
    backgroundColor: "rgba(79,70,229,0.08)",
    borderRadius: 4,
  },
  regionActive: {
    borderColor: C.amber,
    backgroundColor: "rgba(217,119,6,0.14)",
  },
  flash: {
    position: "absolute",
    borderWidth: 2.5,
    borderColor: C.amber,
    backgroundColor: "rgba(217,119,6,0.16)",
    borderRadius: 4,
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
