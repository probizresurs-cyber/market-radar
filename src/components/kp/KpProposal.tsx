"use client";

/**
 * KpProposal — интерактивное коммерческое предложение по анализу сайта.
 *
 * Публичная логика вдохновлена длинными «КП-аудитами» агентств (диагноз →
 * находки → конкуренты → точки роста → план → тарифы → CTA), но переосмыслена
 * под MarketRadar и сделана лучше: единый дизайн платформы (CSS-переменные,
 * светлая/тёмная тема), липкая навигация со скролл-спаем и прогресс-баром,
 * фильтр находок по важности, матрица impact/effort, дорожная карта.
 *
 * Всё строится из РЕАЛЬНОГО анализа (AnalysisResult) — никаких выдумок: секции
 * без данных не показываются. Тарифы — предложение MarketRadar (редактируется
 * через PACKAGES ниже).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, Recommendation } from "@/lib/types";
import {
  AlertTriangle, CheckCircle2, TriangleAlert, Gauge, Target, Rocket,
  ListChecks, Wallet, ArrowRight, TrendingUp, TrendingDown, Minus, Zap, Mail,
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

  if (!company) return <KpEmpty />;
  const c = company.company;
  const niche = company.nicheForecast;

  return (
    <div ref={rootRef} style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* Прогресс-бар */}
      <div style={{ position: "fixed", top: 0, left: 0, height: 3, width: `${progress}%`, background: "var(--primary)", zIndex: 60, transition: "width 0.1s linear" }} />

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
          <div className="kp-navscroll" style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                style={{
                  padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  fontSize: 13, fontWeight: 600,
                  background: active === s.id ? "var(--primary)" : "transparent",
                  color: active === s.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* ─── HERO / ОБЗОР ─── */}
        <Section id="overview">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 32, alignItems: "center" }} className="kp-hero">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Коммерческое предложение · анализ сайта
              </div>
              <h1 style={{ fontSize: 40, fontWeight: 850, lineHeight: 1.1, margin: "0 0 10px", letterSpacing: "-0.02em" }}>{c.name}</h1>
              {c.url && <a href={c.url.startsWith("http") ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 15, textDecoration: "none" }}>{c.url}</a>}
              <p style={{ fontSize: 18, lineHeight: 1.5, marginTop: 18, color: "var(--foreground)" }}>{verdictOf(c.score)}.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                <Badge icon={<Target size={15} />} label="Проанализировано конкурентов" value={String(competitors.length)} />
                <Badge icon={<AlertTriangle size={15} />} label="Критичных проблем" value={String(sevCounts.critical)} color="var(--destructive)" />
                <Badge icon={<ListChecks size={15} />} label="Рекомендаций" value={String(recs.length)} />
                {myRank > 0 && <Badge icon={<Gauge size={15} />} label="Позиция среди конкурентов" value={`#${myRank}`} />}
              </div>
              <button onClick={() => scrollTo("cta")} className="ds-btn ds-btn-primary" style={{ marginTop: 26, height: 46, padding: "0 22px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8 }}>
                Обсудить проект <ArrowRight size={17} />
              </button>
            </div>
            <ScoreGauge score={c.score} />
          </div>

          {/* Категории анализа */}
          {c.categories?.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 40 }}>
              {c.categories.map((cat, i) => (
                <div key={i} className="ds-card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>{cat.name}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: scoreColor(cat.score) }}>{cat.score}</span>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/100</span>
                    {cat.delta !== 0 && <DeltaChip delta={cat.delta} />}
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: "var(--muted)", marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(3, Math.min(100, cat.score))}%`, height: "100%", background: scoreColor(cat.score), borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ─── НАХОДКИ ─── */}
        {findings.length > 0 && (
          <Section id="findings" title="Что мы нашли" subtitle="Проблемы и наблюдения по вашему сайту, отсортированные по важности">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <FilterChip active={sevFilter === "all"} onClick={() => setSevFilter("all")} label={`Все · ${findings.length}`} />
              <FilterChip active={sevFilter === "critical"} onClick={() => setSevFilter("critical")} label={`Критично · ${sevCounts.critical}`} color="var(--destructive)" />
              <FilterChip active={sevFilter === "warning"} onClick={() => setSevFilter("warning")} label={`Внимание · ${sevCounts.warning}`} color="var(--warning)" />
              <FilterChip active={sevFilter === "ok"} onClick={() => setSevFilter("ok")} label={`В порядке · ${sevCounts.ok}`} color="var(--success)" />
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {shownFindings.map((f, i) => <FindingCard key={i} f={f} />)}
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
                  }}>{t === "mobile" ? "Мобильные" : "Десктоп"}</button>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              <TechTile label="Производительность" value={lhSet?.performance} suffix="/100" />
              <TechTile label="SEO" value={lhSet?.seo} suffix="/100" />
              <TechTile label="Доступность" value={lhSet?.accessibility} suffix="/100" />
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
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 28, textAlign: "center", fontWeight: 800, color: i < 3 ? "var(--primary)" : "var(--muted-foreground)", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 12 }}>
                      <span style={{ fontWeight: r.mine ? 800 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}{r.mine && <span style={{ color: "var(--primary)" }}> · вы</span>}
                      </span>
                      <span style={{ fontWeight: 800, color: scoreColor(r.score), flexShrink: 0 }}>{r.score}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(2, Math.min(100, r.score))}%`, height: "100%", background: r.mine ? "var(--primary)" : scoreColor(r.score), borderRadius: 999 }} />
                    </div>
                  </div>
                </div>
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
                  <div key={i} className="ds-card" style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", borderLeft: "4px solid var(--success)" }}>
                    <Rocket size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 15, lineHeight: 1.45 }}>{o}</span>
                  </div>
                ))}
              </div>
            )}
            {recs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                <MatrixCol title="Быстрые победы" hint="сильный эффект, мало усилий" color="var(--success)" recs={buckets["quick-win"]} />
                <MatrixCol title="Крупные ставки" hint="сильный эффект, много усилий" color="var(--primary)" recs={buckets["big-bet"]} />
                <MatrixCol title="Мелкие правки" hint="по возможности" color="var(--muted-foreground)" recs={buckets["fill-in"]} />
              </div>
            )}
          </Section>
        )}

        {/* ─── ПЛАН ─── */}
        {plan.length > 0 && (
          <Section id="plan" title="План работ" subtitle="Как мы предлагаем двигаться — поэтапно, от быстрых результатов к росту">
            <div style={{ display: "grid", gap: 14 }}>
              {plan.map((ph, i) => (
                <div key={i} className="ds-card" style={{ padding: "18px 20px", display: "flex", gap: 16 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 999, background: "var(--primary)", color: "var(--primary-foreground)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{ph.title}</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
                      {ph.items.map((it, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.45, color: "var(--foreground)" }}>{it}</li>)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── ТАРИФЫ ─── */}
        <Section id="pricing" title="Что мы предлагаем" subtitle="Пакеты услуг MarketRadar — можно взять по отдельности или связкой">
          <div style={{ display: "grid", gap: 28 }}>
            {PACKAGES.map((pkg) => (
              <div key={pkg.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 6, height: 22, borderRadius: 3, background: pkg.accent }} />
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{pkg.name}</h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
                  {pkg.tiers.map((t) => (
                    <div key={t.tier} className="ds-card" style={{ padding: "20px", border: t.featured ? `2px solid ${pkg.accent}` : "1px solid var(--border)", position: "relative" }}>
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
            ))}
          </div>
        </Section>

        {/* ─── CTA ─── */}
        <Section id="cta">
          <div style={{ background: "var(--primary)", color: "var(--primary-foreground)", borderRadius: "var(--radius-xl, 20px)", padding: "44px 36px", textAlign: "center" }}>
            <h2 style={{ fontSize: 30, fontWeight: 850, margin: "0 0 10px" }}>Готовы вырасти в выдаче и лидах?</h2>
            <p style={{ fontSize: 17, opacity: 0.9, margin: "0 0 24px", maxWidth: 620, marginInline: "auto", lineHeight: 1.5 }}>
              Разберём находки по вашему сайту, подберём пакет под задачи и покажем прогноз результата.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={`mailto:${contactEmail}?subject=Заявка по анализу сайта ${encodeURIComponent(c.name)}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 50, padding: "0 26px", borderRadius: 12, background: "#fff", color: "var(--primary)", fontWeight: 800, fontSize: 16, textDecoration: "none" }}>
                <Mail size={18} /> Оставить заявку
              </a>
            </div>
            <div style={{ marginTop: 18, fontSize: 14, opacity: 0.85 }}>{contactEmail}</div>
          </div>
          <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 12, marginTop: 24 }}>
            Данные подготовлены платформой MarketRadar{company.analyzedAt ? ` · ${new Date(company.analyzedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}` : ""}
          </div>
        </Section>
      </main>

      <ResponsiveCss />
    </div>
  );
}

// ─── подкомпоненты ──────────────────────────────────────────────────────────

function Section({ id, title, subtitle, children }: { id: string; title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={`kp-${id}`} style={{ paddingTop: 64, scrollMarginTop: 76 }}>
      {title && <h2 style={{ fontSize: 28, fontWeight: 850, margin: "0 0 6px", letterSpacing: "-0.02em" }}>{title}</h2>}
      {subtitle && <p style={{ fontSize: 15.5, color: "var(--muted-foreground)", margin: "0 0 24px", maxWidth: 720, lineHeight: 1.5 }}>{subtitle}</p>}
      {children}
    </section>
  );
}

function Badge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="ds-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: color || "var(--primary)" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: color || "var(--foreground)" }}>{value}</div>
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

function ScoreGauge({ score }: { score: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setShown(Math.round(score * (1 - Math.pow(2, -10 * p))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const R = 84, circ = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 220, height: 220 }}>
        <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--muted)" strokeWidth="16" />
          <circle cx="110" cy="110" r={R} fill="none" stroke={scoreColor(score)} strokeWidth="16" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - shown / 100)} style={{ transition: "stroke-dashoffset 0.1s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 850, lineHeight: 1, color: scoreColor(score) }}>{shown}</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>общий балл / 100</div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
      border: `1px solid ${active ? (color || "var(--primary)") : "var(--border)"}`,
      background: active ? (color || "var(--primary)") : "transparent",
      color: active ? "#fff" : "var(--muted-foreground)",
    }}>{label}</button>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const map = {
    critical: { c: "var(--destructive)", Icon: TriangleAlert, label: "критично" },
    warning: { c: "var(--warning)", Icon: AlertTriangle, label: "внимание" },
    ok: { c: "var(--success)", Icon: CheckCircle2, label: "в порядке" },
  }[f.severity];
  return (
    <div className="ds-card" style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start", borderLeft: `4px solid ${map.c}` }}>
      <map.Icon size={20} style={{ color: map.c, flexShrink: 0, marginTop: 1 }} />
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
    <div className="ds-card" style={{ padding: "16px" }}>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: col }}>{text ?? (value != null ? fmtNum(value) : "—")}</span>
        {suffix && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function MatrixCol({ title, hint, color, recs }: { title: string; hint: string; color: string; recs: Recommendation[] }) {
  return (
    <div className="ds-card" style={{ padding: "16px 18px" }}>
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
    @media (max-width: 760px) {
      .kp-hero { grid-template-columns: 1fr !important; }
    }
  `}</style>;
}

// ─── деривации из данных ────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return n.toLocaleString("ru-RU");
  return String(n);
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
    if (cat.score < 45) out.push({ severity: "critical", category: cat.name, title: `${cat.name}: ${cat.score}/100 — слабое место`, detail: `Показатель значительно ниже нормы. Это напрямую тормозит привлечение клиентов из этого канала.` });
    else if (cat.score < 65) out.push({ severity: "warning", category: cat.name, title: `${cat.name}: ${cat.score}/100 — есть куда расти`, detail: `Средний уровень: конкуренты с более сильным показателем забирают часть вашей аудитории.` });
    else out.push({ severity: "ok", category: cat.name, title: `${cat.name}: ${cat.score}/100 — в порядке`, detail: `Хороший результат, поддерживаем на текущем уровне.` });
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
