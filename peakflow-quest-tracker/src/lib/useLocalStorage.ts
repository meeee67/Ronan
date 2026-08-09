"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, callback: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(callback);
  return () => {
    set!.delete(callback);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string) {
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // ignore quota / privacy-mode errors
  }
}

/** Not yet mounted on the client — used to distinguish "no value" from "not hydrated". */
const NOT_HYDRATED = undefined;

export function useLocalStorage<T>(key: string, initialValue: T) {
  const subscribeToKey = useCallback((callback: () => void) => subscribe(key, callback), [key]);
  const getSnapshot = useCallback(() => readRaw(key), [key]);
  const getServerSnapshot = useCallback(() => NOT_HYDRATED, []);

  const raw = useSyncExternalStore(subscribeToKey, getSnapshot, getServerSnapshot);
  const hydrated = raw !== NOT_HYDRATED;

  const value = useMemo<T>(() => {
    if (!hydrated || raw === null) return initialValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  }, [raw, hydrated, initialValue]);

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const currentRaw = readRaw(key);
      let prev = initialValue;
      if (currentRaw !== null) {
        try {
          prev = JSON.parse(currentRaw) as T;
        } catch {
          prev = initialValue;
        }
      }
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      writeRaw(key, JSON.stringify(next));
      emit(key);
    },
    [key, initialValue]
  );

  return [value, setValue, hydrated] as const;
}
