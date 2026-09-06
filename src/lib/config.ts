import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Where the app talks to the backend.
 *
 * The web client only ever calls its own origin at `/api/*`, and Next.js
 * proxies that to the FastAPI backend. On device there is no proxy, so this
 * must point at something the iPad/iPhone can actually reach:
 *
 *   • Same Wi-Fi as the laptop:   http://192.168.1.8:8010       (no /api)
 *   • Public Cloudflare tunnel:   https://xxxx.trycloudflare.com/api
 *
 * Priority: value saved in-app (Server settings on the login screen)  →
 *           EXPO_PUBLIC_API_BASE baked at build time  →  FALLBACK below.
 *
 * Cloudflare "quick" tunnels hand out a NEW URL every restart, so setting it
 * in-app (no rebuild) is usually the right move.
 */
// Default assumes the backend runs on the original laptop (LAN 192.168.1.8,
// `./run.sh` binds 0.0.0.0) and the iPad is on the same Wi-Fi. Change it once
// in-app: login screen → "⚙︎ Server settings". NSAllowsLocalNetworking
// (app.json) permits this http:// address without a tunnel.
const FALLBACK = "http://192.168.1.8:8010";
const STORE_KEY = "ktt.apiBase";

const buildTime = process.env.EXPO_PUBLIC_API_BASE?.trim();
const compileDefault = (buildTime && buildTime.length ? buildTime : FALLBACK).replace(/\/+$/, "");

let runtimeBase: string | null = null;

/** Synchronous resolver used everywhere. Call loadApiBase() once at startup. */
export function resolveApiBase(): string {
  return runtimeBase ?? compileDefault;
}

/** Back-compat alias — some modules import API_BASE directly. */
export const API_BASE = compileDefault;

export async function loadApiBase(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(STORE_KEY);
    if (v && v.trim()) runtimeBase = v.trim().replace(/\/+$/, "");
  } catch {
    /* ignore */
  }
  return resolveApiBase();
}

export async function saveApiBase(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, "");
  runtimeBase = clean || null;
  try {
    if (clean) await AsyncStorage.setItem(STORE_KEY, clean);
    else await AsyncStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

export function isDefaultApiBase(): boolean {
  return runtimeBase === null;
}

/** Turn a backend-relative path into an absolute URL against the live base. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = resolveApiBase();
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}
