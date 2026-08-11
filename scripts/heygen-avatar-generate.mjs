/**
 * Генерация фото-аватара средствами САМОГО HeyGen (не нашей image-моделью).
 *
 * Почему у HeyGen: их генератор нормально рисует эмблему на каске и одежде —
 * на действующем аватаре ОРЛИНК логотип получился убедительным. Обычные
 * image-модели на такой задаче дают кляксы вместо знака, поэтому наш
 * /api/generate-image здесь не подходит.
 *
 * Скрипт:
 *   1) POST /v2/photo_avatar/photo/generate — 4 варианта портрета
 *   2) опрос /v2/photo_avatar/generation/{id} до готовности
 *   3) печатает ссылки — выбираем лицо глазами
 *
 * Заведение выбранного варианта в аватар делает scripts/heygen-avatar-adopt.mjs:
 * разделено намеренно, чтобы не тратить кредиты на обучение того портрета,
 * который не подошёл.
 *
 * ВНИМАНИЕ: v2-эндпоинт помечен HeyGen как legacy, отключение 2026-10-31.
 * До этой даты работает; при обновлении интеграции надо переходить на
 * актуальный API (developers.heygen.com/reference).
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/heygen-avatar-generate.mjs ["описание внешности"]
 */
const key = process.env.HEYGEN_API_KEY;
const base = process.env.HEYGEN_BASE_URL || "https://api.heygen.com";
if (!key) {
  console.error("Нет HEYGEN_API_KEY в окружении");
  process.exit(1);
}

const appearance =
  process.argv[2] ||
  [
    "Russian construction site foreman, about 28 years old, short dark hair, clean-shaven,",
    "friendly confident expression, looking at camera.",
    "Wearing a white hard hat with a small round company emblem on the front in amber-yellow and black,",
    "and a dark charcoal work jacket with amber-yellow high-visibility stripes.",
    "Background: modern construction site with steel structures, softly blurred, natural daylight.",
    "Professional corporate photography, sharp focus on the face.",
  ].join(" ");

const req = {
  name: "Orlink foreman young",
  age: "Young Adult",
  gender: "Man",
  ethnicity: "White",   // допустимые значения жёстко перечислены в API
  orientation: "square",
  pose: "half_body",
  style: "Realistic",
  appearance,
};

const r = await fetch(`${base}/v2/photo_avatar/photo/generate`, {
  method: "POST",
  headers: { "X-Api-Key": key, "Content-Type": "application/json" },
  body: JSON.stringify(req),
});
const j = await r.json();
const genId = j?.data?.generation_id;
if (!genId) {
  console.error("Генерация не запустилась:", JSON.stringify(j).slice(0, 400));
  process.exit(1);
}
console.log(`generation_id: ${genId}\nЖду портреты…`);

for (let i = 0; i < 30; i++) {
  await new Promise((s) => setTimeout(s, 10000));
  const p = await fetch(`${base}/v2/photo_avatar/generation/${genId}`, { headers: { "X-Api-Key": key } });
  const pj = await p.json();
  const d = pj?.data ?? {};
  const urls = d.image_url_list ?? [];
  if (urls.length > 0) {
    console.log(`\nГотово, вариантов: ${urls.length}`);
    urls.forEach((u, n) => console.log(`  ${n + 1}. ${u}`));
    console.log(`\nid ключей для заведения: ${(d.image_key_list ?? []).join(", ") || "(нет)"}`);
    process.exit(0);
  }
  if (d.status === "failed") {
    console.error("Провал:", JSON.stringify(pj).slice(0, 400));
    process.exit(1);
  }
  console.log(`  ${d.status ?? "pending"}…`);
}
console.error("Не дождались за 5 минут — проверьте позже по generation_id");
process.exitCode = 1;
