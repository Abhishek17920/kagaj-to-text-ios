# Kagaj to Text — iOS / iPad app

Native app (Expo / React Native) for the same account, notebooks, PDFs and chat
as the web version. Same backend (`kagaj-to-text-back`), same login, same files.

## What's inside

| Feature | Where |
| --- | --- |
| Same login / signup (email + password), 1‑month free trial, unique `@username` | `app/(auth)/*`, `src/lib/auth.tsx` |
| Subscription (monthly / yearly demo checkout), 402 gate → Account screen | `app/(app)/account.tsx` |
| Dashboard: notebook grid, covers, page rulings on create | `app/(app)/dashboard.tsx`, `app/(app)/new.tsx` |
| Notebook editor: infinite vertical page scroll, page‑number badge, add page | `app/(app)/notebook/[id].tsx` |
| **Apple Pencil** drawing (Skia), pen / highlighter / eraser / line / arrow / box / oval / text / note / move | `src/components/DrawCanvas.tsx`, `PageSurface.tsx` |
| **Pressure-sensitive pen** — Apple Pencil force (W3C pointer events) drives a variable-width ink ribbon; finger = constant width | `DrawCanvas.tsx` `ribbonPath`, `Stroke.pressures` |
| **Adjustable eraser size** (12–60) with a live circular cursor; pen & eraser keep separate widths | `useDrawTools.ts`, `InkToolbar.tsx` |
| Compact top toolbar — tools row + animated style row (colours / widths) that slides in for drawing tools | `src/components/InkToolbar.tsx` |
| **Select tool** — tap a stroke/shape, drag to move, Duplicate / Delete | `DrawCanvas.tsx` |
| **Shape assist** — rough pen strokes snap to line / rectangle / ellipse (toggle) | `annot.ts` `recogniseShape`, `DrawCanvas.tsx` |
| **Laser pointer** — temporary red trail that fades, never saved | `DrawCanvas.tsx` |
| **Custom colour** — full hue + shade picker behind the toolbar "＋" | `src/components/ColorPicker.tsx` |
| **Pinned pen presets** — 📌 Pin the current pen+colour+width, tap to re-apply, long-press to remove (persisted) | `useDrawTools.ts`, `InkToolbar.tsx` |
| New-notebook picker shows a live **ruling preview** thumbnail per style | `src/components/Ruling.tsx` `RulingThumb`, `app/(app)/new.tsx` |
| **Palm rejection** — "Pencil only" toggle: ignores finger input (`pointerType !== STYLUS`) | `DrawCanvas.tsx` (`pan.onBegin`) |
| Per‑page undo / redo / clear | shared via `src/lib/usePageInk.ts` |
| **Drag / reorder pages** (↑ ↓ sheet) | `notebook/[id].tsx` reorder modal → `Notebooks.reorder` |
| PDF upload (Files / iCloud picker), stored on the account | `expo-document-picker`, `Pdfs.upload` |
| PDF viewer + annotation: infinite page scroll, page badges, ink saved per page | `src/components/PdfPane.tsx` |
| **PDF bookmarks** (★ a page, jump list) stored in `meta_json` | `pdf/[id].tsx` → `Pdfs.setMeta` |
| **PDF offline summary** (extractive, no LLM) | `pdf/[id].tsx` → `Pdfs.summary` |
| **Sticky notes** on notebook pages — drag to move, edit body + colour, delete | `src/components/NotesLayer.tsx`, `NoteEditorModal.tsx`, `Notes.*` |
| **Pinch-zoom + pan** on any page (1x–4x, notebook & PDF); pinch back to reset | `src/components/ZoomableView.tsx` |
| **Split workspace** — notebook + PDF together (iPad = two panes, iPhone = tab switch) | `app/(app)/workspace/[id].tsx` |
| **🔗 Link mode** in the split view — drag a box on the PDF and a linked note drops onto the notebook page (no need to pre-make a note); plus the old note→region flow | `workspace/[id].tsx`, `RegionPicker.tsx`, `Notes.link` |
| **Connected regions panel** ("Links" button) — every link listed with a page tag, editable annotation text, Jump and Unlink | `workspace/[id].tsx` |
| **Read aloud** the PDF summary (`expo-speech` TTS) | `pdf/[id].tsx` |
| **Connector line** note ↔ region (iPad split view, on "Jump"; tracks scrolling) | `src/components/ConnectorLine.tsx` |
| Link regions outlined on their PDF pages | `PdfPane` `regions` prop |
| Chat: user search, direct messages, groups (create + members) with `@username` | `app/(app)/chat/*` |
| Chat: **edit / delete** own group messages (long‑press) | `chat/thread.tsx` → `Chat.editGroup` / `Chat.deleteGroup` |
| Chat **attachments**: photo / camera / document, in‑bubble image thumbnails + lightbox, doc cards with tap‑to‑download‑then‑open | `AttachmentBubble.tsx`, `Chat.uploadAttachment` |
| Chat **voice notes** — hold the mic to record, release to send; in‑bubble player with scrubber | `chat/thread.tsx` (`expo-audio`), `AttachmentBubble.tsx` |
| Chat messages animate in (reanimated `FadeInUp`) | `chat/thread.tsx` |
| Annotation model is byte‑compatible with the web (`{ items: [...] }`, 0..1 coords) | `src/lib/annot.ts` |

