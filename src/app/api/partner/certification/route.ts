/**
 * POST /api/partner/certification
 *
 * Accepts exam submission, scores it, stores result in DB (partner_certifications),
 * and on pass upgrades integrator commission_rate to 50%.
 *
 * DB: partner_certifications(id, partner_id, score, theory_correct, practical, passed, certified_at)
 *     lazily created on first call.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

// ─── Exam definitions (server-side, canonical correct answers) ─────────────────

export const THEORY_QUESTIONS = [
  {
    id: 1,
    question: "Что анализирует платформа MarketRadar?",
    options: [
      "Только SEO-данные сайта",
      "Сайт, SEO, соцсети, вакансии, отзывы и карты",
      "Только социальные сети",
      "Только финансовые показатели компании",
    ],
    correct: 1, // 0-indexed
  },
  {
    id: 2,
    question: "Из каких источников MarketRadar получает реальные данные (не AI)?",
    options: [
      "Только из AI-генерации",
      "Исключительно из Google-сервисов",
      "HH.ru, DaData, PageSpeed, Yandex Maps, 2GIS, Keys.so",
      "Только из открытых государственных реестров",
    ],
    correct: 2,
  },
  {
    id: 3,
    question: "Что такое «золотой сегмент» в анализе целевой аудитории?",
    options: [
      "Самый платёжеспособный сегмент",
      "Самый многочисленный сегмент",
      "Сегмент с наибольшей готовностью купить прямо сейчас",
      "Самый молодой возрастной сегмент",
    ],
    correct: 2,
  },
  {
    id: 4,
    question: "Для чего служат Battle Cards?",
    options: [
      "Карточки с прайс-листом услуг",
      "Карточки конкурентного боя — готовые скрипты и аргументы для отдела продаж",
      "Визитки с данными о партнёре",
      "Карточки с отзывами клиентов",
    ],
    correct: 1,
  },
  {
    id: 5,
    question: "Реферальная комиссия в стандартной программе составляет:",
    options: ["10%", "15%", "20%", "25%"],
    correct: 2,
  },
  {
    id: 6,
    question: "Максимальная комиссия сертифицированного интегратора составляет:",
    options: ["30%", "40%", "50%", "60%"],
    correct: 2,
  },
  {
    id: 7,
    question: "Что входит в модуль «Контент-завод» MarketRadar?",
    options: [
      "Только текстовые посты",
      "Посты, рилс, сторис, карусели и видео через HeyGen-аватар",
      "Только SEO-статьи",
      "Только видеоконтент",
    ],
    correct: 1,
  },
  {
    id: 8,
    question: "Какой архетип по Юнгу стремится к истине и пониманию?",
    options: ["Герой (hero)", "Маг (magician)", "Мудрец (sage)", "Правитель (ruler)"],
    correct: 2,
  },
  {
    id: 9,
    question: "Что означает DataBadge с символом «✓» в интерфейсе платформы?",
    options: [
      "Данные сгенерированы AI",
      "Данные являются оценкой (диапазон)",
      "Реальные проверенные данные из внешних источников",
      "Данные устарели и требуют обновления",
    ],
    correct: 2,
  },
  {
    id: 10,
    question: "С какой периодичностью обновляются данные в режиме мониторинга?",
    options: ["Ежедневно", "Еженедельно", "Каждые 30 дней", "Каждые 90 дней"],
    correct: 2,
  },
];

export const PASS_THRESHOLD = 7; // out of 10

// ─── DB helpers ───────────────────────────────────────────────────────────────

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS partner_certifications (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id   UUID NOT NULL,
      score        INT NOT NULL,
      theory_correct INT NOT NULL,
      practical    TEXT NOT NULL,
      passed       BOOLEAN NOT NULL,
      certified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    await ensureTable();
    // Get partner
    const partners = await query<{ id: string; type: string; commission_rate: number; referral_code: string; company_name: string | null }>(
      `SELECT id, type, commission_rate, referral_code, company_name FROM partners WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [user.userId],
    );
    if (partners.length === 0) {
      return NextResponse.json({ ok: false, error: "Партнёр не найден или не активен" }, { status: 404 });
    }
    const partner = partners[0];

    // Check existing certification
    const certs = await query<{ score: number; theory_correct: number; passed: boolean; certified_at: string }>(
      `SELECT score, theory_correct, passed, certified_at FROM partner_certifications WHERE partner_id = $1 ORDER BY certified_at DESC LIMIT 1`,
      [partner.id],
    );
    return NextResponse.json({
      ok: true,
      partner: { id: partner.id, type: partner.type, commission_rate: partner.commission_rate, referral_code: partner.referral_code, company_name: partner.company_name },
      certification: certs[0] ?? null,
      questions: THEORY_QUESTIONS.map(q => ({ id: q.id, question: q.question, options: q.options })), // no correct answers
    });
  } catch (err) {
    console.error("[partner/certification GET]", err);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    await ensureTable();

    const body = await req.json();
    const answers: number[] = body.answers ?? []; // 0-indexed answers per question
    const practical: string = (body.practical ?? "").trim();

    if (answers.length !== THEORY_QUESTIONS.length) {
      return NextResponse.json({ ok: false, error: "Ответьте на все вопросы" }, { status: 400 });
    }
    if (practical.length < 100) {
      return NextResponse.json({ ok: false, error: "Практическое задание должно содержать не менее 100 символов" }, { status: 400 });
    }

    // Get partner
    const partners = await query<{ id: string; type: string; commission_rate: number }>(
      `SELECT id, type, commission_rate FROM partners WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [user.userId],
    );
    if (partners.length === 0) {
      return NextResponse.json({ ok: false, error: "Партнёр не найден" }, { status: 404 });
    }
    const partner = partners[0];

    // Check already passed
    const existing = await query<{ passed: boolean }>(
      `SELECT passed FROM partner_certifications WHERE partner_id = $1 AND passed = true LIMIT 1`,
      [partner.id],
    );
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: "Вы уже прошли сертификацию" }, { status: 409 });
    }

    // Score theory
    let correct = 0;
    for (let i = 0; i < THEORY_QUESTIONS.length; i++) {
      if (answers[i] === THEORY_QUESTIONS[i].correct) correct++;
    }
    const score = Math.round((correct / THEORY_QUESTIONS.length) * 100);
    const passed = correct >= PASS_THRESHOLD;

    // Store result
    await query(
      `INSERT INTO partner_certifications (partner_id, score, theory_correct, practical, passed)
       VALUES ($1, $2, $3, $4, $5)`,
      [partner.id, score, correct, practical, passed],
    );

    // On pass: upgrade integrator commission to 50%
    if (passed && partner.type === "integrator" && partner.commission_rate < 50) {
      await query(
        `UPDATE partners SET commission_rate = 50 WHERE id = $1`,
        [partner.id],
      );
    }
    // Certified referral gets small bump to 25%
    if (passed && partner.type === "referral" && partner.commission_rate < 25) {
      await query(
        `UPDATE partners SET commission_rate = 25 WHERE id = $1`,
        [partner.id],
      );
    }

    return NextResponse.json({ ok: true, score, correct, passed, total: THEORY_QUESTIONS.length });
  } catch (err) {
    console.error("[partner/certification POST]", err);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }
}
