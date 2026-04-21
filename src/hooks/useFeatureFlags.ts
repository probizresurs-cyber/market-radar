"use client";

import { useEffect, useState } from "react";

export interface FeatureFlagsState {
  map: Record<string, boolean>;        // id → enabled
  labels: Record<string, string>;      // id → human label (для ComingSoonView)
  descriptions: Record<string, string>;// id → description
  loaded: boolean;
}

/**
 * Тянет карту включённых модулей один раз при маунте.
 * Используется в page.tsx чтобы подменять отключённые вкладки на ComingSoonView.
 */
export function useFeatureFlags(): FeatureFlagsState {
  const [state, setState] = useState<FeatureFlagsState>({
    map: {},
    labels: {},
    descriptions: {},
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/features", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.ok) return;
        const map: Record<string, boolean> = d.map ?? {};
        const labels: Record<string, string> = {};
        const descriptions: Record<string, string> = {};
        (d.features ?? []).forEach((f: { id: string; label: string; description?: string | null }) => {
          labels[f.id] = f.label;
          if (f.description) descriptions[f.id] = f.description;
        });
        setState({ map, labels, descriptions, loaded: true });
      })
      .catch(() => { if (!cancelled) setState(s => ({ ...s, loaded: true })); });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/** true если модуль включён (дефолт — включён, пока не загрузили) */
export function isFeatureOn(state: FeatureFlagsState, featureId: string): boolean {
  if (!state.loaded) return true;
  return state.map[featureId] !== false;
}
