"use client";

/**
 * KpProposal — интерактивный анализ сайта для потенциального клиента.
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
import type { AIVisibilityAudit, LLMName } from "@/lib/ai-visibility-types";
import { trackKpEvent } from "@/lib/kp-track";
import {
  EVIDENCE_LEGEND, PILOT_STRENGTHS, PILOT_RIVALS, PILOT_TRUMP, PILOT_GEO, PILOT_FORECAST,
  PILOT_FINDINGS, PILOT_OFFERS, PILOT_OFFERS_TOTAL, PILOT_CHART,
  PILOT_HERO, PILOT_TIMELINE, PILOT_POSITION_DIAGNOSIS, PILOT_GUARANTEE, PILOT_MONTHLY,
  type Evidence,
} from "./pilot-sozdavay-data";
import {
  AlertTriangle, CheckCircle2, TriangleAlert, Gauge, Target, Rocket,
  ListChecks, ArrowRight, TrendingUp, TrendingDown, Minus, Zap, Mail, Radar as RadarIcon,
  Link2, Lock, Eye, Bot, Sun, Moon, FileText, Sparkles, ShieldCheck, Clock,
  Globe, Share2, Wrench, Trophy, Swords, BrainCircuit, LineChart,
} from "lucide-react";

interface Props {
  company: AnalysisResult | null;
  competitors: AnalysisResult[];
  /** Контактный e-mail для CTA. */
  contactEmail?: string;
  /** Последний завершённый аудит AI-видимости (status="done") — если есть, показываем блок. */
  aiVisibility?: AIVisibilityAudit | null;
  /**
   * Обработчик кнопки «Поделиться ссылкой» — создаёт публичную read-only
   * копию этого анализа (без авторизации получателя), как на /owner-dashboard.
   * Не передаётся на самой публичной странице (/share/[id]) — там кнопки нет.
   */
  onShare?: () => void;
  sharing?: boolean;
  shareLink?: string | null;
  shareCopied?: boolean;
  shareError?: string | null;
  onCopyShareLink?: () => void;
  /**
   * Показывает блок «Пилотные условия» + примеры формата SEO+GEO статей —
   * содержание конкретной договорённости с одним проспектом (не общее
   * предложение MarketRadar), поэтому включается точечно через проп, а не
   * глобально для всех /kp. См. src/app/kp-sozdavaya/page.tsx.
   */
  pilotOffer?: boolean;
}

type Severity = "critical" | "warning" | "ok";
type Channel = "site" | "social" | "ai" | "other";
interface Finding {
  severity: Severity;
  channel: Channel;
  category: string;
  title: string;
  detail: string;
  /** Как MarketRadar это закрывает — методология/услуга, не выдуманный факт о сайте. */
  fix?: string;
}

const CHANNEL_META: Record<Channel, { label: string; icon: typeof Globe }> = {
  site: { label: "Сайт", icon: Globe },
  social: { label: "Соцсети", icon: Share2 },
  ai: { label: "Нейросети (ИИ)", icon: Bot },
  other: { label: "Прочее", icon: Target },
};

// ─── Тарифные пакеты MarketRadar (предложение — правится здесь) ─────────────
const PACKAGES = [
  {
    name: "SEO + GEO-продвижение",
    accent: "var(--primary)",
    note: "GEO (Generative Engine Optimization) — оптимизация видимости бренда в ответах AI-ассистентов (ChatGPT, Яндекс Нейро, Алиса), а не только в классической поисковой выдаче. Сейчас туда идёт заметная часть решений о покупке — сайт должен быть виден и там.",
    tiers: [
      { tier: "Старт", price: "35 000 ₽/мес", items: ["Технический аудит + правки", "Семантика по 1 кластеру", "Оптимизация 5 страниц"] },
      { tier: "Оптимум", price: "65 000 ₽/мес", items: ["Всё из «Старт»", "3 кластера запросов", "GEO-оптимизация (llms.txt, Schema.org, FAQ)", "Ежемесячный отчёт"], featured: true },
      { tier: "Энтерпрайз", price: "По договорённости", items: ["Всё из «Оптимум»", "Все кластеры ниши", "GEO под все ключевые AI-ассистенты", "Приоритетная выдача задач"] },
    ],
  },
  {
    name: "Контент-маркетинг + СММ",
    accent: "var(--success)",
    tiers: [
      { tier: "Старт", price: "45 000 ₽/мес", items: ["8 постов в соцсети", "Контент-план на месяц", "Ведение СММ"] },
      { tier: "Оптимум", price: "85 000 ₽/мес", items: ["Всё из «Старт»", "8 рилсов", "СММ-стратегия и аналитика"], featured: true },
      { tier: "Максимум", price: "125 000 ₽/мес", items: ["Всё из «Оптимум»", "Персональный контент-план по рилсам и постам", "Приоритетное производство"] },
    ],
  },
];

// ─── Контент пилотного предложения (проп pilotOffer) — специфично для
// одного конкретного клиента (переговоры о барельефах), не общий питч
// MarketRadar. Примеры статей — иллюстрация формата, а НЕ готовые/реальные
// публикации; прогноз на месяц — ориентировочные направления работы, а не
// гарантированные метрики (это план, гарантия описана отдельно ниже). ────
const SEO_PREVIEW_ARTICLES = [
  {
    title: "Барельеф на стену в интерьере: 7 идей для гостиной и спальни",
    excerpt: "Где барельеф уместен, а где перегружает пространство, сколько стоит индивидуальный заказ и как выбрать мастера.",
    body: "Барельеф — рельефное изображение, выступающее над плоскостью стены, — уместен там, где нужен акцент без перегрузки цветом: над изголовьем кровати, за диваном, в нише прихожей. Разберём 7 сценариев по комнатам, с фото-референсами и подсказкой по масштабу рисунка под площадь стены.\n\nСколько стоит: индивидуальный эскиз + монтаж под ключ — от [диапазон уточняется под нишу], серийный рельеф из каталога — дешевле и быстрее. Как выбрать мастера: смотрите портфолио в объёме (не только фото анфас), спрашивайте про материал (гипс/артбетон) и гарантию на растрескивание.",
    geoNotes: [
      "Заголовок и первый абзац сразу называют, ЧТО такое барельеф и для чего он нужен — это ровно тот прямой ответ, который нейросеть цитирует, когда пользователь спрашивает «как оформить стену барельефом»",
      "7 конкретных сценариев по комнатам — длинный хвост запросов («барельеф в спальне», «барельеф в прихожей») закрывается одной статьёй",
    ],
  },
  {
    title: "Барельеф своими руками или на заказ: сравниваем цену, качество и сроки",
    excerpt: "Честное сравнение — что реально получится сделать самому, а где нужен профессиональный литейщик.",
    body: "DIY-барельеф из шпаклёвки реален для простых форм (геометрия, растения) — но требует навыка работы со шпателем и 3-5 дней на слои и шлифовку. Профессиональный литейщик даёт точный рельеф, детализацию (лица, текстуры) и предсказуемый срок службы без трещин.\n\nСравнение по трём осям — цена, качество, сроки — сведено в таблицу, чтобы читатель за 30 секунд понял, какой вариант ему подходит, без давления «закажите у нас» в лоб.",
    geoNotes: [
      "Формат сравнения (таблица «сам vs заказ») — то, что нейросети чаще всего вытаскивают целиком при ответе на сравнительные запросы («барельеф своими руками или на заказ»)",
      "Честность про DIY-вариант (а не только продажа услуги) повышает доверие к источнику — и у читателя, и как сигнал качества контента для ранжирования",
    ],
  },
  {
    title: "Уход за гипсовым барельефом: как не повредить рельеф при уборке",
    excerpt: "Практическая инструкция — то, что люди ищут уже после покупки, и что закрепляет доверие к бренду.",
    body: "Гипсовый рельеф боится избытка влаги и абразивных губок — рабочий способ: сухая щётка с мягким ворсом для пыли в углублениях, слегка влажная замша для общей поверхности, никаких спреев с спиртом на окрашенных участках.\n\nЭта статья не продаёт — она закрепляет доверие у тех, кто уже купил, и попадает в поиск от совершенно новой аудитории («как ухаживать за барельефом»), которая пока не покупатель, но видит бренд как экспертный источник.",
    geoNotes: [
      "Прямая пошаговая инструкция в первых предложениях — именно такой формат нейросети чаще всего используют для ответа на вопрос «как ухаживать за X»",
      "Статья не о продаже — привлекает людей на более раннем этапе, до решения о покупке, и это тоже часть воронки, которую GEO усиливает",
    ],
  },
];

// Общие механики, почему именно такой формат статей работает и на
// классическое SEO, и особенно на GEO (видимость в ответах нейросетей) —
// показываются один раз под примерами, а не дублируются в каждой карточке.
const SEO_GEO_MECHANICS = [
  "Прямой ответ на вопрос в первых 2-3 предложениях — так формируются цитируемые фрагменты и для featured snippet в поиске, и для ответов нейросетей (GEO)",
  "Заголовки в формате вопроса (H2) — совпадают с тем, как люди реально формулируют запросы к ChatGPT/YandexGPT/Perplexity",
  "Ключевая фраза в H1, подзаголовках и первом абзаце — классический SEO-сигнал релевантности для поисковика",
  "Структурированные списки и сравнения — их проще распарсить и поисковому роботу, и нейросети при генерации ответа",
  "Внутренние ссылки между статьями по теме — усиливают тематический авторитет (topical authority) сайта, важный и для SEO, и для GEO",
  "FAQ-блок в конце статьи — попадает в rich snippets Google/Яндекс и в готовые вопрос-ответ пары, которые нейросети переиспользуют напрямую",
];

const SEO_MONTH1_FORECAST = [
  "Первая неделя — глубокий анализ ниши и полная стратегия SEO+GEO, семантика собрана, контент-план на месяц готов",
  "≈20–25 статей опубликовано на сайте и на внешних площадках (при темпе 1 статья в день)",
  "Большая часть статей проиндексирована в Яндексе и Google к концу месяца",
  "Первые ответы AI-ассистентов (YandexGPT, ChatGPT, Perplexity) на профильные запросы начинают упоминать бренд",
  "Еженедельный отчёт с цифрами: позиции, трафик, упоминания в AI-ответах",
  "Цель — не подписчики и охваты, а целевые обращения от людей, которые ищут барельефы",
];

