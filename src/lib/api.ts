import * as SecureStore from "expo-secure-store";
import { resolveApiBase } from "./config";

/* ------------------------------------------------------------------ *
 * Token storage
 * ------------------------------------------------------------------ */
const TOKEN_KEY = "ktt.token";
let memToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken;
  try {
    memToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    memToken = null;
  }
  return memToken;
}

export async function setToken(token: string | null): Promise<void> {
  memToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* ignore keychain errors — memToken still holds it for this session */
  }
}

export function getTokenSync(): string | null {
  return memToken;
}

/* ------------------------------------------------------------------ *
 * Low-level request
 * ------------------------------------------------------------------ */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Thrown on HTTP 402 — trial/subscription expired. UI routes to /account. */
export class SubscriptionRequiredError extends ApiError {
  constructor(message = "Your access has expired") {
    super(402, message, "subscription_required");
  }
}

type Opts = Omit<RequestInit, "body"> & { body?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const token = await loadToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form as unknown as BodyInit;
  } else if (opts.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${resolveApiBase()}${path}`, { ...opts, headers, body });
  } catch (e) {
    throw new ApiError(0, "Network error — check the API address / Wi-Fi.");
  }

  if (res.status === 402) {
    let msg = "Your access has expired";
    try {
      msg = (await res.json())?.detail?.message ?? msg;
    } catch {
      /* noop */
    }
    throw new SubscriptionRequiredError(msg);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail =
      (data as { detail?: unknown })?.detail ?? (typeof data === "string" ? data : res.statusText);
    const message =
      typeof detail === "string" ? detail : (detail as { message?: string })?.message ?? "Request failed";
    const code = (detail as { code?: string })?.code;
    throw new ApiError(res.status, message, code);
  }

  return data as T;
}

/** Quick reachability probe for a candidate base URL (Server settings). */
export async function pingHealth(base: string): Promise<{ ok: boolean; detail: string }> {
  const url = `${base.trim().replace(/\/+$/, "")}/health`;
  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    return { ok: res.ok, detail: res.ok ? text || `${res.status}` : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
  }
}

/* ------------------------------------------------------------------ *
 * Types (subset of the backend Pydantic schemas)
 * ------------------------------------------------------------------ */
export interface UserOut {
  id: string;
  email: string;
  username: string;
  display_name: string;
  created_at: string;
}
export interface SubscriptionOut {
  plan: string;
  status: string;
  is_active: boolean;
  days_left: number;
  trial_end: string | null;
  current_period_end: string | null;
}
export interface AuthOut {
  token: string;
  user: UserOut;
  subscription: SubscriptionOut;
}

export interface Cover {
  id: string;
  name: string;
  type: string;
  value: string;
}
export interface PageType {
  id: string;
  name: string;
  desc: string;
}
export interface Catalog {
  covers: Cover[];
  page_types: PageType[];
}

export interface PageOut {
  id: string;
  notebook_id: string;
  order: number;
  page_type: string;
  strokes_json: string;
  texts_json: string;
  background_pdf_id: string | null;
  background_pdf_page: number;
  updated_at: string;
}
export interface NotebookOut {
  id: string;
  title: string;
  cover: string;
  page_type: string;
  created_at: string;
  updated_at: string;
}
export interface NotebookDetail extends NotebookOut {
  pages: PageOut[];
}

export interface PdfOut {
  id: string;
  notebook_id: string | null;
  filename: string;
  url: string;
  size: number;
  page_count: number;
  meta_json: string;
  uploaded_at: string;
}
export interface PdfAnnOut {
  pdf_id: string;
  page: number;
  strokes_json: string;
}

export type NoteDisplayMode = "sticky" | "linked" | "region";
export interface NoteLinkOut {
  id: string;
  note_id: string;
  pdf_id: string;
  pdf_page: number;
  rx: number;
  ry: number;
  rw: number;
  rh: number;
}
export interface NoteOut {
  id: string;
  notebook_id: string;
  page_id: string | null;
  body: string;
  display_mode: NoteDisplayMode;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  links: NoteLinkOut[];
  updated_at: string;
}

export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
}
export interface GroupOut {
  id: string;
  name: string;
  owner_id: string;
  members: PublicUser[];
  created_at: string;
}
export interface MessageOut {
  id: string;
  sender: PublicUser;
  body: string;
  attachment_url: string | null;
  deleted: boolean;
  created_at: string;
  edited_at: string | null;
}
export interface DMThreadOut {
  id: string;
  other: PublicUser;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */
export const Auth = {
  signup: (email: string, password: string, display_name: string) =>
    api<AuthOut>("/auth/signup", { method: "POST", body: { email, password, display_name } }),
  login: (email: string, password: string) =>
    api<AuthOut>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => api<AuthOut>("/auth/me"),
};

export const Billing = {
  plans: () => api<{ plans: unknown }>("/billing/plans"),
  status: () => api<SubscriptionOut>("/billing/status"),
  subscribe: (plan: "monthly" | "yearly") =>
    api<SubscriptionOut>("/billing/subscribe", {
      method: "POST",
      body: { plan, card_name: "Demo Card" },
    }),
};

export const Notebooks = {
  catalog: () => api<Catalog>("/catalog"),
  list: () => api<NotebookOut[]>("/notebooks"),
  create: (title: string, cover: string, page_type: string) =>
    api<NotebookDetail>("/notebooks", { method: "POST", body: { title, cover, page_type } }),
  get: (id: string) => api<NotebookDetail>(`/notebooks/${id}`),
  patch: (id: string, patch: Partial<Pick<NotebookOut, "title" | "cover" | "page_type">>) =>
    api<NotebookDetail>(`/notebooks/${id}`, { method: "PATCH", body: patch }),
  remove: (id: string) => api<void>(`/notebooks/${id}`, { method: "DELETE" }),
  addPage: (id: string, page_type: string) =>
    api<PageOut>(`/notebooks/${id}/pages`, { method: "POST", body: { page_type } }),
  patchPage: (
    id: string,
    pageId: string,
    patch: Partial<Pick<PageOut, "strokes_json" | "texts_json" | "page_type" | "order">>,
  ) => api<PageOut>(`/notebooks/${id}/pages/${pageId}`, { method: "PATCH", body: patch }),
  reorder: (id: string, order: string[]) =>
    api<NotebookDetail>(`/notebooks/${id}/pages/reorder`, { method: "POST", body: { order } }),
  removePage: (id: string, pageId: string) =>
    api<void>(`/notebooks/${id}/pages/${pageId}`, { method: "DELETE" }),
};

export const Pdfs = {
  listForNotebook: (notebookId: string) => api<PdfOut[]>(`/notebooks/${notebookId}/pdfs`),
  listAll: () => api<PdfOut[]>("/pdfs"),
  upload: (notebookId: string, file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    // React Native's FormData accepts this { uri, name, type } shape.
    form.append("file", file as unknown as Blob);
    return api<PdfOut>(`/notebooks/${notebookId}/pdfs`, { method: "POST", form });
  },
  pageImageUrl: (pdfId: string, page: number) =>
    `${resolveApiBase()}/pdfs/${pdfId}/pages/${page}/render`,
  getAnnotations: (pdfId: string, page: number) =>
    api<PdfAnnOut>(`/pdfs/${pdfId}/annotations/${page}`),
  saveAnnotations: (pdfId: string, page: number, strokes_json: string) =>
    api<PdfAnnOut>(`/pdfs/${pdfId}/annotations/${page}`, { method: "PUT", body: { strokes_json } }),
  remove: (pdfId: string) => api<void>(`/pdfs/${pdfId}`, { method: "DELETE" }),
  summary: (pdfId: string) =>
    api<{ summary: string; mode: string; sentences: number }>(`/pdfs/${pdfId}/summary`, {
      method: "POST",
    }),
  setMeta: (pdfId: string, meta_json: string) =>
    api<PdfOut>(`/pdfs/${pdfId}/meta`, { method: "PATCH", body: { meta_json } }),
};

export const Notes = {
  list: (notebookId: string) => api<NoteOut[]>(`/notebooks/${notebookId}/notes`),
  create: (
    notebookId: string,
    note: {
      page_id?: string | null;
      body?: string;
      display_mode?: NoteDisplayMode;
      color?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
    },
  ) => api<NoteOut>(`/notebooks/${notebookId}/notes`, { method: "POST", body: note }),
  patch: (
    noteId: string,
    patch: Partial<{
      body: string;
      display_mode: NoteDisplayMode;
      color: string;
      x: number;
      y: number;
      w: number;
      h: number;
      page_id: string | null;
    }>,
  ) => api<NoteOut>(`/notes/${noteId}`, { method: "PATCH", body: patch }),
  remove: (noteId: string) => api<void>(`/notes/${noteId}`, { method: "DELETE" }),
  link: (
    noteId: string,
    link: { pdf_id: string; pdf_page: number; rx: number; ry: number; rw: number; rh: number },
  ) => api<NoteLinkOut>(`/notes/${noteId}/links`, { method: "POST", body: link }),
  unlink: (noteId: string, linkId: string) =>
    api<void>(`/notes/${noteId}/links/${linkId}`, { method: "DELETE" }),
};

export const Chat = {
  me: () => api<PublicUser>("/chat/me"),
  search: (q: string) => api<PublicUser[]>(`/chat/users/search?q=${encodeURIComponent(q)}`),
  groups: () => api<GroupOut[]>("/chat/groups"),
  createGroup: (name: string, usernames: string[]) =>
    api<GroupOut>("/chat/groups", { method: "POST", body: { name, usernames } }),
  addMember: (groupId: string, username: string) =>
    api<GroupOut>(`/chat/groups/${groupId}/members?username=${encodeURIComponent(username)}`, {
      method: "POST",
    }),
  groupMessages: (groupId: string, after?: string) =>
    api<MessageOut[]>(`/chat/groups/${groupId}/messages${after ? `?after=${after}` : ""}`),
  postGroup: (groupId: string, body: string, attachment_url?: string) =>
    api<MessageOut>(`/chat/groups/${groupId}/messages`, {
      method: "POST",
      body: { body, attachment_url: attachment_url ?? null },
    }),
  editGroup: (groupId: string, messageId: string, body: string) =>
    api<MessageOut>(`/chat/groups/${groupId}/messages/${messageId}`, {
      method: "PATCH",
      body: { body },
    }),
  deleteGroup: (groupId: string, messageId: string) =>
    api<MessageOut>(`/chat/groups/${groupId}/messages/${messageId}`, { method: "DELETE" }),
  dms: () => api<DMThreadOut[]>("/chat/dms"),
  openDm: (username: string) =>
    api<DMThreadOut>(`/chat/dms/${encodeURIComponent(username)}`, { method: "POST" }),
  dmMessages: (threadId: string) => api<MessageOut[]>(`/chat/dms/thread/${threadId}/messages`),
  postDm: (threadId: string, body: string) =>
    api<MessageOut>(`/chat/dms/thread/${threadId}/messages`, { method: "POST", body: { body } }),
};
