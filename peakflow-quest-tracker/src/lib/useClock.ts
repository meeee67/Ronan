"use client";

import { useSyncExternalStore } from "react";

function createClockStore(intervalMs: number) {
  let current = Date.now();
  const listeners = new Set<() => void>();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  return {
    subscribe(callback: () => void) {
      listeners.add(callback);
      if (intervalId === null) {
        intervalId = setInterval(() => {
          current = Date.now();
          listeners.forEach((l) => l());
        }, intervalMs);
      }
      return () => {
        listeners.delete(callback);
        if (listeners.size === 0 && intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
    },
    getSnapshot() {
      return current;
    },
    getServerSnapshot() {
      return null;
    },
  };
}

const stores = new Map<number, ReturnType<typeof createClockStore>>();

function getStore(intervalMs: number) {
  let store = stores.get(intervalMs);
  if (!store) {
    store = createClockStore(intervalMs);
    stores.set(intervalMs, store);
  }
  return store;
}

/** Returns the current timestamp (ms), ticking every `intervalMs`. `null` until mounted on the client. */
export function useClock(intervalMs = 1000) {
  const store = getStore(intervalMs);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
