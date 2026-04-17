"use client";

/**
 * Dashboard руководителя — приватная страница /owner-dashboard.
 * Тонкий враппер: загружает данные (сервер → localStorage fallback) и передаёт
 * их в общий компонент OwnerDashboardContent (тот же используется в /share/[id]).
 */

import { useEffect, useState } from "react";
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

export default function OwnerDashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<DashboardData>({
    company: null,
    competitors: [],
    ta: null,
    smm: null,
    content: null,
    brandbook: null,
    cjm: null,
    benchmarks: null,
  });

  useEffect(() => {
    (async () => {
      let uid: string | null = null;
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = await r.json();
        if (j.ok && j.user) { uid = j.user.id; setUserId(uid); }
      } catch { /* ignore */ }
      setAuthChecked(true);

      // 1) Сервер (основной источник)
      let loadedFromServer = false;
      try {
        const res = await fetch("/api/data", { credentials: "include" });
        const json = await res.json();
        if (json.ok && json.data) {
          const d = json.data as Record<string, unknown>;
          setData({
            company: (d.company as AnalysisResult) ?? null,
            competitors: Array.isArray(d.competitors) ? (d.competitors as AnalysisResult[]) : [],
            ta: (d.ta as TAResult) ?? null,
            smm: (d.smm as SMMResult) ?? null,
            content: (d.content as ContentStore) ?? null,
            brandbook: (d.brandbook as BrandBook) ?? null,
            cjm: (d.cjm as DashboardData["cjm"]) ?? null,
            benchmarks: (d.benchmarks as DashboardData["benchmarks"]) ?? null,
          });
          if (d.company) loadedFromServer = true;
        }
      } catch { /* ignore */ }

      // 2) Fallback: localStorage
      if (!loadedFromServer && uid) {
        try {
          const ls = <T,>(key: string): T | null => {
            const raw = localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T) : null;
          };
          setData({
            company: ls<AnalysisResult>(`mr_company_${uid}`),
            competitors: ls<AnalysisResult[]>(`mr_competitors_${uid}`) ?? [],
            ta: ls<TAResult>(`mr_ta_${uid}`),
            smm: ls<SMMResult>(`mr_smm_${uid}`),
            content: ls<ContentStore>(`mr_content_${uid}`),
            brandbook: ls<BrandBook>(`mr_brandbook_${uid}`),
            cjm: ls<DashboardData["cjm"]>(`mr_cjm_${uid}`) as DashboardData["cjm"],
            benchmarks: ls<DashboardData["benchmarks"]>(`mr_benchmarks_${uid}`) as DashboardData["benchmarks"],
          });
        } catch { /* ignore */ }
      }
    })();
  }, []);

  if (!authChecked) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "#8A8C9E" }}>Проверка доступа…</div>;
  }

  if (!userId) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", background: "#F7F7F8" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F1123", marginBottom: 8 }}>Нужен вход</div>
          <div style={{ fontSize: 14, color: "#55576B", marginBottom: 24 }}>Войдите чтобы увидеть дашборд руководителя</div>
          <a href="/" style={{ display: "inline-block", padding: "12px 24px", background: "#534AB7", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            На платформу →
          </a>
        </div>
      </div>
    );
  }

  return <OwnerDashboardContent data={data} mode="private" />;
}
