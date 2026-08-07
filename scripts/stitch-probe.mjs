/**
 * Диагностический зонд Google Stitch.
 *
 * Зачем: генерация лендинга падала с «Tool Call Failed [get_screen]: Request
 * contains an invalid argument» — без единой подробности о том, ЧТО именно
 * не понравилось. Через UI это не разобрать: ответ SDK внутрь роута не течёт.
 *
 * Скрипт дёргает generate_screen_from_text напрямую через callTool и печатает
 * СЫРОЙ ответ: сколько пришло outputComponents, по какому индексу лежит design,
 * есть ли у экрана id/name и приехал ли htmlCode.downloadUrl сразу.
 *
 * Это важно, потому что SDK берёт экран по ЖЁСТКО ЗАШИТОМУ индексу
 * outputComponents[1] (project.js), а если downloadUrl не пришёл inline —
 * лезет в get_screen, где screenId обязателен. Пустой screenId → ровно та
 * ошибка, которую мы ловили.
 *
 * Запуск на сервере (ключ берётся из .env приложения):
 *   node scripts/stitch-probe.mjs "ascii-only prompt"
 */
import { StitchToolClient, Stitch } from "@google/stitch-sdk";

const apiKey = process.env.GOOGLE_STITCH_API_KEY || process.env.STITCH_API_KEY;
if (!apiKey) {
  console.error("Нет GOOGLE_STITCH_API_KEY / STITCH_API_KEY в окружении");
  process.exit(1);
}

const prompt =
  process.argv[2] ||
  `Create a professional landing page for "Orlink".
About: Металлоконструкции под ключ: проектирование, производство, монтаж.
Main company landing page with hero, services, benefits, testimonials, CTA sections.
Use these exact colors: #111111, #F5A623 — primary, secondary, accent.
Base requirements:
- Mobile-responsive layout
- All text content in Russian language`;

const nonAscii = (prompt.match(/[^\x00-\x7F]/g) ?? []).length;
console.log(`prompt: ${prompt.length} символов, не-ASCII: ${nonAscii}`);

const client = new StitchToolClient({ apiKey });
const stitch = new Stitch(client);

try {
  const project = await stitch.createProject("Stitch Probe");
  console.log("projectId:", project.id);

  // Ходим мимо project.generate(), чтобы увидеть ответ ДО того, как SDK
  // выберет из него экран по индексу [1] и потеряет всё остальное.
  const raw = await client.callTool("generate_screen_from_text", {
    projectId: project.id,
    prompt,
    deviceType: "DESKTOP",
    modelId: "GEMINI_3_PRO",
  });

  const comps = raw?.outputComponents ?? [];
  console.log("outputComponents:", comps.length);
  comps.forEach((c, i) => {
    const screens = c?.design?.screens;
    console.log(
      `  [${i}] ключи=${Object.keys(c ?? {}).join(",") || "—"} ` +
        `design.screens=${Array.isArray(screens) ? screens.length : "нет"}`,
    );
    (screens ?? []).forEach((s, j) => {
      console.log(
        `      screen[${j}] id=${s?.id ?? "НЕТ"} name=${s?.name ?? "НЕТ"} ` +
          `html=${s?.htmlCode?.downloadUrl ? "есть" : "НЕТ"} ` +
          `shot=${s?.screenshot?.downloadUrl ? "есть" : "НЕТ"}`,
      );
    });
  });

  if (comps.length && !comps[1]?.design?.screens?.[0]) {
    console.log(
      "\n⚠ SDK читает outputComponents[1].design.screens[0] — здесь его НЕТ.",
    );
  }
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  if (e?.details) console.error("details:", JSON.stringify(e.details, null, 2));
} finally {
  await client.close().catch(() => {});
}
