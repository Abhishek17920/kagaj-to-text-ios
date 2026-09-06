import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { Attachment } from "@/lib/api";
import { absoluteUrl } from "@/lib/config";
import { C } from "@/lib/theme";

const fmtSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

function AudioAttachment({ url, mine, duration }: { url: string; mine: boolean; duration?: number | null }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const total = status?.duration || duration || 0;
  const pos = status?.currentTime || 0;
  const pct = total ? Math.min(1, pos / total) : 0;
  const playing = !!status?.playing;

  return (
    <View style={styles.audioRow}>
      <Pressable
        onPress={() => (playing ? player.pause() : player.play())}
        style={[styles.playBtn, mine && { backgroundColor: "rgba(255,255,255,0.25)" }]}
      >
        <Text style={[styles.playGlyph, mine && { color: "#fff" }]}>{playing ? "❚❚" : "▶"}</Text>
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={[styles.track, mine && { backgroundColor: "rgba(255,255,255,0.3)" }]}>
          <View
            style={[
              styles.trackFill,
              { width: `${pct * 100}%`, backgroundColor: mine ? "#fff" : C.brand },
            ]}
          />
        </View>
        <Text style={[styles.audioTime, mine && { color: "rgba(255,255,255,0.85)" }]}>
          {fmtTime(playing || pos ? pos : total)}
        </Text>
      </View>
    </View>
  );
}

export function AttachmentBubble({ att, mine }: { att: Attachment; mine: boolean }) {
  const url = absoluteUrl(att.url);
  const [full, setFull] = useState(false);
  const [dl, setDl] = useState<"idle" | "working" | "done">("idle");
  const [localUri, setLocalUri] = useState<string | null>(null);

  if (att.kind === "image") {
    return (
      <>
        <Pressable onPress={() => setFull(true)}>
          <Image source={{ uri: url }} style={styles.image} contentFit="cover" transition={120} />
        </Pressable>
        <Modal visible={full} transparent onRequestClose={() => setFull(false)}>
          <Pressable style={styles.lightbox} onPress={() => setFull(false)}>
            <Image source={{ uri: url }} style={styles.lightboxImg} contentFit="contain" />
          </Pressable>
        </Modal>
      </>
    );
  }

  if (att.kind === "audio") {
    return <AudioAttachment url={url} mine={mine} duration={att.duration} />;
  }

  // pdf / video / generic file — show a card, download on demand
  const download = async () => {
    if (dl === "working") return;
    if (localUri) {
      await Sharing.shareAsync(localUri).catch(() => {});
      return;
    }
    setDl("working");
    try {
      const dest = new File(Paths.document, att.name || "download");
      const out = await File.downloadFileAsync(url, dest);
      setLocalUri(out.uri);
      setDl("done");
      await Sharing.shareAsync(out.uri).catch(() => {});
    } catch {
      setDl("idle");
    }
  };

  const glyph = att.kind === "pdf" ? "📕" : att.kind === "video" ? "🎬" : "📄";
  return (
    <Pressable
      onPress={download}
      style={[styles.fileCard, mine && { backgroundColor: "rgba(255,255,255,0.15)" }]}
    >
      <Text style={styles.fileGlyph}>{glyph}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fileName, mine && { color: "#fff" }]} numberOfLines={1}>
          {att.name}
        </Text>
        <Text style={[styles.fileMeta, mine && { color: "rgba(255,255,255,0.8)" }]}>
          {fmtSize(att.size)} ·{" "}
          {dl === "working"
            ? "Downloading…"
            : dl === "done" || localUri
              ? "Saved — tap to open"
              : "Tap to download"}
        </Text>
      </View>
      {dl === "working" ? <ActivityIndicator size="small" color={mine ? "#fff" : C.brand} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: 200, height: 200, borderRadius: 10, backgroundColor: C.line },
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImg: { width: "100%", height: "100%" },
  audioRow: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 180, paddingVertical: 2 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: C.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  playGlyph: { fontSize: 13, color: C.brand, fontWeight: "800" },
  track: { height: 4, borderRadius: 999, backgroundColor: C.line, overflow: "hidden" },
  trackFill: { height: 4, borderRadius: 999 },
  audioTime: { fontSize: 10, color: C.sub, fontWeight: "600" },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 10,
    minWidth: 200,
  },
  fileGlyph: { fontSize: 22 },
  fileName: { fontWeight: "700", color: C.ink, fontSize: 13 },
  fileMeta: { fontSize: 11, color: C.sub, marginTop: 1 },
});
