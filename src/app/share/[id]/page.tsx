"use client";

/**
 * Публичная страница дашборда по ссылке /share/[id].
 * Не требует авторизации. Читает snapshot из /api/share/[id] и рендерит
 * тот же OwnerDashboardContent что и приватный /owner-dashboard, но в mode="public".
 */

import { use, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { ContentPlan, BrandBook } from "@/lib/content-types";
import {
  OwnerDashboardContent,
  type DashboardData,
} from "@/components/dashboard/OwnerDashboardContent";

interface ContentStore {
  plan: ContentPlan | null;
  posts: unknown[];
  reels: unknown[];
}

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<{
    status: "loading" | "ok" | "error";
    error?: string;
    data?: DashboardData;
    createdAt?: string;
  }>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/${id}`);
        const json = await res.json();
        if (!json.ok) {
          setState({ status: "error", error: json.error || "Ссылка недоступна" });
          return;
        }
        const snap = (json.snapshot ?? {}) as Record<string, unknown>;
        setState({
          status: "ok",
          createdAt: json.createdAt,
          data: {
            company: (snap.company as AnalysisResult) ?? null,
            competitors: Array.isArray(snap.competitors) ? (snap.competitors as AnalysisResult[]) : [],
            ta: (snap.ta as TAResult) ?? null,
            smm: (snap.smm as SMMResult) ?? null,
            content: (snap.content as ContentStore) ?? null,
            brandbook: (snap.brandbook as BrandBook) ?? null,
            cjm: (snap.cjm as DashboardData["cjm"]) ?? null,
            benchmarks: (snap.benchmarks as DashboardData["benchmarks"]) ?? null,
          },
        });
      } catch (e) {
        setState({ status: "error", error: e instanceof Error ? e.message : "Ошибка сети" });
      }
    })();
  }, [id]);

  if (state.status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif", background: "#F7F7F8", color: "#8A8C9E" }}>
        Загружаем дашборд…
      </div>
    );
  }

  if (state.status === "error" || !state.data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif", background: "#F7F7F8" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F1123", marginBottom: 8 }}>Ссылка недоступна</div>
          <div style={{ fontSize: 14, color: "#55576B", marginBottom: 24 }}>
            {state.error ?? "Проверьте правильность ссылки или попросите владельца создать новую."}
          </div>
          <a href="/" style={{ display: "inline-block", padding: "12px 24px", background: "#534AB7", color: "#fff",
            borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            На MarketRadar →
          </a>
        </div>
      </div>
    );
  }

  return <OwnerDashboardContent data={state.data} mode="public" createdAt={state.createdAt} />;
}