Coordinates are stored as fractions of the page, so a page drawn on iPad opens
identically on the web and vice‑versa (`strokes_json`).

## 1. Point it at your backend

The app talks straight to FastAPI (no Next.js proxy on device). Set the address,
highest priority first:

1. **In-app** — login screen → **⚙︎ Server settings** → enter URL → **Test
   connection** → **Save**. Stored on device (AsyncStorage), survives restarts,
   no rebuild. Best for Cloudflare "quick" tunnels (URL changes each restart).
   Also editable from the Account screen.
2. **Build-time env** — `EXPO_PUBLIC_API_BASE=… npx expo start`.
3. **Fallback** — the constant in `src/lib/config.ts` (`http://192.168.1.8:8010`).

Address forms: `http://192.168.1.8:8010` (same Wi-Fi, **no** `/api`) or
`https://YOURNAME.trycloudflare.com/api` (tunnel, **with** `/api`).

- Backend must bind all interfaces for LAN: `kagaj-to-text-back/run.sh` passes
  `--host 0.0.0.0`. Find the laptop IP with `ip a` / `ifconfig`.
- Plain `http://` to a private IP is allowed by `NSAllowsLocalNetworking`
  (in `app.json`). iOS shows a "find devices on local network" prompt on first
  connect — tap Allow. An `https://` tunnel avoids that.

## 2. Install

```bash
cd kagaj-to-text-ios
npm install                # .npmrc sets legacy-peer-deps (react-dom peer skew)
npx expo install --fix     # aligns native package versions to the Expo SDK
```

Chat attachments/voice notes need a **backend** with `POST /chat/upload` and
`storage/chat/` serving (present in this repo's `kagaj-to-text-back`). Chat
media packages (`expo-image-picker`, `expo-audio`, `expo-sharing`) are config
plugins — run `npx expo prebuild -p ios --clean` after pulling this change.

## 3. Run on your iPad / iPhone (you have a Mac + Apple Developer account)

```bash
# generates the ios/ project from app.json
npx expo prebuild -p ios --clean

# build + install on a USB‑connected device (Apple Pencil needs a real device)
npx expo run:ios --device
```

The Skia canvas and gesture handler are native modules, so the Simulator works
for UI but **Apple Pencil / palm rejection only test on a physical iPad**.

## 4. TestFlight build (cloud, from the Mac)

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build -p ios --profile production   # signs + produces the .ipa
eas submit -p ios --latest              # uploads to App Store Connect / TestFlight
```

Set the bundle id in `app.json` (`ios.bundleIdentifier`, currently
`com.bknetworks.kagajtotext`) to one registered on your developer account.

## Parity notes / deliberate simplifications

- **Connector line**: drawn in the iPad split view when you tap "Jump" on a
  note's link — a line between the note card and its PDF region, re‑measured
  every 250 ms so it follows scrolling, auto‑clears after 4 s. On iPhone (one
  pane at a time) only the flash + banner show.
- **PDF still renders as a flat image** (`/pdfs/{id}/pages/{n}/render` PNG, needs
  poppler on the backend). No selectable text / search / copy — add
  `react-native-pdf` for that. Pinch‑zoom helps read dense pages but the raster
  softens past ~3x.
- **No voice typing** (speech‑to‑text) yet — needs a native speech module +
  `expo prebuild`.
- **Drawing** uses velocity‑independent constant width (same as the web). For
  pressure + tilt like PencilKit, add a dev‑client module such as
  `react-native-pencil-kit` and swap it behind `DrawCanvas`.
- **PDF pages** render as server PNGs (`/pdfs/{id}/pages/{n}/render`, needs
  `pdftoppm`/poppler on the backend host). For local rendering add
  `react-native-pdf` + `react-native-blob-util` and replace the `<Image>` layer.
- **Chat** is poll‑based (3 s). `attachment_url` is sent/displayed if present but
  there is no in‑app uploader for chat files (the backend has no chat‑upload
  route). DM edit/delete isn't in the backend, so it's group‑only.
- **Note x/y**: stored as a page fraction; legacy web rows using pixels
  (value > 1.5) are divided by 800 on read.
- **Bookmarks / page markers**: implemented per‑PDF via `meta_json`; the legacy
  FTP‑path `/legacy/pdf-page-marker` endpoints are not used.
