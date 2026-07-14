"use client";

/**
 * KpProposal — интерактивное коммерческое предложение по анализу сайта.
 *
 * Публичная логика вдохновлена длинными «КП-аудитами» агентств (диагноз →
 * находки → конкуренты → точки роста → план → тарифы → CTA), но переосмыслена
 * под MarketRadar и сделана лучше: единый дизайн платформы (CSS-переменные,
 * светлая/тёмная тема), липкая навигация со скролл-спаем, прогресс-баром и
 * скользящим индикатором активной вкладки, scroll-reveal анимации, radar-чарт
 * категорий, кольцевые gauge вместо плоских чисел, анимированные count-up
 * значения.
 *
 * Всё строится из РЕАЛЬНОГО анализа (AnalysisResult) — никаких выдумок: секции
 * без данных не показываются. Тарифы — предложение MarketRadar (редактируется
 * через PACKAGES ниже).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, Recommendation } from "@/lib/types";
import {
  AlertTriangle, CheckCircle2, TriangleAlert, Gauge, Target, Rocket,
  ListChecks, ArrowRight, TrendingUp, TrendingDown, Minus, Zap, Mail, Radar as RadarIcon,
} from "lucide-react";

interface Props {
  company: AnalysisResult | null;
  competitors: AnalysisResult[];
  /** Контактный e-mail для CTA. */
  contactEmail?: string;
}

type Severity = "critical" | "warning" | "ok";
interface Finding {
  severity: Severity;
  category: string;
  title: string;
  detail: string;
}

// ─── Тарифные пакеты MarketRadar (предложение — правится здесь) ─────────────
const PACKAGES = [
  {
    name: "SEO-продвижение",
    accent: "var(--primary)",
    tiers: [
      { tier: "Старт", price: "30 000 ₽/мес", items: ["Технический аудит + правки", "Семантика по 1 кластеру", "Оптимизация 5 страниц"] },
      { tier: "Оптимум", price: "65 000 ₽/мес", items: ["Всё из «Старт»", "3 кластера запросов", "Контент-план + линкбилдинг", "Ежемесячный отчёт"], featured: true },
      { tier: "Максимум", price: "100 000 ₽/мес", items: ["Всё из «Оптимум»", "Все кластеры ниши", "Приоритетная выдача задач"] },
    ],
  },
  {
    name: "Контекстная реклама",
    accent: "var(--warning)",
    tiers: [
      { tier: "Старт", price: "35 000 ₽/мес", items: ["Настройка Яндекс.Директ", "1 кампания на поиск", "Базовая аналитика целей"] },
      { tier: "Оптимум", price: "45 000 ₽/мес", items: ["Всё из «Старт»", "Поиск + РСЯ", "A/B объявлений", "Управление ставками"], featured: true },
      { tier: "Максимум", price: "55 000 ₽/мес", items: ["Всё из «Оптимум»", "Ретаргетинг + look-alike", "Сквозная аналитика"] },
    ],
  },
  {
    name: "Контент-маркетинг",
    accent: "var(--success)",
    tiers: [
      { tier: "Старт", price: "25 000 ₽/мес", items: ["4 поста в соцсети", "1 экспертная статья", "Контент-план на месяц"] },
      { tier: "Оптимум", price: "45 000 ₽/мес", items: ["Всё из «Старт»", "8 постов + сторис", "2 статьи + рассылка"], featured: true },
      { tier: "Максимум", price: "75 000 ₽/мес", items: ["Всё из «Оптимум»", "Видео/Reels", "Полный SMM-цикл"] },
    ],
  },
];

const SECTIONS = [
  { id: "overview", label: "Обзор" },
  { id: "findings", label: "Находки" },
  { id: "tech", label: "Тех-аудит" },
  { id: "competitors", label: "Конкуренты" },
  { id: "growth", label: "Точки роста" },
  { id: "plan", label: "План" },
  { id: "pricing", label: "Тарифы" },
  { id: "cta", label: "Заявка" },
] as const;

// ─── helpers ────────────────────────────────────────────────────────────────
const scoreColor = (s: number) => (s >= 70 ? "var(--success)" : s >= 45 ? "var(--warning)" : "var(--destructive)");
const verdictOf = (s: number) =>
  s >= 80 ? "Сильный сайт с точечными зонами роста"
  : s >= 60 ? "Хорошая база, но упускаете часть трафика и лидов"
  : s >= 40 ? "Средний уровень — конкуренты вас обходят"
  : "Сайт недобирает: критичные проблемы мешают привлекать клиентов";

/** Пояснение по баллу категории — общий текст для карточки-аккордеона и находок. */
const categoryVerdict = (score: number) =>
  score < 45 ? "Показатель значительно ниже нормы. Это напрямую тормозит привлечение клиентов из этого канала."
  : score < 65 ? "Средний уровень: конкуренты с более сильным показателем забирают часть вашей аудитории."
  : "Хороший результат, поддерживаем на текущем уровне.";

