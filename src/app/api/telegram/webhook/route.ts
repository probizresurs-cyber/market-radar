import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG = `https://api.telegram.org/bot${TOKEN}`;

async function sendMessage(chatId: number, text: string) {
  await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const msg = update?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId: number = msg.chat?.id;
    const text: string = msg.text?.trim() ?? "";
    const firstName: string = msg.chat?.first_name ?? "друг";

    if (text === "/start") {
      await sendMessage(chatId,
        `👋 Привет, ${firstName}!\n\nДобро пожаловать в <b>Market Radar</b> — сервис конкурентного анализа.\n\n` +
        `Чтобы подключить уведомления, перейдите в настройки приложения → вкладка <b>Уведомления</b> и скопируйте код.\n\n` +
        `📋 Затем отправьте его сюда в формате <code>MR-XXXXXX</code>`
      );
    } else if (/^MR-[A-Z0-9]{6}$/i.test(text)) {
      await sendMessage(chatId,
        `✅ <b>Готово!</b>\n\n` +
        `Вы подписались на уведомления Market Radar.\n` +
        `Теперь нажмите кнопку <b>«Проверить подключение»</b> в приложении — и всё заработает.\n\n` +
        `Вы будете получать уведомления о новых анализах и изменениях конкурентов.`
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
