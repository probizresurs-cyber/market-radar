import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// All 67 pricing items from the pricing document
const PRICING_ITEMS = [
  // ─── GROUP A — Lead Magnets (Free) ──────────────────────────────────────────
  { name: "Базовый Score компании", description: "Базовая оценка компании по ключевым метрикам", price_group: "A", type: "free", price_amount: 0, limits: { per_account: 1 }, sort_order: 1 },
  { name: "Экспресс-анализ ЦА", description: "Базовый портрет целевой аудитории", price_group: "A", type: "free", price_amount: 0, limits: { per_account: 1 }, sort_order: 2 },
  { name: "Анализ 3 конкурентов", description: "Сравнительный анализ трёх конкурентов", price_group: "A", type: "free", price_amount: 0, limits: { per_account: 1 }, sort_order: 3 },
  { name: "Базовые бенчмарки", description: "Отраслевые ориентиры по ключевым показателям", price_group: "A", type: "free", price_amount: 0, limits: { per_account: "unlimited" }, sort_order: 4 },
  { name: "Мини-презентация бренда", description: "Компактная презентация бренда до 5 слайдов", price_group: "A", type: "free", price_amount: 0, limits: { per_account: 1 }, sort_order: 5 },
  { name: "Пробный контент: 1 статья + 5 постов", description: "Тестовый пакет контента для оценки качества", price_group: "A", type: "free", price_amount: 0, limits: { per_account: 1 }, sort_order: 6 },

  // ─── GROUP B — Micro-updates (one-time, small ticket) ────────────────────────
  { name: "Обновление Score компании", description: "Пересчёт оценки компании с актуальными данными", price_group: "B", type: "one_time", price_amount: 990_00, limits: null, sort_order: 10 },
  { name: "Обновление анализа ЦА", description: "Обновление портрета целевой аудитории", price_group: "B", type: "one_time", price_amount: 1900_00, limits: null, sort_order: 11 },
  { name: "Обновление анализа конкурентов", description: "Актуализация данных по конкурентам", price_group: "B", type: "one_time", price_amount: 1900_00, limits: null, sort_order: 12 },
  { name: "Обновление анализа отзывов", description: "Новый сбор и анализ отзывов", price_group: "B", type: "one_time", price_amount: 990_00, limits: null, sort_order: 13 },
  { name: "Обновление SMM-анализа", description: "Актуализация SMM-стратегии и анализа соцсетей", price_group: "B", type: "one_time", price_amount: 1900_00, limits: null, sort_order: 14 },
  { name: "Обновление отраслевых бенчмарков", description: "Свежие отраслевые показатели и ориентиры", price_group: "B", type: "one_time", price_amount: 1900_00, limits: null, sort_order: 15 },

  // ─── GROUP C — Deep One-Time Products ────────────────────────────────────────
  // Competitor analysis
  { name: "Анализ до 10 конкурентов", description: "Глубокий конкурентный анализ до 10 компаний", price_group: "C", type: "one_time", price_amount: 9900_00, limits: { competitors: 10 }, sort_order: 20 },
  { name: "Анализ до 30 конкурентов", description: "Расширенный конкурентный анализ до 30 компаний", price_group: "C", type: "one_time", price_amount: 24900_00, limits: { competitors: 30 }, sort_order: 21 },
  { name: "Анализ до 50 конкурентов", description: "Полный конкурентный анализ рынка до 50 компаний", price_group: "C", type: "one_time", price_amount: 39900_00, limits: { competitors: 50 }, sort_order: 22 },
  // Deep TA / CJM
  { name: "Глубокий CJM (1 сегмент)", description: "Детальная карта пути клиента для одного сегмента ЦА", price_group: "C", type: "one_time", price_amount: 2900_00, limits: { segments: 1 }, sort_order: 23 },
  { name: "Глубокий CJM (3 сегмента)", description: "Детальная карта пути клиента для трёх сегментов ЦА", price_group: "C", type: "one_time", price_amount: 6900_00, limits: { segments: 3 }, sort_order: 24 },
  { name: "Глубокий CJM (5 сегментов)", description: "Детальная карта пути клиента для пяти сегментов ЦА", price_group: "C", type: "one_time", price_amount: 9900_00, limits: { segments: 5 }, sort_order: 25 },
  // Review analysis
  { name: "Анализ отзывов (до 200)", description: "AI-анализ тональности и тем до 200 отзывов", price_group: "C", type: "one_time", price_amount: 2900_00, limits: { reviews: 200 }, sort_order: 26 },
  { name: "Анализ отзывов (до 1 000)", description: "AI-анализ тональности и тем до 1000 отзывов", price_group: "C", type: "one_time", price_amount: 7900_00, limits: { reviews: 1000 }, sort_order: 27 },
  { name: "Анализ отзывов (до 5 000)", description: "AI-анализ тональности и тем до 5000 отзывов", price_group: "C", type: "one_time", price_amount: 19900_00, limits: { reviews: 5000 }, sort_order: 28 },
  // SMM analysis
  { name: "Углублённый SMM (до 5 конкурентов)", description: "Детальный SMM-анализ до 5 конкурентов", price_group: "C", type: "one_time", price_amount: 4900_00, limits: { competitors: 5 }, sort_order: 29 },
  { name: "Углублённый SMM (до 10 конкурентов + стратегия)", description: "SMM-анализ и стратегия по 10 конкурентам", price_group: "C", type: "one_time", price_amount: 9900_00, limits: { competitors: 10 }, sort_order: 30 },
  { name: "Углублённый SMM (до 20 конкурентов + контент-план)", description: "Полный SMM-анализ рынка с контент-планом", price_group: "C", type: "one_time", price_amount: 14900_00, limits: { competitors: 20 }, sort_order: 31 },
  // Industry report
  { name: "Отраслевой отчёт (базовый)", description: "Отчёт по рынку: тенденции, доли, ключевые игроки", price_group: "C", type: "one_time", price_amount: 9900_00, limits: null, sort_order: 32 },
  { name: "Отраслевой отчёт (расширенный + прогноз + рекомендации)", description: "Детальный отчёт с прогнозом развития рынка и рекомендациями", price_group: "C", type: "one_time", price_amount: 24900_00, limits: null, sort_order: 33 },

  // ─── GROUP D — Content Production ────────────────────────────────────────────
  // SEO articles
  { name: "Статьи: 5 шт", description: "Пять SEO-оптимизированных статей", price_group: "D", type: "one_time", price_amount: 4900_00, limits: { articles: 5 }, sort_order: 40 },
  { name: "Статьи: 15 шт", description: "Пятнадцать SEO-оптимизированных статей", price_group: "D", type: "one_time", price_amount: 12900_00, limits: { articles: 15 }, sort_order: 41 },
  { name: "Статьи: 50 шт", description: "Пятьдесят SEO-оптимизированных статей", price_group: "D", type: "one_time", price_amount: 34900_00, limits: { articles: 50 }, sort_order: 42 },
  { name: "Статьи: 100 шт (Блог на год)", description: "Сто SEO-статей — полный контент на год", price_group: "D", type: "one_time", price_amount: 59900_00, limits: { articles: 100 }, sort_order: 43 },
  { name: "Подписка: 5 статей/мес", description: "Ежемесячный пакет из 5 SEO-статей", price_group: "D", type: "subscription", price_amount: 3900_00, limits: { articles_per_month: 5 }, sort_order: 44 },
  { name: "Подписка: 20 статей/мес", description: "Ежемесячный пакет из 20 SEO-статей", price_group: "D", type: "subscription", price_amount: 12900_00, limits: { articles_per_month: 20 }, sort_order: 45 },
  // Social media posts
  { name: "Посты: 20 шт", description: "Двадцать постов для социальных сетей", price_group: "D", type: "one_time", price_amount: 2900_00, limits: { posts: 20 }, sort_order: 46 },
  { name: "Посты: 60 шт", description: "Шестьдесят постов для социальных сетей", price_group: "D", type: "one_time", price_amount: 7900_00, limits: { posts: 60 }, sort_order: 47 },
  { name: "Посты: 200 шт", description: "Двести постов для социальных сетей", price_group: "D", type: "one_time", price_amount: 19900_00, limits: { posts: 200 }, sort_order: 48 },
  { name: "Подписка: 30 постов/мес", description: "Ежемесячный пакет из 30 постов", price_group: "D", type: "subscription", price_amount: 3900_00, limits: { posts_per_month: 30 }, sort_order: 49 },
  { name: "Подписка: 100 постов/мес", description: "Ежемесячный пакет из 100 постов", price_group: "D", type: "subscription", price_amount: 9900_00, limits: { posts_per_month: 100 }, sort_order: 50 },
  // Stories & Reels
  { name: "Сторис: 10 сценариев", description: "Десять готовых сценариев для Instagram Stories", price_group: "D", type: "one_time", price_amount: 1900_00, limits: { stories: 10 }, sort_order: 51 },
  { name: "Reels: 10 сценариев", description: "Десять готовых сценариев для Reels/TikTok", price_group: "D", type: "one_time", price_amount: 2900_00, limits: { reels: 10 }, sort_order: 52 },
  { name: "Месяц контента (30 сторис + 15 Reels)", description: "Полный пакет контента на месяц: сторис и рилсы", price_group: "D", type: "one_time", price_amount: 9900_00, limits: { stories: 30, reels: 15 }, sort_order: 53 },
  // Landing pages
  { name: "Лендинг: 1 базовый", description: "Одностраничный лендинг с базовым дизайном", price_group: "D", type: "one_time", price_amount: 4900_00, limits: { landings: 1 }, sort_order: 54 },
  { name: "Лендинг: 1 премиум (под нишу)", description: "Кастомный лендинг под специфику вашей ниши", price_group: "D", type: "one_time", price_amount: 12900_00, limits: { landings: 1 }, sort_order: 55 },
  { name: "Лендинги: пакет 5 шт", description: "Пять лендингов для разных продуктов или офферов", price_group: "D", type: "one_time", price_amount: 29900_00, limits: { landings: 5 }, sort_order: 56 },
  { name: "Лендинги: пакет 10 шт", description: "Десять лендингов — максимальный пакет", price_group: "D", type: "one_time", price_amount: 49900_00, limits: { landings: 10 }, sort_order: 57 },
  // Brand presentations
  { name: "Презентация базовая (до 10 слайдов)", description: "Профессиональная брендовая презентация до 10 слайдов", price_group: "D", type: "one_time", price_amount: 4900_00, limits: { slides: 10 }, sort_order: 58 },
  { name: "Презентация расширенная (до 25 слайдов)", description: "Расширенная презентация с детальной проработкой до 25 слайдов", price_group: "D", type: "one_time", price_amount: 12900_00, limits: { slides: 25 }, sort_order: 59 },
  { name: "Презентация Premium (до 50 слайдов + дизайн)", description: "Топ-уровень: до 50 слайдов с авторским дизайном", price_group: "D", type: "one_time", price_amount: 29900_00, limits: { slides: 50 }, sort_order: 60 },

  // ─── GROUP E — Monitoring Subscriptions ──────────────────────────────────────
  // Modular blocks
  { name: "Мониторинг конкурентов (до 10)", description: "Ежемесячный мониторинг до 10 конкурентов", price_group: "E", type: "subscription", price_amount: 9900_00, limits: { competitors: 10 }, sort_order: 70 },
  { name: "Мониторинг отзывов (все платформы)", description: "Отслеживание и анализ отзывов на всех площадках", price_group: "E", type: "subscription", price_amount: 9900_00, limits: null, sort_order: 71 },
  { name: "Мониторинг SMM (свои + 10 конкурентов)", description: "SMM-мониторинг своих каналов и 10 конкурентов", price_group: "E", type: "subscription", price_amount: 9900_00, limits: { competitors: 10 }, sort_order: 72 },
  { name: "Мониторинг Score компании", description: "Постоянный мониторинг и обновление Score компании", price_group: "E", type: "subscription", price_amount: 2900_00, limits: null, sort_order: 73 },
  // Complex plans
  { name: "MarketRadar Старт", description: "Стартовый план: базовый мониторинг и аналитика", price_group: "E", type: "subscription", price_amount: 9900_00, limits: { plan: "start" }, sort_order: 80 },
  { name: "MarketRadar Бизнес", description: "Бизнес-план: расширенный мониторинг и контент (экономия 7 800 ₽)", price_group: "E", type: "subscription", price_amount: 24900_00, limits: { plan: "business" }, sort_order: 81 },
  { name: "MarketRadar Про", description: "Про-план: полный комплекс мониторинга и производства контента (экономия 20 000 ₽)", price_group: "E", type: "subscription", price_amount: 49900_00, limits: { plan: "pro" }, sort_order: 82 },
  { name: "Enterprise", description: "Индивидуальный план для крупного бизнеса — от 99 900 ₽/мес", price_group: "E", type: "subscription", price_amount: 99900_00, limits: { plan: "enterprise" }, sort_order: 83 },

  // ─── GROUP E — Niche Packages ─────────────────────────────────────────────────
  { name: "Пакет: Клиники / Стоматологии", description: "Мониторинг 10 конкурентов, анализ отзывов, SMM, 30 постов/мес", price_group: "E", type: "subscription", price_amount: 49900_00, limits: { niche: "clinics" }, sort_order: 90 },
  { name: "Пакет: Салоны красоты", description: "Анализ отзывов, SMM, 60 постов/мес, 1 лендинг", price_group: "E", type: "subscription", price_amount: 29900_00, limits: { niche: "beauty" }, sort_order: 91 },
  { name: "Пакет: Рекрутинговые агентства", description: "HR-бренд анализ, SMM, 10 статей/мес, 2 лендинга", price_group: "E", type: "subscription", price_amount: 39900_00, limits: { niche: "recruiting" }, sort_order: 92 },
  { name: "Пакет: HoReCa", description: "Анализ отзывов, мониторинг 20 конкурентов, 100 постов/мес", price_group: "E", type: "subscription", price_amount: 59900_00, limits: { niche: "horeca" }, sort_order: 93 },
  { name: "Пакет: Логистика / Складской бизнес", description: "Анализ конкурентов, SEO 20 статей/мес, лендинги", price_group: "E", type: "subscription", price_amount: 69900_00, limits: { niche: "logistics" }, sort_order: 94 },
];

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await initDb();

  // Check if already seeded
  const existing = await query<{ cnt: string }>("SELECT COUNT(*) AS cnt FROM pricing_items");
  const currentCount = Number(existing[0]?.cnt || 0);

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (currentCount > 0 && !force) {
    return NextResponse.json({
      ok: false,
      error: `Таблица уже содержит ${currentCount} записей. Добавьте ?force=1 для перезаписи.`,
      current_count: currentCount,
    }, { status: 409 });
  }

  if (force) {
    await query("DELETE FROM pricing_items");
  }

  let inserted = 0;
  for (const item of PRICING_ITEMS) {
    await query(
      `INSERT INTO pricing_items (id, name, description, price_group, type, price_amount, currency, limits, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,'RUB',$7,true,$8)`,
      [
        randomUUID(),
        item.name,
        item.description,
        item.price_group,
        item.type,
        item.price_amount,
        item.limits ? JSON.stringify(item.limits) : null,
        item.sort_order,
      ]
    );
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted, message: `Загружено ${inserted} тарифных позиций` });
}

// GET — preview the seed data without inserting
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const existing = await query<{ cnt: string }>("SELECT COUNT(*) AS cnt FROM pricing_items");
  return NextResponse.json({
    ok: true,
    current_count: Number(existing[0]?.cnt || 0),
    seed_count: PRICING_ITEMS.length,
    items: PRICING_ITEMS,
  });
}
