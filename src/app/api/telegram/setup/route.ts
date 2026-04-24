import { NextRequest, NextResponse } from "next/server";

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
  const host = req.headers.get("host") ?? "";
  const webhookUrl = `https://${host}/api/telegram/webhook`;

  // Set webhook
  const webhook = await tgCall("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
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
