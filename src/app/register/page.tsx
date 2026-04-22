"use client";

// Dedicated /register route — primarily used when referral links land the
// visitor here via the middleware redirect. Internally reuses RegisterView
// and hands off to "/" after success/login so the SPA in app/page.tsx
// picks up the session cookie and boots the dashboard.

import { useEffect, useState } from "react";
import { RegisterView } from "@/components/views/RegisterView";
import { COLORS } from "@/lib/colors";
import type { Theme } from "@/lib/colors";

export default function RegisterPage() {
  const [theme, setTheme] = useState<Theme>("light");
  void setTheme;

  // Honour saved theme so colours match the rest of the site
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mr_theme");
      if (saved === "light" || saved === "dark" || saved === "warm") {
        setTheme(saved as Theme);
      }
    } catch {
      // ignore
    }
  }, []);

  const c = COLORS[theme];

  return (
    <RegisterView
      c={c}
      onSuccess={() => {
        // Session cookie is set — send the user into the SPA which will
        // detect the logged-in state and show onboarding.
        window.location.href = "/";
      }}
      onLogin={() => {
        window.location.href = "/";
      }}
      onBack={() => {
        window.location.href = "/";
      }}
    />
  );
}
