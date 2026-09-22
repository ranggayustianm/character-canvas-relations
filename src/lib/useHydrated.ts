"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Hydration gate for localStorage-backed UI: false during SSR/prerender and
 * the first client render, true afterwards. Replaces the mounted-state-in-
 * effect pattern, which risks cascading renders (react-hooks/set-state-in-effect).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
