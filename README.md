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
| **Apple Pencil** drawing (Skia), pen / highlighter / eraser / line / arrow / box / oval / text | `src/components/DrawCanvas.tsx`, `PageSurface.tsx` |
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
| **Link a note → PDF region** (drag a box), **jump to region** (flash), **unlink** | `RegionPicker.tsx`, `workspace/[id].tsx`, `Notes.link` / `Notes.unlink` |
| **Connector line** note ↔ region (iPad split view, on "Jump"; tracks scrolling) | `src/components/ConnectorLine.tsx` |
| Link regions outlined on their PDF pages | `PdfPane` `regions` prop |
| Chat: user search, direct messages, groups (create + members) with `@username` | `app/(app)/chat/*` |
| Chat: **edit / delete** own group messages (long‑press) | `chat/thread.tsx` → `Chat.editGroup` / `Chat.deleteGroup` |
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
npm install
npx expo install --fix     # aligns native package versions to the Expo SDK
```

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
