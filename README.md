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
| **Split workspace** — notebook + PDF together (iPad = two panes, iPhone = tab switch) | `app/(app)/workspace/[id].tsx` |
| **Link a note → PDF region** (drag a box), **jump to region** (flash), **unlink** | `RegionPicker.tsx`, `workspace/[id].tsx`, `Notes.link` / `Notes.unlink` |
| Link regions outlined on their PDF pages | `PdfPane` `regions` prop |
| Chat: user search, direct messages, groups (create + members) with `@username` | `app/(app)/chat/*` |
| Chat: **edit / delete** own group messages (long‑press) | `chat/thread.tsx` → `Chat.editGroup` / `Chat.deleteGroup` |
| Annotation model is byte‑compatible with the web (`{ items: [...] }`, 0..1 coords) | `src/lib/annot.ts` |

Coordinates are stored as fractions of the page, so a page drawn on iPad opens
identically on the web and vice‑versa (`strokes_json`).

## 1. Point it at your backend

The app talks straight to FastAPI (no Next.js proxy on device). Set the address:

```bash
# same Wi‑Fi as the laptop running ./run.sh  (note: no /api suffix)
export EXPO_PUBLIC_API_BASE=http://192.168.1.8:8010

# …or the public Cloudflare tunnel  (WITH /api, the web proxy path)
export EXPO_PUBLIC_API_BASE=https://YOURNAME.trycloudflare.com/api
```

Fallback if unset: the tunnel URL baked into `src/lib/config.ts` — change it there
or always export the variable.

If you use a plain `http://` LAN address, iOS ATS needs an exception. This repo
does not add one; use the `https://` tunnel for device builds, or add
`NSAppTransportSecurity` in `app.json` → `ios.infoPlist` for local testing.

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

- **Connector line**: on the web a line is drawn between a note and its linked
  PDF region. Here (two independently‑scrolling panes) "Jump" scrolls the PDF to
  the region and **flashes** it, with a connector banner naming the pair. A
  literal drawn line needs cross‑pane geometry tracking — not done yet.
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
