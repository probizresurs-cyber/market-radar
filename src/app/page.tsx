"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { LayoutDashboard, Users, Sword, BookOpen, BarChart2, Settings, Menu, ChevronRight, X, Moon, Sun, Coffee } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult, TASegment, TAAudienceType } from "@/lib/ta-types";
import type { SMMResult, SMMSocialLinks, SMMRealStats } from "@/lib/smm-types";
import type { ContentPlan, ContentPostIdea, ContentReelIdea, GeneratedPost, GeneratedReel, AvatarSettings, ReferenceImage, BrandBook, PostMetrics, ReelMetrics, GeneratedStory, GeneratedCarousel, TovCheckResult, TovIssue, PresentationStyle } from "@/lib/content-types";
import type { CompanyStyleState } from "@/lib/company-style-types";
import type { Review, ReviewAnalysis } from "@/lib/review-types";

// ─── Shared modules (extracted from this file) ─────────────────────────────────
import { COLORS, type Theme, type Colors } from "@/lib/colors";
import { type UserAccount, NICHE_COMPETITORS, syncToServer, loadAllFromServer, authGetCurrentUser, authSetCurrentUser, sendTgNotification, setActiveWorkspaceForSync } from "@/lib/user";
import { resolveActiveWorkspace, saveActiveWorkspaceId, type ActiveWorkspaceState } from "@/lib/workspace-client";
import type { WorkspaceSummary } from "@/lib/workspace";
import { SOURCES_FREE } from "@/lib/data/sources";
import { trackGoal } from "@/lib/metrika";

// ─── Extracted view components ────────────────────────────────────────────────
import { LandingPageView } from "@/components/views/LandingPageView";
import { RegisterView } from "@/components/views/RegisterView";
import { LoginView } from "@/components/views/LoginView";
import { OnboardingView } from "@/components/views/OnboardingView";
import { LandingView } from "@/components/views/LandingView";
import { LoadingView } from "@/components/views/LoadingView";
import { MarketRadarLogo } from "@/components/ui/MarketRadarLogo";

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
import { BattleCardsView } from "@/components/views/BattleCardsView";
import { InsightsView } from "@/components/views/InsightsView";
import { AIChatWidget } from "@/components/ui/AIChatWidget";
import { AIVisibilityView } from "@/components/views/AIVisibilityView";
import { CompanyStyleView } from "@/components/views/CompanyStyleView";
import { ReportsView } from "@/components/views/ReportsView";
import { SourcesView } from "@/components/views/SourcesView";

type AnyMetrics = PostMetrics & ReelMetrics;

// Защита от дублей в списке черновиков: если только что был добавлен пост
// с тем же ideaId+platform (или абсолютно идентичным body) в течение
// последних ~30 секунд — заменяем предыдущий, а не плюсуем второй.
// Это нивелирует двойной клик / повторную отправку формы / случайные
// ре-моунты, из-за которых пользователь видел два одинаковых черновика.
function prependPostDedup(prev: GeneratedPost[], next: GeneratedPost): GeneratedPost[] {
  const first = prev[0];
  if (first) {
    const sameIdea =
      !!next.ideaId && next.ideaId === first.ideaId &&
      next.platform === first.platform;
    const sameBody =
      !!next.body && next.body.trim() === first.body?.trim();
    const recentMs = Date.now() - new Date(first.generatedAt).getTime();
    if ((sameIdea || sameBody) && recentMs < 30_000) {
      return [next, ...prev.slice(1)];
    }
  }
  return [next, ...prev];
}

// ============================================================
// New Analysis View (inside dashboard sidebar)
// ============================================================

