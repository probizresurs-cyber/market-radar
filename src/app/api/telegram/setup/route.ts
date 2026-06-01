import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";
const TG = `${TG_BASE}/bot${TOKEN}`;

// Command menu shown in the Telegram UI "/" dropdown.
// Must match the commands handled in ../webhook/route.ts
const BOT_COMMANDS = [
  { command: "express", description: "🔍 Бесплатный экспресс-аудит сайта" },
  { command: "price", description: "💰 Тарифы и продукты" },
  { command: "partners", description: "🤝 Партнёрская программа (до 50%)" },
  { command: "about", description: "ℹ️ Что такое MarketRadar" },
  { command: "connect", description: "🔗 Подключить уведомления (код MR-XXXXXX)" },
  { command: "site", description: "🌐 Открыть сайт" },
  { command: "help", description: "❓ Все команды" },
];

async function tgCall(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  // Раньше открыт — атакующий мог через X-Forwarded-Host подменить
  // webhook URL и перехватывать все входящие сообщения нашему боту.
  // Теперь admin-only И URL берётся из env, а не из header.
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Доступ запрещён (admin only)" }, { status: 403 });
  }

  // URL из env, не из req.headers.host (защита от подмены X-Forwarded-Host)
  const publicHost = process.env.PUBLIC_HOST ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const webhookUrl = publicHost
    ? `${publicHost.replace(/\/$/, "")}/api/telegram/webhook`
    : `https://${req.headers.get("host") ?? ""}/api/telegram/webhook`;

  // secret_token будет проверяться webhook'ом для отбрасывания подделок
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secretToken) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET не настроен в .env (нужен для anti-spoof)" },
      { status: 500 },
    );
  }

  // Set webhook
  const webhook = await tgCall("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
    secret_token: secretToken,
  });

  // Register command menu (ru + default scope)
  const commandsRu = await tgCall("setMyCommands", {
    commands: BOT_COMMANDS,
    language_code: "ru",
  });
  const commandsDefault = await tgCall("setMyCommands", {
    commands: BOT_COMMANDS,
  });

  // Register short bot description (shown above chat when empty)
  const shortDescription = await tgCall("setMyShortDescription", {
    short_description:
      "ИИ-анализ конкурентов и бренд-стратегия. Экспресс-аудит сайта за 2 минуты.",
    language_code: "ru",
  });

  // Register full description (shown on bot profile)
  const description = await tgCall("setMyDescription", {
    description:
      "MarketRadar — SaaS для конкурентного анализа и бренд-стратегии на российском рынке.\n\n" +
      "• Экспресс-аудит сайта прямо в боте\n" +
      "• Полный анализ: SEO, соцсети, вакансии, отзывы, карты, ЦА, CJM, брендбук\n" +
      "• Контент-завод: посты, рилсы, сторис, лендинги\n" +
      "• Сравнение с конкурентами + Battle Cards\n\n" +
      "Начните с /express — бесплатно.",
    language_code: "ru",
  });

  return NextResponse.json({
    webhookUrl,
    webhook,
    commandsRu,
    commandsDefault,
    shortDescription,
    description,
  });
}
