"use client";

/**
 * /kp — интерактивное коммерческое предложение по анализу сайта.
 * Публичная ссылка: marketradar24.ru/kp. Тонкий враппер: грузит анализ текущего
 * пользователя (сервер → localStorage fallback) и отдаёт в KpProposal.
 * Если данных нет — KpProposal показывает заглушку со ссылкой на платформу.
 */
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { KpProposal } from "@/components/kp/KpProposal";

export default function KpPage() {
  const [company, setCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      let uid: string | null = null;
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = await r.json();
        if (j.ok && j.user) uid = j.user.id;
      } catch { /* ignore */ }

      // 1) Сервер
      let ok = false;
      try {
        const res = await fetch("/api/data", { credentials: "include" });
        const json = await res.json();
        if (json.ok && json.data?.company) {
          setCompany(json.data.company as AnalysisResult);
          setCompetitors(Array.isArray(json.data.competitors) ? (json.data.competitors as AnalysisResult[]) : []);
          ok = true;
        }
      } catch { /* ignore */ }

      // 2) localStorage fallback
      if (!ok && uid) {
        try {
          const raw = localStorage.getItem(`mr_company_${uid}`);
          if (raw) setCompany(JSON.parse(raw) as AnalysisResult);
          const rawC = localStorage.getItem(`mr_competitors_${uid}`);
          if (rawC) setCompetitors(JSON.parse(rawC) as AnalysisResult[]);
        } catch { /* ignore */ }
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "var(--muted-foreground)" }}>Готовим коммерческое предложение…</div>;
  }

  return <KpProposal company={company} competitors={competitors} />;
}
