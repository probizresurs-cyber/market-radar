"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginView } from "@/components/views/LoginView";
import { COLORS } from "@/lib/colors";
import { PRODUCT_BY_SCOPE, type ProductScope } from "@/lib/products";

// Страница входа отдельного продукта. Авторизация — по аккаунту MarketRadar
// (тот же /api/auth/login и cookie).
//
// «Связка с аккаунтом» (SSO): если у юзера уже есть активная сессия MarketRadar
// — НЕ показываем форму повторно, а сразу заводим в продукт. Форма логина
// видна только тем, кто ещё не авторизован.
export function ProductLogin({ scope }: { scope: ProductScope }) {
  const router = useRouter();
  // Общий вход (/login, scope=core) ведёт на хаб продуктов /main; вход на
  // конкретный продукт (/seo-geo/login и т.п.) — сразу в этот продукт.
  const target = scope === "core" ? "/main" : (PRODUCT_BY_SCOPE[scope]?.route ?? "/");
  const route = target;
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = await r.json();
        if (!cancelled && j.ok && j.user) {
          router.replace(route); // уже залогинен — сразу в продукт
          return;
        }
      } catch { /* сервер недоступен — покажем форму */ }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [route, router]);

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--background)", color: "var(--muted-foreground)",
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: 15,
      }}>
        Проверяем сессию…
      </div>
    );
  }

  return (
    <LoginView
      c={COLORS.dark}
      onSuccess={() => router.replace(route)}
      onRegister={() => router.push("/?register=1")}
      onBack={() => router.push("/")}
    />
  );
}
