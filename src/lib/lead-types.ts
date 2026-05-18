/**
 * Типы и константы для лидген-модуля.
 * — leads: база сайтов для холодного аутрича
 * — lead_reports: AI-сгенерированные экспресс-отчёты по каждому сайту
 * — lead_notes: заметки CRM-менеджера
 * — lead_status_history: воронка для аналитики
 */

export const LEAD_STATUSES = [
  "new",
  "in_progress",
  "contacted",
  "replied",
  "meeting",
  "customer",
  "rejected",
  "followup",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новый",
  in_progress: "В работе",
  contacted: "Отправлено",
  replied: "Ответил",
  meeting: "Встреча",
  customer: "Купил",
  rejected: "Отказался",
  followup: "Повтор",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#94a3b8",          // нейтральный
  in_progress: "#3b82f6",  // синий
  contacted: "#a855f7",    // фиолетовый
  replied: "#06b6d4",      // циан
  meeting: "#f59e0b",      // оранжевый
  customer: "#22c55e",     // зелёный — деньги
  rejected: "#ef4444",     // красный
  followup: "#eab308",     // жёлтый — напомнить позже
};

export interface Lead {
  id: string;
  domain: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_telegram: string | null;
  city: string | null;
  niche: string | null;
  slug: string;
  status: LeadStatus;
  assigned_to: string | null;
  source: string | null;
  tags: string[] | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Структура AI-отчёта, хранится в `lead_reports.data` как JSONB. */
export interface LeadReport {
  /** Название бренда — берём СТРОГО из <title>/<h1> сайта, без транслитерации.
   *  Если на сайте написано "RuDenta" — здесь "RuDenta", не "Руденталь". */
  brandName: string;
  /** Сырой <title> страницы — на случай если brandName странный */
  siteTitle: string;

  /** Общий Score 0–100 (overall) */
  overallScore: number;
  /** Среднее по нише (из ниши/публичных данных) — для контраста */
  nicheAverage: number;
  /** 6 баллов по категориям 0-100. aiVisibility — отдельная важная категория. */
  scores: {
    seo: number;
    social: number;
    content: number;
    hrBrand: number;
    technical: number;
    aiVisibility: number;
  };
  /** Топ-3 критичных проблемы (видны бесплатно) */
  topProblems: Array<{
    title: string;
    description: string;
    severity: "high" | "medium";
  }>;
  /** Топ-3 упущенные возможности (видны бесплатно) */
  opportunities: Array<{
    title: string;
    description: string;
    potential: string; // "+30% трафика за 2 мес"
    moneyEstimate?: string; // "от 150 тыс ₽/мес" — если AI смог посчитать
  }>;
  /** 5 рекомендаций — первые 3 видны, последние 2 blurred с CTA */
  recommendations: Array<{
    title: string;
    description: string;
    effort: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
  }>;
  /** Конкуренты — первые 2 видны, остальные blurred */
  competitors: Array<{
    name: string;
    domain: string;
    advantage: string; // что у них лучше
  }>;
  /** Видимость в AI-ассистентах — отдельный блок про GEO/llms.txt/schema.
   *  Это «крючок» — обычно у компаний score 0-30, что шокирует. */
  aiVisibility: {
    score: number;            // 0-100, обычно 0-40 у среднего сайта без работы
    status: "invisible" | "weak" | "moderate" | "strong";
    /** Что мешает находиться в нейросетях (3-4 пункта, видимы) */
    blockers: Array<{
      title: string;          // "Нет llms.txt"
      description: string;    // "Файл-инструкция для AI-краулеров не настроен..."
    }>;
    /** Примеры запросов из ниши + упоминается ли клиент. Первые 2 видны, остальные blurred. */
    sampleQueries: Array<{
      query: string;          // "лучшая стоматология в москве с гарантией"
      youArePresent: boolean; // упоминается ли клиент в выдаче AI
      note?: string;          // короткая ремарка («упоминают сайты-агрегаторы вместо вашего»)
    }>;
  };
  /** Резюме одной строкой для email-превью */
  oneLineSummary: string;
  /** Когда отчёт устареет (~30 дней с даты генерации) */
  generatedAt: string;
}

/** Превращает «https://www.example.ru/path?q=1» → «example.ru». Идемпотентно. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0];
}

/** Превращает домен в URL-safe slug: «me-dent.ru» → «me-dent-ru». */
export function domainToSlug(domain: string): string {
  return normalizeDomain(domain).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
