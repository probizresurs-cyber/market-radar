"use client";

/**
 * FetchPatcher — клиентский компонент-инициализатор, который патчит
 * глобальный window.fetch при загрузке клиента. Импорт fetch-patch
 * выполняется как side-effect — патч ставится один раз при первом
 * рендере.
 *
 * Подключается в RootLayout рядом с DeploymentRefresher.
 */

import { useEffect } from "react";

export function FetchPatcher() {
  useEffect(() => {
    // Динамический import как side-effect — patch применится только
    // в клиенте, ни SSR ни Static Generation не задеваются.
    void import("@/lib/fetch-patch");
  }, []);
  return null;
}