const PILOT_STEPS = [
  "Бесплатно: экспресс-разбор ниши на созвоне (20 минут) — где вы в поиске сейчас, что отвечают нейросети про барельефы, что делают конкуренты в соцсетях, + план действий",
  "Если план откликается — стартуем, оплата помесячно",
  "Первая неделя — глубокий анализ и полная стратегия",
  "Дальше — раз в неделю отчёт с цифрами",
];

// Живая проверка позиций снова включена (15.07.2026) — раньше здесь был
// headless-браузер по yandex.ru, который на проде блокировался капчей в
// 100% случаев. Заменено на официальный Yandex Search API (без браузера,
// без капчи) — см. src/lib/yandex-search-api.ts. Google по-прежнему через
// Playwright (официального API нет), это не менялось.
const POSITION_CHECK_ENABLED = true;

// id → флаг, по которому секция включается. pilot-* показываются только на
// /kp-sozdavaya (pilotOffer); hideOnPilot — наоборот, генерик-блоки, которые
// на пилотной странице разжижают воронку (точки роста/план/тарифы дублируют
// кейсы-находки и пилотные цены); positions — по POSITION_CHECK_ENABLED.
// Порядок = драматургия воронки: доверие → боль → доказательства → решение
// с ценой → выгода → условия → заявка.
const BASE_SECTIONS: { id: string; label: string; pilotOnly?: boolean; hideOnPilot?: boolean }[] = [
  { id: "overview", label: "Обзор" },
  { id: "pilot-strengths", label: "Сильные стороны", pilotOnly: true },
  { id: "findings", label: "Находки" },
  { id: "tech", label: "Тех-аудит" },
  { id: "competitors", label: "Конкуренты" },
  { id: "pilot-rivals", label: "Лидеры ниши", pilotOnly: true },
  { id: "ai-visibility", label: "AI-видимость" },
  { id: "pilot-geo", label: "GEO-видимость", pilotOnly: true },
  { id: "positions", label: "Позиции" },
  { id: "growth", label: "Точки роста", hideOnPilot: true },
  { id: "plan", label: "План", hideOnPilot: true },
  { id: "pilot-offer", label: "Предложение", pilotOnly: true },
  { id: "seo-preview", label: "Формат работ" },
  { id: "pilot-forecast", label: "Прогноз", pilotOnly: true },
  { id: "pilot", label: "Пилотные условия" },
  { id: "pricing", label: "Тарифы", hideOnPilot: true },
  { id: "cta", label: "Заявка" },
];

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

const LLM_LABELS: Record<LLMName, string> = {
  yandex: "YandexGPT", claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity",
};

// Presence нейросети в анализе (aiPerception.knowledgePresence) → человекочитаемо.
const aiPresenceLabel = (p: string) =>
  p === "strong" ? "Сильное — нейросети знают и рекомендуют бренд"
  : p === "moderate" ? "Умеренное — бренд иногда упоминается"
  : p === "weak" ? "Слабое — нейросети почти не знают о бренде"
  : "Минимальное — бренда фактически нет в ответах нейросетей";
const aiPresenceColor = (p: string) =>
  p === "strong" ? "var(--success)" : p === "moderate" ? "var(--warning)" : "var(--destructive)";

