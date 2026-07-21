// IndexedDB-backed storage for Pord documents.
//
// Why IndexedDB instead of localStorage?
// - localStorage has a strict ~5–10 MB per-origin quota. A document with a few
//   base64-embedded images can easily exceed that, and any localStorage.setItem
//   call will throw QuotaExceededError — which is exactly what was happening
//   with manual snapshots: autosave (a single state blob) barely fit, but
//   adding a second, third, ... snapshot copy tipped it over.
// - IndexedDB has a much larger quota (often 50 MB to several GB, depending on
//   browser/disk), stores binary data efficiently, and supports async I/O so
//   the UI thread never blocks on a save.
//
// This module exposes a small promise-based API used by the page component:
//   - saveAutosaveState(state)    — debounced or periodic autosave
//   - loadAutosaveState()         — restore on page load
//   - saveSnapshot(snap)          — manual "save current version" action
//   - loadAllSnapshots()          — list snapshots for the panel
//   - deleteSnapshotById(id)      — remove one
//   - renameSnapshotById(id, name)
//
// All functions are SSR-safe (no-op when typeof indexedDB === "undefined").

import type { Block, DocMeta, SavedSnapshot } from "./doc-types";

const DB_NAME = "pord-doc";
const DB_VERSION = 1;
const STORE_AUTOSAVE = "autosave"; // single-record store keyed by "current"
const STORE_SNAPSHOTS = "snapshots"; // keyed by snapshot.id

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUTOSAVE)) {
        db.createObjectStore(STORE_AUTOSAVE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const os = transaction.objectStore(store);
        const request = fn(os);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Autosave (single-record store, keyed by "current")
// ─────────────────────────────────────────────────────────────────────────────

export interface AutosaveState {
  key: "current";
  meta: DocMeta;
  blocks: Block[];
  savedAt: number; // epoch millis
}

export async function saveAutosaveState(
  meta: DocMeta,
  blocks: Block[]
): Promise<void> {
  const record: AutosaveState = {
    key: "current",
    meta,
    blocks,
    savedAt: Date.now(),
  };
  await tx(STORE_AUTOSAVE, "readwrite", (s) => s.put(record));
}

export async function loadAutosaveState(): Promise<AutosaveState | null> {
  try {
    const rec = await tx<AutosaveState | undefined>(
      STORE_AUTOSAVE,
      "readonly",
      (s) => s.get("current")
    );
    return rec ?? null;
  } catch {
    return null;
  }
}

export async function clearAutosaveState(): Promise<void> {
  await tx(STORE_AUTOSAVE, "readwrite", (s) => s.delete("current"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots (keyed by snapshot.id)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SNAPSHOTS = 50;

export async function saveSnapshotToDb(
  name: string,
  meta: DocMeta,
  blocks: Block[]
): Promise<SavedSnapshot> {
  const snap: SavedSnapshot = {
    id:
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `snap_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    name: name.trim() || "بدون نام",
    savedAt: Date.now(),
    meta: { ...meta },
    blocks: JSON.parse(JSON.stringify(blocks)) as Block[],
  };
  await tx(STORE_SNAPSHOTS, "readwrite", (s) => s.put(snap));
  // Cap total snapshot count. Load all, sort by savedAt desc, delete the tail.
  try {
    const all = await loadAllSnapshots();
    if (all.length > MAX_SNAPSHOTS) {
      const sorted = [...all].sort((a, b) => b.savedAt - a.savedAt);
      const toDelete = sorted.slice(MAX_SNAPSHOTS);
      await Promise.all(
        toDelete.map((s) =>
          tx(STORE_SNAPSHOTS, "readwrite", (store) => store.delete(s.id))
        )
      );
    }
  } catch {
    // non-fatal
  }
  return snap;
}

export async function loadAllSnapshots(): Promise<SavedSnapshot[]> {
  try {
    const all = await tx<SavedSnapshot[]>(
      STORE_SNAPSHOTS,
      "readonly",
      (s) => s.getAll()
    );
    // Sort newest first for consistent UI ordering
    return (all ?? []).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function deleteSnapshotFromDb(id: string): Promise<void> {
  await tx(STORE_SNAPSHOTS, "readwrite", (s) => s.delete(id));
}

export async function renameSnapshotInDb(
  id: string,
  newName: string
): Promise<void> {
  const existing = await tx<SavedSnapshot | undefined>(
    STORE_SNAPSHOTS,
    "readonly",
    (s) => s.get(id)
  );
  if (!existing) return;
  existing.name = newName.trim() || existing.name;
  await tx(STORE_SNAPSHOTS, "readwrite", (s) => s.put(existing));
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON file export/import (a single .pord.json file containing the full
// document — meta, blocks, and all embedded base64 image data — so users can
// round-trip a project between machines/browsers without losing images).
// ─────────────────────────────────────────────────────────────────────────────

export interface PordFile {
  format: "pord";
  version: 1;
  exportedAt: string; // ISO date
  meta: DocMeta;
  blocks: Block[];
}

export function buildPordFile(meta: DocMeta, blocks: Block[]): PordFile {
  return {
    format: "pord",
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: { ...meta },
    blocks: JSON.parse(JSON.stringify(blocks)) as Block[],
  };
}

export function exportPordFile(meta: DocMeta, blocks: Block[]): void {
  const file = buildPordFile(meta, blocks);
  // Pretty-print so the file is human-inspectable, but images stay as one line.
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob(["\ufeff", json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeTitle = (meta.title || "document")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  a.href = url;
  a.download = `${safeTitle || "document"}.pord.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface PordImportResult {
  ok: boolean;
  meta?: DocMeta;
  blocks?: Block[];
  error?: string;
}

export function importPordFile(file: File): Promise<PordImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text) as Partial<PordFile>;
        if (!parsed || parsed.format !== "pord" || !Array.isArray(parsed.blocks)) {
          resolve({
            ok: false,
            error:
              "این فایل با فرمت Pord نیست (کلید format یا blocks پیدا نشد).",
          });
          return;
        }
        if (!parsed.meta || typeof parsed.meta !== "object") {
          resolve({ ok: false, error: "بخش meta در فایل پیدا نشد." });
          return;
        }
        resolve({
          ok: true,
          meta: parsed.meta as DocMeta,
          blocks: parsed.blocks as Block[],
        });
      } catch (e) {
        resolve({
          ok: false,
          error: `خطا در خواندن فایل JSON: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
      }
    };
    reader.onerror = () => resolve({ ok: false, error: "خواندن فایل ناموفق بود." });
    reader.readAsText(file);
  });
}
