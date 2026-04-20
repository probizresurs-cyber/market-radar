"use client";

import React, { useState, useEffect } from "react";
import { LayoutDashboard, Users, Sword, BookOpen, BarChart2, Settings, Menu, ChevronRight, X } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult, TASegment } from "@/lib/ta-types";
import type { SMMResult, SMMSocialLinks, SMMRealStats } from "@/lib/smm-types";
import type { ContentPlan, ContentPostIdea, ContentReelIdea, GeneratedPost, GeneratedReel, AvatarSettings, ReferenceImage, BrandBook, PostMetrics, ReelMetrics, GeneratedStory, TovCheckResult, TovIssue, PresentationStyle } from "@/lib/content-types";
import type { Review, ReviewAnalysis } from "@/lib/review-types";

// ─── Shared modules (extracted from this file) ─────────────────────────────────
import { COLORS, type Theme, type Colors } from "@/lib/colors";
import { type UserAccount, NICHE_COMPETITORS, syncToServer, loadAllFromServer, authGetCurrentUser, authSetCurrentUser, sendTgNotification } from "@/lib/user";
import { SOURCES_FREE } from "@/lib/data/sources";

// ─── Extracted view components ────────────────────────────────────────────────
import { LandingPageView } from "@/components/views/LandingPageView";
import { RegisterView } from "@/components/views/RegisterView";
import { LoginView } from "@/components/views/LoginView";
import { OnboardingView } from "@/components/views/OnboardingView";
import { LandingView } from "@/components/views/LandingView";
import { LoadingView } from "@/components/views/LoadingView";

// ─── Extracted UI components ──────────────────────────────────────────────────
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { RadarChart } from "@/components/ui/RadarChart";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { KeysoDashboardBlock } from "@/components/ui/KeysoDashboardBlock";
import { PreviousAnalysesView } from "@/components/views/PreviousAnalysesView";
import { DashboardView } from "@/components/views/DashboardView";
import { CompetitorsView } from "@/components/views/CompetitorsView";
import { CompetitorProfileView } from "@/components/views/CompetitorProfileView";
import { CompareView } from "@/components/views/CompareView";
import { InsightsView } from "@/components/views/InsightsView";
import { ReportsView } from "@/components/views/ReportsView";
import { SourcesView } from "@/components/views/SourcesView";

type AnyMetrics = PostMetrics & ReelMetrics;

// ============================================================
// New Analysis View (inside dashboard sidebar)
// ============================================================