export function KpProposal({
  company, competitors, contactEmail = "hello@marketradar24.ru",
  aiVisibility = null,
  onShare, sharing = false, shareLink = null, shareCopied = false, shareError = null, onCopyShareLink,
  pilotOffer = false,
}: Props) {
  // AI-видимость показываем, если есть либо отдельный аудит, либо
  // aiPerception из основного анализа (он есть почти всегда) — блок больше
  // не пропадает на КП без отдельного прогона AI-аудита.
  const aiPerc = company?.aiPerception ?? null;
  const hasAiViz = (aiVisibility?.status === "done" && aiVisibility.totalScore != null) || !!aiPerc;
  // Упоминаний бренда в ответах нейросетей. Берём реальное число из Keys.so
  // (Алиса/Нейро) если оно есть; если данных нет, но присутствие бренда
  // «минимальное»/«слабое» — показываем 0 как базовый уровень на момент
  // анализа (это НЕ выдумка: minimal presence и означает практическое
  // отсутствие в ответах). Для сильного присутствия без числа — не врём, скрываем.
  const rawAiMentions = company?.keysoDashboard?.yandex?.aiMentions ?? company?.keysoDashboard?.google?.aiMentions;
  const aiMentions =
    rawAiMentions != null
      ? rawAiMentions
      : (aiPerc && (aiPerc.knowledgePresence === "minimal" || aiPerc.knowledgePresence === "weak"))
        ? 0
        : null;
  const SECTIONS = useMemo(
    () => BASE_SECTIONS.filter(
      (s) => (s.id !== "positions" || POSITION_CHECK_ENABLED)
        && ((s.id !== "seo-preview" && s.id !== "pilot") || pilotOffer)
        && (!s.pilotOnly || pilotOffer)
        && (!s.hideOnPilot || !pilotOffer)
        && (s.id !== "ai-visibility" || hasAiViz)
    ),
    [pilotOffer, hasAiViz],
  );
  const [active, setActive] = useState<string>("overview");
  const [progress, setProgress] = useState(0);
  // Тарифы скрыты за кнопкой «Получить анализ» — раньше цены висели открыто
  // сразу под планом работ; теперь их раскрывает осознанное действие.
  // revealPricing определена ниже, после scrollTo (см. дальше по компоненту).
  const [pricingRevealed, setPricingRevealed] = useState(false);

  // Светлая/тёмная тема — совместима с общим переключателем платформы:
  // тот же ключ localStorage.mr_theme и тот же класс .dark на <html>,
  // который уже проставляет beforeInteractive-скрипт в layout.tsx (без
  // FOUC). Здесь просто читаем текущее состояние и умеем его переключить —
  // страница /kp публичная и не рендерит общий сайдбар с тумблером.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggleTheme = () => {
    const next = !isDark;
    const root = document.documentElement;
    root.classList.remove("dark", "warm");
    if (next) root.classList.add("dark");
    try { localStorage.setItem("mr_theme", next ? "dark" : "light"); } catch { /* ignore */ }
    setIsDark(next);
  };
  const [techTab, setTechTab] = useState<"mobile" | "desktop">("mobile");
  const [expandedArticle, setExpandedArticle] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ─── Позиции в поиске — реальная живая проверка (см. /admin/position-checker,
  // /api/check-positions), не выдумка AI. Раздел показывается только если для
  // этого домена реально проводилась проверка — иначе просто не рендерится. ──
  const [positionCheck, setPositionCheck] = useState<{
    engine: "yandex" | "google"; checkedAt: string;
    results: Array<{ keyword: string; position: number | null; status: "done" | "not_found" | "failed" }>;
  } | null>(null);
  useEffect(() => {
    if (!POSITION_CHECK_ENABLED) return;
    const domain = company?.company.url;
    if (!domain) return;
    fetch(`/api/position-checks?domain=${encodeURIComponent(domain)}`)
      .then((r) => r.json())
      .then((json) => {
        const hasResults = json.ok && Array.isArray(json.results) && json.results.length > 0;
        // Показываем то, что есть — но если ВЕСЬ батч "failed" (например,
        // старый прогон ещё через Playwright/капчу до перехода на Yandex
        // Search API), это не полезные данные. Показываем как есть, но
        // ниже всё равно пробуем перезапустить проверку — сервер сам не
        // применит cooldown к полностью-failed батчу (см. /api/kp-position-check).
        const allFailed = hasResults && json.results.every((r: { status: string }) => r.status === "failed");
        if (hasResults) {
          setPositionCheck({ engine: json.engine, checkedAt: json.checkedAt, results: json.results });
          if (!allFailed) return;
        }
        // Данных ещё нет (или прошлая попытка целиком провалилась) — тихо
        // запускаем живую проверку в фоне (займёт 1.5-2 мин у Google;
        // Yandex — секунды, т.к. это официальный API, а не браузер).
        // /api/kp-position-check публичный (без авторизации) — работает для
        // любого КП, кто бы его ни открыл. Единственная защита — cooldown
        // 24ч по домену на сервере (не даёт задублировать проверку при
        // перезагрузках страницы), это не access control. Ключевые слова
        // берём из уже реально извлечённого SEO-анализа сайта
        // (company.seo.keywords, обычно из Keys.so). Если их нет — это
        // частый случай, когда Keys.so у пользователя не подключён —
        // подстраховка: проверяем хотя бы позицию по названию бренда,
        // это тоже реальный, а не выдуманный запрос.
        const keywords = (company?.seo?.keywords ?? []).filter(Boolean).slice(0, 10);
        if (keywords.length === 0 && company?.company.name) keywords.push(company.company.name);
        if (keywords.length === 0) return;
        fetch("/api/kp-position-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, keywords, engine: "yandex" }),
        }).catch(() => { /* тихо — не критично, раздел просто не появится в этот раз */ });
      })
      .catch(() => { /* тихо — раздел просто не появится */ });
  }, [company?.company.url, company?.seo?.keywords]);

  // ─── Находки из реальных данных ──
  const findings = useMemo<Finding[]>(() => buildFindings(company, competitors), [company, competitors]);
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

  // ─── трекинг вовлечённости: просмотр + до какого раздела долистали ──
  // Просмотр шлём один раз при монтировании; "section" — только когда юзер
  // ушёл ДАЛЬШЕ, чем был (maxSectionIdxRef), чтобы не спамить событиями на
  // каждый пиксель скролла и не логировать возврат назад как новый прогресс.
  const maxSectionIdxRef = useRef(-1);
  useEffect(() => {
    trackKpEvent("view");
  }, []);

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
      const idx = SECTIONS.findIndex((s) => s.id === current);
      if (idx > maxSectionIdxRef.current) {
        maxSectionIdxRef.current = idx;
        trackKpEvent("section", current);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(`kp-${id}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
  };
  const revealPricing = () => { setPricingRevealed(true); scrollTo("pricing"); };

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

  // Ссылка на форму заявки (/analysis-request) — company/site/ref подставляем
  // из текущего анализа, intent разводит копирайт формы: "contact" — общая
  // заявка («Оставить заявку»), "full" — платный полный анализ за 2 990 ₽.
  const analysisRequestHref = (intent: "contact" | "full") =>
    `/analysis-request?intent=${intent}&company=${encodeURIComponent(c.name)}&site=${encodeURIComponent(c.url ?? "")}&ref=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/kp")}`;

  return (
    <div ref={rootRef} style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh", fontFamily: "var(--font-sans, system-ui, sans-serif)", position: "relative" }}>
      <DotGridBackdrop />

      {/* Прогресс-бар */}
      <div style={{ position: "fixed", top: 0, left: 0, height: 3, width: `${progress}%`, background: "var(--primary)", zIndex: 60, transition: "width 0.1s linear", boxShadow: "0 0 8px color-mix(in srgb, var(--primary) 70%, transparent)" }} />

      {/* Sticky-CTA: оффер всегда на экране, пока читают середину страницы.
          Скрыт в начале (hero сам продаёт) и в конце (не перекрывать финальный CTA). */}
      {pilotOffer && progress > 18 && progress < 90 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 55,
          background: "color-mix(in srgb, var(--background) 92%, transparent)", backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--border)",
        }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13.5, minWidth: 0 }}>
              <b>Перенос сайта на Astro — 10 000 ₽</b>
              <span style={{ color: "var(--muted-foreground)" }}> · скорость 43 → 90+ за 3–5 дней · фиксированная цена</span>
            </div>
            <button
              onClick={() => { trackKpEvent("click", "sticky-offer-cta"); scrollTo("pilot-offer"); }}
              className="ds-btn ds-btn-primary"
              style={{ height: 38, padding: "0 18px", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}
            >
              Начать <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Панель шеринга — видна только владельцу (onShare передан из /kp), не на публичной странице */}
      {onShare && (
        <div style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
              Эта страница видна только вам. Чтобы отправить анализ клиенту без доступа к платформе — создайте публичную ссылку.
            </div>
            <button
              onClick={onShare}
              disabled={sharing}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                border: "1px solid var(--primary)", background: "var(--background)", color: "var(--primary)",
                fontSize: 13, fontWeight: 600, cursor: sharing ? "wait" : "pointer", flexShrink: 0,
              }}
            >
              <Link2 size={14} /> {sharing ? "Создаём…" : "Поделиться ссылкой"}
            </button>
          </div>
          {shareLink && (
            <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px 12px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 2 }}>
                  Публичная ссылка {shareCopied && <span style={{ color: "var(--success)" }}>· скопировано ✓</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", wordBreak: "break-all" }}>{shareLink}</div>
              </div>
              <button
                onClick={onCopyShareLink}
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--primary)", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}
              >
                Копировать
              </button>
            </div>
          )}
          {shareError && (
            <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px 12px", fontSize: 12.5, color: "var(--destructive)" }}>
              {shareError}
            </div>
          )}
        </div>
      )}

      {/* Липкая навигация */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50, background: "color-mix(in srgb, var(--background) 88%, transparent)",
        backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
            <span style={{ color: "var(--primary)" }}>MarketRadar</span>
            <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>· Анализ</span>
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
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
            title={isDark ? "Светлая тема" : "Тёмная тема"}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 999, border: "1px solid var(--border)",
              background: "var(--card)", color: "var(--foreground)", cursor: "pointer", flexShrink: 0,
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
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
                      Интерактивный анализ сайта
                    </div>
                    <h1 style={{ fontSize: 40, fontWeight: 850, lineHeight: 1.1, margin: "0 0 10px", letterSpacing: "-0.02em" }}>{c.name}</h1>
                    {c.url && <a href={c.url.startsWith("http") ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 15, textDecoration: "none" }}>{c.url}</a>}
                    {pilotOffer ? (
                      /* Пилотный hero: строгая иерархия — 1 вердикт-строка,
                         1 главный акцент (потенциал), чипы-факты со stagger,
                         пульсирующий дедлайн, 2 кнопки. Автокарточки скрыты:
                         «0 конкурентов» рядом с «3 разобраны вручную» врало. */
                      <>
                        <p style={{ fontSize: 17, lineHeight: 1.5, marginTop: 16, marginBottom: 0, color: "var(--muted-foreground)", maxWidth: 520 }}>{PILOT_HERO.verdict}</p>
                        <div className="kp-hero-pop" style={{ marginTop: 20 }}>
                          {/* Связка «боль → выгода»: label-мост, чтобы вердикт и цифра
                              читались одной мыслью, а не двумя обрывками (мобильный фидбек) */}
                          <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--success)", marginBottom: 6 }}>
                            Потенциал после устранения находок
                          </div>
                          <div style={{
                            fontSize: "clamp(30px, 7vw, 44px)", fontWeight: 850, lineHeight: 1.05, letterSpacing: "-0.02em",
                            background: "linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 55%, var(--primary)))",
                            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                          }}>
                            {PILOT_HERO.potential}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>{PILOT_HERO.potentialSub}</div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
                          {PILOT_HERO.badges.map((b, bi) => (
                            <span key={b} className="kp-hero-pop" style={{
                              animationDelay: `${200 + bi * 110}ms`,
                              display: "inline-flex", alignItems: "center", gap: 6,
                              fontSize: 12.5, fontWeight: 650, padding: "6px 13px", borderRadius: 999,
                              background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)",
                            }}>
                              <CheckCircle2 size={13} style={{ color: "var(--success)", flexShrink: 0 }} /> {b}
                            </span>
                          ))}
                        </div>
                        <div className="kp-hero-pop" style={{
                          animationDelay: "540ms",
                          display: "inline-flex", alignItems: "center", gap: 10, marginTop: 16,
                          fontSize: 13, fontWeight: 700, color: "var(--warning)",
                          padding: "7px 14px", borderRadius: 999,
                          background: "color-mix(in srgb, var(--warning) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                        }}>
                          <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--warning)" }} />
                            <span className="kp-pulse-dot" style={{ color: "var(--warning)", top: 0, left: 0 }} />
                          </span>
                          {PILOT_HERO.deadline}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
                          <button onClick={() => { trackKpEvent("click", "hero-discuss"); scrollTo("cta"); }} className="ds-btn ds-btn-primary kp-cta-glow" style={{ height: 46, padding: "0 22px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8 }}>
                            Обсудить проект <ArrowRight size={17} />
                          </button>
                          <button onClick={() => { trackKpEvent("click", "hero-offer"); scrollTo("pilot-offer"); }} style={{
                            height: 46, padding: "0 20px", fontSize: 14.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8,
                            borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer",
                          }}>
                            Предложение — от 10 000 ₽
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 18, lineHeight: 1.5, marginTop: 18, color: "var(--foreground)" }}>{verdictOf(c.score)}.</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                          <Badge icon={<Target size={15} />} label="Проанализировано конкурентов" value={competitors.length} active={v} />
                          <Badge icon={<AlertTriangle size={15} />} label="Критичных проблем" value={sevCounts.critical} color="var(--destructive)" active={v} />
                          <Badge icon={<ListChecks size={15} />} label="Рекомендаций" value={recs.length} active={v} />
                          {myRank > 0 && <Badge icon={<Gauge size={15} />} label="Позиция среди конкурентов" value={myRank} prefix="#" active={v} />}
                        </div>
                        <button onClick={() => { trackKpEvent("click", "hero-discuss"); scrollTo("cta"); }} className="ds-btn ds-btn-primary kp-cta-glow" style={{ marginTop: 26, height: 46, padding: "0 22px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8 }}>
                          Обсудить проект <ArrowRight size={17} />
                        </button>
                      </>
                    )}
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

        {/* ─── СИЛЬНЫЕ СТОРОНЫ + ЛЕГЕНДА (только pilotOffer) — доверие до боли ─── */}
        {pilotOffer && (
          <Section id="pilot-strengths" title="Что уже работает" subtitle="Честный аудит начинается с сильных сторон — их нельзя сломать в ходе работ, на них мы опираемся">
            {/* Легенда достоверности — как читать весь отчёт */}
            <div className="ds-card" style={{ padding: "14px 18px", marginBottom: 20, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Как читать отчёт:</span>
              {EVIDENCE_LEGEND.map((l) => (
                <span key={l.level} style={{ display: "inline-flex", gap: 7, alignItems: "flex-start", fontSize: 12.5, color: "var(--muted-foreground)", flex: "1 1 220px", minWidth: 200, lineHeight: 1.4 }}>
                  <EvidenceBadge level={l.level} /> {l.desc}
                </span>
              ))}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {PILOT_STRENGTHS.map((s, i) => (
                <Reveal key={i} delay={i * 70}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "18px 20px", borderLeft: "4px solid var(--success)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                        <Trophy size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35, flex: 1 }}>{s.title}</div>
                        <EvidenceBadge level={s.evidence} />
                      </div>
                      <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 8px" }}>{s.body}</p>
                      <div style={{ fontSize: 13.5, lineHeight: 1.5, display: "flex", gap: 8 }}>
                        <ArrowRight size={15} style={{ color: "var(--success)", flexShrink: 0, marginTop: 3 }} />
                        <span><b style={{ color: "var(--success)" }}>На это опираемся:</b> {s.leverage}</span>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </Section>
        )}

        {/* ─── НАХОДКИ: пилот — ручные кейсы «факт → важно → делать → даст» ─── */}
        {pilotOffer && (
          <Section id="findings" title="Находки — с доказательствами и эффектом" subtitle="Каждая находка: что нашли → почему это важно → что делать → что это даст. Всё проверено вручную 15–16.07.2026">
            <div style={{ display: "grid", gap: 14 }}>
              {PILOT_FINDINGS.map((f, i) => (
                <Reveal key={i} delay={Math.min(i, 6) * 50}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "18px 20px", borderLeft: `4px solid ${f.severity === "critical" ? "var(--destructive)" : "var(--warning)"}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.3, flex: 1, minWidth: 220 }}>{f.title}</div>
                        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: f.severity === "critical" ? "var(--destructive)" : "var(--warning)", border: `1px solid ${f.severity === "critical" ? "var(--destructive)" : "var(--warning)"}`, borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap" }}>
                          {f.severity === "critical" ? "КРИТИЧНО" : "ВНИМАНИЕ"}
                        </span>
                        <EvidenceBadge level={f.evidence} />
                      </div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.55, padding: "10px 14px", background: "var(--muted)", borderRadius: 8, marginBottom: 10 }}>{f.fact}</div>
                      <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 12px" }}>{f.why}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                        <div style={{ borderRadius: 8, padding: "10px 14px", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: "var(--primary)", marginBottom: 4 }}>ЧТО ДЕЛАТЬ</div>
                          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{f.action}</div>
                        </div>
                        <div style={{ borderRadius: 8, padding: "10px 14px", background: "color-mix(in srgb, var(--success) 8%, transparent)" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: "var(--success)", marginBottom: 4 }}>ЧТО ДАСТ <span style={{ fontWeight: 600, opacity: 0.8 }}>· прогноз</span></div>
                          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{f.effect}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </Section>
        )}

        {/* ─── НАХОДКИ (дыры по каналам: сайт / соцсети / ИИ) — не-пилот ─── */}
        {!pilotOffer && findings.length > 0 && (
          <Section id="findings" title="Где вы теряете клиентов" subtitle="Проблемы по трём каналам — сайт, соцсети и видимость в нейросетях — и как мы их закрываем">
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 8 }}>
              <ProportionBar critical={sevCounts.critical} warning={sevCounts.warning} ok={sevCounts.ok} />
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                Всего нашли <b style={{ color: "var(--foreground)" }}>{findings.length}</b> {ruPlural(findings.length, "точку роста", "точки роста", "точек роста")}
                {sevCounts.critical > 0 && <>, из них <b style={{ color: "var(--destructive)" }}>{sevCounts.critical}</b> критичных</>}
              </div>
            </div>
            {(["site", "social", "ai", "other"] as Channel[]).map((ch) => {
              const group = findings.filter((f) => f.channel === ch);
              if (group.length === 0) return null;
              const meta = CHANNEL_META[ch];
              return (
                <div key={ch} style={{ marginTop: 26 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                    <meta.icon size={17} style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{meta.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 999, padding: "2px 9px" }}>{group.length}</span>
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {group.map((f, i) => (
                      <Reveal key={`${ch}-${i}`} delay={Math.min(i, 6) * 50}>
                        {(v) => <FindingCard f={f} visible={v} />}
                      </Reveal>
                    ))}
                  </div>
                </div>
              );
            })}
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
            <div className="kp-tech-grid">
              {lhSet?.performance != null && <RingTile key={`perf-${techTab}`} label="Производительность" value={lhSet.performance} hint="Как быстро грузится сайт. Низкий балл — люди уходят, не дождавшись." />}
              {lhSet?.seo != null && <RingTile key={`seo-${techTab}`} label="Тех. SEO страницы" value={lhSet.seo} hint="Технические основы: title, мета-теги, мобильность. Это не позиции — за реальную видимость отвечает SEO-балл по трафику." />}
              {lhSet?.accessibility != null && <RingTile key={`acc-${techTab}`} label="Доступность" value={lhSet.accessibility} hint="Удобство и корректность вёрстки — сигнал качества для людей и роботов." />}
              {lhSet?.lcp && <TechTile label="LCP" text={lhSet.lcp.display} pct={lhSet.lcp.score * 100} hint="Загрузка основного контента. Хорошо — до 2,5 с." />}
              {lhSet?.cls && <TechTile label="CLS" text={lhSet.cls.display} pct={lhSet.cls.score * 100} hint="Сдвиги вёрстки при загрузке. Хорошо — меньше 0,1." />}
              {lhSet?.tbt && <TechTile label="TBT" text={lhSet.tbt.display} pct={lhSet.tbt.score * 100} hint="Задержка отклика на клики. Хорошо — меньше 200 мс." />}
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

        {/* ─── ЛИДЕРЫ НИШИ — разбор конкурентов вручную (только pilotOffer) ─── */}
        {pilotOffer && (
          <Section id="pilot-rivals" title="Лидеры ниши — разобраны вручную" subtitle="Три сайта из топа выдачи по ключевым запросам. У каждого — что забираем себе; ниша выигрывается структурой, а не бюджетом">
            <div style={{ display: "grid", gap: 14 }}>
              {PILOT_RIVALS.map((r, i) => (
                <Reveal key={i} delay={i * 80}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <Swords size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
                        <span style={{ fontSize: 16.5, fontWeight: 800 }}>{r.name}</span>
                        <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{r.url}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Сильны в</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--muted-foreground)" }}>{r.strength}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Слабое место</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--muted-foreground)" }}>{r.weakness}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Что забираем</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{r.steal}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
            <div className="ds-card" style={{ padding: "18px 20px", marginTop: 14, borderLeft: "4px solid var(--success)", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Trophy size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>{PILOT_TRUMP}</p>
            </div>
          </Section>
        )}

        {/* ─── AI-ВИДИМОСТЬ ─── */}
        {/* Полный аудит (отдельный прогон) — если он есть, показываем богатую версию. */}
        {aiVisibility && aiVisibility.status === "done" && aiVisibility.totalScore != null ? (
          <Section id="ai-visibility" title="AI-видимость" subtitle="Насколько бренд заметен в ответах AI-ассистентов — ChatGPT, Claude, YandexGPT, Gemini">
            <div className="kp-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,220px) 1fr", gap: 28, alignItems: "center" }}>
              <Reveal>{(v) => <Ring value={aiVisibility.totalScore ?? 0} size={150} stroke={12} active={v} sublabel="AI-видимость / 100" />}</Reveal>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                {(Object.entries(aiVisibility.scoresByLlm ?? {}) as Array<[LLMName, number]>)
                  .filter(([, score]) => score >= 0)
                  .map(([llm, score]) => (
                    <Reveal key={llm}>
                      {(v) => (
                        <div className="ds-card ds-card-interactive" style={{ padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <Ring value={score} size={64} stroke={6} active={v} />
                          <div style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", marginTop: 4 }}>{LLM_LABELS[llm]}</div>
                        </div>
                      )}
                    </Reveal>
                  ))}
              </div>
            </div>
            {aiVisibility.recommendations && aiVisibility.recommendations.length > 0 && (
              <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
                {aiVisibility.recommendations.slice(0, 3).map((r, i) => (
                  <Reveal key={i} delay={i * 60}>
                    {() => (
                      <div className="ds-card ds-card-interactive" style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", borderLeft: "4px solid var(--primary)" }}>
                        <Bot size={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.title}</div>
                          <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.45, marginTop: 4 }}>{r.description}</div>
                        </div>
                      </div>
                    )}
                  </Reveal>
                ))}
              </div>
            )}
          </Section>
        ) : aiPerc ? (
          // Fallback: отдельного аудита нет, но в основном анализе всегда есть
          // aiPerception (как нейросети воспринимают бренд) — показываем его,
          // чтобы блок AI-видимости не пропадал. Все данные реальные (из анализа).
          <Section id="ai-visibility" title="AI-видимость" subtitle="Как нейросети воспринимают ваш бренд — по анализу присутствия в ответах AI-ассистентов">
            <div className="ds-card" style={{ padding: "18px 22px", marginBottom: 18, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", borderLeft: `4px solid ${aiPresenceColor(aiPerc.knowledgePresence)}` }}>
              <Bot size={22} style={{ color: aiPresenceColor(aiPerc.knowledgePresence), flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 4 }}>Присутствие в ответах нейросетей</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: aiPresenceColor(aiPerc.knowledgePresence) }}>{aiPresenceLabel(aiPerc.knowledgePresence)}</div>
              </div>
              {aiMentions != null && (
                <div style={{ textAlign: "center", paddingLeft: 18, borderLeft: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 40, fontWeight: 850, lineHeight: 1, color: aiMentions === 0 ? "var(--destructive)" : "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{aiMentions}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 4, maxWidth: 150 }}>упоминаний бренда в ответах нейросетей на момент анализа</div>
                </div>
              )}
            </div>
            {aiMentions === 0 && (
              <div className="ds-card" style={{ padding: "14px 18px", marginBottom: 18, display: "flex", gap: 12, alignItems: "flex-start", borderLeft: "4px solid var(--destructive)" }}>
                <AlertTriangle size={18} style={{ color: "var(--destructive)", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                  Когда клиент спрашивает у нейросети «кто в вашей нише лучше», бренд <b>не называют ни разу</b> — весь этот трафик уходит к конкурентам, которых AI уже знает. Это чиним в разделе <b>GEO-видимость</b> ниже.
                </p>
              </div>
            )}
            {/* E-E-A-T — реальные баллы 0-100 из анализа */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 18 }}>
              {([
                ["Экспертность", aiPerc.eeat?.expertise],
                ["Авторитет", aiPerc.eeat?.authority],
                ["Доверие", aiPerc.eeat?.trust],
                ["Опыт", aiPerc.eeat?.experience],
              ] as Array<[string, number | undefined]>).filter(([, s]) => s != null).map(([label, s]) => (
                <Reveal key={label}>
                  {(v) => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <Ring value={s ?? 0} size={64} stroke={6} active={v} />
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>{label}</div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
            {aiPerc.sampleAnswer && (
              <div className="ds-card" style={{ padding: "16px 18px", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 8 }}>Что нейросеть отвечает о вас сейчас</div>
                <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, fontStyle: "italic", color: "var(--foreground)" }}>«{aiPerc.sampleAnswer}»</p>
              </div>
            )}
            {aiPerc.improvementTips && aiPerc.improvementTips.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {aiPerc.improvementTips.slice(0, 4).map((tip, i) => (
                  <Reveal key={i} delay={i * 60}>
                    {() => (
                      <div className="ds-card ds-card-interactive" style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", borderLeft: "4px solid var(--primary)" }}>
                        <Sparkles size={17} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 14, lineHeight: 1.5 }}>{tip}</span>
                      </div>
                    )}
                  </Reveal>
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {/* ─── GEO-ВИДИМОСТЬ — глубокий разбор (только pilotOffer) ─── */}
        {pilotOffer && (
          <Section id="pilot-geo" title="GEO: видимость в ответах нейросетей" subtitle="Отдельный, растущий канал — как попасть в ответы Алисы, ChatGPT и Perplexity, когда клиент спрашивает «кто делает искусственные скалы в Москве»">
            <div className="ds-card" style={{ padding: "20px 22px", marginBottom: 16, borderLeft: "4px solid var(--primary)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <BrainCircuit size={20} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 10px" }}>{PILOT_GEO.intro}</p>
                  <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0, color: "var(--muted-foreground)" }}>{PILOT_GEO.whyNow}</p>
                </div>
              </div>
            </div>

            {/* Что вознаграждает каждый ассистент */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "24px 0 12px" }}>
              Что вознаграждает каждый ассистент
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {PILOT_GEO.assistants.map((a, i) => (
                <Reveal key={i} delay={i * 50}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <Bot size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                        <span style={{ fontSize: 14.5, fontWeight: 800 }}>{a.name}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{a.rewards}</div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>

            {/* Рычаги цитируемости */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "24px 0 12px" }}>
              Чем мы поднимаем цитируемость — 5 рычагов
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {PILOT_GEO.levers.map((l, i) => (
                <Reveal key={i} delay={i * 40}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 999, background: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>{l.title}</div>
                        <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{l.detail}</div>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>

            {/* Как замеряем */}
            <div className="ds-card" style={{ padding: "18px 20px", marginTop: 24, borderLeft: "4px solid var(--success)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <LineChart size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 800 }}>Как честно замеряем результат</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}>{PILOT_GEO.method.intro}</p>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--success)", margin: "0 0 10px" }}>{PILOT_GEO.method.metric}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Примеры контрольных вопросов</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PILOT_GEO.method.questions.map((q, i) => (
                  <span key={i} style={{ fontSize: 12.5, background: "var(--muted)", borderRadius: 999, padding: "5px 12px", color: "var(--foreground)" }}>«{q}»</span>
                ))}
              </div>
            </div>

            {/* Прогноз GEO по месяцам */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "24px 0 12px" }}>
              Прогноз по GEO-каналу
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {PILOT_GEO.forecast.map((f, i) => (
                <Reveal key={i} delay={i * 60}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>{f.month}</span>
                        <EvidenceBadge level={f.evidence} />
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted-foreground)" }}>{f.text}</div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </Section>
        )}

        {/* ─── ПОЗИЦИИ В ПОИСКЕ ─── */}
        {POSITION_CHECK_ENABLED && positionCheck && positionCheck.results.length > 0 && (
          <Section
            id="positions"
            title="Позиции в поиске"
            subtitle={`Живая проверка в ${positionCheck.engine === "yandex" ? "Яндексе" : "Google"} по ключевым запросам — реальная выдача, не оценка AI · ${new Date(positionCheck.checkedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}`}
          >
            <div style={{ display: "grid", gap: 10 }}>
              {positionCheck.results.map((r, i) => {
                const diagnosis = pilotOffer ? PILOT_POSITION_DIAGNOSIS[r.keyword.toLowerCase().trim()] : undefined;
                return (
                <Reveal key={i} delay={Math.min(i, 8) * 50}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 14.5 }}>{r.keyword}</span>
                        {r.status === "done" && r.position != null ? (
                          <span style={{ fontWeight: 800, fontSize: 18, color: r.position <= 3 ? "var(--success)" : r.position <= 10 ? "var(--warning)" : "var(--destructive)", fontVariantNumeric: "tabular-nums" }}>
                            #{r.position}
                          </span>
                        ) : r.status === "not_found" ? (
                          <span style={{ fontSize: 12.5, color: "var(--muted-foreground)", fontWeight: 600 }}>вне топ-30</span>
                        ) : (
                          <span style={{ fontSize: 12.5, color: "var(--muted-foreground)", fontWeight: 600 }}>не удалось проверить</span>
                        )}
                      </div>
                      {diagnosis && (
                        <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.45, marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                          <b style={{ color: "var(--foreground)" }}>Диагноз:</b> {diagnosis}
                        </div>
                      )}
                    </div>
                  )}
                </Reveal>
                );
              })}
            </div>
          </Section>
        )}

        {/* ─── ТОЧКИ РОСТА ─── */}
        {!pilotOffer && (niche?.opportunities?.length || recs.length > 0) && (
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
        {!pilotOffer && plan.length > 0 && (
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

        {/* ─── ПРЕДЛОЖЕНИЕ: два фиксированных оффера (только pilotOffer) ─── */}
        {pilotOffer && (
          <Section id="pilot-offer" title="С чего предлагаем начать" subtitle="Разовый вход с фиксированной ценой + два месячных направления — внутренняя оптимизация уже входит в тариф СЕО+ГЕО">
            <div style={{ display: "grid", gap: 16 }}>
              {PILOT_OFFERS.map((o) => (
                <Reveal key={o.n} delay={o.n * 80}>
                  {() => (
                    <div className="ds-card" style={{ padding: "22px 24px", border: "2px solid var(--primary)", boxShadow: "0 0 0 4px color-mix(in srgb, var(--primary) 10%, transparent)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 999, background: "var(--primary)", color: "var(--primary-foreground)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{o.n}</div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 19, fontWeight: 850, lineHeight: 1.25 }}>{o.name}</div>
                          <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}>{o.priceNote}</div>
                        </div>
                        <div style={{ fontSize: 27, fontWeight: 850, color: "var(--primary)", whiteSpace: "nowrap" }}>{o.price}</div>
                      </div>
                      {o.before && o.after && (
                        <div style={{ display: "flex", gap: 18, alignItems: "center", justifyContent: "center", marginBottom: 16, flexWrap: "wrap", padding: "14px 10px", borderRadius: 12, background: "var(--muted)" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <Ring value={43} size={104} stroke={10} active />
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{o.before.label}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{o.before.value}</div>
                          </div>
                          <ArrowRight size={26} style={{ color: "var(--primary)", flexShrink: 0 }} />
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <Ring value={92} size={104} stroke={10} active />
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{o.after.label}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{o.after.value}</div>
                          </div>
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: "var(--muted-foreground)", textTransform: "uppercase", marginBottom: 8 }}>Что входит</div>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
                            {o.what.map((w, j) => (
                              <li key={j} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.45 }}>
                                <Wrench size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 3 }} /> {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: "var(--success)", textTransform: "uppercase", marginBottom: 8 }}>Что получите</div>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
                            {o.gets.map((g, j) => (
                              <li key={j} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.45 }}>
                                <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.5, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                        <b>Почему такая цена:</b> {o.effort}
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
            {/* Месячные направления — цены партнёра; он-пейдж оптимизация входит в СЕО+ГЕО */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "24px 0 12px" }}>
              Дальше — помесячно
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
              {PILOT_MONTHLY.map((m, i) => (
                <Reveal key={m.name} delay={i * 70}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "18px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6 }}>{m.name}</div>
                      <div style={{ fontSize: 23, fontWeight: 850, marginBottom: 12 }}>{m.price}</div>
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 7 }}>
                        {m.items.map((it, j) => (
                          <li key={j} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.45, color: "var(--muted-foreground)" }}>
                            <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>

            {/* Что происходит по неделям после старта — снимает страх «заплачу и тишина» */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "24px 0 12px" }}>
              Что происходит после старта
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {PILOT_TIMELINE.map((t, i) => (
                <Reveal key={i} delay={i * 60}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--primary)", marginBottom: 6 }}>{t.week}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{t.text}</div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 16, padding: "16px 20px", borderRadius: 12, background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{PILOT_OFFERS_TOTAL}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12.5, color: "var(--success)", fontWeight: 600 }}>
                  <ShieldCheck size={15} style={{ flexShrink: 0 }} /> {PILOT_GUARANTEE}
                </div>
              </div>
              <button onClick={() => { trackKpEvent("click", "pilot-offer-cta"); scrollTo("cta"); }} className="ds-btn ds-btn-primary" style={{ height: 42, padding: "0 20px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                Начать с переноса <ArrowRight size={15} />
              </button>
            </div>
          </Section>
        )}

        {/* ─── ФОРМАТ РАБОТ (только для pilotOffer) ─── */}
        {pilotOffer && (
          <Section id="seo-preview" title="Как это будет выглядеть" subtitle="Формат SEO+GEO статей — иллюстрация, не готовые публикации — и ориентир по результату первого месяца">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
              Пример формата статей — нажмите, чтобы прочитать
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 16, alignItems: "start" }}>
              {SEO_PREVIEW_ARTICLES.map((a, i) => {
                const isOpen = expandedArticle === i;
                return (
                  <Reveal key={i} delay={i * 70}>
                    {() => (
                      <div
                        className="ds-card ds-card-interactive"
                        onClick={() => setExpandedArticle(isOpen ? null : i)}
                        style={{ padding: "18px 20px", cursor: "pointer", border: isOpen ? "2px solid var(--primary)" : undefined }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <FileText size={18} style={{ color: "var(--primary)", marginBottom: 10, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>{isOpen ? "Свернуть ↑" : "Читать →"}</span>
                        </div>
                        <div style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.35, marginBottom: 8 }}>{a.title}</div>
                        <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{a.excerpt}</div>
                        {isOpen && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                            {a.body.split("\n\n").map((para, pi) => (
                              <p key={pi} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--foreground)", margin: pi === 0 ? "0 0 10px" : "0 0 10px" }}>{para}</p>
                            ))}
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>
                              Почему это работает на SEO и ГЕО
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
                              {a.geoNotes.map((note, ni) => (
                                <li key={ni} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.45, color: "var(--muted-foreground)" }}>
                                  <Sparkles size={13} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 3 }} /> {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </Reveal>
                );
              })}
            </div>

            <div className="ds-card" style={{ padding: "18px 20px", marginBottom: 32, borderLeft: "4px solid var(--success)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Почему такой формат в целом поднимает SEO и особенно ГЕО
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {SEO_GEO_MECHANICS.map((m, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.5 }}>
                    <CheckCircle2 size={15} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> {m}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
              Ориентир на первый месяц — СЕО+ГЕО
            </div>
            <div className="ds-card" style={{ padding: "20px 22px", marginBottom: 32 }}>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
                {SEO_MONTH1_FORECAST.map((it, j) => (
                  <li key={j} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.45 }}>
                    <CheckCircle2 size={17} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} /> {it}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
              Контент-завод для соцсетей
            </div>
            <div className="ds-card ds-card-interactive" style={{ padding: "18px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Rocket size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
                Сделаем то же по соцсетям: разберём нишу и аудиторию, найдём форматы, которые сейчас заходят в декоре/интерьере, и соберём контент-план со сценариями на неделю вперёд — что и как снимать, простыми кадрами на телефон. Примеры готовых роликов покажем уже в процессе работы, после старта.
              </p>
            </div>
          </Section>
        )}

        {/* ─── ПРОГНОЗ РОСТА — расчётная модель (только pilotOffer). Идёт после
            «Формата работ»: пик выгоды подводит прямо к условиям и заявке. ─── */}
        {pilotOffer && (
          <Section id="pilot-forecast" title="Прогноз: что даст каждый канал и когда" subtitle="Расчётная модель с вилкой — ориентир для планирования, не гарантия. Пересчитывается ежемесячно по фактам Метрики и Вебмастера">
            {/* Формула + допущения */}
            <div className="ds-card" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Как считаем</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, fontFamily: "var(--font-mono, ui-monospace, monospace)", background: "var(--muted)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, lineHeight: 1.5 }}>{PILOT_FORECAST.formula}</div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 7 }}>
                {PILOT_FORECAST.assumptions.map((a, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.45, color: "var(--muted-foreground)" }}>
                    <Minus size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 3 }} /> {a}
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 12, padding: "10px 14px", background: "color-mix(in srgb, var(--primary) 7%, transparent)", borderRadius: 8 }}>
                <b>Пример расчёта.</b> {PILOT_FORECAST.example}
              </div>
            </div>

            {/* Сценарии по каналам */}
            <div style={{ display: "grid", gap: 12 }}>
              {PILOT_FORECAST.scenarios.map((s, i) => (
                <Reveal key={i} delay={i * 70}>
                  {() => (
                    <div className="ds-card ds-card-interactive" style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                        <LineChart size={17} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 3 }} />
                        <div style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.3, flex: 1 }}>{s.name}</div>
                        <EvidenceBadge level="forecast" />
                      </div>
                      <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", lineHeight: 1.5, margin: "0 0 12px" }}>{s.desc}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                        {[{ m: "1-й месяц", t: s.m1 }, { m: "3-й месяц", t: s.m3 }, { m: "6-й месяц", t: s.m6 }].map((c, j) => (
                          <div key={j} style={{ background: "var(--muted)", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>{c.m}</div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{c.t}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>

            {/* График: заявки/мес по каналам (как в эталоне) */}
            <PilotForecastChart isDark={isDark} />

            {/* Свод + юнит-экономика: главный аргумент — цифрами, не абзацем */}
            <div className="kp-cta-panel" style={{ marginTop: 16, padding: "26px 28px", borderRadius: "var(--radius-xl, 20px)", color: "var(--primary-foreground)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9, marginBottom: 14 }}>Сводный прогноз к 6-му месяцу · юнит-экономика</div>
                <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 850, lineHeight: 1.1 }}>+{PILOT_FORECAST.totalLow}–{PILOT_FORECAST.totalHigh}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>заявок в месяц</div>
                  </div>
                  <ArrowRight size={22} style={{ opacity: 0.7, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 850, lineHeight: 1.1 }}>2–8</div>
                    <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>договоров в месяц (конверсия 15–25%)</div>
                  </div>
                  <ArrowRight size={22} style={{ opacity: 0.7, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 850, lineHeight: 1.1 }}>150–500 тыс ₽</div>
                    <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>средний чек проекта</div>
                  </div>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, margin: 0 }}>
                  Разовый вход — 10 000 ₽ за перенос сайта: окупается с первого договора.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* ─── ПИЛОТНЫЕ УСЛОВИЯ (только для pilotOffer) ─── */}
        {pilotOffer && (
          <Section id="pilot" title="Пилотные условия — первый поток" subtitle="Специальные условия для первых 10 компаний — старт потока 21 июля 2026">
            <div className="ds-card" style={{ borderLeft: "4px solid var(--primary)", padding: "22px 26px", marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Sparkles size={22} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 15, lineHeight: 1.55, margin: "0 0 14px" }}>
                  Сейчас запускаем первый поток — 10 компаний на пилотных условиях, их результаты станут первыми публичными кейсами MarketRadar. Условия ниже — специально для первого потока, ниже стандартных.
                </p>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
                  {PILOT_STEPS.map((it, j) => (
                    <li key={j} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.5 }}>
                      <CheckCircle2 size={16} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} /> {it}
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14 }}>
                  <ShieldCheck size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                    <b>Гарантия:</b> если за месяц не выпускаем заявленный объём работ — возвращаем оплату этого месяца.
                  </div>
                </div>
              </div>
            </div>

            {/* Ценовые карточки переехали в «С чего предлагаем начать» (PILOT_MONTHLY),
                плашка «Старт потока … публичный кейс» убрана по просьбе партнёра. */}
          </Section>
        )}

        {/* ─── ТАРИФЫ — скрыты на пилоте: пилотные условия дают свои цены ─── */}
        {!pilotOffer && (
        <Section id="pricing" title="Что мы предлагаем" subtitle="Пакеты услуг MarketRadar — можно взять по отдельности или связкой">
          {!pricingRevealed ? (
            <Reveal>
              {() => (
                <div className="ds-card" style={{ padding: "40px 32px", textAlign: "center" }}>
                  <Lock size={28} style={{ color: "var(--muted-foreground)", marginBottom: 14 }} />
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Цены открываются по запросу</div>
                  <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 20, maxWidth: 420, marginInline: "auto", lineHeight: 1.5 }}>
                    Нажмите кнопку — покажем пакеты услуг и стоимость под ваши задачи.
                  </div>
                  <button onClick={() => { trackKpEvent("click", "reveal-pricing"); revealPricing(); }} className="ds-btn ds-btn-primary" style={{ height: 46, padding: "0 24px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Eye size={17} /> Получить коммерческое предложение
                  </button>
                </div>
              )}
            </Reveal>
          ) : (
          <div style={{ display: "grid", gap: 28 }}>
            {PACKAGES.map((pkg, pi) => (
              <Reveal key={pkg.name} delay={pi * 90}>
                {() => (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: pkg.note ? 6 : 14 }}>
                      <div style={{ width: 6, height: 22, borderRadius: 3, background: pkg.accent }} />
                      <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{pkg.name}</h3>
                    </div>
                    {pkg.note && (
                      <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.45, margin: "0 0 14px", maxWidth: 640 }}>
                        {pkg.note}
                      </p>
                    )}
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
          )}
        </Section>
        )}

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
                    <a href={analysisRequestHref("contact")}
                      onClick={() => trackKpEvent("click", "leave-request")}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 50, padding: "0 26px", borderRadius: 12, background: "#fff", color: "var(--primary)", fontWeight: 800, fontSize: 16, textDecoration: "none", transition: "transform 0.2s var(--ease)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                      <Mail size={18} /> Оставить заявку
                    </a>
                  </div>
                  {pilotOffer && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13.5, opacity: 0.95 }}>
                      <ShieldCheck size={16} style={{ flexShrink: 0 }} /> {PILOT_GUARANTEE}
                    </div>
                  )}
                  <div style={{ marginTop: 18, fontSize: 14, opacity: 0.85 }}>{contactEmail}</div>
                </div>
              </div>
            )}
          </Reveal>

          {/* Полноценный анализ за 2 990 ₽ — только для холодного /kp: на пилоте
              конкурирует с пилотным оффером и обесценивает уже показанный анализ */}
          {!pilotOffer && (
          <Reveal delay={100}>
            {() => (
              <div className="ds-card" style={{ marginTop: 24, padding: "24px 28px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Хотите полноценный анализ?</div>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: "0 0 16px", lineHeight: 1.5 }}>
                  Детальный разбор сайта, ниши и конкурентов от MarketRadar — <b style={{ color: "var(--foreground)" }}>2 990 ₽</b>.
                </p>
                <a
                  href={analysisRequestHref("full")}
                  onClick={() => trackKpEvent("click", "order-full-analysis")}
                  className="ds-btn ds-btn-primary"
                  style={{ display: "inline-flex", height: 44, padding: "0 22px", alignItems: "center", gap: 8, textDecoration: "none" }}
                >
                  Заказать за 2 990 ₽ <ArrowRight size={15} />
                </a>
              </div>
            )}
          </Reveal>
          )}

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

// Бейдж уровня достоверности (ФАКТ / ОЦЕНКА / ПРОГНОЗ) — честная маркировка
// пилотных блоков: где проверенный факт, где экспертная оценка, где расчётный
// прогноз. Повышает доверие, а не маскирует неопределённость.
const EVIDENCE_STYLE: Record<Evidence, { label: string; color: string }> = {
  fact: { label: "ФАКТ", color: "var(--success)" },
  estimate: { label: "ОЦЕНКА", color: "var(--warning)" },
  forecast: { label: "ПРОГНОЗ", color: "var(--primary)" },
};
function EvidenceBadge({ level }: { level: Evidence }) {
  const s = EVIDENCE_STYLE[level];
  return (
    <span style={{
      display: "inline-block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em",
      color: s.color, border: `1px solid ${s.color}`, borderRadius: 999, padding: "1px 8px",
      background: `color-mix(in srgb, ${s.color} 10%, transparent)`, whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

// ─── График прогноза: stacked bars «заявки/мес по каналам» ──────────────────
// Палитра — категориальные слоты 1-4 референс-палитры dataviz-скилла,
// валидирована scripts/validate_palette.js для light и dark (adjacent CVD
// ΔE 24.2 / 10.3). WARN по контрасту закрыт: легенда + прямые подписи итогов
// + таблица данных; между сегментами 2px зазор поверхности.
const CHART_COLORS_LIGHT = ["#2a78d6", "#1baf7a", "#eda100", "#008300"];
const CHART_COLORS_DARK = ["#3987e5", "#199e70", "#c98500", "#008300"];

function PilotForecastChart({ isDark }: { isDark: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const colors = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
  const { months, series } = PILOT_CHART;
  const totals = months.map((_, m) => series.reduce((s, sr) => s + sr.values[m], 0));
  const maxV = Math.ceil(Math.max(...totals) / 5) * 5 + 2; // до 28

  const W = 680, H = 280, padL = 34, padB = 30, padT = 18, padR = 8;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const barW = Math.min(56, (plotW / months.length) * 0.55);
  const xOf = (m: number) => padL + (plotW / months.length) * (m + 0.5) - barW / 2;
  const yOf = (v: number) => padT + plotH - (v / maxV) * plotH;

  return (
    <div className="ds-card" style={{ padding: "18px 20px", marginTop: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Дополнительные заявки в месяц — по каналам</div>
        <EvidenceBadge level="forecast" />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginBottom: 12 }}>Середины вилок по каждому сценарию · наведите на месяц для разбивки</div>

      {/* Легенда — идентичность серий не только цветом (порядок + подписи) */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        {series.map((s, i) => (
          <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--foreground)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[i], display: "inline-block" }} /> {s.name}
          </span>
        ))}
      </div>

      <div style={{ position: "relative", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: 480 }} role="img" aria-label="Прогноз дополнительных заявок в месяц по четырём каналам, месяцы 1–6">
          {/* Сетка — рецессивные hairline-линии + подписи оси Y текстовыми токенами */}
          {[0, 10, 20].map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10.5} fill="var(--muted-foreground)">{v}</text>
            </g>
          ))}
          {months.map((mLabel, m) => {
            let acc = 0;
            const x = xOf(m);
            const dimmed = hover != null && hover !== m;
            return (
              <g key={m} opacity={dimmed ? 0.45 : 1} style={{ transition: "opacity 0.15s" }}
                 onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)}>
                {/* Невидимая зона наведения на всю колонку месяца */}
                <rect x={padL + (plotW / months.length) * m} y={padT} width={plotW / months.length} height={plotH + padB} fill="transparent" />
                {series.map((s, i) => {
                  const v = s.values[m];
                  if (v <= 0) { return null; }
                  const y1 = yOf(acc + v), y0 = yOf(acc);
                  acc += v;
                  const isTop = acc === totals[m];
                  const h = Math.max(1, y0 - y1 - 2); // 2px зазор поверхности между сегментами
                  return isTop ? (
                    <path key={s.name} d={`M ${x} ${y1 + 4} Q ${x} ${y1} ${x + 4} ${y1} H ${x + barW - 4} Q ${x + barW} ${y1} ${x + barW} ${y1 + 4} V ${y1 + h} H ${x} Z`} fill={colors[i]} />
                  ) : (
                    <rect key={s.name} x={x} y={y1} width={barW} height={h} fill={colors[i]} />
                  );
                })}
                {/* Прямая подпись итога над колонкой (relief для WARN-контраста) */}
                <text x={x + barW / 2} y={yOf(totals[m]) - 6} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--foreground)">{totals[m] % 1 === 0 ? totals[m] : totals[m].toFixed(1)}</text>
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{mLabel}</text>
              </g>
            );
          })}
        </svg>
        {/* Тултип разбивки по наведённому месяцу */}
        {hover != null && (
          <div style={{ position: "absolute", top: 6, right: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", pointerEvents: "none", minWidth: 170 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{months[hover]} · всего ≈ {totals[hover] % 1 === 0 ? totals[hover] : totals[hover].toFixed(1)}</div>
            {series.map((s, i) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 2 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i], flexShrink: 0 }} />
                <span style={{ color: "var(--muted-foreground)", flex: 1 }}>{s.name}</span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{s.values[hover]}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Таблица данных — доступность + relief */}
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12.5, color: "var(--muted-foreground)", cursor: "pointer" }}>Таблица данных графика</summary>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontWeight: 600 }}>Канал</th>
                {months.map((mL) => <th key={mL} style={{ textAlign: "right", padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontWeight: 600 }}>{mL}</th>)}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.name}>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)" }}>{s.name}</td>
                  {s.values.map((v, m) => <td key={m} style={{ textAlign: "right", padding: "6px 10px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" }}>{v}</td>)}
                </tr>
              ))}
              <tr>
                <td style={{ padding: "6px 10px", fontWeight: 700 }}>Итого</td>
                {totals.map((t, m) => <td key={m} style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{t % 1 === 0 ? t : t.toFixed(1)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

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

function RingTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Reveal>
      {(v) => (
        <div className="ds-card ds-card-interactive" style={{ padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Ring value={value} size={84} stroke={8} active={v} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", textAlign: "center" }}>{label}</div>
          {hint && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.4, marginTop: 2 }}>{hint}</div>}
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
        {f.fix && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "color-mix(in srgb, var(--success) 10%, transparent)" }}>
            <Wrench size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 13, lineHeight: 1.4 }}>
              <b style={{ color: "var(--success)" }}>Как исправим:</b> <span style={{ color: "var(--foreground)" }}>{f.fix}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TechTile({ label, value, suffix, text, pct, hint }: { label: string; value?: number; suffix?: string; text?: string; pct?: number; hint?: string }) {
  const shownPct = pct != null ? pct : typeof value === "number" ? value : undefined;
  const col = shownPct != null ? scoreColor(shownPct) : "var(--foreground)";
  return (
    <Reveal>
      {(v) => (
        <div className="ds-card ds-card-interactive" style={{ padding: "16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>{label}</div>
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
          {hint && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", lineHeight: 1.4, marginTop: 10 }}>{hint}</div>}
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
        <div style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 24 }}>Запустите анализ компании на платформе — и интерактивный анализ соберётся автоматически.</div>
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

    /* Hero: мягкое каскадное появление (потенциал → чипы → дедлайн).
       ВАЖНО: скрытие только через fill-mode:both (from-состояние во время
       delay), БЕЗ постоянного opacity:0 в классе — если анимация не
       запустилась (print/старый браузер/фоновая вкладка), контент остаётся
       видимым, а не исчезает навсегда. */
    .kp-hero-pop {
      animation: kp-hero-pop 0.55s var(--ease, cubic-bezier(0.16,1,0.3,1)) both;
    }
    @keyframes kp-hero-pop {
      from { opacity: 0; transform: translateY(10px) scale(0.985); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes kp-pulse {
      0% { box-shadow: 0 0 0 0 currentColor; opacity: 0.7; }
      100% { box-shadow: 0 0 0 10px transparent; opacity: 0; }
    }

    /* Тех-аудит: ровная сетка — 3 колонки (кольца сверху, метрики снизу),
       без «сиротской» карточки в отдельном ряду. */
    .kp-tech-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
    @media (max-width: 980px) { .kp-tech-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .kp-tech-grid { grid-template-columns: 1fr; } }

    @media (max-width: 760px) {
      .kp-hero-grid { grid-template-columns: 1fr !important; }
      .kp-radar-wrap { grid-template-columns: 1fr !important; }
      .kp-cat-grid { grid-template-columns: 1fr !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .kp-blob, .kp-cta-panel, .kp-pulse-dot { animation: none !important; }
      .kp-hero-pop { animation: none !important; }
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
// Максимально полный список «дыр» по трём каналам (сайт / соцсети / ИИ) —
// СТРОГО из реальных данных анализа (AnalysisResult), без выдумок: каждая
// находка добавляется, только если данные реально указывают на проблему.
// Поле fix описывает, как MarketRadar это закрывает (это про наши услуги/
// методологию, а не про выдуманные факты о сайте — так можно).
function buildFindings(my: AnalysisResult | null, competitors: AnalysisResult[]): Finding[] {
  if (!my) return [];
  const out: Finding[] = [];
  const seo = my.seo;
  const lh = seo.lighthouseScores;
  const soc = my.social;
  const ap = my.aiPerception;

  // ─────────────── САЙТ ───────────────
  (seo.issues ?? []).slice(0, 8).forEach((iss) =>
    out.push({ severity: "warning", channel: "site", category: "SEO", title: iss,
      detail: "Обнаружено при техническом анализе страниц — влияет на позиции в поиске.",
      fix: "Закроем в рамках технического аудита и правок на старте." }));

  if (!seo.title || seo.title.trim().length < 5)
    out.push({ severity: "critical", channel: "site", category: "SEO", title: "Слабый или отсутствующий заголовок страницы (title)",
      detail: "Title — первое, что видит поисковик и человек в выдаче. Без него страница проигрывает конкурентам.",
      fix: "Пропишем SEO-заголовки с ключевым запросом для каждой важной страницы." });
  if (!seo.metaDescription || seo.metaDescription.trim().length < 10)
    out.push({ severity: "warning", channel: "site", category: "SEO", title: "Нет или пустой meta description",
      detail: "И поиск, и нейросети хуже понимают, о чём страница, а в выдаче нет цепляющего описания.",
      fix: "Составим продающие описания под ключевые запросы." });
  if ((seo.keywords ?? []).length === 0)
    out.push({ severity: "warning", channel: "site", category: "Семантика", title: "Не собрана семантика — непонятно, по каким запросам вас искать",
      detail: "Без семантического ядра невозможно системно расти в поиске.",
      fix: "Соберём ядро запросов ниши и разложим его по страницам сайта." });
  if (seo.pageCount != null && seo.pageCount > 0 && seo.pageCount < 10)
    out.push({ severity: "warning", channel: "site", category: "Контент", title: `Мало страниц в индексе (${seo.pageCount})`,
      detail: "Сайту буквально не за что ранжироваться по большинству запросов ниши.",
      fix: "Запустим регулярный выпуск SEO-статей, расширяющих охват." });
  if (lh) {
    if (lh.performance != null && lh.performance < 60)
      out.push({ severity: lh.performance < 40 ? "critical" : "warning", channel: "site", category: "Скорость", title: `Низкая скорость загрузки (Performance ${lh.performance}/100)`,
        detail: "Часть посетителей уходит, не дождавшись загрузки — это прямая потеря заявок.",
        fix: "Оптимизируем изображения, скрипты и Core Web Vitals." });
    if (lh.seo != null && lh.seo < 80)
      out.push({ severity: "warning", channel: "site", category: "Тех-SEO", title: `Технический SEO-балл ${lh.seo}/100`,
        detail: "Есть ошибки разметки/структуры, которые мешают ранжированию.",
        fix: "Закроем технические SEO-ошибки на старте." });
    if (lh.accessibility != null && lh.accessibility < 70)
      out.push({ severity: "warning", channel: "site", category: "Доступность", title: `Доступность ${lh.accessibility}/100`,
        detail: "Часть пользователей и поисковых роботов испытывают трудности с сайтом.",
        fix: "Поправим контрастность, разметку и навигацию." });
  }

  // ─────────────── СОЦСЕТИ ───────────────
  if (!soc.vk)
    out.push({ severity: "warning", channel: "social", category: "ВКонтакте", title: "ВКонтакте не найден или не ведётся",
      detail: "Упускаете аудиторию главной соцсети РФ и целый канал бесплатного трафика.",
      fix: "Заведём и упакуем профиль, запустим контент-план с рилсами и постами." });
  // posts30d === 0 НЕ показываем как находку: ноль чаще означает «парсер не
  // смог посчитать посты», чем реальное молчание канала (живой TG Sozdavay
  // с 963 подписчиками получал «0 за 30 дней» — клиент справедливо спросил,
  // откуда это). Утверждаем «редкие публикации» только при 1–7 реальных.
  else if (soc.vk.posts30d != null && soc.vk.posts30d > 0 && soc.vk.posts30d < 8)
    out.push({ severity: "warning", channel: "social", category: "ВКонтакте", title: `Мало публикаций во ВКонтакте (${soc.vk.posts30d} за 30 дней)`,
      detail: "При редком постинге алгоритмы и подписчики быстро забывают о бренде.",
      fix: "Контент-план на неделю вперёд + монтаж: стабильный поток контента." });
  if (!soc.telegram)
    out.push({ severity: "warning", channel: "social", category: "Telegram", title: "Нет Telegram-канала",
      detail: "Упускаете лояльную аудиторию и прямой канал контакта с клиентами.",
      fix: "Запустим канал и наполним его по контент-плану." });
  else if (soc.telegram.posts30d != null && soc.telegram.posts30d > 0 && soc.telegram.posts30d < 8)
    out.push({ severity: "warning", channel: "social", category: "Telegram", title: `Редкие публикации в Telegram (${soc.telegram.posts30d} за 30 дней)`,
      detail: "Канал есть, но не работает как источник касаний с аудиторией.",
      fix: "Добавим Telegram в общий контент-план." });
  if (soc.yandexRating != null && soc.yandexReviews != null && soc.yandexReviews > 0 && soc.yandexReviews < 15)
    out.push({ severity: "warning", channel: "social", category: "Репутация", title: `Мало отзывов на Яндекс.Картах (${soc.yandexReviews})`,
      detail: "Новые клиенты меньше доверяют компании с малым числом отзывов.",
      fix: "Настроим системный сбор отзывов и работу с репутацией." });
  if (soc.gisRating != null && soc.gisReviews != null && soc.gisReviews > 0 && soc.gisReviews < 15)
    out.push({ severity: "warning", channel: "social", category: "Репутация", title: `Мало отзывов в 2ГИС (${soc.gisReviews})`,
      detail: "Отзывы в 2ГИС — важный сигнал доверия для локальных клиентов.",
      fix: "Подключим сбор отзывов в 2ГИС в стратегию репутации." });

  // ─────────────── НЕЙРОСЕТИ (ИИ) ───────────────
  if (ap) {
    if (ap.knowledgePresence === "weak" || ap.knowledgePresence === "minimal")
      out.push({ severity: ap.knowledgePresence === "minimal" ? "critical" : "warning", channel: "ai", category: "Известность в ИИ", title: "Нейросети почти ничего не знают о вашем бренде",
        detail: "При запросах в вашей нише ChatGPT, YandexGPT и Алиса вас не называют — а туда уходит всё больше решений о покупке.",
        fix: "GEO-стратегия: экспертные статьи + структурирование данных, чтобы AI знал и рекомендовал вас." });
    const e = ap.eeat;
    if (e) {
      if (e.expertise != null && e.expertise < 50)
        out.push({ severity: "warning", channel: "ai", category: "E-E-A-T", title: `Слабый сигнал экспертности (${e.expertise}/100)`,
          detail: "И поиск, и нейросети хуже доверяют источнику без выраженной экспертности.",
          fix: "Экспертный контент с авторством и фактами — поднимаем экспертность бренда." });
      if (e.trust != null && e.trust < 50)
        out.push({ severity: "warning", channel: "ai", category: "E-E-A-T", title: `Слабый сигнал доверия (${e.trust}/100)`,
          detail: "Низкий trust снижает и позиции в поиске, и вероятность попасть в ответ нейросети.",
          fix: "Отзывы, кейсы, прозрачные контакты и реквизиты — усиливаем доверие." });
    }
  }
  const aiMentions = my.keysoDashboard?.yandex?.aiMentions ?? my.keysoDashboard?.google?.aiMentions;
  if (aiMentions != null && aiMentions === 0)
    out.push({ severity: "warning", channel: "ai", category: "Яндекс Нейро", title: "Ноль упоминаний в ответах Яндекс Нейро / Алисы",
      detail: "Ваш бренд не попадает в генеративные ответы Яндекса по запросам ниши.",
      fix: "GEO-оптимизация контента под цитирование Яндекс Нейро." });

  // ─────────────── ПРОЧЕЕ: категории и конкуренты ───────────────
  (my.company.categories ?? []).forEach((cat) => {
    if (cat.score >= 65) return; // хорошие категории не показываем как «дыры»
    // HR-бренд/найм — не клиентский канал: фраза «тормозит привлечение
    // клиентов» к нему не относится и звучит абсурдно (фидбек клиента).
    if (/hr|найм|вакан|кадр/i.test(cat.name)) return;
    const severity: Severity = cat.score < 45 ? "critical" : "warning";
    out.push({ severity, channel: "other", category: cat.name, title: `${cat.name}: ${cat.score}/100`,
      detail: categoryVerdict(cat.score),
      fix: "Проработаем эту зону в рамках комплексной стратегии." });
  });
  const ahead = competitors.filter((c) => c.company.score > my.company.score);
  if (ahead.length > 0) {
    const top = ahead.sort((a, b) => b.company.score - a.company.score)[0];
    out.push({ severity: "critical", channel: "other", category: "Конкуренты", title: `${ahead.length} конкурент(ов) опережают вас по общему баллу`,
      detail: `Лидер — ${top.company.name} (${top.company.score} против ваших ${my.company.score}).`,
      fix: "Разберём, за счёт чего они сильнее, и составим план обгона." });
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, ok: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

interface Phase { title: string; items: string[] }
function buildPlan(recs: Recommendation[]): Phase[] {
  if (recs.length === 0) return [];
  const quick = recs.filter((r) => bucketOf(r) === "quick-win").slice(0, 5).map((r) => r.text);
  const foundation = recs.filter((r) => r.priority === "high" && bucketOf(r) !== "quick-win").slice(0, 5).map((r) => r.text);
  const growth = recs.filter((r) => bucketOf(r) === "big-bet" || r.priority === "medium").slice(0, 5).map((r) => r.text);
  // План всегда из 4 шагов, независимо от того, сколько рекомендаций попало
  // в каждый бакет. Раньше пустой бакет «Фундамент» просто выбрасывался из
  // массива — план схлопывался до 2 шагов, а нумерованный кружок (i+1 при
  // рендере) расходился с текстом заголовка («2» рядом с «Этап 3»). Теперь
  // для пустого бакета показываем стандартное описание этого этапа работы
  // (это про процесс/методологию MarketRadar, а не выдуманные факты о сайте).
  const phases: Phase[] = [
    {
      // Честный срок: H1/alt/мета-правки — это часы-дни, а не недели.
      // Завышенный срок на очевидно мелкие задачи подрывает доверие (фидбек
      // клиента: «почему недели на работы, которые можно сделать за день»).
      title: "Быстрые победы (1–3 дня)",
      items: quick.length ? quick : [
        "Технический аудит сайта и приоритизация правок",
        "Устранение критичных ошибок, найденных при анализе",
      ],
    },
    {
      title: "Фундамент (1–2 месяца)",
      items: foundation.length ? foundation : [
        "Проработка семантики и структуры под ключевые запросы ниши",
        "Настройка аналитики и регулярной отчётности",
      ],
    },
    {
      title: "Рост и масштабирование",
      items: growth.length ? growth : [
        "Расширение охвата: новые кластеры запросов, каналы и форматы контента",
        "Усиление позиций относительно конкурентов из ниши",
      ],
    },
    {
      title: "Мониторинг и поддержка",
      items: [
        "Ежемесячный отчёт о динамике позиций и метрик",
        "Корректировка стратегии по свежим данным",
        "Приоритет — задачи с максимальным эффектом",
      ],
    },
  ];
  return phases;
}
