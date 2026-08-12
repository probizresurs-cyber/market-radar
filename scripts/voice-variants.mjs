/**
 * Варианты подачи ОДНОГО текста ОДНИМ голосом — для выбора на слух.
 *
 * Отличие от voice-probe.mjs: там сравниваются голоса при одинаковых
 * настройках, здесь — настройки при одном голосе. Это разные вопросы:
 * «какой тембр» уже решён (Igor), теперь ищем «какая подача».
 *
 * Паузы зашиты в САМ ТЕКСТ пунктуацией (многоточия, тире, короткие
 * предложения): на eleven_v3 XML-теги <break> не поддерживаются и рискуют
 * прочитаться вслух, а пунктуацию модель отыгрывает надёжно.
 *
 * «Студийность» — это в основном use_speaker_boost (компрессия и «присутствие»
 * как в рекламе) плюс высокий style. Варианты ниже крутят обе ручки.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/voice-variants.mjs
 */
import { writeFileSync, mkdirSync } from "fs";

const VOICE_ID = "hRJPpkSVdR2btkZBUz26"; // RU igor
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

// Один текст на все варианты, ~15 секунд. Паузы — пунктуацией.
// Цифр нет намеренно: банк фактов ещё не заполнен, выдумывать нельзя.
const TEXT = `Металлоконструкции под ключ… проектирование, производство, монтаж — без посредников.
Показываем объекты как есть. От каркаса… до сдачи.
ГК Орлинк. Строим — для жизни и бизнеса.`;

/**
 * Сетка вариантов. Ключевые оси:
 *  - boost: false = убрать рекламную компрессию (главный источник «студийности»)
 *  - style ниже = меньше актёрства, ближе к обычной речи
 *  - stability средняя = живые модуляции без театральности
 *  - speed 1.1-1.15 = «чуть быстрее», как просили
 */
const VARIANTS = [
  { tag: "1-razgovorny",  stability: 0.40, style: 0.30, speed: 1.10, boost: false,
    note: "разговорный: без буста, минимум актёрства" },
  { tag: "2-zhivoy",      stability: 0.32, style: 0.45, speed: 1.12, boost: false,
    note: "живой: больше модуляций, всё ещё без студийного лоска" },
  { tag: "3-spokoyny",    stability: 0.50, style: 0.25, speed: 1.08, boost: false,
    note: "спокойный естественный: ровнее, солиднее" },
  { tag: "4-prezhny-bystree", stability: 0.35, style: 0.55, speed: 1.12, boost: true,
    note: "как референс, но быстрее и с паузами (для сравнения)" },
  { tag: "5-suhoy",       stability: 0.45, style: 0.15, speed: 1.12, boost: false,
    note: "максимально без прикрас: почти нулевой style" },
];

const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("Нет ELEVENLABS_API_KEY"); process.exit(1); }

mkdirSync("public/voiceovers", { recursive: true });
console.log(`Голос: RU igor | модель: ${MODEL} | текст: ${TEXT.replace(/\n/g, " ").slice(0, 60)}…\n`);

for (const v of VARIANTS) {
  const r = await fetch(`${base}/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: TEXT,
      model_id: MODEL,
      voice_settings: {
        stability: v.stability,
        similarity_boost: 0.85,
        style: v.style,
        use_speaker_boost: v.boost,
        speed: v.speed,
      },
    }),
  });
  if (!r.ok) {
    console.log(`${v.tag}: ОТКАЗ HTTP ${r.status} — ${(await r.text()).slice(0, 160)}`);
    continue;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const name = `igor-nat-${v.tag}.mp3`;
  writeFileSync(`public/voiceovers/${name}`, buf);
  console.log(`${v.tag} (${v.note})`);
  console.log(`   https://marketradar24.ru/api/static-asset/voiceovers/${name}  [${(buf.length / 1024).toFixed(0)} КБ]`);
}
