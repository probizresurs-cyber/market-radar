"use client";

/**
 * /kp-sozdavaya — отдельная страница КП под конкретного проспекта (sozdavay.art /
 * sozdavay-barelief.ru), не зависящая от того, какой «Профиль» сейчас активен
 * в основном приложении. В отличие от /kp (который всегда показывает АКТИВНЫЙ
 * профиль), эта страница ищет профиль по имени "Sozdavaya" и показывает его —
 * так можно спокойно работать над основным анализом на /kp, пока здесь лежит
 * отдельный КП под этого проспекта.
 *
 * Данные появятся здесь только после того, как в аккаунте создан профиль
 * с именем "Sozdavaya" и в нём проведён реальный анализ сайта — никаких
 * заглушек/выдуманных цифр до этого момента.
 */
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { KpProposal } from "@/components/kp/KpProposal";
import { getProfiles, profileLsSuffix, profileServerSuffix } from "@/lib/profiles";

const PROFILE_NAME_MATCH = /sozdav/i;

export default function KpSozdavayaPage() {
  const [company, setCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
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

      const profile = getProfiles(uid).find((p) => PROFILE_NAME_MATCH.test(p.name));
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
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "var(--muted-foreground)" }}>Готовим коммерческое предложение…</div>;
  }

  if (!profileFound || !company) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", color: "var(--foreground)", padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>КП для Sozdavaya пока не готов</div>
          <div style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.5 }}>
            {!profileFound
              ? <>Создайте профиль с именем «Sozdavaya» (переключатель профилей в сайдбаре → «Добавить профиль») и проведите в нём анализ сайта sozdavay.art — после этого здесь появится КП.</>
              : <>Профиль «Sozdavaya» создан, но анализ сайта в нём ещё не запускался. Запустите «Новый анализ» внутри этого профиля — КП соберётся автоматически.</>}
          </div>
          <a href="/" className="ds-btn ds-btn-primary" style={{ display: "inline-flex", height: 44, padding: "0 22px", alignItems: "center" }}>На платформу →</a>
        </div>
      </div>
    );
  }

  return (
    <KpProposal
      company={company} competitors={competitors}
      onShare={handleShare} sharing={sharing} shareLink={shareLink}
      shareCopied={shareCopied} shareError={shareError} onCopyShareLink={handleCopyShareLink}
    />
  );
}
