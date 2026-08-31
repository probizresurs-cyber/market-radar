/**
 * Рендер ОРЛИНК-аватара под ГОТОВУЮ дорожку ElevenLabs v3.
 *
 * Зачем именно так: HeyGen генерирует движение губ ИЗ поданного звука. Если
 * наложить другой дубль поверх готового клипа, синхронизации не будет никогда
 * — у другого дубля другой ритм. Отдаём v3-дорожку на вход, и липсинк точен
 * по построению, а голос остаётся v3 (встроенный TTS HeyGen тут не участвует).
 *
 * Фон — плоский пурпур: живым пробником выяснено, что background.type в v3
 * принимает только "color" или "image" (ни прозрачности, ни scale/offset в
 * API нет), поэтому кат-аут делаем сами хромакеем. Пурпур выбран под одежду
 * аватара: лайм-жилет убивает зелёный ключ, деним — синий.
 *
 * Запуск (на сервере, где лежит ключ):
 *   node scripts/orlink-avatar-render.mjs <path-to-mp3>
 */
import { readFileSync } from "fs";

const API = "https://api.heygen.com";
const AVATAR_ID = "33337ae6b3fc4d2bb733d3200cac805b"; // ОРЛИНК — Construction Site Supervisor
const KEY_COLOR = "#FF00FF";

const mp3Path = process.argv[2];
if (!mp3Path) { console.error("Укажи путь к mp3"); process.exit(1); }
const apiKey = process.env.HEYGEN_API_KEY;
if (!apiKey) { console.error("Нет HEYGEN_API_KEY"); process.exit(1); }

const bytes = readFileSync(mp3Path);
const form = new FormData();
form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "voice-v3.mp3");
const up = await fetch(`${API}/v3/assets`, {
  method: "POST",
  headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  body: form,
});
const upText = await up.text();
if (!up.ok) { console.error(`Загрузка звука отклонена ${up.status}: ${upText.slice(0, 300)}`); process.exit(1); }
const assetId = JSON.parse(upText)?.data?.asset_id;
console.log("Звук загружен, asset_id:", assetId);

const payload = {
  type: "avatar",
  avatar_id: AVATAR_ID,
  aspect_ratio: "9:16",
  resolution: "1080p",
  background: { type: "color", value: KEY_COLOR },
  audio_asset_id: assetId,
  expressiveness: "high",
  title: `orlink-arena-v3-${Date.now()}`,
};

let r = await fetch(`${API}/v3/videos`, {
  method: "POST",
  headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(payload),
});
let text = await r.text();

// Выразительность поддерживается не всеми связками движка и типа аватара —
// если ругань именно на неё, повторяем без неё: клип важнее мимики.
if (!r.ok && /expressiveness/i.test(text)) {
  console.warn("HeyGen отклонил expressiveness — повтор без него");
  const { expressiveness: _drop, ...plain } = payload;
  r = await fetch(`${API}/v3/videos`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(plain),
  });
  text = await r.text();
}

if (!r.ok) { console.error(`Рендер отклонён ${r.status}: ${text.slice(0, 400)}`); process.exit(1); }
console.log("video_id:", JSON.parse(text)?.data?.video_id);