export function KpProposal({ company, competitors, contactEmail = "hello@marketradar24.ru" }: Props) {
  const [active, setActive] = useState<string>("overview");
  const [progress, setProgress] = useState(0);
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [techTab, setTechTab] = useState<"mobile" | "desktop">("mobile");
  const rootRef = useRef<HTMLDivElement>(null);

  // ─── Находки из реальных данных ──
  const findings = useMemo<Finding[]>(() => buildFindings(company, competitors), [company, competitors]);
  const shownFindings = useMemo(
    () => (sevFilter === "all" ? findings : findings.filter((f) => f.severity === sevFilter)),
    [findings, sevFilter],
  );
  const sevCounts = useMemo(() => ({
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    ok: findings.filter((f) => f.severity === "ok").length,
  }), [findings]);

  // ─── Рейтинг конкурентов ──
  const ranking = useMemo(() => {
    const rows: Array<{ name: string; score: number; mine: boolean }> = [];
    if (company) rows.push({ name: company.company.name, score: company.company.score, mine: true });
    competitors.slice(0, 8).forEach((c) => rows.push({ name: c.company.name, score: c.company.score, mine: false }));
    return rows.sort((a, b) => b.score - a.score);
  }, [company, competitors]);
  const myRank = ranking.findIndex((r) => r.mine) + 1;

  // ─── Impact/Effort матрица ──
  const recs = company?.recommendations ?? [];
  const buckets = useMemo(() => ({
    "quick-win": recs.filter((r) => bucketOf(r) === "quick-win"),
    "big-bet": recs.filter((r) => bucketOf(r) === "big-bet"),
    "fill-in": recs.filter((r) => bucketOf(r) === "fill-in"),
  }), [recs]);

  // ─── План работ ──
  const plan = useMemo(() => buildPlan(recs), [recs]);

  // ─── Lighthouse ──
  const lh = company?.seo.lighthouseScores;
  const lhSet = techTab === "desktop" ? lh?.desktop : lh;
  const hasTech = !!lh && (!!lhSet?.performance || !!lhSet?.seo);

  // ─── Видимость (Keys.so) ──
  const vis = company?.keysoDashboard?.yandex ?? company?.keysoDashboard?.google;

  // ─── «Почему это важно» — мостик диагноз → необходимость действия, только реальные числа ──
  const aheadCount = useMemo(
    () => (company ? competitors.filter((cm) => cm.company.score > company.company.score).length : 0),
    [company, competitors],
  );
  const nicheGap = company ? Math.round(company.company.avgNiche - company.company.score) : 0;
  const opportunityCount = company?.nicheForecast?.opportunities?.length ?? 0;
  const showWhyPanel = !!company && (sevCounts.critical > 0 || opportunityCount > 0);

  // ─── скролл-спай + прогресс ──
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0);
      let current: string = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(`kp-${s.id}`);
        if (el && el.getBoundingClientRect().top <= 120) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(`kp-${id}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
  };

  // ─── скользящий индикатор активной вкладки в навигации ──
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const btn = btnRefs.current[active];
    if (btn) setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [active]);

  if (!company) return <KpEmpty />;
  const c = company.company;
  const niche = company.nicheForecast;
  const categories = c.categories ?? [];

  return (
    <div ref={rootRef} style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh", fontFamily: "var(--font-sans, system-ui, sans-serif)", position: "relative" }}>
      <DotGridBackdrop />

      {/* Прогресс-бар */}
      <div style={{ position: "fixed", top: 0, left: 0, height: 3, width: `${progress}%`, background: "var(--primary)", zIndex: 60, transition: "width 0.1s linear", boxShadow: "0 0 8px color-mix(in srgb, var(--primary) 70%, transparent)" }} />

      {/* Липкая навигация */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50, background: "color-mix(in srgb, var(--background) 88%, transparent)",
        backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
            <span style={{ color: "var(--primary)" }}>MarketRadar</span>
            <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>· КП</span>
          </div>
          <div className="kp-navscroll" style={{ position: "relative", display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: pill.left, width: pill.width,
              background: "var(--primary)", borderRadius: 999, transition: "left 0.32s var(--ease), width 0.32s var(--ease)", zIndex: 0,
            }} />
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                ref={(el) => { btnRefs.current[s.id] = el; }}
                onClick={() => scrollTo(s.id)}
                style={{
                  position: "relative", zIndex: 1, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  fontSize: 13, fontWeight: 600, background: "transparent",
                  color: active === s.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  transition: "color 0.2s var(--ease)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px 80px", position: "relative" }}>

        {/* ─── HERO / ОБЗОР ─── */}
        <Section id="overview">
          <div className="kp-hero" style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "36px 32px" }}>
            <HeroBlobs score={c.score} />
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 32, alignItems: "center" }} className="kp-hero-grid">
              <Reveal>
                {(v) => (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                      Коммерческое предложение · анализ сайта
                    </div>
                    <h1 style={{ fontSize: 40, fontWeight: 850, lineHeight: 1.1, margin: "0 0 10px", letterSpacing: "-0.02em" }}>{c.name}</h1>
                    {c.url && <a href={c.url.startsWith("http") ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 15, textDecoration: "none" }}>{c.url}</a>}
                    <p style={{ fontSize: 18, lineHeight: 1.5, marginTop: 18, color: "var(--foreground)" }}>{verdictOf(c.score)}.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                      <Badge icon={<Target size={15} />} label="Проанализировано конкурентов" value={competitors.length} active={v} />
                      <Badge icon={<AlertTriangle size={15} />} label="Критичных проблем" value={sevCounts.critical} color="var(--destructive)" active={v} />
                      <Badge icon={<ListChecks size={15} />} label="Рекомендаций" value={recs.length} active={v} />
                      {myRank > 0 && <Badge icon={<Gauge size={15} />} label="Позиция среди конкурентов" value={myRank} prefix="#" active={v} />}
                    </div>
                    <button onClick={() => scrollTo("cta")} className="ds-btn ds-btn-primary kp-cta-glow" style={{ marginTop: 26, height: 46, padding: "0 22px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      Обсудить проект <ArrowRight size={17} />
                    </button>
                  </div>
                )}
              </Reveal>
              <Reveal delay={120}>{(v) => <Ring value={c.score} size={220} stroke={16} active={v} sublabel="общий балл / 100" />}</Reveal>
            </div>
          </div>

          {/* Radar-чарт + категории анализа: карточки в 2 колонки, пояснение видно сразу (без клика) */}
          {categories.length > 0 && (
            <div className="kp-radar-wrap" style={{ display: "grid", gridTemplateColumns: categories.length >= 3 ? "minmax(240px,320px) 1fr" : "1fr", gap: 28, marginTop: 40, alignItems: "start" }}>
              {categories.length >= 3 && (
                <Reveal delay={80}>
                  {(v) => (
                    <div className="ds-card" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", alignSelf: "flex-start" }}>
                        <RadarIcon size={13} /> Профиль по категориям
                      </div>
                      <RadarChart categories={categories.map((cat) => ({ name: cat.name, score: cat.score }))} active={v} />
                    </div>
                  )}
                </Reveal>
              )}
              <div className="kp-cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, alignItems: "stretch" }}>
                {categories.map((cat, i) => {
                  const isDanglingLast = categories.length % 2 === 1 && i === categories.length - 1;
                  return (
                    <div key={i} style={{ gridColumn: isDanglingLast ? "1 / -1" : undefined, height: "100%" }}>
                      <Reveal delay={i * 60}>
                        {(v) => (
                          <div className="ds-card ds-card-interactive" style={{ padding: "14px 16px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>{cat.name}</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: 24, fontWeight: 800, color: scoreColor(cat.score), fontVariantNumeric: "tabular-nums" }}>
                                <CountUp target={cat.score} active={v} />
                              </span>
                              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/100</span>
                              {cat.delta !== 0 && <DeltaChip delta={cat.delta} />}
                            </div>
                            <div style={{ height: 5, borderRadius: 999, background: "var(--muted)", marginTop: 8, overflow: "hidden" }}>
                              <div style={{ width: v ? `${Math.max(3, Math.min(100, cat.score))}%` : "0%", height: "100%", background: scoreColor(cat.score), borderRadius: 999, transition: "width 0.9s var(--ease) 0.1s" }} />
                            </div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--muted-foreground)", marginTop: 8 }}>
                              {categoryVerdict(cat.score)}
                            </div>
                          </div>
                        )}
                      </Reveal>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        {/* ─── ПОЧЕМУ ЭТО ВАЖНО (мостик диагноз → необходимость действия) ─── */}
        {showWhyPanel && (
          <Reveal>
            {() => (
              <div className="ds-card kp-why-panel" style={{ borderLeft: "4px solid var(--primary)", padding: "22px 26px", marginTop: 32, display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                {nicheGap > 0
                  ? <TrendingDown size={22} style={{ color: "var(--destructive)", flexShrink: 0, marginTop: 2 }} />
                  : <TrendingUp size={22} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--primary)", marginBottom: 8 }}>
                    Почему это важно
                  </div>
                  <p style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.4, margin: "0 0 8px" }}>
                    {nicheGap > 3
                      ? `Вы отстаёте от среднего уровня по нише на ${nicheGap} ${ruPlural(nicheGap, "балл", "балла", "баллов")}`
                      : nicheGap < -3
                      ? `Вы опережаете средний уровень по нише на ${-nicheGap} ${ruPlural(-nicheGap, "балл", "балла", "баллов")}`
                      : `Вы на уровне среднего по нише`}
                    {aheadCount > 0 && ` — ${aheadCount} ${ruPlural(aheadCount, "конкурент опережает", "конкурента опережают", "конкурентов опережают")} вас по общему баллу`}
                  </p>
                  <p style={{ fontSize: 14.5, color: "var(--muted-foreground)", lineHeight: 1.55, margin: 0 }}>
                    Это напрямую влияет на то, сколько клиентов доходит до вас, а не до конкурентов.
                    {sevCounts.critical > 0 && ` Мы нашли ${sevCounts.critical} ${ruPlural(sevCounts.critical, "критичную проблему", "критичные проблемы", "критичных проблем")}`}
                    {sevCounts.critical > 0 && opportunityCount > 0 && " и "}
                    {opportunityCount > 0 && `${sevCounts.critical > 0 ? "" : "Нашли "}${opportunityCount} ${ruPlural(opportunityCount, "точку роста", "точки роста", "точек роста")}`}
                    {" "}— ниже показываем план, с чего начать и что это даёт.
                  </p>
                  <button onClick={() => scrollTo("plan")} style={{
                    marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
                    color: "var(--primary)", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: 0,
                  }}>
                    Смотреть план работ <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </Reveal>
        )}

        {/* ─── НАХОДКИ ─── */}
        {findings.length > 0 && (
          <Section id="findings" title="Что мы нашли" subtitle="Проблемы и наблюдения по вашему сайту, отсортированные по важности">
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
              <ProportionBar critical={sevCounts.critical} warning={sevCounts.warning} ok={sevCounts.ok} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <FilterChip active={sevFilter === "all"} onClick={() => setSevFilter("all")} label={`Все · ${findings.length}`} />
                <FilterChip active={sevFilter === "critical"} onClick={() => setSevFilter("critical")} label={`Критично · ${sevCounts.critical}`} color="var(--destructive)" />
                <FilterChip active={sevFilter === "warning"} onClick={() => setSevFilter("warning")} label={`Внимание · ${sevCounts.warning}`} color="var(--warning)" />
                <FilterChip active={sevFilter === "ok"} onClick={() => setSevFilter("ok")} label={`В порядке · ${sevCounts.ok}`} color="var(--success)" />
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {shownFindings.map((f, i) => (
                <Reveal key={`${sevFilter}-${i}`} delay={Math.min(i, 8) * 50}>
                  {(v) => <FindingCard f={f} visible={v} />}
                </Reveal>
              ))}
            </div>
          </Section>
        )}

        {/* ─── ТЕХ-АУДИТ ─── */}
        {hasTech && (
          <Section id="tech" title="Технический аудит" subtitle="Скорость и качество страниц по данным Google Lighthouse / Core Web Vitals">
            {lh?.desktop && (
              <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--muted)", borderRadius: 10, marginBottom: 18 }}>
                {(["mobile", "desktop"] as const).map((t) => (
                  <button key={t} onClick={() => setTechTab(t)} style={{
                    padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: techTab === t ? "var(--card)" : "transparent", color: techTab === t ? "var(--foreground)" : "var(--muted-foreground)",
                    transition: "background 0.2s var(--ease), color 0.2s var(--ease)",
                  }}>{t === "mobile" ? "Мобильные" : "Десктоп"}</button>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {lhSet?.performance != null && <RingTile key={`perf-${techTab}`} label="Производительность" value={lhSet.performance} />}
              {lhSet?.seo != null && <RingTile key={`seo-${techTab}`} label="SEO" value={lhSet.seo} />}
              {lhSet?.accessibility != null && <RingTile key={`acc-${techTab}`} label="Доступность" value={lhSet.accessibility} />}
              {lhSet?.lcp && <TechTile label="LCP" text={lhSet.lcp.display} pct={lhSet.lcp.score * 100} />}
              {lhSet?.cls && <TechTile label="CLS" text={lhSet.cls.display} pct={lhSet.cls.score * 100} />}
              {lhSet?.tbt && <TechTile label="TBT" text={lhSet.tbt.display} pct={lhSet.tbt.score * 100} />}
            </div>
          </Section>
        )}

        {/* ─── КОНКУРЕНТЫ ─── */}
        {ranking.length > 1 && (
          <Section id="competitors" title="Где вы среди конкурентов" subtitle="Общий балл вашего сайта против конкурентов из вашей ниши">
            <div style={{ display: "grid", gap: 10 }}>
              {ranking.map((r, i) => (
                <Reveal key={i} delay={Math.min(i, 8) * 55}>
                  {(v) => (
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13,
                        background: i < 3 ? "color-mix(in srgb, var(--primary) 16%, transparent)" : "transparent",
                        color: i < 3 ? "var(--primary)" : "var(--muted-foreground)",
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 12 }}>
                          <span style={{ fontWeight: r.mine ? 800 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.name}{r.mine && <span style={{ color: "var(--primary)" }}> · вы</span>}
                          </span>
                          <span style={{ fontWeight: 800, color: scoreColor(r.score), flexShrink: 0, fontVariantNumeric: "tabular-nums" }}><CountUp target={r.score} active={v} /></span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                          <div style={{
                            width: v ? `${Math.max(2, Math.min(100, r.score))}%` : "0%", height: "100%",
                            background: r.mine ? "var(--primary)" : scoreColor(r.score), borderRadius: 999,
                            transition: `width 0.8s var(--ease) ${Math.min(i, 8) * 0.04}s`,
                            boxShadow: r.mine ? "0 0 10px color-mix(in srgb, var(--primary) 50%, transparent)" : "none",
                          }} />
                        </div>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
            {vis && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 24 }}>
                <TechTile label="Трафик из поиска / сут" value={vis.traffic} />
                <TechTile label="Запросов в топ-10" value={vis.top10} />
                <TechTile label="Страниц в выдаче" value={vis.pagesInOrganic} />
                {vis.aiMentions != null && <TechTile label="Упоминаний в ИИ-ответах" value={vis.aiMentions} />}
              </div>
            )}
          </Section>
        )}

        {/* ─── ТОЧКИ РОСТА ─── */}
        {(niche?.opportunities?.length || recs.length > 0) && (
          <Section id="growth" title="Точки роста" subtitle="Возможности ниши и приоритизация задач по эффекту и усилиям">
            {niche?.opportunities?.length > 0 && (
              <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
                {niche.opportunities.slice(0, 4).map((o, i) => (
                  <Reveal key={i} delay={i * 60}>
                    {() => (
                      <div className="ds-card ds-card-interactive" style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", borderLeft: "4px solid var(--success)" }}>
                        <Rocket size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 15, lineHeight: 1.45 }}>{o}</span>
                      </div>
                    )}
                  </Reveal>
                ))}
              </div>
            )}
            {recs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                <Reveal delay={0}>{() => <MatrixCol title="Быстрые победы" hint="сильный эффект, мало усилий" color="var(--success)" recs={buckets["quick-win"]} />}</Reveal>
                <Reveal delay={90}>{() => <MatrixCol title="Крупные ставки" hint="сильный эффект, много усилий" color="var(--primary)" recs={buckets["big-bet"]} />}</Reveal>
                <Reveal delay={180}>{() => <MatrixCol title="Мелкие правки" hint="по возможности" color="var(--muted-foreground)" recs={buckets["fill-in"]} />}</Reveal>
              </div>
            )}
          </Section>
        )}

        {/* ─── ПЛАН ─── */}
        {plan.length > 0 && (
          <Section id="plan" title="План работ" subtitle="Как мы предлагаем двигаться — поэтапно, от быстрых результатов к росту">
            <div style={{ display: "grid", gap: 14, position: "relative" }}>
              {plan.length > 1 && (
                <div style={{ position: "absolute", left: 19, top: 38, bottom: 38, width: 2, background: "var(--border)", zIndex: 0 }} />
              )}
              {plan.map((ph, i) => (
                <Reveal key={i} delay={i * 100}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "18px 20px", display: "flex", gap: 16, position: "relative", zIndex: 1 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 999, background: "var(--primary)", color: "var(--primary-foreground)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0, boxShadow: "0 0 0 4px var(--background)" }}>{i + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{ph.title}</div>
                        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
                          {ph.items.map((it, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.45, color: "var(--foreground)" }}>{it}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </Section>
        )}

        {/* ─── ТАРИФЫ ─── */}
        <Section id="pricing" title="Что мы предлагаем" subtitle="Пакеты услуг MarketRadar — можно взять по отдельности или связкой">
          <div style={{ display: "grid", gap: 28 }}>
            {PACKAGES.map((pkg, pi) => (
              <Reveal key={pkg.name} delay={pi * 90}>
                {() => (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 6, height: 22, borderRadius: 3, background: pkg.accent }} />
                      <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{pkg.name}</h3>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
                      {pkg.tiers.map((t) => (
                        <div key={t.tier} className="ds-card ds-card-interactive" style={{ padding: "20px", border: t.featured ? `2px solid ${pkg.accent}` : "1px solid var(--border)", position: "relative", ...(t.featured ? { boxShadow: `0 0 0 4px color-mix(in srgb, ${pkg.accent} 12%, transparent)` } : {}) }}>
                          {t.featured && <div style={{ position: "absolute", top: -10, left: 20, background: pkg.accent, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>Популярный</div>}
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--muted-foreground)" }}>{t.tier}</div>
                          <div style={{ fontSize: 24, fontWeight: 850, margin: "6px 0 14px" }}>{t.price}</div>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                            {t.items.map((it, j) => (
                              <li key={j} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.4 }}>
                                <CheckCircle2 size={16} style={{ color: pkg.accent, flexShrink: 0, marginTop: 1 }} /> {it}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ─── CTA ─── */}
        <Section id="cta">
          <Reveal>
            {() => (
              <div className="kp-cta-panel" style={{ position: "relative", overflow: "hidden", color: "var(--primary-foreground)", borderRadius: "var(--radius-xl, 20px)", padding: "44px 36px", textAlign: "center" }}>
                <div style={{ position: "relative" }}>
                  <h2 style={{ fontSize: 30, fontWeight: 850, margin: "0 0 10px" }}>Готовы вырасти в выдаче и лидах?</h2>
                  <p style={{ fontSize: 17, opacity: 0.9, margin: "0 0 24px", maxWidth: 620, marginInline: "auto", lineHeight: 1.5 }}>
                    Разберём находки по вашему сайту, подберём пакет под задачи и покажем прогноз результата.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <a href={`mailto:${contactEmail}?subject=Заявка по анализу сайта ${encodeURIComponent(c.name)}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 50, padding: "0 26px", borderRadius: 12, background: "#fff", color: "var(--primary)", fontWeight: 800, fontSize: 16, textDecoration: "none", transition: "transform 0.2s var(--ease)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                      <Mail size={18} /> Оставить заявку
                    </a>
                  </div>
                  <div style={{ marginTop: 18, fontSize: 14, opacity: 0.85 }}>{contactEmail}</div>
                </div>
              </div>
            )}
          </Reveal>
          <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 12, marginTop: 24 }}>
            Данные подготовлены платформой MarketRadar{company.analyzedAt ? ` · ${new Date(company.analyzedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}` : ""}
          </div>
        </Section>
      </main>

      <ResponsiveCss />
    </div>
  );
}

