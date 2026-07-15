"use client";

/**
 * /kp — интерактивный анализ сайта для потенциального клиента.
 * Публичная ссылка: marketradar24.ru/kp. Тонкий враппер: грузит анализ текущего
 * пользователя (сервер → localStorage fallback) и отдаёт в KpProposal.
 * Если данных нет — KpProposal показывает заглушку со ссылкой на платформу.
 *
 * Учитывает активный ПРОФИЛЬ (см. lib/profiles.ts) — если переключиться на
 * отдельный профиль (например, завести профиль под нового клиента и
 * проанализировать его сайт там), /kp покажет анализ ИМЕННО этого профиля,
 * не трогая данные «Основного». Так можно готовить анализ для прочих компаний,
 * не мешая текущему анализу.
 */
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { AIVisibilityAudit } from "@/lib/ai-visibility-types";
import { KpProposal } from "@/components/kp/KpProposal";
import { getActiveProfileId, profileLsSuffix, profileServerSuffix } from "@/lib/profiles";

export default function KpPage() {
  const [company, setCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
  const [aiVisibility, setAiVisibility] = useState<AIVisibilityAudit | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profileId, setProfileId] = useState("default");

  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleShare = async () => {
    setSharing(true); setShareError(null);
    try {
      const r = await fetch("/api/share/create", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "kp", profileId }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ошибка создания ссылки");
      const url = `${window.location.origin}/share/${j.id}`;
      setShareLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch { /* clipboard denied — ссылку покажем в баре */ }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSharing(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  };

  useEffect(() => {
    (async () => {
      let uid: string | null = null;
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = await r.json();
        if (j.ok && j.user) uid = j.user.id;
      } catch { /* ignore */ }

      // Активный профиль (см. lib/profiles.ts) — тот же, что выбран в сайдбаре AppShell.
      const activeProfileId = uid ? getActiveProfileId(uid) : "default";
      setProfileId(activeProfileId);
      const serverSuffix = profileServerSuffix(activeProfileId);
      const companyKey = `company${serverSuffix}`;
      const competitorsKey = `competitors${serverSuffix}`;

      // 1) Сервер
      let ok = false;
      try {
        const res = await fetch("/api/data", { credentials: "include" });
        const json = await res.json();
        if (json.ok && json.data?.[companyKey]) {
          setCompany(json.data[companyKey] as AnalysisResult);
          setCompetitors(Array.isArray(json.data[competitorsKey]) ? (json.data[competitorsKey] as AnalysisResult[]) : []);
          ok = true;
        }
      } catch { /* ignore */ }

      // 2) localStorage fallback
      if (!ok && uid) {
        try {
          const lsSuffix = profileLsSuffix(activeProfileId);
          const raw = localStorage.getItem(`mr_company_${uid}${lsSuffix}`);
          if (raw) setCompany(JSON.parse(raw) as AnalysisResult);
          const rawC = localStorage.getItem(`mr_competitors_${uid}${lsSuffix}`);
          if (rawC) setCompetitors(JSON.parse(rawC) as AnalysisResult[]);
        } catch { /* ignore */ }
      }

      // AI-видимость: аудиты не скоупятся по профилю (см. AIVisibilityView) —
      // берём последний завершённый по userId, как есть.
      if (uid) {
        try {
          const rawAudits = localStorage.getItem(`mr_ai_visibility_audits_${uid}`);
          if (rawAudits) {
            const audits = JSON.parse(rawAudits) as AIVisibilityAudit[];
            const done = audits.find((a) => a.status === "done");
            if (done) setAiVisibility(done);
          }
        } catch { /* ignore */ }
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "var(--muted-foreground)" }}>Готовим интерактивный анализ…</div>;
  }

  return (
    <KpProposal
      company={company} competitors={competitors} aiVisibility={aiVisibility}
      onShare={handleShare} sharing={sharing} shareLink={shareLink}
      shareCopied={shareCopied} shareError={shareError} onCopyShareLink={handleCopyShareLink}
    />
  );
}
