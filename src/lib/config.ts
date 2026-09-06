/**
 * Where the app talks to the backend.
 *
 * The web client only ever calls its own origin at `/api/*`, and Next.js
 * proxies that to the FastAPI backend. On device there is no proxy, so point
 * this straight at something reachable from the iPad/iPhone:
 *
 *   • Same Wi-Fi as the laptop:   http://192.168.1.8:8010       (no /api)
 *   • Public Cloudflare tunnel:   https://xxxx.trycloudflare.com/api
 *
 * Override without editing code by setting EXPO_PUBLIC_API_BASE, e.g.
 *   EXPO_PUBLIC_API_BASE=http://192.168.1.8:8010 npx expo start
 */
const FALLBACK = "https://discovery-match-remained-grams.trycloudflare.com/api";

const raw = process.env.EXPO_PUBLIC_API_BASE?.trim();

export const API_BASE = (raw && raw.length ? raw : FALLBACK).replace(/\/+$/, "");

/** Turn a backend-relative path (e.g. "/storage/x.pdf") into an absolute URL. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