// ─── анимационные хуки ──────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/** Scroll-reveal обёртка: fade + translateY один раз при появлении во вьюпорте; отдаёт `visible` детям для доп. анимаций (счётчики, ширина баров, дуги диаграмм). */
function Reveal({ children, delay = 0, y = 16 }: { children: (visible: boolean) => React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    // Подстраховка: если IntersectionObserver по какой-то причине не тикнет
    // (необычный контекст показа — печать в PDF, встроенный вьюер, фоновая
    // вкладка), контент не должен остаться невидимым навсегда.
    const fallback = setTimeout(() => setVisible(true), 2500);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, [reduced]);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity 0.6s var(--ease) ${delay}ms, transform 0.6s var(--ease) ${delay}ms`,
    }}>
      {children(visible)}
    </div>
  );
}

function useCountUp(target: number, active: boolean, duration = 900): number {
  const [shown, setShown] = useState(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!active) return;
    if (reduced) { setShown(target); return; }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(target * (1 - Math.pow(2, -10 * p))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration, reduced]);
  return shown;
}

function CountUp({ target, active, duration }: { target: number; active: boolean; duration?: number }) {
  return <>{fmtNum(useCountUp(target, active, duration))}</>;
}

// ─── подкомпоненты ──────────────────────────────────────────────────────────

function Section({ id, title, subtitle, children }: { id: string; title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={`kp-${id}`} style={{ paddingTop: 64, scrollMarginTop: 76 }}>
      {(title || subtitle) && (
        <Reveal>
          {() => (
            <>
              {title && <h2 style={{ fontSize: 28, fontWeight: 850, margin: "0 0 6px", letterSpacing: "-0.02em" }}>{title}</h2>}
              {subtitle && <p style={{ fontSize: 15.5, color: "var(--muted-foreground)", margin: "0 0 24px", maxWidth: 720, lineHeight: 1.5 }}>{subtitle}</p>}
            </>
          )}
        </Reveal>
      )}
      {children}
    </section>
  );
}

function Badge({ icon, label, value, color, prefix = "", active }: { icon: React.ReactNode; label: string; value: number; color?: string; prefix?: string; active: boolean }) {
  return (
    <div className="ds-card ds-card-interactive" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: color || "var(--primary)" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: color || "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
          {prefix}<CountUp target={value} active={active} />
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const up = delta > 0;
  const Icon = up ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const col = up ? "var(--success)" : delta < 0 ? "var(--destructive)" : "var(--muted-foreground)";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 700, color: col, marginLeft: 4 }}><Icon size={13} />{Math.abs(delta)}</span>;
}

/** Кольцевой gauge общего назначения (hero-балл, тех-аудит) — параметризованный размер. */
function Ring({ value, size, stroke, color, active, sublabel }: { value: number; size: number; stroke: number; color?: string; active: boolean; sublabel?: string }) {
  const shown = useCountUp(value, active, 900);
  const col = color || scoreColor(value);
  const R = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * R;
  const reduced = usePrefersReducedMotion();
  const offset = active || reduced ? circ * (1 - value / 100) : circ;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.9s var(--ease)" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: size * 0.25, fontWeight: 850, lineHeight: 1, color: col, fontVariantNumeric: "tabular-nums" }}>{shown}</div>
          {sublabel && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}

function RingTile({ label, value }: { label: string; value: number }) {
  return (
    <Reveal>
      {(v) => (
        <div className="ds-card ds-card-interactive" style={{ padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Ring value={value} size={84} stroke={8} active={v} />
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>{label}</div>
        </div>
      )}
    </Reveal>
  );
}

/** Radar/spider-чарт профиля категорий — n ≥ 3 осей, анимированное построение полигона. */
function RadarChart({ categories, active }: { categories: Array<{ name: string; score: number }>; active: boolean }) {
  const n = categories.length;
  const reduced = usePrefersReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reduced) { setT(1); return; }
    let raf = 0;
    const start = performance.now();
    const step = (time: number) => {
      const p = Math.min(1, (time - start) / 900);
      setT(1 - Math.pow(2, -10 * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced]);

  const size = 260, cx = size / 2, cy = size / 2, R = 90;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, r: number): [number, number] => [cx + r * Math.cos(angleFor(i)), cy + r * Math.sin(angleFor(i))];
  const polygonAt = (frac: number) => categories.map((_, i) => pointAt(i, R * frac).join(",")).join(" ");
  const dataPolygon = categories.map((cat, i) => pointAt(i, R * (cat.score / 100) * t).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 280, display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={polygonAt(f)} fill="none" stroke="var(--border)" strokeWidth={1} />)}
      {categories.map((_, i) => {
        const [x, y] = pointAt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
      })}
      <polygon points={dataPolygon} fill="color-mix(in srgb, var(--primary) 20%, transparent)" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" style={{ transition: "opacity 0.3s" }} />
      {categories.map((cat, i) => {
        const [x, y] = pointAt(i, R * (cat.score / 100) * t);
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--primary)" />;
      })}
      {categories.map((cat, i) => {
        const [x, y] = pointAt(i, R + 26);
        const cos = Math.cos(angleFor(i));
        const anchor = Math.abs(cos) < 0.3 ? "middle" : cos > 0 ? "start" : "end";
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fontWeight={700} fill="var(--muted-foreground)">
            {cat.name.length > 14 ? `${cat.name.slice(0, 13)}…` : cat.name}
          </text>
        );
      })}
    </svg>
  );
}

/** Горизонтальная сегментированная полоса critical/warning/ok — компактная сводка находок. */
function ProportionBar({ critical, warning, ok }: { critical: number; warning: number; ok: number }) {
  const total = critical + warning + ok;
  return (
    <Reveal>
      {(v) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
          <div style={{ display: "flex", height: 10, width: 140, borderRadius: 999, overflow: "hidden", background: "var(--muted)" }}>
            {total > 0 && (
              <>
                <div style={{ width: v ? `${(critical / total) * 100}%` : 0, background: "var(--destructive)", transition: "width 0.8s var(--ease)" }} />
                <div style={{ width: v ? `${(warning / total) * 100}%` : 0, background: "var(--warning)", transition: "width 0.8s var(--ease) 0.1s" }} />
                <div style={{ width: v ? `${(ok / total) * 100}%` : 0, background: "var(--success)", transition: "width 0.8s var(--ease) 0.2s" }} />
              </>
            )}
          </div>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{total} находок</span>
        </div>
      )}
    </Reveal>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
      border: `1px solid ${active ? (color || "var(--primary)") : "var(--border)"}`,
      background: active ? (color || "var(--primary)") : "transparent",
      color: active ? "#fff" : "var(--muted-foreground)",
      transition: "background 0.2s var(--ease), border-color 0.2s var(--ease), color 0.2s var(--ease)",
    }}>{label}</button>
  );
}

function FindingCard({ f, visible }: { f: Finding; visible: boolean }) {
  const map = {
    critical: { c: "var(--destructive)", Icon: TriangleAlert, label: "критично" },
    warning: { c: "var(--warning)", Icon: AlertTriangle, label: "внимание" },
    ok: { c: "var(--success)", Icon: CheckCircle2, label: "в порядке" },
  }[f.severity];
  return (
    <div className="ds-card ds-card-interactive" style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start", borderLeft: `4px solid ${map.c}` }}>
      <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
        {f.severity === "critical" && visible && <span className="kp-pulse-dot" style={{ background: map.c }} />}
        <map.Icon size={20} style={{ color: map.c, marginTop: 1 }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{f.title}</span>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: map.c }}>{map.label}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>· {f.category}</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.45, marginTop: 6 }}>{f.detail}</div>
      </div>
    </div>
  );
}

function TechTile({ label, value, suffix, text, pct }: { label: string; value?: number; suffix?: string; text?: string; pct?: number }) {
  const shownPct = pct != null ? pct : typeof value === "number" ? value : undefined;
  const col = shownPct != null ? scoreColor(shownPct) : "var(--foreground)";
  return (
    <Reveal>
      {(v) => (
        <div className="ds-card ds-card-interactive" style={{ padding: "16px" }}>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>{label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums" }}>
              {text ?? (value != null ? <CountUp target={value} active={v} /> : "—")}
            </span>
            {suffix && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{suffix}</span>}
          </div>
          {pct != null && (
            <div style={{ height: 4, borderRadius: 999, background: "var(--muted)", marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: v ? `${Math.max(3, Math.min(100, pct))}%` : "0%", height: "100%", background: col, borderRadius: 999, transition: "width 0.8s var(--ease)" }} />
            </div>
          )}
        </div>
      )}
    </Reveal>
  );
}

function MatrixCol({ title, hint, color, recs }: { title: string; hint: string; color: string; recs: Recommendation[] }) {
  return (
    <div className="ds-card ds-card-interactive" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Zap size={16} style={{ color }} />
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>{hint}</div>
      {recs.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>—</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
          {recs.slice(0, 5).map((r, i) => (
            <li key={i} style={{ fontSize: 13.5, lineHeight: 1.4, display: "flex", gap: 8 }}>
              <span style={{ color, fontWeight: 800, flexShrink: 0 }}>→</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeroBlobs({ score }: { score: number }) {
  const col = scoreColor(score);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div className="kp-blob kp-blob-a" style={{ background: "var(--primary)" }} />
      <div className="kp-blob kp-blob-b" style={{ background: col }} />
    </div>
  );
}

function DotGridBackdrop() {
  return <div aria-hidden className="kp-page-dotgrid" />;
}

function KpEmpty() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", color: "var(--foreground)", padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Нет данных анализа</div>
        <div style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 24 }}>Запустите анализ компании на платформе — и КП соберётся автоматически.</div>
        <a href="/" className="ds-btn ds-btn-primary" style={{ display: "inline-flex", height: 44, padding: "0 22px", alignItems: "center" }}>На платформу →</a>
      </div>
    </div>
  );
}

function ResponsiveCss() {
  return <style>{`
    .kp-navscroll::-webkit-scrollbar { display: none; }

    .kp-page-dotgrid {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
      background-size: 24px 24px;
      opacity: 0.35;
      mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 0%, transparent 75%);
      -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 0%, transparent 75%);
    }

    .kp-hero { background: var(--card); border: 1px solid var(--border); }
    .kp-blob { position: absolute; width: 360px; height: 360px; border-radius: 50%; filter: blur(70px); opacity: 0.16; }
    .kp-blob-a { top: -140px; left: -80px; animation: kp-drift-a 16s ease-in-out infinite alternate; }
    .kp-blob-b { bottom: -160px; right: -60px; animation: kp-drift-b 18s ease-in-out infinite alternate; }
    @keyframes kp-drift-a { from { transform: translate(0,0); } to { transform: translate(40px, 30px); } }
    @keyframes kp-drift-b { from { transform: translate(0,0); } to { transform: translate(-30px, -40px); } }

    .kp-cta-panel { background: linear-gradient(120deg, var(--primary), color-mix(in srgb, var(--primary) 60%, var(--success))); background-size: 200% 200%; animation: kp-gradient-shift 10s ease infinite; }
    @keyframes kp-gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

    .kp-cta-glow { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 50%, transparent); transition: box-shadow 0.3s var(--ease), transform 0.2s var(--ease); }
    .kp-cta-glow:hover { box-shadow: 0 4px 24px color-mix(in srgb, var(--primary) 45%, transparent); transform: translateY(-1px); }

    .kp-pulse-dot {
      position: absolute; top: -2px; left: -2px; width: 8px; height: 8px; border-radius: 50%;
      animation: kp-pulse 1.8s ease-out infinite;
    }
    @keyframes kp-pulse {
      0% { box-shadow: 0 0 0 0 currentColor; opacity: 0.7; }
      100% { box-shadow: 0 0 0 10px transparent; opacity: 0; }
    }

    @media (max-width: 760px) {
      .kp-hero-grid { grid-template-columns: 1fr !important; }
      .kp-radar-wrap { grid-template-columns: 1fr !important; }
      .kp-cat-grid { grid-template-columns: 1fr !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .kp-blob, .kp-cta-panel, .kp-pulse-dot { animation: none !important; }
    }
  `}</style>;
}

// ─── деривации из данных ────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return n.toLocaleString("ru-RU");
  return String(n);
}

/** Русское склонение по числительному: 1 / 2-4 / 5+ (с учётом 11-14 → «много»). */
function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function bucketOf(r: Recommendation): "quick-win" | "big-bet" | "fill-in" {
  if (r.effortImpactBucket === "quick-win" || r.effortImpactBucket === "big-bet") return r.effortImpactBucket;
  if (r.effortImpactBucket === "fill-in" || r.effortImpactBucket === "avoid") return "fill-in";
  // Фолбэк без размеченных impact/effort: по приоритету
  if (r.priority === "high") return "quick-win";
  if (r.priority === "medium") return "big-bet";
  return "fill-in";
}

/** Находки из категорий (низкие баллы), SEO-issues и отставания от конкурентов. */
function buildFindings(my: AnalysisResult | null, competitors: AnalysisResult[]): Finding[] {
  if (!my) return [];
  const out: Finding[] = [];

  // Категории с низким баллом
  (my.company.categories ?? []).forEach((cat) => {
    const severity: Severity = cat.score < 45 ? "critical" : cat.score < 65 ? "warning" : "ok";
    const label = severity === "critical" ? "слабое место" : severity === "warning" ? "есть куда расти" : "в порядке";
    out.push({ severity, category: cat.name, title: `${cat.name}: ${cat.score}/100 — ${label}`, detail: categoryVerdict(cat.score) });
  });

  // SEO-проблемы
  (my.seo.issues ?? []).slice(0, 6).forEach((iss) =>
    out.push({ severity: "warning", category: "SEO", title: iss, detail: "Обнаружено при техническом анализе страниц — влияет на позиции в поиске." }));

  // Отставание от конкурентов
  const ahead = competitors.filter((c) => c.company.score > my.company.score);
  if (ahead.length > 0) {
    const top = ahead.sort((a, b) => b.company.score - a.company.score)[0];
    out.push({ severity: "critical", category: "Конкуренты", title: `${ahead.length} конкурент(ов) опережают вас по общему баллу`, detail: `Лидер — ${top.company.name} (${top.company.score} против ваших ${my.company.score}). Разберём, за счёт чего они сильнее.` });
  }

  // Сортировка: critical → warning → ok
  const order: Record<Severity, number> = { critical: 0, warning: 1, ok: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

interface Phase { title: string; items: string[] }
function buildPlan(recs: Recommendation[]): Phase[] {
  if (recs.length === 0) return [];
  const quick = recs.filter((r) => bucketOf(r) === "quick-win").slice(0, 5).map((r) => r.text);
  const foundation = recs.filter((r) => r.priority === "high" && bucketOf(r) !== "quick-win").slice(0, 5).map((r) => r.text);
  const growth = recs.filter((r) => bucketOf(r) === "big-bet" || r.priority === "medium").slice(0, 5).map((r) => r.text);
  const phases: Phase[] = [];
  if (quick.length) phases.push({ title: "Этап 1. Быстрые победы (1–2 недели)", items: quick });
  if (foundation.length) phases.push({ title: "Этап 2. Фундамент (1–2 месяца)", items: foundation });
  if (growth.length) phases.push({ title: "Этап 3. Рост и масштабирование", items: growth });
  return phases;
}