function NewAnalysisView({ c, onAnalyze, isAnalyzing }: { c: Colors; onAnalyze: (url: string) => Promise<unknown>; isAnalyzing: boolean }) {
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
import { loadWhiteLabel, saveWhiteLabel, buildAccentCss, type WhiteLabelConfig } from "@/lib/whitelabel";
import { NewTAView, TAEmptyDashboard, TADashboardView } from "@/components/views/TAViews";
import { BrandSuggestionsView } from "@/components/views/BrandSuggestionsView";
import { NewSMMView, SMMEmptyDashboard, SMMDashboardView } from "@/components/views/SMMViews";

import { ContentEmptyView, NewContentPlanView, ContentPlanView } from "@/components/views/ContentPlanView";
import { ContentCalendarView } from "@/components/views/ContentCalendarView";
import { AgentHubView } from "@/components/views/AgentHubView";
import { NewAnalysisWizard } from "@/components/views/NewAnalysisWizard";
import { ContentTrendsView, type TrendContentIdea } from "@/components/views/ContentTrendsView";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { PackageProgressModal, type PackageProgress } from "@/components/ui/PackageProgressModal";
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
import { GeneratedCarouselsView } from "@/components/views/GeneratedCarouselsView";
import { CJMView, BenchmarksView } from "@/components/views/CJMBenchmarks";
import { SWOTView } from "@/components/views/SWOTView";
import { PriceTrackingView } from "@/components/views/PriceTrackingView";
import { SidebarComponent, MobileBottomNav } from "@/components/views/SidebarComponent";
import { TrialBanner } from "@/components/views/TrialBanner";
import { PaywallGuard } from "@/components/views/PaywallGuard";
import { ComingSoonView } from "@/components/views/ComingSoonView";
import { VisitTracker } from "@/components/VisitTracker";
import { useFeatureFlags, isFeatureOn } from "@/hooks/useFeatureFlags";
import { SEOArticlesView } from "@/components/views/SEOArticlesView";
import type { NavItem, NavSection } from "@/lib/nav";
import { NAV_SECTIONS } from "@/lib/nav";


// ============================================================
// Main App
// ============================================================

export default function MarketRadarDashboard() {
  return (
    <ToastProvider>
      <MarketRadarDashboardInner />
    </ToastProvider>
  );
}

function MarketRadarDashboardInner() {
  const { toast } = useToast();
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

  // ─── Workspace state ───────────────────────────────────────────────────
  // activeWorkspace.isOwnWorkspace=true для собственной workspace юзера
  // (поведение «как было раньше»). При isOwnWorkspace=false мы в чужом
  // workspace и:
  //   • данные читаются из user_data владельца через /api/data?workspaceId=
  //   • писать может только если role !== "viewer"
  //   • UI должен прятать кнопки запуска анализа и генерации для viewer'а
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspaceState | null>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceSummary[]>([]);
  const isReadOnly = !!activeWorkspace && activeWorkspace.role === "viewer";
  const features = useFeatureFlags();
  // Внутренние аккаунты (@company24.pro + admin) видят все модули независимо от флагов в БД.
  // Всем остальным пользователям модули видны только если они включены в админ-панели,
  // одинаково на проде и staging. Это единое правило: "выключено в админке = выключено везде".
  const isInternalUser = (currentUser?.email ?? "").endsWith("@company24.pro") || currentUser?.role === "admin";
  const featureOn = (featureId: string) => {
    if (isInternalUser) return true;
    return isFeatureOn(features, featureId);
  };
  const [activeNav, setActiveNav] = useState("new-analysis");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Если на платформу пришли с ?nav=<id> (например, с дашборда руководителя), переключаемся на эту секцию
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const navParam = params.get("nav");
      if (navParam) {
        setActiveNav(navParam);
        // Очищаем query, чтобы при обновлении не прилипала
        const url = new URL(window.location.href);
        url.searchParams.delete("nav");
        window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams.toString()}` : "") + url.hash);
      }
    } catch { /* ignore */ }
  }, []);
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
  // ЦА-анализ может существовать в двух вариантах — B2C и B2B.
  // taAnalysis остаётся "активным" (на который смотрит пользователь) для обратной совместимости
  // со всеми местами в коде, где используется текущий анализ. taAnalysisAlt — параллельный
  // (второй, другого типа) — если есть.
  // ЦА-анализ может существовать в двух вариантах — B2C и B2B.
  // taAnalysis остаётся "активным" (на который смотрит пользователь) для обратной совместимости
  // со всеми местами в коде, где используется текущий анализ. taAnalysisAlt — параллельный
  // (второй, другого типа) — если есть.
  const [taAnalysis, setTaAnalysis] = useState<TAResult | null>(null);
  const [taAnalysisAlt, setTaAnalysisAlt] = useState<TAResult | null>(null);
  const taExistingTypes: TAAudienceType[] = [
    ...(taAnalysis ? [taAnalysis.audienceType ?? "b2c"] : []),
    ...(taAnalysisAlt ? [taAnalysisAlt.audienceType ?? "b2c"] : []),
  ];
  // Переключение между B2C/B2B в дашборде ЦА — swap active ↔ alt.
  const handleSwitchTAType = React.useCallback((t: TAAudienceType) => {
    if ((taAnalysis?.audienceType ?? "b2c") === t) return;
    if (taAnalysisAlt && (taAnalysisAlt.audienceType ?? "b2c") === t) {
      const cur = taAnalysis;
      setTaAnalysis(taAnalysisAlt);
      setTaAnalysisAlt(cur);
    }
  }, [taAnalysis, taAnalysisAlt]);
  const [isTAAnalyzing, setIsTAAnalyzing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cjmData, setCjmData] = useState<any | null>(null);
  const [isCJMGenerating, setIsCJMGenerating] = useState(false);
  const [cjmError, setCjmError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [benchmarksData, setBenchmarksData] = useState<any | null>(null);
  const [isBenchmarksGenerating, setIsBenchmarksGenerating] = useState(false);
  const [benchmarksError, setBenchmarksError] = useState<string | null>(null);
  const [whiteLabel, setWhiteLabel] = useState<WhiteLabelConfig | null>(null);
  const [smmAnalysis, setSmmAnalysis] = useState<SMMResult | null>(null);
  const [isSMMAnalyzing, setIsSMMAnalyzing] = useState(false);
  const [contentPlan, setContentPlan] = useState<ContentPlan | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [generatedReels, setGeneratedReels] = useState<GeneratedReel[]>([]);
  // Refs всегда содержат СВЕЖИЕ значения state. Нужны для async коллбэков
  // (parallel Promise.all из handleCreatePackageFromTrend, HeyGen poller),
  // которые иначе захватывают snapshot из замыкания и затирают друг друга
  // при одновременной записи в persistContent / persistStories.
  const contentPlanRef = useRef(contentPlan);
  const generatedPostsRef = useRef(generatedPosts);
  const generatedReelsRef = useRef(generatedReels);
  useEffect(() => { contentPlanRef.current = contentPlan; }, [contentPlan]);
  useEffect(() => { generatedPostsRef.current = generatedPosts; }, [generatedPosts]);
  useEffect(() => { generatedReelsRef.current = generatedReels; }, [generatedReels]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatingPostId, setGeneratingPostId] = useState<string | null>(null);
  const [generatingReelId, setGeneratingReelId] = useState<string | null>(null);
  // Progress пакетной генерации из тренда (4 шага). null = модалка скрыта.
  const [packageProgress, setPackageProgress] = useState<PackageProgress | null>(null);
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
  const [generatedCarousels, setGeneratedCarousels] = useState<GeneratedCarousel[]>([]);
  const [companyStyleState, setCompanyStyleState] = useState<CompanyStyleState>({
    docs: [],
    profile: null,
    applyToGeneration: false,
  });
  const [analysisHistory, setAnalysisHistory] = useState<Array<AnalysisResult & { analyzedAt: string }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brandSuggestions, setBrandSuggestions] = useState<any | null>(null);
  const c = COLORS[theme];

  // Apply server/localStorage data to React state — shared by initApp and post-login
  const applyUserData = React.useCallback((data: Record<string, unknown>, uid: string) => {
    const get = (key: string) => data[key] ?? null;

    // Reset all state first to prevent stale data from previous session
    setMyCompany(null); setCompetitors([]); setTaAnalysis(null); setTaAnalysisAlt(null);
    setCjmData(null); setBenchmarksData(null); setSmmAnalysis(null);
    setContentPlan(null); setGeneratedPosts([]); setGeneratedReels([]);
    setGeneratedStories([]); setGeneratedCarousels([]); setAnalysisHistory([]); setBrandSuggestions(null);
    setCompanyStyleState({ docs: [], profile: null, applyToGeneration: false });

    const company = get("company") ?? JSON.parse(localStorage.getItem(`mr_company_${uid}`) ?? "null");
    if (company) { setMyCompany(company as AnalysisResult); setStatus("done"); setActiveNav("dashboard"); }

    const comps = get("competitors") ?? JSON.parse(localStorage.getItem(`mr_competitors_${uid}`) ?? "null");
    if (Array.isArray(comps) && comps.length > 0) setCompetitors(comps as AnalysisResult[]);

    // Load TA analysis — supports both new per-type keys and the old single key.
    // Old single key (mr_ta_<uid>) is migrated: treated as B2C on first load.
    const taB2c: TAResult | null =
      JSON.parse(localStorage.getItem(`mr_ta_${uid}_b2c`) ?? "null") ??
      (() => {
        // Migrate old key → b2c slot on first access
        const old = get("ta") ?? JSON.parse(localStorage.getItem(`mr_ta_${uid}`) ?? "null");
        if (old && !(old as TAResult).audienceType) {
          (old as TAResult).audienceType = "b2c";
          try { localStorage.setItem(`mr_ta_${uid}_b2c`, JSON.stringify(old)); } catch { /* ignore */ }
        }
        return old as TAResult | null;
      })();
    const taB2b: TAResult | null = JSON.parse(localStorage.getItem(`mr_ta_${uid}_b2b`) ?? "null");
    if (taB2c) setTaAnalysis(taB2c);
    if (taB2b) setTaAnalysisAlt(taB2b);

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

    const carousels = get("carousels") ?? JSON.parse(localStorage.getItem(`mr_carousels_${uid}`) ?? "null");
    if (Array.isArray(carousels)) setGeneratedCarousels(carousels as GeneratedCarousel[]);

    const history = get("history") ?? JSON.parse(localStorage.getItem(`mr_analysis_history_${uid}`) ?? "null");
    if (Array.isArray(history)) setAnalysisHistory(history as Array<AnalysisResult & { analyzedAt: string }>);

    const brandsug = get("brandsug") ?? JSON.parse(localStorage.getItem(`mr_brandsug_${uid}`) ?? "null");
    if (brandsug) setBrandSuggestions(brandsug);

    const avatar = get("avatar") ?? JSON.parse(localStorage.getItem(`mr_avatar_settings_${uid}`) ?? "null");
    if (avatar) setAvatarSettings(avatar as AvatarSettings);

    const companyStyle = get("companyStyle") ?? JSON.parse(localStorage.getItem(`mr_company_style_${uid}`) ?? "null");
    if (companyStyle && typeof companyStyle === "object") {
      const cs = companyStyle as Partial<CompanyStyleState>;
      setCompanyStyleState({
        docs: Array.isArray(cs.docs) ? cs.docs : [],
        profile: cs.profile ?? null,
        applyToGeneration: !!cs.applyToGeneration,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load server data and apply it — called after login and on init.
  // Also performs a one-time migration: if a key exists in localStorage but
  // NOT on the server, push it up so other devices can see it.
  const loadAndApplyUserData = React.useCallback(async (uid: string): Promise<boolean> => {
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
      ["mr_carousels_", "carousels"],
      ["mr_analysis_history_", "history"],
      ["mr_brandsug_", "brandsug"],
      ["mr_avatar_settings_", "avatar"],
      ["mr_company_style_", "companyStyle"],
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

    const mergedData = { ...pushed, ...serverData };
    const hasCompany = mergedData.company != null;
    applyUserData(mergedData, uid);
    return hasCompany;
  }, [applyUserData]);

  // Загрузка данных foreign workspace (когда юзер — member чужого дашборда).
  // Читаем напрямую из user_data владельца через /api/data?workspaceId=
  // (НЕ из localStorage member'а — там его собственные данные).
  const loadForeignWorkspaceData = React.useCallback(async (workspaceId: string, memberUid: string): Promise<boolean> => {
    let data: Record<string, unknown> = {};
    try {
      data = (await loadAllFromServer(workspaceId)) ?? {};
    } catch (err) {
      console.warn("[workspace] foreign load failed:", err);
    }
    // applyUserData ожидает uid для fallback'ов в localStorage. Для foreign
    // workspace localStorage пуст по этому uid — передаём memberUid просто
    // как тех-параметр (его localStorage обращений не сработают и это ок).
    applyUserData(data, memberUid);
    return data.company != null;
  }, [applyUserData]);

  // Переключатель workspace: перезагружает данные с нужного source.
  const handleSwitchWorkspace = React.useCallback(async (workspaceId: string) => {
    if (!currentUser) return;
    if (activeWorkspace?.workspaceId === workspaceId) return;

    const target = availableWorkspaces.find(w => w.workspaceId === workspaceId);
    if (!target) return;

    const isOwn = workspaceId === currentUser.id;
    const nextActive: ActiveWorkspaceState = {
      workspaceId,
      role: target.role,
      isOwnWorkspace: isOwn,
      displayName: target.ownerCompanyName || target.ownerName || target.ownerEmail || "Моя команда",
      ownerEmail: target.ownerEmail || "",
    };
    setActiveWorkspace(nextActive);
    saveActiveWorkspaceId(workspaceId);
    setActiveWorkspaceForSync(isOwn ? null : workspaceId);

    setStatus("loading");
    if (isOwn) {
      await loadAndApplyUserData(currentUser.id);
    } else {
      await loadForeignWorkspaceData(workspaceId, currentUser.id);
    }
    setStatus("done");
  }, [currentUser, activeWorkspace, availableWorkspaces, loadAndApplyUserData, loadForeignWorkspaceData]);

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
          // Preserve localStorage-only profile fields (phone, niche, social
          // links, onboarding state, TG prefs) when refreshing from the
          // server — /api/auth/me only returns the core identity + company.
          const prior = authGetCurrentUser();
          // `website` is the canonical URL captured at registration. For
          // backwards compatibility we also mirror it into `companyUrl` —
          // the rest of the app (auto-analysis, dashboard, settings) still
          // reads that field.
          const website = meJson.user.website ?? prior?.website;
          user = {
            ...(prior ?? { password: "", onboardingDone: true }),
            id: meJson.user.id,
            name: meJson.user.name ?? "",
            email: meJson.user.email,
            role: meJson.user.role,
            companyName: meJson.user.companyName ?? prior?.companyName,
            website,
            phone: meJson.user.phone ?? prior?.phone,
            telegram: meJson.user.telegram ?? prior?.telegram,
            companyUrl: prior?.companyUrl ?? website,
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
      setWhiteLabel(loadWhiteLabel(user.id));

      // Резолвим активный workspace до загрузки данных, чтобы сразу читать
      // нужный (свой или чужой через snapshot).
      let ws: ActiveWorkspaceState | null = null;
      try {
        const resolved = await resolveActiveWorkspace(user.id);
        ws = resolved.active;
        setActiveWorkspace(ws);
        setAvailableWorkspaces(resolved.available);
        setActiveWorkspaceForSync(ws.isOwnWorkspace ? null : ws.workspaceId);
      } catch (err) {
        console.warn("[workspace] resolve failed, falling back to own:", err);
      }

      // Если мы в чужой workspace — грузим из её user_data, не из localStorage.
      const hasCompany = ws && !ws.isOwnWorkspace
        ? await loadForeignWorkspaceData(ws.workspaceId, user.id)
        : await loadAndApplyUserData(user.id);

      setAppScreen(user.onboardingDone ? "app" : "onboarding");

      // Auto-trigger analysis if user has companyUrl but no analysis yet
      if (!hasCompany && user.onboardingDone) {
        const storedUser = authGetCurrentUser();
        const url = storedUser?.companyUrl || user.companyUrl;
        if (url) {
          setStatus("loading");
          analyzeUrl(url)
            .then(result => {
              saveMyCompany(result, user.id);
              setActiveNav("dashboard");
            })
            .catch(() => setActiveNav("new-analysis"))
            .finally(() => setStatus("done"));
        }
      }
    };
    initApp();
  }, [loadAndApplyUserData]);

  const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
    trackGoal("analyze_start", { url });
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, businessType: currentUser?.businessType }),
    });
    // Защита от HTML-ответов nginx (502/504 при таймауте) — не падаем на JSON.parse,
    // а отдаём понятную ошибку «сервер не успел ответить».
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await res.text().catch(() => "");
      console.error("[analyze] non-JSON response", res.status, text.slice(0, 200));
      throw new Error(res.status === 504 || res.status === 502
        ? "Сервер не успел проанализировать сайт (timeout). Попробуйте ещё раз — иногда внешние API медленно отвечают."
        : `Ошибка сервера (${res.status})`);
    }
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Ошибка анализа");
    trackGoal("analyze_complete", { score: json.data?.company?.score });
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
  /**
   * Multi-module analysis trigger (новый wizard).
   * 1. Запускает основной анализ компании
   * 2. Параллельно дёргает выбранные модули: TA / SMM / Competitors / Reviews
   * 3. Каждый модуль не блокирует завершение основного — пользователь видит
   *    дашборд сразу, остальные подгружаются по мере готовности
   */
  const handleNewAnalysisWithOptions = async (opts: {
    url: string;
    modules: Array<"ta" | "smm" | "competitors" | "reviews">;
    smm?: { vk?: string; telegram?: string; instagram?: string };
    competitorUrls?: string[];
  }) => {
    // 1) Основной анализ. Получаем result ЯВНО, не из React state —
    //    state ещё не обновится к моменту вызова дочерних модулей.
    const result = await handleNewAnalysis(opts.url);
    if (!result) {
      console.warn("[wizard] основной анализ не удался, пропускаем доп.модули");
      return;
    }

    // 2) Параллельно запускаем выбранные модули с явным companyOverride.
    //    Каждый handler принимает result, не читает myCompany из закрытия,
    //    поэтому модули работают сразу после анализа.
    const tasks: Promise<unknown>[] = [];

    if (opts.modules.includes("ta")) {
      // niche/extraContext пустые — TA-route сам возьмёт контекст из company.
      // Тип аудитории определяем из user.businessType: BusinessType строки
      // вида 'b2b-services'/'b2c-retail' — берём префикс.
      const bt = currentUser?.businessType ?? "";
      const audienceType: TAAudienceType = bt.startsWith("b2b") ? "b2b" : "b2c";
      tasks.push(handleTAAnalysis("", "", audienceType, result).catch((e) => {
        console.warn("[wizard] TA failed", e);
      }));
    }
    if (opts.modules.includes("smm")) {
      const links = {
        vk: opts.smm?.vk ?? "",
        telegram: opts.smm?.telegram ?? "",
        instagram: opts.smm?.instagram ?? "",
        facebook: "",
        tiktok: "",
        youtube: "",
      } as SMMSocialLinks;
      tasks.push(handleSMMAnalysis("", links, result).catch((e) => {
        console.warn("[wizard] SMM failed", e);
      }));
    }
    if (opts.modules.includes("competitors") && opts.competitorUrls?.length) {
      // handleAddCompetitor не зависит от myCompany — он просто добавляет
      // новый конкурент через analyzeUrl. Однако его внутренний state-merge
      // тоже опасен (последовательность гонок). Запускаем последовательно
      // чтобы избежать race condition на setCompetitors.
      tasks.push((async () => {
        for (const compUrl of opts.competitorUrls!.slice(0, 3)) {
          try { await handleAddCompetitor(compUrl); }
          catch (e) { console.warn("[wizard] competitor failed", compUrl, e); }
        }
      })());
    }
    // Reviews — отдельная вкладка, юзер запускает вручную.

    // Fire-and-forget: пускай работают в фоне, пользователь смотрит дашборд.
    void Promise.all(tasks);
  };

  const handleNewAnalysis = async (url: string): Promise<AnalysisResult | null> => {
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
      return result;
    } catch (err) {
      console.error("[handleNewAnalysis]", err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Delete history entry
  const handleDeleteHistory = (idx: number) => {
    setAnalysisHistory(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_analysis_history_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
        syncToServer("history", next);
      }
      return next;
    });
  };

  // Delete competitor
  const handleDeleteCompetitor = (idx: number) => {
    setCompetitors(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_competitors_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
        syncToServer("competitors", next);
      }
      return next;
    });
  };

  // Update myCompany — partial refresh from a single block (e.g. Keys.so refresh)
  const handleUpdateMyCompany = (next: AnalysisResult) => {
    setMyCompany(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_company_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      syncToServer("company", next);
    }
  };

  // Update single competitor in array
  const handleUpdateCompetitor = (idx: number, next: AnalysisResult) => {
    setCompetitors(prev => {
      const updated = prev.map((c, i) => i === idx ? next : c);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_competitors_${currentUser.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
        syncToServer("competitors", updated);
      }
      return updated;
    });
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

  const handleTAAnalysis = async (niche: string, extraContext: string, audienceType: TAAudienceType = "b2c", companyOverride?: AnalysisResult) => {
    // Когда вызывается из мастера сразу после handleNewAnalysis — React-state
    // ещё не успел обновиться, поэтому принимаем companyOverride явно.
    const company = companyOverride ?? myCompany;
    setIsTAAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-ta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company?.company.name ?? "",
          companyUrl: company?.company.url ?? "",
          niche,
          extraContext,
          audienceType,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа ЦА");
      const newAnalysis = json.data as TAResult;

      // Slot management: if existing active analysis is the same type — overwrite it.
      // Otherwise push current active to alt slot and make the new one active.
      const curType = taAnalysis?.audienceType ?? "b2c";
      if (!taAnalysis || curType === audienceType) {
        setTaAnalysis(newAnalysis);
      } else {
        setTaAnalysisAlt(taAnalysis);
        setTaAnalysis(newAnalysis);
      }

      if (currentUser?.id) {
        try { localStorage.setItem(`mr_ta_${currentUser.id}_${audienceType}`, JSON.stringify(newAnalysis)); } catch { /* ignore */ }
        syncToServer("ta", newAnalysis);
      }
      // Когда запущено из мастера (companyOverride передан) — НЕ переключаем
      // вкладку, оставляем юзера на dashboard. Иначе модули в фоне будут
      // перетаскивать его с экрана на экран.
      if (!companyOverride) setActiveNav("ta-dashboard");
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

  const handleSMMAnalysis = async (niche: string, links: SMMSocialLinks, companyOverride?: AnalysisResult) => {
    // Принимаем companyOverride чтобы работало сразу после handleNewAnalysis
    // (React state ещё не обновился в момент вызова из мастера).
    const company = companyOverride ?? myCompany;
    setIsSMMAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company?.company.name ?? "",
          companyUrl: company?.company.url ?? "",
          niche,
          socialLinks: links,
          websiteContext: company?.company.description ?? "",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа СММ");
      setSmmAnalysis(json.data);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_smm_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("smm", json.data);
      }
      if (!companyOverride) setActiveNav("smm-dashboard");
    } finally {
      setIsSMMAnalyzing(false);
    }
  };

  // ----- Content Factory -----

  const persistContent = (plan: ContentPlan | null, posts: GeneratedPost[], reels: GeneratedReel[]) => {
    if (!currentUser?.id) return;
    // КРИТИЧНО: data:image/...;base64,... в posts[].imageUrl (например когда
    // persistImageDataUri упал и API вернул raw base64) забивает 5MB localStorage
    // за один пост. Раньше posts/reels шли без sanitize → QuotaExceededError
    // → ВСЕ последующие saveItem падали молча → юзер генерил, всё пропадало.
    // persistStories/persistCarousels уже чистились, posts/reels — нет.
    const safePosts = sanitizeDataUrls(posts);
    const safeReels = sanitizeDataUrls(reels);
    const payload = JSON.stringify({ plan, posts: safePosts, reels: safeReels });
    try {
      localStorage.setItem(`mr_content_${currentUser.id}`, payload);
    } catch (e) {
      // Чаще всего — QuotaExceededError из-за base64-картинок в постах.
      // НЕ молчим: пользователь должен знать, что его пост может не пережить
      // reload, иначе генерирует ещё, теряет всё, и думает что платформа сломана.
      console.error("[persistContent] localStorage save failed:", e);
      const sizeMb = (payload.length / 1024 / 1024).toFixed(1);
      toast({
        kind: "error",
        title: "Не удалось сохранить контент в браузере",
        description:
          `Хранилище переполнено (~${sizeMb} MB). Удалите часть старых постов/рилсов, ` +
          `иначе после перезагрузки страницы свежие посты пропадут.`,
      });
    }
    // Серверный sync независимый: даже если localStorage упал, постараемся
    // сохранить на сервере. На сервер шлём ОРИГИНАЛЬНЫЕ posts/reels (без
    // sanitize) — там Postgres TEXT поле выдерживает большие base64, а
    // картинка нужна для отображения в чужих браузерах. Если 413 — warn
    // прилетит из syncToServer.
    syncToServer("content", { plan, posts, reels });
  };

  const handleUpdateAvatarSettings = (next: AvatarSettings) => {
    setAvatarSettings(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_avatar_settings_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      syncToServer("avatar", next);
    }
  };

  const handleUpdateCompanyStyle = (next: CompanyStyleState) => {
    setCompanyStyleState(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_company_style_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      syncToServer("companyStyle", next);
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

  // Дешёвая sanitization для media-полей: data:image/...;base64,... URI
  // имеют длину 1-2MB и при persist-е забивают localStorage / 413'ят POST /api/data.
  // Должны были стать /api/image/{id}, но если persistImageDataUri упал
  // (DB down, userId не подгружен) — клиент получил raw base64. Защищаемся:
  // вырезаем base64-URI на стороне UI, оставляем только короткие ссылки.
  // Пользователь увидит пустой слайд и сможет регенерировать одной кнопкой,
  // вместо «тихого» исчезновения всего набора при QuotaExceededError.
  const sanitizeDataUrls = <T,>(obj: T): T => {
    const s = JSON.stringify(obj);
    if (!s.includes("data:image/")) return obj;
    // Заменяем только содержимое в значениях string, не ломая структуру JSON.
    const cleaned = s.replace(/"data:image\/[^"\\]+(?:\\.[^"\\]*)*"/g, '""');
    try { return JSON.parse(cleaned) as T; } catch { return obj; }
  };

  const persistStories = (stories: GeneratedStory[]) => {
    if (!currentUser?.id) return;
    const safe = sanitizeDataUrls(stories);
    try { localStorage.setItem(`mr_stories_${currentUser.id}`, JSON.stringify(safe)); } catch { /* ignore */ }
    syncToServer("stories", safe);
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

  const persistCarousels = (carousels: GeneratedCarousel[]) => {
    if (!currentUser?.id) return;
    const safe = sanitizeDataUrls(carousels);
    try { localStorage.setItem(`mr_carousels_${currentUser.id}`, JSON.stringify(safe)); } catch { /* ignore */ }
    syncToServer("carousels", safe);
  };

  const handleAddCarousel = (carousel: GeneratedCarousel) => {
    setGeneratedCarousels(prev => {
      const next = [carousel, ...prev];
      persistCarousels(next);
      return next;
    });
  };

  const handleDeleteCarousel = (carouselId: string) => {
    setGeneratedCarousels(prev => {
      const next = prev.filter(c => c.id !== carouselId);
      persistCarousels(next);
      return next;
    });
  };

  const handleUpdateCarousel = (updated: GeneratedCarousel) => {
    setGeneratedCarousels(prev => {
      const next = prev.map(c => c.id === updated.id ? updated : c);
      persistCarousels(next);
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

  // Создание контента прямо из карточки идеи в "Трендах по нише".
  // Отдельная функция от handleGeneratePost, потому что у TrendContentIdea
  // другой shape (id/format/topic/hook/prompt/trendBasis vs ContentPostIdea).
  const handleCreateFromTrendIdea = React.useCallback(async (idea: TrendContentIdea) => {
    const companyName = myCompany?.company.name ?? smmAnalysis?.companyName ?? "MyCompany";
    const platform = "instagram"; // дефолт; в трендах формат ≠ платформа

    try {
      // ─ Пост / карусель / рилс — все идут через generate-post (текстовая идея).
      //   Карусель и рилс пока создаются как пост с пометкой формата —
      //   позже подключим отдельные API.
      if (idea.format === "пост" || idea.format === "карусель" || idea.format === "рилс") {
        const adaptedIdea: ContentPostIdea = {
          id: idea.id,
          pillar: "Тренды",
          hook: idea.hook,
          format: idea.format,
          angle: idea.topic,
          goal: "вовлечение",
          cta: "Что думаете? Поделитесь в комментариях.",
          platform,
        };

        const res = await fetch("/api/generate-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName,
            // Ниша из анализа — критично для image prompt при компаниях-омонимах
            // (например «Менделеев Стоматология» ≠ химик Менделеев).
            companyNiche: myCompany?.company?.description ?? "",
            idea: adaptedIdea,
            smmAnalysis,
            brandBook,
            companyStyleProfile: companyStyleState.applyToGeneration ? companyStyleState.profile : null,
            generateImage: true,
            userPrompt: idea.prompt, // пробрасываем оригинальный промпт идеи
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Ошибка генерации поста");

        setGeneratedPosts(prev => {
          const next = prependPostDedup(prev, json.data as GeneratedPost);
          persistContent(contentPlan, next, generatedReels);
          return next;
        });

        toast({
          kind: "success",
          title: `${idea.format.charAt(0).toUpperCase() + idea.format.slice(1)} готов 🎉`,
          description: `Сохранён в «Создать пост». Картинка готова.`,
          action: { label: "Открыть", onClick: () => setActiveNav("content-posts") },
        });
        return;
      }

      // ─ Сторис — отдельный API: генерим серию из 5 слайдов.
      if (idea.format === "сторис") {
        const res = await fetch("/api/generate-stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName,
            platform,
            slidesCount: 5,
            goal: "прогрев",
            brief: idea.prompt,
            pillar: idea.topic,
            smmAnalysis,
            brandBook,
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Ошибка генерации сторис");
        const story = json.data as GeneratedStory;

        // Сначала добавляем в стейт, потом запускаем фоновую генерацию картинок.
        setGeneratedStories(prev => {
          const next = [story, ...prev];
          persistStories(next);
          return next;
        });

        toast({
          kind: "success",
          title: "Серия сторис готова 🎉",
          description: `Сохранена в «Сторис-сценарии». Сейчас рисую фоны для всех слайдов…`,
          action: { label: "Открыть", onClick: () => setActiveNav("content-stories") },
        });

        // Параллельно генерим фоны. КРИТИЧНО: раньше через общий `let working`
        // 2-3 параллельных промиса читали stale snapshot и затирали друг друга
        // — из 5 слайдов оставалась только 1 картинка. Делаем как в
        // StoriesView.tsx: массив results[] по индексу, и в каждом setState
        // пересобираем slides[] из results, а не из stale working.
        const brandVisual = brandBook?.visualStyle?.trim();
        const brandColors = brandBook?.colors?.length ? `Brand palette: ${brandBook.colors.join(", ")}.` : "";
        const results: (string | null)[] = new Array(story.slides.length).fill(null);
        await Promise.all(story.slides.map(async (slide, i) => {
          try {
            const prompt = [
              `Story background for ${story.platform}: ${slide.background}.`,
              slide.visualNote && `Mood: ${slide.visualNote}.`,
              brandVisual && `Brand visual style: ${brandVisual}.`,
              brandColors,
              `Variation seed: ${story.id.slice(-4)}-${i + 1}.`,
              "Vertical 9:16 format. No text overlay.",
            ].filter(Boolean).join(" ");
            const r = await fetch("/api/generate-image-anthropic", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                postText: prompt,
                format: "сторис",
                platform: story.platform,
                brandColors: brandBook?.colors ?? [],
                brandStyle: brandBook?.visualStyle ?? "",
              }),
            });
            const j = await r.json() as { ok: boolean; data?: { imageUrl: string } };
            if (!j.ok || !j.data?.imageUrl) return;
            results[i] = j.data.imageUrl;
            // Атомарный setState — собираем slides из results, не из замыкания
            setGeneratedStories(prev => {
              const next = prev.map(s => {
                if (s.id !== story.id) return s;
                return {
                  ...s,
                  slides: s.slides.map((sl, idx) => {
                    const url = results[idx];
                    return url ? { ...sl, backgroundImageUrl: url } : sl;
                  }),
                };
              });
              persistStories(next);
              return next;
            });
          } catch { /* пропускаем — пользователь дорисует вручную */ }
        }));
        return;
      }

      throw new Error(`Формат «${idea.format}» пока не поддерживается`);
    } catch (e) {
      toast({
        kind: "error",
        title: "Не удалось создать контент",
        description: e instanceof Error ? e.message : "Неизвестная ошибка",
      });
    }
  }, [myCompany, smmAnalysis, brandBook, companyStyleState, contentPlan, generatedReels, toast]);

  // Пакетная генерация: одна идея тренда → пост + карусель + рилс + сторис
  // ВСЕ ПАРАЛЛЕЛЬНО. Адаптация workflow из cf.txt: один Trend Filter → 3-4
  // параллельных AI-агента. Всё попадает в свои разделы «Готовых».
  const handleCreatePackageFromTrend = React.useCallback(async (idea: TrendContentIdea) => {
    const companyName = myCompany?.company.name ?? smmAnalysis?.companyName ?? "MyCompany";
    const platform = "instagram";

    const adaptedIdea: ContentPostIdea = {
      id: `${idea.id}-pkg`,
      pillar: "Тренды",
      hook: idea.hook,
      format: "пост",
      angle: idea.topic,
      goal: "вовлечение",
      cta: "Что думаете? Поделитесь в комментариях.",
      platform,
    };

    // Открываем progress-модалку
    setPackageProgress({
      post: "loading",
      stories: "loading",
      carousel: "loading",
      reel: "loading",
    });

    // ─── Запускаем 4 задачи параллельно, обновляя прогресс по мере завершения каждой ───
    const postTask = fetch("/api/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        companyNiche: myCompany?.company?.description ?? "",
        idea: adaptedIdea, smmAnalysis, brandBook,
        companyStyleProfile: companyStyleState.applyToGeneration ? companyStyleState.profile : null,
        generateImage: true, userPrompt: idea.prompt,
      }),
    }).then(r => r.json()).then(json => {
      if (json?.ok && json.data) {
        setGeneratedPosts(prev => {
          const next = prependPostDedup(prev, json.data as GeneratedPost);
          // Используем refs для plan/reels — иначе stale snapshot из закрытия
          // затёр бы reel, который уже успел добавиться параллельно.
          persistContent(contentPlanRef.current, next, generatedReelsRef.current);
          return next;
        });
        setPackageProgress(p => p ? { ...p, post: "done" } : p);
        return true;
      }
      setPackageProgress(p => p ? { ...p, post: "failed" } : p);
      return false;
    }).catch(() => { setPackageProgress(p => p ? { ...p, post: "failed" } : p); return false; });

    const storyTask = fetch("/api/generate-stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName, platform,
        slidesCount: 5, goal: "прогрев",
        brief: idea.prompt, pillar: idea.topic,
        smmAnalysis, brandBook,
      }),
    }).then(r => r.json()).then(json => {
      if (json?.ok && json.data) {
        setGeneratedStories(prev => {
          const next = [json.data as GeneratedStory, ...prev];
          persistStories(next);
          return next;
        });
        setPackageProgress(p => p ? { ...p, stories: "done" } : p);
        return true;
      }
      setPackageProgress(p => p ? { ...p, stories: "failed" } : p);
      return false;
    }).catch(() => { setPackageProgress(p => p ? { ...p, stories: "failed" } : p); return false; });

    const carouselTask = fetch("/api/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        companyNiche: myCompany?.company?.description ?? "",
        idea: { ...adaptedIdea, id: `${idea.id}-car`, format: "карусель" as const },
        smmAnalysis, brandBook,
        companyStyleProfile: companyStyleState.applyToGeneration ? companyStyleState.profile : null,
        generateImage: true,
        userPrompt: `Карусель из 5-7 слайдов с разделителями ---. ${idea.prompt}`,
      }),
    }).then(r => r.json()).then(json => {
      if (json?.ok && json.data) {
        setGeneratedPosts(prev => {
          const next = prependPostDedup(prev, json.data as GeneratedPost);
          persistContent(contentPlanRef.current, next, generatedReelsRef.current);
          return next;
        });
        setPackageProgress(p => p ? { ...p, carousel: "done" } : p);
        return true;
      }
      setPackageProgress(p => p ? { ...p, carousel: "failed" } : p);
      return false;
    }).catch(() => { setPackageProgress(p => p ? { ...p, carousel: "failed" } : p); return false; });

    const reelTask = fetch("/api/generate-reel-scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        idea: {
          id: `${idea.id}-reel`,
          pillar: "Тренды",
          hook: idea.hook,
          intrigue: idea.topic,
          problem: "из тренда",
          solution: idea.prompt.slice(0, 200),
          result: "вовлечение",
          cta: "Подписывайтесь",
          durationSec: 30,
          visualStyle: "динамичный, кадры 2-3 сек",
          hashtags: [],
        },
        smmAnalysis, brandBook,
        voiceDescription: avatarSettings.voiceDescription,
        avatarDescription: avatarSettings.avatarDescription,
        userPrompt: idea.prompt,
      }),
    }).then(r => r.json()).then(json => {
      if (json?.ok && json.data) {
        setGeneratedReels(prev => {
          const next = [json.data as GeneratedReel, ...prev];
          persistContent(contentPlanRef.current, generatedPostsRef.current, next);
          return next;
        });
        setPackageProgress(p => p ? { ...p, reel: "done" } : p);
        return true;
      }
      setPackageProgress(p => p ? { ...p, reel: "failed" } : p);
      return false;
    }).catch(() => { setPackageProgress(p => p ? { ...p, reel: "failed" } : p); return false; });

    const [postOk, storyOk, carouselOk, reelOk] = await Promise.all([postTask, storyTask, carouselTask, reelTask]);
    const okCount = [postOk, storyOk, carouselOk, reelOk].filter(Boolean).length;

    // Закрываем модалку через 1.5с (даём пользователю увидеть финальный статус)
    setTimeout(() => setPackageProgress(null), 1500);

    if (okCount === 0) {
      toast({
        kind: "error",
        title: "Не удалось создать пакет",
        description: "Все 4 формата завершились с ошибкой. Попробуйте отдельные форматы по очереди.",
      });
      return;
    }

    toast({
      kind: "success",
      title: `Готово ${okCount}/4 формата 🎉`,
      description: okCount === 4 ? "Все материалы сохранены в «Готовые»." : `Сохранено ${okCount} из 4. Остальные можно перегенерировать отдельно.`,
      duration: 8000,
      action: { label: "Готовые посты", onClick: () => setActiveNav("content-posts") },
    });
  }, [myCompany, smmAnalysis, brandBook, companyStyleState, contentPlan, generatedPosts, generatedReels, avatarSettings, toast]);

  const handleGeneratePost = async (
    idea: ContentPostIdea,
    customPrompt?: string,
    imageOpts?: {
      imagePromptOverride?: string;
      imageStyle?: string;
      imageWithTextOverlay?: boolean;
      imageOverlayText?: string;
    },
  ) => {
    setGeneratingPostId(idea.id);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis?.companyName ?? "",
          companyNiche: myCompany?.company?.description ?? "",
          idea,
          // Раздельные настройки для текста и картинки.
          imagePromptOverride: imageOpts?.imagePromptOverride,
          imageStyle: imageOpts?.imageStyle,
          imageWithTextOverlay: imageOpts?.imageWithTextOverlay,
          imageOverlayText: imageOpts?.imageOverlayText,
          smmAnalysis,
          brandBook,
          companyStyleProfile: companyStyleState.applyToGeneration ? companyStyleState.profile : null,
          generateImage: true,
          userPrompt: customPrompt,
          referenceImages: referenceImages.map(r => ({ data: r.data, mimeType: r.mimeType })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации поста");
      setGeneratedPosts(prev => {
        const next = prependPostDedup(prev, json.data as GeneratedPost);
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
        persistContent(contentPlanRef.current, generatedPostsRef.current, next);
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
      persistContent(contentPlanRef.current, generatedPostsRef.current, next);
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
      persistContent(contentPlanRef.current, generatedPostsRef.current, next);
      return next;
    });
  };

  const handleGenerateReelVideo = async (reelId: string) => {
    const reel = generatedReels.find(r => r.id === reelId);
    if (!reel) return;
    setGeneratingVideoFor(reelId);
    try {
      // Видео-агент HeyGen v3 — единый запрос: аватар + b-roll + сабтитры.
      // Если есть запланированные b-roll сцены (status='planned') — передаём
      // их явным списком; иначе агент сам решит.
      const plannedScenes = (reel.brollClips ?? [])
        .filter(c => c.status === "planned" && c.prompt?.trim())
        .map(c => ({
          prompt: c.prompt,
          motionHint: c.motionHint,
          position: c.position,
          referenceImageUrl: c.referenceImageUrl,
        }));
      // Аватар: приоритет — выбранный на конкретном рилсе, иначе глобальный
      // из avatarSettings. selectedAvatarId хранится прямо в reel (берётся
      // из библиотеки customAvatars).
      const avatarIdToUse = reel.selectedAvatarId || avatarSettings.avatarId || undefined;
      const res = await fetch("/api/generate-reel-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: reel.voiceoverScript,
          avatarId: avatarIdToUse,
          voiceId: avatarSettings.voiceId || undefined,
          aspect: avatarSettings.aspect,
          title: reel.title,
          hook: reel.title,
          companyName: myCompany?.company?.name ?? "",
          companyNiche: myCompany?.company?.description ?? "",
          brollScenes: plannedScenes,
          targetDurationSec: reel.targetDurationSec ?? reel.durationSec ?? 30,
          subtitles: reel.subtitles !== false,
          videoMode: reel.videoMode ?? "mixed",
          // Voice quality knobs из глобальных AvatarSettings — пробрасываем
          // в HeyGen v3 для разборчивого, эмоционально окрашенного голоса.
          voiceSpeed: avatarSettings.voiceSpeed,
          voicePitch: avatarSettings.voicePitch,
          voiceEmotion: avatarSettings.voiceEmotion,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка HeyGen");
      const videoId: string = json.data.videoId;
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, heygenVideoId: videoId, videoStatus: "generating" as const, videoError: undefined }
          : r);
        persistContent(contentPlanRef.current, generatedPostsRef.current, next);
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, videoStatus: "failed" as const, videoError: msg }
          : r);
        persistContent(contentPlanRef.current, generatedPostsRef.current, next);
        return next;
      });
    } finally {
      setGeneratingVideoFor(null);
    }
  };

  // Стабильный depKey для poll-effect ниже. Без useMemo `.map().join()`
  // создавался на каждый рендер → setInterval пересоздавался → DDOS API.
  const reelsPollKey = useMemo(
    () => generatedReels.map(r => `${r.id}:${r.videoStatus}`).join(","),
    [generatedReels],
  );

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
              persistContent(contentPlanRef.current, generatedPostsRef.current, next);
              return next;
            });
          } else if (status === "failed") {
            setGeneratedReels(prev => {
              const next = prev.map(r => r.id === reel.id
                ? { ...r, videoStatus: "failed" as const, videoError: json.data.error ?? "HeyGen вернул failed" }
                : r);
              persistContent(contentPlanRef.current, generatedPostsRef.current, next);
              return next;
            });
          }
        } catch { /* keep polling */ }
      }
    }, 10_000);
    return () => clearInterval(interval);
    // Стабильный ключ — иначе `.map().join()` пересчитывался каждый рендер,
    // setInterval пересоздавался, /api/video-status DDOS-ился.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelsPollKey]);

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

    // Зачищаем ВСЕ кеши платформы из localStorage чтобы предотвратить
    // утечку данных между аккаунтами (например AI Visibility audits,
    // chat history, мини-кэши offers). Сохраняем только настройки темы
    // и сессионные ключи, чтобы UI после login'а не моргнул.
    try {
      if (typeof window !== "undefined") {
        const KEEP = new Set(["mr_theme", "mr_nav_bubble_seen"]);
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("mr_") && !KEEP.has(k)) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
      }
    } catch { /* ignore quota / cross-origin */ }

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
  // Пункты меню видны всем — отключённые в админке модули показывают заглушку
  // «В разработке, подпишитесь на уведомления» на своей странице, а не исчезают из сайдбара.
  const navSections = NAV_SECTIONS.map(section => ({ ...section, items: updateCounts(section.items) }));

  // Состояние воронки 6 шагов для OnboardingChecklist в empty-states.
  // Используется в Готовых постах / рилсах / сторис / каруселях.
  const onboardingState = React.useMemo(() => ({
    company: !!myCompany,
    competitors: competitors.length > 0,
    ta: !!taAnalysis,
    smm: !!smmAnalysis,
    brandbook: !!(brandBook && brandBook.brandName),
    content: !!(contentPlan && contentPlan.bigIdea),
  }), [myCompany, competitors.length, taAnalysis, smmAnalysis, brandBook, contentPlan]);

  // Screen routing
  if (appScreen === "landing") {
    return <LandingPageView c={c} theme={theme} setTheme={setTheme} onRegister={() => setAppScreen("register")} onLogin={() => setAppScreen("login")} />;
  }
  if (appScreen === "register") {
    return <RegisterView c={c} onSuccess={(user) => {
      // Новый юзер — обязательно зачищаем все кэши других аккаунтов из
      // localStorage (если предыдущий юзер не нажимал «Выход», его
      // mr_ai_visibility_audits, mr_chat_history и т.д. могли остаться).
      try {
        if (typeof window !== "undefined") {
          const KEEP = new Set(["mr_theme", "mr_nav_bubble_seen", "mr_last_uid"]);
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith("mr_") && !KEEP.has(k)) {
              localStorage.removeItem(k);
            }
          }
          localStorage.setItem("mr_last_uid", user.id);
        }
      } catch { /* ignore */ }

      // Новый flow: после регистрации НЕ запускаем анализ автоматически,
      // а показываем wizard с предзаполненным URL — пользователь выбирает
      // какие модули хочет (ЦА / СММ / Конкуренты / Отзывы) и стартует.
      setCurrentUser(user);
      setAppScreen("app");
      if (user.companyUrl) {
        setCurrentUrl(user.companyUrl);
      }
      setActiveNav("new-analysis");
    }} onLogin={() => setAppScreen("login")} onBack={() => setAppScreen("landing")} />;
  }
  if (appScreen === "login") {
    return <LoginView c={c} onSuccess={async (user) => {
      // Защита от утечки данных между аккаунтами: если в localStorage
      // остались ключи от ДРУГОГО юзера (например выход не нажимали,
      // session expired) — снимаем НЕскоупленные кэши.
      try {
        if (typeof window !== "undefined") {
          const lastUid = localStorage.getItem("mr_last_uid");
          if (lastUid && lastUid !== user.id) {
            const KEEP = new Set(["mr_theme", "mr_nav_bubble_seen", "mr_last_uid"]);
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const k = localStorage.key(i);
              if (k && k.startsWith("mr_") && !KEEP.has(k) && !k.endsWith(`_${user.id}`)) {
                localStorage.removeItem(k);
              }
            }
          }
          localStorage.setItem("mr_last_uid", user.id);
        }
      } catch { /* ignore */ }

      setCurrentUser(user);
      await loadAndApplyUserData(user.id);
      setAppScreen(user.onboardingDone ? "app" : "onboarding");
    }} onRegister={() => setAppScreen("register")} onBack={() => setAppScreen("landing")} />;
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
          <MarketRadarLogo size={28} variant={theme === "light" ? "light" : "dark"} animated />
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>
            <span style={{ fontWeight: 400, opacity: 0.6 }}>Market</span>Radar
          </span>
        </div>
        <button onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "warm" : "light")} aria-label="Сменить тему"
          style={{ background: "transparent", border: "none", width: 40, height: 40, cursor: "pointer", fontSize: 18, borderRadius: 8 }}>
          {theme === "light" ? <Moon size={14}/> : theme === "dark" ? <Coffee size={14}/> : <Sun size={14}/>}
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
            <MarketRadarLogo size={30} variant="dark" animated />
            <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.dark.sidebarText }}>
              <span style={{ fontWeight: 400, opacity: 0.6 }}>Market</span>Radar
            </span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.dark.sidebarTextMuted, borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        </div>
        <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav}
          setActiveNav={setActiveNavMobile} navSections={navSections}
          companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout}
          workspaces={availableWorkspaces.map(w => ({ workspaceId: w.workspaceId, role: w.role, displayName: w.ownerCompanyName || w.ownerName || w.ownerEmail || "Моя команда" }))}
          activeWorkspaceId={activeWorkspace?.workspaceId}
          onSwitchWorkspace={handleSwitchWorkspace} />
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
          <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={(id) => { if (id === "owner-dashboard") { handleNavClick(id); return; } setSelectedCompetitor(null); setActiveNav(id); }} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout}
            workspaces={availableWorkspaces.map(w => ({ workspaceId: w.workspaceId, role: w.role, displayName: w.ownerCompanyName || w.ownerName || w.ownerEmail || "Моя команда" }))}
            activeWorkspaceId={activeWorkspace?.workspaceId}
            onSwitchWorkspace={handleSwitchWorkspace} />
          <main className="ds-mobile-page-padding" style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
            <CompetitorProfileView
              c={c}
              data={competitors[selectedCompetitor]}
              myCompany={myCompany}
              onBack={() => { setSelectedCompetitor(null); setActiveNav("competitors"); }}
              onUpdateData={(next) => handleUpdateCompetitor(selectedCompetitor, next)}
            />
          </main>
        </div>
      </div>
    );
  }

  // App: main dashboard layout
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Inter', 'PT Sans', system-ui, sans-serif", background: "var(--background)", color: "var(--foreground)" }}>
      <style>{`::selection { background: "var(--primary)"30; } button { transition: opacity 0.15s ease, transform 0.1s ease; } button:hover:not(:disabled) { opacity: 0.92; } button:active:not(:disabled) { transform: scale(0.98); }`}</style>
      {whiteLabel?.enabled && whiteLabel.accentColor.length === 7 && (
        <style>{buildAccentCss(whiteLabel.accentColor)}</style>
      )}
      {mobileNav}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={handleNavClick} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} hideBranding={whiteLabel?.enabled && whiteLabel.hideBranding}
        workspaces={availableWorkspaces.map(w => ({ workspaceId: w.workspaceId, role: w.role, displayName: w.ownerCompanyName || w.ownerName || w.ownerEmail || "Моя команда" }))}
        activeWorkspaceId={activeWorkspace?.workspaceId}
        onSwitchWorkspace={handleSwitchWorkspace} />
      <main className="ds-mobile-page-padding" style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        <TrialBanner userId={currentUser?.id} />
        <PaywallGuard />
        {/* Баннер «вы смотрите чужой workspace» — для editor'а и viewer'а */}
        {activeWorkspace && !activeWorkspace.isOwnWorkspace && (
          <div style={{
            marginBottom: 16, padding: "10px 14px", borderRadius: 10,
            background: isReadOnly ? "color-mix(in oklch, var(--warning) 12%, transparent)" : "color-mix(in oklch, var(--primary) 10%, transparent)",
            color: isReadOnly ? "var(--warning)" : "var(--primary)",
            fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10,
          }}>
            <span>👁️</span>
            <span>
              Вы в рабочем пространстве <b>{activeWorkspace.displayName}</b>
              {" · "}
              {isReadOnly ? "только для просмотра" : "редактор"}
            </span>
          </div>
        )}
        <VisitTracker source="platform" />
        {/* Глобальные оверлеи — пакетная генерация */}
        {packageProgress && <PackageProgressModal progress={packageProgress} />}
        {activeNav === "agents" && <AgentHubView c={c} />}
        {activeNav === "new-analysis" && <NewAnalysisWizard c={c} onSubmit={handleNewAnalysisWithOptions} isAnalyzing={isAnalyzing} initialUrl={currentUser?.companyUrl ?? currentUrl ?? undefined} />}
        {activeNav === "dashboard" && (myCompany ? <DashboardView c={c} data={myCompany} competitors={competitors} onUpdateData={handleUpdateMyCompany} /> : <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />)}
        {activeNav === "prev-analyses" && <PreviousAnalysesView c={c} history={analysisHistory} currentAnalysis={myCompany} onDeleteHistory={handleDeleteHistory} />}
        {activeNav === "competitors" && <CompetitorsView c={c} myCompany={myCompany} competitors={competitors} onSelectCompetitor={(i) => { setSelectedCompetitor(i); }} onAddCompetitor={handleAddCompetitor} onDeleteCompetitor={handleDeleteCompetitor} isAnalyzing={isAnalyzing} />}
        {activeNav === "compare" && <CompareView c={c} myCompany={myCompany} competitors={competitors} />}
        {activeNav === "battle-cards" && <BattleCardsView c={c} myCompany={myCompany} competitors={competitors} userId={currentUser?.id ?? ""} />}
        {activeNav === "insights" && myCompany && <InsightsView c={c} data={myCompany} competitors={competitors} />}
        {activeNav === "ai-visibility" && <AIVisibilityView c={c} myCompany={myCompany} userId={currentUser?.id} />}
        {activeNav === "swot" && <SWOTView c={c} company={myCompany ?? null} competitors={competitors} ta={taAnalysis} smm={smmAnalysis} userId={currentUser?.id} />}
        {activeNav === "price-tracking" && <PriceTrackingView />}
        {activeNav === "content-style" && (
          <CompanyStyleView
            c={c}
            state={companyStyleState}
            onChange={handleUpdateCompanyStyle}
            companyName={myCompany?.company.name ?? ""}
          />
        )}
        {activeNav === "reports" && <ReportsView c={c} data={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} competitors={competitors} />}
        {activeNav === "sources" && <SourcesView c={c} />}
        {activeNav === "settings" && <SettingsView c={c} user={currentUser} onUpdateUser={(updated) => setCurrentUser(updated)} onWhiteLabelChange={(cfg) => { setWhiteLabel(cfg); if (currentUser) saveWhiteLabel(currentUser.id, cfg); }} />}
        {activeNav === "ta-new" && <NewTAView c={c} myCompany={myCompany} isAnalyzing={isTAAnalyzing} onAnalyze={handleTAAnalysis} existingTypes={taExistingTypes} />}
        {activeNav === "ta-dashboard" && (taAnalysis ? <TADashboardView c={c} data={taAnalysis} altData={taAnalysisAlt} onSwitchType={handleSwitchTAType} onRunNew={() => setActiveNav("ta-new")} /> : <TAEmptyDashboard c={c} onRunAnalysis={() => setActiveNav("ta-new")} />)}
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
        {/* Если родительский «Контент-завод» выключен — все 9 вкладок показывают общий ComingSoonView. */}
        {(activeNav === "content-trends" || activeNav === "content-plan" || activeNav === "content-calendar" || activeNav === "content-posts" || activeNav === "content-reels" || activeNav === "content-stories" || activeNav === "content-carousels" || activeNav === "content-analytics" || activeNav === "content-roi") && !featureOn("content-factory") && (
          <ComingSoonView c={c} featureId="content-factory" title={features.labels["content-factory"] ?? "Контент-завод"} description={features.descriptions["content-factory"]} userEmail={currentUser?.email} />
        )}
        {/* Родитель включён, но конкретная вкладка точечно выключена админом — показываем её собственный ComingSoonView. */}
        {(activeNav === "content-trends" || activeNav === "content-plan" || activeNav === "content-calendar" || activeNav === "content-posts" || activeNav === "content-reels" || activeNav === "content-stories" || activeNav === "content-carousels" || activeNav === "content-analytics" || activeNav === "content-roi") && featureOn("content-factory") && !featureOn(activeNav) && (
          <ComingSoonView c={c} featureId={activeNav} title={features.labels[activeNav] ?? "Модуль"} description={features.descriptions[activeNav]} userEmail={currentUser?.email} />
        )}
        {activeNav === "content-trends" && featureOn("content-factory") && featureOn("content-trends") && <ContentTrendsView analysis={myCompany ?? null} userId={currentUser?.id} onCreateFromIdea={handleCreateFromTrendIdea} onCreatePackage={handleCreatePackageFromTrend} />}
        {activeNav === "content-plan" && featureOn("content-factory") && featureOn("content-plan") && (
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
                currentCompanyName={myCompany?.company.name}
                onRegenerateForCurrentCompany={() => {
                  // Сбрасываем старый план — открывается NewContentPlanView
                  setContentPlan(null);
                }}
              />
            : <NewContentPlanView c={c} myCompany={myCompany} smm={smmAnalysis} isGenerating={isGeneratingPlan} onGenerate={handleGenerateContentPlan} />
        )}
        {activeNav === "content-calendar" && featureOn("content-factory") && featureOn("content-calendar") && (
          <ContentCalendarView
            c={c}
            posts={generatedPosts}
            reels={generatedReels}
            stories={generatedStories}
            carousels={generatedCarousels}
            onUpdatePost={handleUpdatePost}
            onUpdateReel={handleUpdateReel}
            onUpdateStory={handleUpdateStory}
            onUpdateCarousel={handleUpdateCarousel}
            onGoToPost={() => setActiveNav("content-posts")}
            onGoToReel={() => setActiveNav("content-reels")}
            onGoToStory={() => setActiveNav("content-stories")}
            onGoToCarousel={() => setActiveNav("content-carousels")}
          />
        )}
        {activeNav === "content-posts" && featureOn("content-factory") && featureOn("content-posts") && (
          <GeneratedPostsView
            c={c}
            posts={generatedPosts}
            onUpdatePost={handleUpdatePost}
            onDeletePost={handleDeletePost}
            referenceImages={referenceImages}
            onUpdateReferenceImages={setReferenceImages}
            brandBook={brandBook}
            onboardingState={onboardingState}
            // Встроенный блок «Создать пост»
            plan={contentPlan}
            isGeneratingPost={generatingPostId !== null}
            generatingPostId={generatingPostId}
            onGeneratePost={handleGeneratePost}
          />
        )}
        {activeNav === "content-reels" && featureOn("content-factory") && featureOn("content-reels") && (
          <GeneratedReelsView
            c={c}
            reels={generatedReels}
            onGenerateVideo={handleGenerateReelVideo}
            generatingVideoFor={generatingVideoFor}
            avatarSettings={avatarSettings}
            onUpdateAvatarSettings={handleUpdateAvatarSettings}
            onUpdateReel={handleUpdateReel}
            onDeleteReel={handleDeleteReel}
            onboardingState={onboardingState}
            brandBook={brandBook}
            // Встроенный блок «Создать видео»
            plan={contentPlan}
            isGeneratingReel={generatingReelId !== null}
            generatingReelId={generatingReelId}
            onGenerateReelScenario={handleGenerateReelScenario}
            // Контекст компании — критично для b-roll промптов
            companyName={myCompany?.company.name}
            companyNiche={myCompany?.company.description ?? ""}
          />
        )}
        {activeNav === "content-stories" && featureOn("content-factory") && featureOn("content-stories") && <StoriesView c={c} stories={generatedStories} plan={contentPlan} smmAnalysis={smmAnalysis} myCompany={myCompany} taResult={taAnalysis} companyName={myCompany?.company.name ?? ""} brandBook={brandBook} onAdd={handleAddStory} onDelete={handleDeleteStory} onUpdate={handleUpdateStory} onboardingState={onboardingState} />}
        {activeNav === "content-carousels" && featureOn("content-factory") && featureOn("content-carousels") && <GeneratedCarouselsView c={c} carousels={generatedCarousels} plan={contentPlan} smmAnalysis={smmAnalysis} myCompany={myCompany} taResult={taAnalysis} companyName={myCompany?.company.name ?? ""} brandBook={brandBook} onAdd={handleAddCarousel} onDelete={handleDeleteCarousel} onUpdate={handleUpdateCarousel} onboardingState={onboardingState} />}
        {activeNav === "content-analytics" && featureOn("content-factory") && featureOn("content-analytics") && <ContentAnalyticsView c={c} posts={generatedPosts} reels={generatedReels} stories={generatedStories} carousels={generatedCarousels} companyName={myCompany?.company.name ?? ""} />}
        {activeNav === "content-roi" && featureOn("content-factory") && featureOn("content-roi") && <ROICalculatorView c={c} posts={generatedPosts} reels={generatedReels} stories={generatedStories} carousels={generatedCarousels} />}
        {(activeNav === "seo-new" || activeNav === "seo-library" || activeNav === "seo-keywords" || activeNav === "seo-expand" || activeNav === "seo-paa" || activeNav === "seo-tech-audit") && (
          featureOn("seo-articles")
            ? <SEOArticlesView
                c={c}
                userId={currentUser?.id ?? ""}
                analysis={myCompany ?? null}
                taResult={taAnalysis}
                brandBook={brandBook}
                companyStyleProfile={companyStyleState.applyToGeneration ? companyStyleState.profile : null}
                companyStyleState={companyStyleState}
                onUpdateCompanyStyle={handleUpdateCompanyStyle}
                onOpenStyleTab={() => setActiveNav("content-style")}
                activeSubNav={activeNav}
                mode="seo"
              />
            : <ComingSoonView c={c} featureId="seo-articles" title={features.labels["seo-articles"] ?? "SEO-статьи"} description={features.descriptions["seo-articles"]} userEmail={currentUser?.email} />
        )}
        {/* GEO-статьи — то же что SEO, но в режиме mode="geo".
            Шарят SEOArticlesView + localStorage с SEO, разделение по brief.articleMode. */}
        {(activeNav === "geo-new" || activeNav === "geo-library") && (
          featureOn("seo-articles")
            ? <SEOArticlesView
                c={c}
                userId={currentUser?.id ?? ""}
                analysis={myCompany ?? null}
                taResult={taAnalysis}
                brandBook={brandBook}
                companyStyleProfile={companyStyleState.applyToGeneration ? companyStyleState.profile : null}
                companyStyleState={companyStyleState}
                onUpdateCompanyStyle={handleUpdateCompanyStyle}
                onOpenStyleTab={() => setActiveNav("content-style")}
                activeSubNav={activeNav}
                mode="geo"
              />
            : <ComingSoonView c={c} featureId="seo-articles" title="GEO-статьи" description="Оптимизация статей под LLM-поисковики (Алиса, ChatGPT Search, Perplexity)" userEmail={currentUser?.email} />
        )}
        {activeNav === "reviews-analysis" && (
          featureOn("reviews-analysis")
            ? <ReviewsView c={c} companyName={myCompany?.company.name ?? ""} domain={myCompany?.company.url} niche={myCompany?.company.description ?? ""} />
            : <ComingSoonView c={c} featureId="reviews-analysis" title={features.labels["reviews-analysis"] ?? "Рынок и отзывы"} description={features.descriptions["reviews-analysis"]} userEmail={currentUser?.email} />
        )}
        {activeNav === "brand-presentation" && (
          featureOn("brand-presentation")
            ? <PresentationView c={c} myCompany={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} brandBook={brandBook} userId={currentUser?.id ?? ""} />
            : <ComingSoonView c={c} featureId="brand-presentation" title={features.labels["brand-presentation"] ?? "Презентации"} description={features.descriptions["brand-presentation"]} userEmail={currentUser?.email} />
        )}
        {activeNav === "landing-generator" && (
          featureOn("landing-generator")
            ? <LandingGeneratorView c={c} myCompany={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} brandBook={brandBook} userId={currentUser?.id ?? ""} />
            : <ComingSoonView c={c} featureId="landing-generator" title={features.labels["landing-generator"] ?? "Лендинги"} description={features.descriptions["landing-generator"]} userEmail={currentUser?.email} />
        )}
      </main>
      </div>
      {/* AI Chat Widget — floating, always visible when logged in */}
      <AIChatWidget
        myCompany={myCompany}
        competitors={competitors}
        taAnalysis={taAnalysis}
        smmAnalysis={smmAnalysis}
        userId={currentUser?.id}
      />
    </div>
  );
}

// ============================================================
// Customer Journey Map View
// ============================================================

