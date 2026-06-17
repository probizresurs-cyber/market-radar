"use client";

import { useRouter } from "next/navigation";
import { LoginView } from "@/components/views/LoginView";
import { COLORS } from "@/lib/colors";
import { PRODUCT_BY_SCOPE, type ProductScope } from "@/lib/products";

// Страница входа отдельного продукта. Авторизация — по аккаунту MarketRadar
// (тот же /api/auth/login и cookie). После входа остаёмся в этом продукте.
export function ProductLogin({ scope }: { scope: ProductScope }) {
  const router = useRouter();
  const route = PRODUCT_BY_SCOPE[scope]?.route ?? "/";
  return (
    <LoginView
      c={COLORS.dark}
      onSuccess={() => router.replace(route)}
      onRegister={() => router.push("/?register=1")}
      onBack={() => router.push("/")}
    />
  );
}
