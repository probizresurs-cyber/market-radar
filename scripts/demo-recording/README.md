# 🎬 Запись скринкаста главного дашборда

Автоматизированная запись 4-5 минутного скринкаста MarketRadar24 через Playwright.
На выходе — `.webm` видео + `.srt` субтитры с тайм-кодами, синхронные под ElevenLabs.

---

## Что записывается

9 сцен по сценарию:
1. **Лендинг** (25s) — обзор главной marketradar24.ru
2. **Регистрация** (30s) — заполнение формы
3. **Wizard** (25s) — выбор модулей + запуск
4. **Дашборд: первый взгляд** (35s) — шапка, KPI, PageSpeed
5. **Финансы + Команда** (30s) — DaData / Rusprofile / HH.ru
6. **Соцсети + Репутация** (30s) — VK/TG/Яндекс-Карты/2GIS
7. **Сайдбар-тур** (50s) — все модули по очереди
8. **Дашборд руководителя** (25s) — executive-вид
9. **Outro** (15s) — call-to-action

Общий хронометраж ~4:25.

---

## Установка на VPS (один раз)

```bash
# на сервере maria@72.56.241.159
cd /var/www/market-radar-staging

# зависимости
npm install -D playwright
npx playwright install chromium --with-deps  # --with-deps подтягивает libgbm, libnss и др.

# проверка
node -e "import('playwright').then(p => console.log('OK', p.chromium))"
```

⚠ Если ругается на `libnss3` / `libdrm` — добавь `--with-deps` (требует sudo для apt).

---

## Запуск

```bash
# задаём креды
export STAGING_URL=https://staging.marketradar24.ru
export TEST_EMAIL=demo@marketradar24.ru
export TEST_PASSWORD='тут_пароль'
export TEST_COMPANY_URL=gk-orlink.ru

# одной командой
node scripts/demo-recording/record-dashboard-demo.mjs
```

В консоль будет вывод по сценам:
```
[1/9] landing (~25s)
    🎙  «Привет! За следующие пять минут я покажу…»
[2/9] registration (~30s)
    🎙  «Регистрация занимает буквально минуту…»
...
```

Через ~5 минут получишь:
```
scripts/demo-recording/output/dashboard-demo-2026-05-26T18-30-12.webm
scripts/demo-recording/output/dashboard-demo-2026-05-26T18-30-12.srt
```

---

## Что дальше

### 1. Голос через ElevenLabs

Открой `.srt` — там 9 блоков текста с таймкодами. Каждый блок отдельно прогоняешь через ElevenLabs:

- **Голос:** `Eve` или `Sasha` (русский)
- **Stability:** 50%
- **Similarity:** 75%
- **Style:** 10-15%
- **Speed:** 0.95

Сохраняй mp3 как `01-landing.mp3`, `02-registration.mp3` и т.д. Тайминги уже в .srt — в монтаже подложишь по таймкодам.

### 2. (опц) Конвертация WebM → MP4

```bash
ffmpeg -i output/dashboard-demo-*.webm \
       -c:v libx264 -crf 18 -preset slow \
       -c:a aac -b:a 128k \
       output/dashboard-demo.mp4
```

### 3. Финальный монтаж

В **DaVinci Resolve** (бесплатный) или **CapCut**:

1. Положи видео на V1 трек
2. Положи 9 mp3 от ElevenLabs на A1, синхронизируй с таймкодами из .srt
3. (опц) Burn-in субтитры — `.srt` импортируется напрямую как subtitle track
4. Экспорт: H.264, 1080p, 30fps, target bitrate 8 Mbps

---

## Подкрутка темпа

Если скринкаст идёт слишком быстро/медленно — правь `duration` в `scenes` массиве в [record-dashboard-demo.mjs](./record-dashboard-demo.mjs). Скрипт автоматически пересчитает SRT-таймкоды.

Или меняй паузы внутри `action` — `await page.waitForTimeout(N)`.

---

## Troubleshooting

| Проблема | Решение |
|---|---|
| `Error: browserType.launch: Executable doesn't exist` | `npx playwright install chromium --with-deps` |
| Видео получается чёрным | Запусти в режиме `headless: false` для теста — может, надо подкрутить selectors |
| Курсор не виден на видео | Это нормально для headless — pink-кружок добавляется JS-инжектом |
| Сцена ломается «element not found» | Скрипт защищён `try/catch` — пропустит и продолжит. Посмотри console.log какая сцена упала и проверь selectors |
| Логин не срабатывает | Проверь `TEST_EMAIL` / `TEST_PASSWORD`, может email уже создан в проде |

---

## Сценарий для других модулей

Шаблон `record-dashboard-demo.mjs` легко скопировать под другие модули:
- `record-content-factory.mjs` — Контент-завод
- `record-agents.mjs` — Агенты
- `record-competitors.mjs` — Конкуренты

Скажи когда нужны — напишу с тем же подходом.