function NewAnalysisView({ c, onAnalyze, isAnalyzing }: { c: Colors; onAnalyze: (url: string) => Promise<void>; isAnalyzing: boolean }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isAnalyzing) return;
    setError(null);
    try {
      await onAnalyze(url.trim());
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Новый анализ</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 24px" }}>Введите URL сайта для анализа. Результат будет добавлен в дашборд и список конкурентов.</p>
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)" }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="example.ru" disabled={isAnalyzing}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${error ? "var(--destructive)" : "var(--border)"}`, background: "var(--background)", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={isAnalyzing || !url.trim()}
              style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", opacity: isAnalyzing || !url.trim() ? 0.65 : 1, fontFamily: "inherit" }}>
              {isAnalyzing ? "Анализ…" : "Анализировать →"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: "var(--destructive)", fontSize: 13 }}>{error}</div>}
          {isAnalyzing && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <style>{`@keyframes mr-spin2 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 16, height: 16, border: `2px solid var(--muted)`, borderTop: `2px solid var(--primary)`, borderRadius: "50%", animation: "mr-spin2 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: "var(--foreground-secondary)" }}>Анализируем сайт…</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}












import { SettingsView } from "@/components/views/SettingsView";
import { NewTAView, TAEmptyDashboard, TADashboardView } from "@/components/views/TAViews";
import { BrandSuggestionsView } from "@/components/views/BrandSuggestionsView";
import { NewSMMView, SMMEmptyDashboard, SMMDashboardView } from "@/components/views/SMMViews";

import { ContentEmptyView, NewContentPlanView, ContentPlanView } from "@/components/views/ContentPlanView";
import { GeneratedPostsView } from "@/components/views/GeneratedPostsView";
import { GeneratedReelsView } from "@/components/views/GeneratedReelsView";
import { ContentAnalyticsView, ROICalculatorView } from "@/components/views/ContentAnalyticsView";
import { ImageReferencePanel } from "@/components/ui/ImageReferencePanel";
import { BrandBookPanel } from "@/components/ui/BrandBookPanel";
import { AvatarSettingsPanel } from "@/components/ui/AvatarSettingsPanel";

// ============================================================
// Presentation Builder View
// ============================================================

import { LandingGeneratorView } from "@/components/views/LandingGeneratorView";
import { PresentationView } from "@/components/views/PresentationView";
import { ReviewsView } from "@/components/views/ReviewsView";
import { StoriesView } from "@/components/views/StoriesView";
import { CJMView, BenchmarksView } from "@/components/views/CJMBenchmarks";
import { SidebarComponent, MobileBottomNav } from "@/components/views/SidebarComponent";
import { SEOArticlesView } from "@/components/views/SEOArticlesView";
import type { NavItem, NavSection } from "@/lib/nav";
import { NAV_SECTIONS } from "@/lib/nav";


// ============================================================
// Main App
// ============================================================

export default function MarketRadarDashboard() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("mr_theme", t); } catch { /* ignore */ }
      const root = document.documentElement;
      root.classList.remove("dark", "warm");
      if (t !== "light") root.classList.add(t);
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("mr_theme") as Theme | null;
      if (saved && saved in COLORS) { setThemeState(saved); }
      else {
        // default: respect OS preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const def: Theme = prefersDark ? "dark" : "light";
        setThemeState(def);
        document.documentElement.classList.remove("dark", "warm");
        if (def !== "light") document.documentElement.classList.add(def);
      }
    } catch { /* ignore */ }
  }, []);
  const [appScreen, setAppScreen] = useState<"landing" | "register" | "login" | "onboarding" | "app">("landing");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeNav, setActiveNav] = useState("new-analysis");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleNavClick = React.useCallback((id: string) => {
    if (id === "owner-dashboard") {
      if (typeof window !== "undefined") window.open("/owner-dashboard", "_blank");
      return;
    }
    setActiveNav(id);
  }, []);
  const setActiveNavMobile = React.useCallback((id: string) => {
    if (id === "owner-dashboard") {
      if (typeof window !== "undefined") window.open("/owner-dashboard", "_blank");
      setMobileMenuOpen(false);
      return;
    }
    setActiveNav(id); setMobileMenuOpen(false);
  }, []);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [myCompany, setMyCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<number | null>(null);
  const [taAnalysis, setTaAnalysis] = useState<TAResult | null>(null);
  const [isTAAnalyzing, setIsTAAnalyzing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cjmData, setCjmData] = useState<any | null>(null);
  const [isCJMGenerating, setIsCJMGenerating] = useState(false);
  const [cjmError, setCjmError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [benchmarksData, setBenchmarksData] = useState<any | null>(null);
  const [isBenchmarksGenerating, setIsBenchmarksGenerating] = useState(false);
  const [benchmarksError, setBenchmarksError] = useState<string | null>(null);
  const [smmAnalysis, setSmmAnalysis] = useState<SMMResult | null>(null);
  const [isSMMAnalyzing, setIsSMMAnalyzing] = useState(false);
  const [contentPlan, setContentPlan] = useState<ContentPlan | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [generatedReels, setGeneratedReels] = useState<GeneratedReel[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatingPostId, setGeneratingPostId] = useState<string | null>(null);
  const [generatingReelId, setGeneratingReelId] = useState<string | null>(null);
  const [generatingVideoFor, setGeneratingVideoFor] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings>({
    avatarId: "",
    voiceId: "",
    avatarDescription: "",
    voiceDescription: "",
    aspect: "portrait",
  });
  const [brandBook, setBrandBook] = useState<BrandBook>({
    brandName: "",
    tagline: "",
    mission: "",
    colors: [],
    fontHeader: "",
    fontBody: "",
    toneOfVoice: [],
    forbiddenWords: [],
    goodPhrases: [],
    visualStyle: "",
  });
  const [generatedStories, setGeneratedStories] = useState<GeneratedStory[]>([]);
  const [analysisHistory, setAnalysisHistory] = useState<Array<AnalysisResult & { analyzedAt: string }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brandSuggestions, setBrandSuggestions] = useState<any | null>(null);
  const c = COLORS[theme];

  // Apply server/localStorage data to React state — shared by initApp and post-login
  const applyUserData = React.useCallback((data: Record<string, unknown>, uid: string) => {
    const get = (key: string) => data[key] ?? null;

    // Reset all state first to prevent stale data from previous session
    setMyCompany(null); setCompetitors([]); setTaAnalysis(null);
    setCjmData(null); setBenchmarksData(null); setSmmAnalysis(null);
    setContentPlan(null); setGeneratedPosts([]); setGeneratedReels([]);
    setGeneratedStories([]); setAnalysisHistory([]); setBrandSuggestions(null);

    const company = get("company") ?? JSON.parse(localStorage.getItem(`mr_company_${uid}`) ?? "null");
    if (company) { setMyCompany(company as AnalysisResult); setStatus("done"); setActiveNav("dashboard"); }

    const comps = get("competitors") ?? JSON.parse(localStorage.getItem(`mr_competitors_${uid}`) ?? "null");
    if (Array.isArray(comps) && comps.length > 0) setCompetitors(comps as AnalysisResult[]);

    const ta = get("ta") ?? JSON.parse(localStorage.getItem(`mr_ta_${uid}`) ?? "null");
    if (ta) setTaAnalysis(ta as TAResult);

    const cjm = get("cjm") ?? JSON.parse(localStorage.getItem(`mr_cjm_${uid}`) ?? "null");
    if (cjm) setCjmData(cjm);

    const bench = get("benchmarks") ?? JSON.parse(localStorage.getItem(`mr_benchmarks_${uid}`) ?? "null");
    if (bench) setBenchmarksData(bench);

    const smm = get("smm") ?? JSON.parse(localStorage.getItem(`mr_smm_${uid}`) ?? "null");
    if (smm) setSmmAnalysis(smm as SMMResult);

    const content = (get("content") ?? JSON.parse(localStorage.getItem(`mr_content_${uid}`) ?? "null")) as { plan: ContentPlan | null; posts: GeneratedPost[]; reels: GeneratedReel[] } | null;
    if (content) {
      if (content.plan) setContentPlan(content.plan);
      if (Array.isArray(content.posts)) setGeneratedPosts(content.posts);
      if (Array.isArray(content.reels)) setGeneratedReels(content.reels);
    }

    const bb = get("brandbook") ?? JSON.parse(localStorage.getItem(`mr_brandbook_${uid}`) ?? "null");
    if (bb) setBrandBook(bb as BrandBook);

    const stories = get("stories") ?? JSON.parse(localStorage.getItem(`mr_stories_${uid}`) ?? "null");
    if (Array.isArray(stories)) setGeneratedStories(stories as GeneratedStory[]);

    const history = get("history") ?? JSON.parse(localStorage.getItem(`mr_analysis_history_${uid}`) ?? "null");
    if (Array.isArray(history)) setAnalysisHistory(history as Array<AnalysisResult & { analyzedAt: string }>);

    const brandsug = get("brandsug") ?? JSON.parse(localStorage.getItem(`mr_brandsug_${uid}`) ?? "null");
    if (brandsug) setBrandSuggestions(brandsug);

    const avatar = get("avatar") ?? JSON.parse(localStorage.getItem(`mr_avatar_settings_${uid}`) ?? "null");
    if (avatar) setAvatarSettings(avatar as AvatarSettings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load server data and apply it — called after login and on init.
  // Also performs a one-time migration: if a key exists in localStorage but
  // NOT on the server, push it up so other devices can see it.
  const loadAndApplyUserData = React.useCallback(async (uid: string) => {
    let serverData: Record<string, unknown> = {};
    try {
      serverData = (await loadAllFromServer()) ?? {};
    } catch { /* keep empty */ }

    // Migration map: localStorage key prefix (without userId) → server key
    // We scan ALL localStorage keys starting with the prefix to support the
    // case where the legacy userId (old client-generated UUID) differs from
    // the new Postgres-backed userId.
    const migrations: Array<[string, string]> = [
      ["mr_company_", "company"],
      ["mr_competitors_", "competitors"],
      ["mr_ta_", "ta"],
      ["mr_cjm_", "cjm"],
      ["mr_benchmarks_", "benchmarks"],
      ["mr_smm_", "smm"],
      ["mr_content_", "content"],
      ["mr_brandbook_", "brandbook"],
      ["mr_stories_", "stories"],
      ["mr_analysis_history_", "history"],
      ["mr_brandsug_", "brandsug"],
      ["mr_avatar_settings_", "avatar"],
    ];

    const pushed: Record<string, unknown> = {};
    for (const [prefix, srvKey] of migrations) {
      if (serverData[srvKey] != null) continue; // server already has it
      const candidates = [`${prefix}${uid}`];
      for (const lsKey of candidates) {
        try {
          const raw = localStorage.getItem(lsKey);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed == null) continue;
          if (Array.isArray(parsed) && parsed.length === 0) continue;
          pushed[srvKey] = parsed;
          console.log(`[migrate] pushing "${srvKey}" from localStorage key "${lsKey}"`);
          syncToServer(srvKey, parsed);
          // also store under the new uid so next reload picks it up instantly
          try { localStorage.setItem(`${prefix}${uid}`, raw); } catch { /* ignore */ }
          break; // stop after first non-empty candidate
        } catch { /* try next candidate */ }
      }
    }

    applyUserData({ ...pushed, ...serverData }, uid);
  }, [applyUserData]);

  // Check for existing session + restore saved data on mount
  useEffect(() => {
    const initApp = async () => {
      // Server session is the ONLY source of truth now.
      // If /api/auth/me fails, clear any stale legacy localStorage user and
      // force the login screen so a fresh JWT cookie gets set.
      let user: UserAccount | null = null;
      let serverReachable = false;
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        serverReachable = true;
        const meJson = await meRes.json();
        if (meJson.ok && meJson.user) {
          user = {
            id: meJson.user.id,
            name: meJson.user.name ?? "",
            email: meJson.user.email,
            password: "",
            onboardingDone: true,
            role: meJson.user.role,
          };
          authSetCurrentUser(user);
        }
      } catch { /* server unreachable */ }

      if (!user) {
        if (serverReachable) {
          // Server said "no session" → wipe stale legacy login so UI shows login screen
          const stale = authGetCurrentUser();
          if (stale) {
            console.warn("[auth] legacy localStorage session without JWT cookie — clearing, please re-login");
            authSetCurrentUser(null);
          }
        } else {
          // Server unreachable → allow legacy offline fallback
          user = authGetCurrentUser();
        }
      }

      if (!user) return; // not logged in — LandingPage will show

      setCurrentUser(user);
      await loadAndApplyUserData(user.id);
      setAppScreen(user.onboardingDone ? "app" : "onboarding");
    };
    initApp();
  }, [loadAndApplyUserData]);

  const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Ошибка анализа");
    return json.data;
  };

  // Save company to localStorage and state
  const saveMyCompany = (result: AnalysisResult, userId?: string) => {
    const resultWithDate: AnalysisResult = { ...result, analyzedAt: new Date().toISOString() };
    setMyCompany(resultWithDate);
    const uid = userId ?? currentUser?.id;
    if (uid) {
      try { localStorage.setItem(`mr_company_${uid}`, JSON.stringify(resultWithDate)); } catch { /* ignore */ }
      syncToServer("company", resultWithDate);
    }
  };

  // New analysis from within dashboard
  const handleNewAnalysis = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      // Save current analysis to history before replacing
      if (myCompany) {
        const historyEntry = { ...myCompany, analyzedAt: new Date().toISOString() };
        setAnalysisHistory(prev => {
          const next = [historyEntry, ...prev].slice(0, 20); // keep last 20
          if (currentUser?.id) {
            try { localStorage.setItem(`mr_analysis_history_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
            syncToServer("history", next);
          }
          return next;
        });
      }
      saveMyCompany(result);
      setCompetitors([]);
      if (currentUser?.id) {
        try { localStorage.removeItem(`mr_competitors_${currentUser.id}`); } catch { /* ignore */ }
      }
      setSelectedCompetitor(null);
      setActiveNav("dashboard");
      if (currentUser?.tgChatId && currentUser.tgNotifyAnalysis !== false) {
        await sendTgNotification(
          currentUser.tgChatId,
          `✅ <b>MarketRadar</b>\n\nАнализ завершён: <b>${result.company.name}</b>\nScore: <b>${result.company.score}/100</b>\n\nОткройте приложение, чтобы посмотреть результаты.`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Add competitor
  const handleAddCompetitor = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      const resultWithDate: AnalysisResult = { ...result, analyzedAt: new Date().toISOString() };
      setCompetitors(prev => {
        const updated = [...prev, resultWithDate];
        if (currentUser?.id) {
          try { localStorage.setItem(`mr_competitors_${currentUser.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
          syncToServer("competitors", updated);
        }
        return updated;
      });
      if (currentUser?.tgChatId && currentUser.tgNotifyCompetitors !== false) {
        await sendTgNotification(
          currentUser.tgChatId,
          `🎯 <b>MarketRadar</b>\n\nДобавлен конкурент: <b>${result.company.name}</b>\nScore: <b>${result.company.score}/100</b>\n${result.hiring?.openVacancies ? `Открытых вакансий: ${result.hiring.openVacancies}` : ""}`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTAAnalysis = async (niche: string, extraContext: string) => {
    setIsTAAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-ta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? "",
          companyUrl: myCompany?.company.url ?? "",
          niche,
          extraContext,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа ЦА");
      setTaAnalysis(json.data);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_ta_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("ta", json.data);
      }
      setActiveNav("ta-dashboard");
    } finally {
      setIsTAAnalyzing(false);
    }
  };

  const handleGenerateCJM = async () => {
    if (!myCompany) return;
    setIsCJMGenerating(true);
    setCjmError(null);
    try {
      const niche = (myCompany.company.description ?? myCompany.company.name ?? "").slice(0, 500);
      const res = await fetch("/api/generate-cjm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany.company.name,
          niche: niche || myCompany.company.name,
          taData: taAnalysis,
          companyData: { description: myCompany.company.description?.slice(0, 500), url: myCompany.company.url },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации CJM");
      setCjmData(json.data);
      setCjmError(null);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_cjm_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("cjm", json.data);
      }
    } catch (e: unknown) {
      setCjmError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setIsCJMGenerating(false);
    }
  };

  const handleGenerateBenchmarks = async () => {
    if (!myCompany) return;
    setIsBenchmarksGenerating(true);
    setBenchmarksError(null);
    try {
      const niche = (myCompany.company.description ?? myCompany.company.name ?? "").slice(0, 500);
      const res = await fetch("/api/generate-benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany.company.name,
          niche: niche || myCompany.company.name,
          companyScore: myCompany.company.score,
          categories: myCompany.company.categories,
          seoData: myCompany.seo,
          competitors: competitors.map(c2 => ({ name: c2.company.name, score: c2.company.score, categories: c2.company.categories })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации бенчмарков");
      setBenchmarksData(json.data);
      setBenchmarksError(null);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_benchmarks_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("benchmarks", json.data);
      }
    } catch (e: unknown) {
      setBenchmarksError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setIsBenchmarksGenerating(false);
    }
  };

  const handleSMMAnalysis = async (niche: string, links: SMMSocialLinks) => {
    setIsSMMAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? "",
          companyUrl: myCompany?.company.url ?? "",
          niche,
          socialLinks: links,
          websiteContext: myCompany?.company.description ?? "",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа СММ");
      setSmmAnalysis(json.data);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_smm_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("smm", json.data);
      }
      setActiveNav("smm-dashboard");
    } finally {
      setIsSMMAnalyzing(false);
    }
  };

  // ----- Content Factory -----

  const persistContent = (plan: ContentPlan | null, posts: GeneratedPost[], reels: GeneratedReel[]) => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`mr_content_${currentUser.id}`, JSON.stringify({ plan, posts, reels }));
      syncToServer("content", { plan, posts, reels });
    } catch { /* ignore */ }
  };

  const handleUpdateAvatarSettings = (next: AvatarSettings) => {
    setAvatarSettings(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_avatar_settings_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      syncToServer("avatar", next);
    }
  };

  const handleUpdateBrandBook = (next: BrandBook) => {
    setBrandBook(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_brandbook_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      syncToServer("brandbook", next);
    }
  };

  const handleSetBrandSuggestions = (v: unknown) => {
    setBrandSuggestions(v);
    if (currentUser) {
      try { localStorage.setItem(`mr_brandsug_${currentUser.id}`, JSON.stringify(v)); } catch { /* ignore */ }
      syncToServer("brandsug", v);
    }
  };

  const persistStories = (stories: GeneratedStory[]) => {
    if (!currentUser?.id) return;
    try { localStorage.setItem(`mr_stories_${currentUser.id}`, JSON.stringify(stories)); } catch { /* ignore */ }
    syncToServer("stories", stories);
  };

  const handleAddStory = (story: GeneratedStory) => {
    setGeneratedStories(prev => {
      const next = [story, ...prev];
      persistStories(next);
      return next;
    });
  };

  const handleDeleteStory = (storyId: string) => {
    setGeneratedStories(prev => {
      const next = prev.filter(s => s.id !== storyId);
      persistStories(next);
      return next;
    });
  };

  const handleUpdateStory = (updated: GeneratedStory) => {
    setGeneratedStories(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      persistStories(next);
      return next;
    });
  };

  const handleGenerateContentPlan = async (niche: string) => {
    if (!smmAnalysis) return;
    setIsGeneratingPlan(true);
    try {
      const res = await fetch("/api/generate-content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis.companyName,
          niche,
          smmAnalysis,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации плана");
      setContentPlan(json.data);
      persistContent(json.data, generatedPosts, generatedReels);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGeneratePost = async (idea: ContentPostIdea, customPrompt?: string) => {
    setGeneratingPostId(idea.id);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis?.companyName ?? "",
          idea,
          smmAnalysis,
          brandBook,
          generateImage: true,
          userPrompt: customPrompt,
          referenceImages: referenceImages.map(r => ({ data: r.data, mimeType: r.mimeType })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации поста");
      setGeneratedPosts(prev => {
        const next = [json.data as GeneratedPost, ...prev];
        persistContent(contentPlan, next, generatedReels);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации поста");
    } finally {
      setGeneratingPostId(null);
    }
  };

  const handleGenerateReelScenario = async (idea: ContentReelIdea, customPrompt?: string) => {
    setGeneratingReelId(idea.id);
    try {
      const res = await fetch("/api/generate-reel-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis?.companyName ?? "",
          idea,
          smmAnalysis,
          brandBook,
          voiceDescription: avatarSettings.voiceDescription,
          avatarDescription: avatarSettings.avatarDescription,
          userPrompt: customPrompt,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации сценария");
      setGeneratedReels(prev => {
        const next = [json.data as GeneratedReel, ...prev];
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации сценария");
    } finally {
      setGeneratingReelId(null);
    }
  };

  const handleUpdatePost = (updated: GeneratedPost) => {
    setGeneratedPosts(prev => {
      const next = prev.map(p => p.id === updated.id ? updated : p);
      persistContent(contentPlan, next, generatedReels);
      return next;
    });
  };

  const handleUpdateReel = (updated: GeneratedReel) => {
    setGeneratedReels(prev => {
      const next = prev.map(r => r.id === updated.id ? updated : r);
      persistContent(contentPlan, generatedPosts, next);
      return next;
    });
  };

  const handleDeletePost = (postId: string) => {
    setGeneratedPosts(prev => {
      const next = prev.filter(p => p.id !== postId);
      persistContent(contentPlan, next, generatedReels);
      return next;
    });
  };

  const handleDeleteReel = (reelId: string) => {
    setGeneratedReels(prev => {
      const next = prev.filter(r => r.id !== reelId);
      persistContent(contentPlan, generatedPosts, next);
      return next;
    });
  };

  const handleGenerateReelVideo = async (reelId: string) => {
    const reel = generatedReels.find(r => r.id === reelId);
    if (!reel) return;
    setGeneratingVideoFor(reelId);
    try {
      const res = await fetch("/api/generate-reel-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: reel.voiceoverScript,
          avatarId: avatarSettings.avatarId || undefined,
          voiceId: avatarSettings.voiceId || undefined,
          aspect: avatarSettings.aspect,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка HeyGen");
      const videoId: string = json.data.videoId;
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, heygenVideoId: videoId, videoStatus: "generating" as const, videoError: undefined }
          : r);
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, videoStatus: "failed" as const, videoError: msg }
          : r);
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } finally {
      setGeneratingVideoFor(null);
    }
  };

  // Poll HeyGen for any reels currently generating
  useEffect(() => {
    const generating = generatedReels.filter(r => r.videoStatus === "generating" && r.heygenVideoId);
    if (generating.length === 0) return;
    const interval = setInterval(async () => {
      for (const reel of generating) {
        try {
          const res = await fetch(`/api/video-status?videoId=${encodeURIComponent(reel.heygenVideoId!)}`);
          const json = await res.json();
          if (!json.ok) continue;
          const status: string = json.data.status;
          if (status === "completed" && json.data.videoUrl) {
            setGeneratedReels(prev => {
              const next = prev.map(r => r.id === reel.id
                ? { ...r, videoStatus: "ready" as const, videoUrl: json.data.videoUrl as string }
                : r);
              persistContent(contentPlan, generatedPosts, next);
              return next;
            });
          } else if (status === "failed") {
            setGeneratedReels(prev => {
              const next = prev.map(r => r.id === reel.id
                ? { ...r, videoStatus: "failed" as const, videoError: json.data.error ?? "HeyGen вернул failed" }
                : r);
              persistContent(contentPlan, generatedPosts, next);
              return next;
            });
          }
        } catch { /* keep polling */ }
      }
    }, 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedReels.map(r => `${r.id}:${r.videoStatus}`).join(",")]);

  // Onboarding complete: run initial analysis
  const handleOnboardingComplete = async (updatedUser: UserAccount, companyUrl: string, competitorUrls: string[]) => {
    setCurrentUser(updatedUser);
    setAppScreen("app");
    if (!companyUrl) { setStatus("done"); setActiveNav("new-analysis"); return; }
    setCurrentUrl(companyUrl);
    setStatus("loading");
    try {
      const result = await analyzeUrl(companyUrl);
      saveMyCompany(result, updatedUser.id);
      const compResults: AnalysisResult[] = [];
      for (const url of competitorUrls) {
        setCurrentUrl(url);
        const comp = await analyzeUrl(url);
        compResults.push({ ...comp, analyzedAt: new Date().toISOString() });
        setCompetitors([...compResults]);
      }
      if (compResults.length > 0 && updatedUser.id) {
        try { localStorage.setItem(`mr_competitors_${updatedUser.id}`, JSON.stringify(compResults)); } catch { /* ignore */ }
        syncToServer("competitors", compResults);
      }
      setActiveNav("dashboard");
    } catch {
      setActiveNav("new-analysis");
    } finally {
      setStatus("done");
    }
  };

  // Logout — clear ALL user data from React state to prevent data leaking between accounts
  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    authSetCurrentUser(null);
    setCurrentUser(null);

    // Reset all analysis & content state
    setMyCompany(null);
    setCompetitors([]);
    setTaAnalysis(null);
    setCjmData(null);
    setBenchmarksData(null);
    setSmmAnalysis(null);
    setContentPlan(null);
    setGeneratedPosts([]);
    setGeneratedReels([]);
    setGeneratedStories([]);
    setAnalysisHistory([]);
    setBrandSuggestions(null);
    setReferenceImages([]);
    setBrandBook({
      brandName: "", tagline: "", mission: "", colors: [],
      fontHeader: "", fontBody: "", toneOfVoice: [],
      forbiddenWords: [], goodPhrases: [], visualStyle: "",
    });
    setAvatarSettings({
      avatarId: "", voiceId: "", avatarDescription: "",
      voiceDescription: "", aspect: "portrait",
    });

    setAppScreen("landing");
    setStatus("idle");
    setActiveNav("new-analysis");
    setSelectedCompetitor(null);
  };

  // Update nav counts dynamically (including nested children)
  const updateCounts = (items: typeof NAV_SECTIONS[0]["items"]): typeof NAV_SECTIONS[0]["items"] =>
    items.map(item => ({
      ...item,
      count: item.id === "competitors" ? (competitors.length > 0 ? competitors.length : null) :
        item.id === "insights" ? (myCompany?.insights?.length ?? null) :
          item.id === "competitor-analysis" ? (myCompany ? 1 : null) :
            item.id === "ta-analysis" ? (taAnalysis ? 1 : null) :
              item.id === "smm-analysis" ? (smmAnalysis ? 1 : null) :
                item.id === "content-factory" ? (contentPlan ? 1 : null) :
                  item.id === "content-posts" ? (generatedPosts.length > 0 ? generatedPosts.length : null) :
                    item.id === "content-reels" ? (generatedReels.length > 0 ? generatedReels.length : null) : item.count,
      children: item.children ? updateCounts(item.children) : undefined,
    }));
  const navSections = NAV_SECTIONS.map(section => ({ ...section, items: updateCounts(section.items) }));

  // Screen routing
  if (appScreen === "landing") {
    return <LandingPageView c={c} theme={theme} setTheme={setTheme} onRegister={() => setAppScreen("register")} onLogin={() => setAppScreen("login")} />;
  }
  if (appScreen === "register") {
    return <RegisterView c={c} onSuccess={(user) => { setCurrentUser(user); setAppScreen("onboarding"); }} onLogin={() => setAppScreen("login")} onBack={() => setAppScreen("landing")} />;
  }
  if (appScreen === "login") {
    return <LoginView c={c} onSuccess={async (user) => { setCurrentUser(user); await loadAndApplyUserData(user.id); setAppScreen(user.onboardingDone ? "app" : "onboarding"); }} onRegister={() => setAppScreen("register")} onBack={() => setAppScreen("landing")} />;
  }
  if (appScreen === "onboarding" && currentUser) {
    return <OnboardingView c={c} user={currentUser} onComplete={handleOnboardingComplete} />;
  }

  // App: loading state (initial analysis)
  if (status === "loading") {
    return <LoadingView c={c} url={currentUrl} />;
  }

  // Mobile chrome: top bar + drawer + bottom nav
  const mobileNav = (
    <>
      {/* Top bar — mobile only */}
      <div className="ds-mobile-only" style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", height: 52,
        background: "var(--card)", borderBottom: `1px solid var(--border)`,
        flexShrink: 0,
      }}>
        <button onClick={() => setMobileMenuOpen(true)} aria-label="Открыть меню"
          style={{ background: "transparent", border: "none", width: 40, height: 40, cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
          <Menu size={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11 }}>MR</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>MarketRadar</span>
        </div>
        <button onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "warm" : "light")} aria-label="Сменить тему"
          style={{ background: "transparent", border: "none", width: 40, height: 40, cursor: "pointer", fontSize: 18, borderRadius: 8 }}>
          {theme === "light" ? "🌙" : theme === "dark" ? "☕" : "☀️"}
        </button>
      </div>

      {/* Drawer backdrop */}
      <div onClick={() => setMobileMenuOpen(false)}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 105, opacity: mobileMenuOpen ? 1 : 0, pointerEvents: mobileMenuOpen ? "auto" : "none", transition: "opacity 220ms ease" }} />

      {/* Side drawer with full nav */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 280, maxWidth: "85vw",
        background: COLORS.dark.bgSidebar, zIndex: 110,
        transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 220ms ease", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${COLORS.dark.sidebarBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11 }}>MR</div>
            <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.dark.sidebarText }}>MarketRadar</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.dark.sidebarTextMuted, borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        </div>
        <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav}
          setActiveNav={setActiveNavMobile} navSections={navSections}
          companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
      </div>

      <MobileBottomNav activeNav={activeNav}
        setActiveNav={(id) => { setSelectedCompetitor(null); setActiveNavMobile(id); }}
        onOpenMenu={() => setMobileMenuOpen(true)} />
    </>
  );

  // App: competitor profile sub-view
  if (selectedCompetitor !== null && competitors[selectedCompetitor]) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Inter', 'PT Sans', system-ui, sans-serif", background: "var(--background)", color: "var(--foreground)" }}>
        <style>{`::selection { background: "var(--primary)"30; } button { transition: opacity 0.15s ease, transform 0.1s ease; } button:hover:not(:disabled) { opacity: 0.92; } button:active:not(:disabled) { transform: scale(0.98); }`}</style>
        {mobileNav}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={(id) => { if (id === "owner-dashboard") { handleNavClick(id); return; } setSelectedCompetitor(null); setActiveNav(id); }} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
          <main className="ds-mobile-page-padding" style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
            <CompetitorProfileView c={c} data={competitors[selectedCompetitor]} onBack={() => { setSelectedCompetitor(null); setActiveNav("competitors"); }} />
          </main>
        </div>
      </div>
    );
  }

  // App: main dashboard layout
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Inter', 'PT Sans', system-ui, sans-serif", background: "var(--background)", color: "var(--foreground)" }}>
      <style>{`::selection { background: "var(--primary)"30; } button { transition: opacity 0.15s ease, transform 0.1s ease; } button:hover:not(:disabled) { opacity: 0.92; } button:active:not(:disabled) { transform: scale(0.98); }`}</style>
      {mobileNav}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={handleNavClick} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
      <main className="ds-mobile-page-padding" style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {activeNav === "new-analysis" && <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />}
        {activeNav === "dashboard" && (myCompany ? <DashboardView c={c} data={myCompany} competitors={competitors} /> : <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />)}
        {activeNav === "prev-analyses" && <PreviousAnalysesView c={c} history={analysisHistory} currentAnalysis={myCompany} />}
        {activeNav === "competitors" && <CompetitorsView c={c} myCompany={myCompany} competitors={competitors} onSelectCompetitor={(i) => { setSelectedCompetitor(i); }} onAddCompetitor={handleAddCompetitor} isAnalyzing={isAnalyzing} />}
        {activeNav === "compare" && <CompareView c={c} myCompany={myCompany} competitors={competitors} />}
        {activeNav === "insights" && myCompany && <InsightsView c={c} data={myCompany} competitors={competitors} />}
        {activeNav === "reports" && <ReportsView c={c} data={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} competitors={competitors} />}
        {activeNav === "sources" && <SourcesView c={c} />}
        {activeNav === "settings" && <SettingsView c={c} user={currentUser} onUpdateUser={(updated) => setCurrentUser(updated)} />}
        {activeNav === "ta-new" && <NewTAView c={c} myCompany={myCompany} isAnalyzing={isTAAnalyzing} onAnalyze={handleTAAnalysis} />}
        {activeNav === "ta-dashboard" && (taAnalysis ? <TADashboardView c={c} data={taAnalysis} /> : <TAEmptyDashboard c={c} onRunAnalysis={() => setActiveNav("ta-new")} />)}
        {activeNav === "ta-cjm" && <CJMView c={c} data={cjmData} isGenerating={isCJMGenerating} onGenerate={handleGenerateCJM} myCompany={myCompany} taAnalysis={taAnalysis} error={cjmError} />}
        {activeNav === "ta-benchmarks" && <BenchmarksView c={c} data={benchmarksData} isGenerating={isBenchmarksGenerating} onGenerate={handleGenerateBenchmarks} myCompany={myCompany} error={benchmarksError} />}
        {activeNav === "ta-brandbook" && taAnalysis && (
          <BrandSuggestionsView c={c} taData={taAnalysis} brandSuggestions={brandSuggestions} setBrandSuggestions={handleSetBrandSuggestions} brandBook={brandBook} onUpdateBrandBook={handleUpdateBrandBook} />
        )}
        {activeNav === "ta-brandbook" && !taAnalysis && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--foreground-secondary)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>Сначала проведите анализ ЦА</div>
            <div style={{ fontSize: 13 }}>Перейдите в «Анализ ЦА → Новый анализ»</div>
          </div>
        )}
        {activeNav === "smm-new" && <NewSMMView c={c} myCompany={myCompany} isAnalyzing={isSMMAnalyzing} onAnalyze={handleSMMAnalysis} />}
        {activeNav === "smm-dashboard" && (smmAnalysis ? <SMMDashboardView c={c} data={smmAnalysis} /> : <SMMEmptyDashboard c={c} onRunAnalysis={() => setActiveNav("smm-new")} />)}
        {activeNav === "content-plan" && (
          contentPlan
            ? <ContentPlanView
                c={c}
                plan={contentPlan}
                isGeneratingPost={generatingPostId !== null}
                generatingPostId={generatingPostId}
                isGeneratingReel={generatingReelId !== null}
                generatingReelId={generatingReelId}
                onGeneratePost={handleGeneratePost}
                onGenerateReel={handleGenerateReelScenario}
                avatarSettings={avatarSettings}
                onUpdateAvatarSettings={handleUpdateAvatarSettings}
                referenceImages={referenceImages}
                onUpdateReferenceImages={setReferenceImages}
                brandBook={brandBook}
                onUpdateBrandBook={handleUpdateBrandBook}
              />
            : <NewContentPlanView c={c} myCompany={myCompany} smm={smmAnalysis} isGenerating={isGeneratingPlan} onGenerate={handleGenerateContentPlan} />
        )}
        {activeNav === "content-posts" && <GeneratedPostsView c={c} posts={generatedPosts} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} referenceImages={referenceImages} onUpdateReferenceImages={setReferenceImages} brandBook={brandBook} />}
        {activeNav === "content-reels" && <GeneratedReelsView c={c} reels={generatedReels} onGenerateVideo={handleGenerateReelVideo} generatingVideoFor={generatingVideoFor} avatarSettings={avatarSettings} onUpdateAvatarSettings={handleUpdateAvatarSettings} onUpdateReel={handleUpdateReel} onDeleteReel={handleDeleteReel} />}
        {activeNav === "content-stories" && <StoriesView c={c} stories={generatedStories} plan={contentPlan} smmAnalysis={smmAnalysis} companyName={myCompany?.company.name ?? ""} brandBook={brandBook} onAdd={handleAddStory} onDelete={handleDeleteStory} onUpdate={handleUpdateStory} />}
        {activeNav === "content-analytics" && <ContentAnalyticsView c={c} posts={generatedPosts} reels={generatedReels} companyName={myCompany?.company.name ?? ""} />}
        {activeNav === "content-roi" && <ROICalculatorView c={c} posts={generatedPosts} reels={generatedReels} />}
        {(activeNav === "seo-new" || activeNav === "seo-library" || activeNav === "seo-keywords") && (
          <SEOArticlesView
            c={c}
            userId={currentUser?.id ?? ""}
            analysis={myCompany ?? null}
            taResult={taAnalysis}
            brandBook={brandBook}
            activeSubNav={activeNav}
          />
        )}
        {activeNav === "reviews-analysis" && <ReviewsView c={c} companyName={myCompany?.company.name ?? ""} />}
        {activeNav === "brand-presentation" && <PresentationView c={c} myCompany={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} brandBook={brandBook} userId={currentUser?.id ?? ""} />}
        {activeNav === "landing-generator" && <LandingGeneratorView c={c} myCompany={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} brandBook={brandBook} userId={currentUser?.id ?? ""} />}
      </main>
      </div>
    </div>
  );
}

// ============================================================
// Customer Journey Map View
// ============================================================

