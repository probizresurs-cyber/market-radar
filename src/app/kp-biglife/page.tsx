"use client";

/**
 * /kp-biglife — интерактивный анализ под проспекта BigLife Magazine
 * (biglifemagazine.online), по механике /kp-sozdavaya:
 *   1) профиль с именем ~"biglife" под текущим логином — либо
 *   2) выделенный аккаунт клиента (env BIGLIFE_ACCOUNT_EMAIL, проверка на
 *      сервере через /api/kp-account-check — email не хранится в исходниках).
 *
 * ВАЖНО: pilotOffer здесь НЕ включён — пилотные блоки (находки с
 * доказательствами, офферы с ценами, GEO-разбор, прогноз) наполнены ручным
 * аудитом Sozdavay и к BigLife не относятся. Страница показывает честную
 * версию из реального анализа платформы; ручной пилот-слой для BigLife
 * добавится, когда будет проведён его реальный аудит.
 */
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { AIVisibilityAudit } from "@/lib/ai-visibility-types";
import { KpProposal } from "@/components/kp/KpProposal";
import { DEFAULT_PROFILE_ID, getProfiles, profileLsSuffix, profileServerSuffix } from "@/lib/profiles";

const PROFILE_NAME_MATCH = /biglife/i;

export default function KpBiglifePage() {
  const [company, setCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
  const [aiVisibility, setAiVisibility] = useState<AIVisibilityAudit | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profileFound, setProfileFound] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleShare = async () => {
    if (!profileId) return;
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

      if (!uid) { setLoaded(true); return; }

      const profiles = getProfiles(uid);
      const named = profiles.find((p) => PROFILE_NAME_MATCH.test(p.name));
      let isClientAccount = false;
      if (!named) {
        try {
          const r = await fetch("/api/kp-account-check?client=biglife", { credentials: "include" });
          const j = await r.json();
          isClientAccount = !!j.ok && !!j.isClientAccount;
        } catch { /* ignore */ }
      }
      const profile = named ?? (isClientAccount ? profiles.find((p) => p.id === DEFAULT_PROFILE_ID) : undefined);
      if (!profile) { setLoaded(true); return; }
      setProfileFound(true);
      setProfileId(profile.id);

      const serverSuffix = profileServerSuffix(profile.id);
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
      if (!ok) {
        try {
          const lsSuffix = profileLsSuffix(profile.id);
          const raw = localStorage.getItem(`mr_company_${uid}${lsSuffix}`);
          if (raw) setCompany(JSON.parse(raw) as AnalysisResult);
          const rawC = localStorage.getItem(`mr_competitors_${uid}${lsSuffix}`);
          if (rawC) setCompetitors(JSON.parse(rawC) as AnalysisResult[]);
        } catch { /* ignore */ }
      }

      // AI-видимость: последний завершённый аудит по userId (не скоупится по профилю)
      try {
        const rawAudits = localStorage.getItem(`mr_ai_visibility_audits_${uid}`);
        if (rawAudits) {
          const audits = JSON.parse(rawAudits) as AIVisibilityAudit[];
          const done = audits.find((a) => a.status === "done");
          if (done) setAiVisibility(done);
        }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "var(--muted-foreground)" }}>Готовим интерактивный анализ…</div>;
  }

  if (!profileFound || !company) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", color: "var(--foreground)", padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Анализ для BigLife пока не готов</div>
          <div style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.5 }}>
            {!profileFound
              ? <>Войдите в выделенный аккаунт клиента — либо создайте профиль с именем «BigLife» в текущем аккаунте (переключатель профилей в сайдбаре → «Добавить профиль») и проведите в нём анализ сайта biglifemagazine.online.</>
              : <>Профиль найден, но анализ сайта в нём ещё не запускался. Запустите «Новый анализ» — интерактивный анализ соберётся автоматически.</>}
          </div>
          <a href="/" className="ds-btn ds-btn-primary" style={{ display: "inline-flex", height: 44, padding: "0 22px", alignItems: "center" }}>На платформу →</a>
        </div>
      </div>
    );
  }

  return (
    <KpProposal
      company={company} competitors={competitors} aiVisibility={aiVisibility}
      onShare={handleShare} sharing={sharing} shareLink={shareLink}
      shareCopied={shareCopied} shareError={shareError} onCopyShareLink={handleCopyShareLink}
    />
  );
}
