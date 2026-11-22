"use client";

/**
 * Saved events.
 *
 * Signed out: kept on this device (localStorage).
 * Signed in: kept in the account (favorites table). On sign-in the device's
 * saves are merged into the account once, then the device copy mirrors the
 * account and every toggle is written through to the server.
 */
import { useEffect, useSyncExternalStore } from "react";
import { setFavorite, syncFavorites } from "@/app/favorites-actions";

const KEY = "eventhub:saved";
const listeners = new Set<() => void>();
let cache: string[] | null = null;
let accountId: string | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(ids: string[]) {
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage full or blocked: keep in memory for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: string[] = [];
export function useSaved() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleSaved(id: string) {
  const ids = read();
  const saving = !ids.includes(id);
  write(saving ? [id, ...ids] : ids.filter((x) => x !== id));
  if (accountId) {
    setFavorite(id, saving).then((r) => {
      // The server refused (event gone, session ended): put the device copy back.
      if (!r.ok && accountId) write(saving ? read().filter((x) => x !== id) : [id, ...read()]);
    }, () => {});
  }
}

/**
 * Mounted once (in the header). Follows the session: merges on sign-in,
 * clears the device copy on sign-out so the next person on this device
 * doesn't see the account's saves.
 */
export function useSavedAccountSync(userId: string | null | undefined, pending: boolean) {
  useEffect(() => {
    if (pending) return;
    if (userId && userId !== accountId) {
      accountId = userId;
      syncFavorites(read()).then((ids) => {
        if (ids && accountId === userId) write(ids);
      }, () => {});
    } else if (!userId && accountId) {
      accountId = null;
      write([]);
    }
  }, [userId, pending]);
}
