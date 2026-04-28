"use client";

import { useEffect } from "react";

/**
 * Automatically reloads the page when the browser has a stale JS bundle
 * from a previous deployment (Next.js "Failed to find Server Action" error).
 *
 * This happens when:
 * 1. User has the app open in their browser
 * 2. A new version is deployed on the server
 * 3. The old JS tries to call server actions that no longer exist
 *
 * Fix: detect the error → wait 1s → hard reload to get fresh assets.
 */
export function DeploymentRefresher() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isStaleDeploymentError(event.message)) {
        scheduleReload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg =
        typeof event.reason === "string"
          ? event.reason
          : event.reason?.message ?? "";
      if (isStaleDeploymentError(msg)) {
        scheduleReload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}

function isStaleDeploymentError(msg: string): boolean {
  return (
    msg.includes("Failed to find Server Action") ||
    msg.includes("from an older or newer deployment") ||
    msg.includes("NEXT_NOT_FOUND") ||
    msg.includes("ChunkLoadError")
  );
}

let reloadScheduled = false;
function scheduleReload() {
  if (reloadScheduled) return;
  reloadScheduled = true;
  console.info("[MarketRadar] Новая версия обнаружена — обновляем страницу...");
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}
