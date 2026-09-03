@AGENTS.md

# MarketRadar — Документация проекта

## Обзор проекта

MarketRadar — SaaS-платформа для конкурентного анализа, контент-маркетинга и бренд-стратегии.
Пользователь регистрируется, указывает компанию/нишу, и система автоматически:
- анализирует компанию (сайт, соцсети, SEO, вакансии, отзывы, карты)
- исследует конкурентов и строит сравнительный дашборд
- формирует портрет целевой аудитории (ЦА)
- создаёт стратегию для СММ, план контента, пост/рилс/сторис
- генерирует брендбук и бренд-презентацию
- экспортирует результаты в PDF / PPTX

Данные хранятся в Postgres (таблица `user_data`, key/value JSONB по `userId`) — при загрузке страницы сервер приоритетнее localStorage, который служит write-through кэшем/офлайн-фолбэком, а не источником правды. Мультиаккаунт и шеринг воркспейсов (приглашения, роли editor/viewer) работают поверх этого же слоя. См. раздел «Хранилище данных» ниже — здесь раньше было написано «БД нет», это устарело.

---

## Стек

| Слой | Технология |
|---|---|
| Фреймворк | Next.js 16.2.2 (App Router, `"use client"`) |
| UI | React 19 + inline styles (no CSS framework) |
| AI | Claude (единственный текстовый + vision провайдер во всём контент-пайплайне), Gemini (опционально) |
| Презентации | `pptxgenjs` (серверный, `runtime = "nodejs"`) |
| Видео-аватар | HeyGen API |
| Карты/отзывы | Google Places API, Yandex Maps Search API, 2GIS Catalog API |
| Уведомления | Telegram Bot API (webhooks) |
| Деплой | Собственный VPS (Moscow, Node.js + PM2, `.env` файл) |
| Хранилище | PostgreSQL (`user_data` key/value JSONB, per userId) + localStorage как write-through кэш |

---

## Структура папок

```
src/
├── app/
│   ├── page.tsx              # Весь фронтенд — один файл (~9500 строк)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── analyze/          # Главный анализ компании (Claude)
│       ├── analyze-offers/   # Анализ офферов конкурента (GPT-4o + сайт)
│       ├── analyze-performance/ # Анализ метрик контента
│       ├── analyze-reviews/  # AI-анализ отзывов → темы, тональность
│       ├── analyze-smm/      # Анализ СММ-стратегии
│       ├── analyze-ta/       # Анализ целевой аудитории
│       ├── check-tov/        # Проверка тона голоса поста
│       ├── debug-keyso/      # Отладка Key.so API
│       ├── expand-prompt/    # Расширение промпта поста
│       ├── export-pptx/      # Генерация .pptx (pptxgenjs)
│       ├── extract-metrics/  # Извлечение метрик из текста/скрина
│       ├── extract-reviews/  # Извлечение отзывов из скрина/текста (GPT-4o Vision)
│       ├── fetch-map-ratings/ # Живые рейтинги с Google/Yandex/2GIS по названию
│       ├── fetch-reviews-2gis/ # Отзывы 2GIS (по URL или названию компании)
│       ├── fetch-reviews-google/ # Отзывы Google Places (по названию компании)
│       ├── generate-content-plan/ # Генерация плана контента
│       ├── generate-image/   # Генерация изображения для поста
│       ├── generate-post/    # Генерация текста поста
│       ├── generate-presentation/ # Генерация структуры слайдов (JSON)
│       ├── generate-reel-scenario/ # Сценарий рилса
│       ├── generate-reel-video/    # Видео через HeyGen
│       ├── generate-stories/ # Сторис-сценарии
│       ├── heygen-list/      # Список аватаров/голосов HeyGen
│       ├── suggest-brandbook/ # Рекомендации по брендбуку из ЦА
│       ├── telegram/         # connect / notify / setup / webhook
│       └── video-status/     # Статус рендера видео HeyGen
└── lib/
    ├── types.ts              # AnalysisResult, Company, SEO, Social, Business...
    ├── ta-types.ts           # TAResult, TASegment
    ├── smm-types.ts          # SMMResult, SMMSocialLinks, SMMRealStats
    ├── content-types.ts      # ContentPlan, GeneratedPost, BrandBook, AvatarSettings...
    ├── review-types.ts       # Review, ReviewCollection, ReviewAnalysis
    ├── analyzer.ts           # Парсинг + Claude-запросы для анализа компании
    ├── enricher.ts           # Обогащение данных (DaData, HH.ru, PageSpeed...)
    ├── scraper.ts            # Playwright/fetch скрапер сайта
    └── tgStore.ts            # Хранилище chatId для Telegram-уведомлений
```

---

## Реализованные модули

### Анализ компании
| Модуль | Статус |
|---|---|
| Ввод компании + запуск анализа | ✅ Готово |
| Дашборд компании (scores, SEO, соцсети, карты) | ✅ Готово |
| Живые рейтинги с Google / Yandex / 2GIS | ✅ Готово |
| История анализов с раскрываемыми карточками и дельтой | ✅ Готово |
| Онбординг нового пользователя | ✅ Готово |

### Анализ конкурентов
| Модуль | Статус |
|---|---|
| Список конкурентов + профиль | ✅ Готово |
| Сравнение конкурентов (таблица) | ✅ Готово |
| AI-инсайты по конкурентам | ✅ Готово |
| Анализ офферов конкурента (парсинг сайта → GPT) | ✅ Готово |
| Рейтинги конкурентов на картах | ✅ Готово |

### Анализ ЦА
| Модуль | Статус |
|---|---|
| Генерация портрета ЦА (сегменты, психографика) | ✅ Готово |
| Дашборд ЦА (страхи, мотивы, возражения, цитаты) | ✅ Готово |
| Рекомендации по брендбуку из ЦА (отдельный таб) | ✅ Готово |
| «Применить к брендбуку» — перенос в план контента | ✅ Готово |

### Анализ СММ
| Модуль | Статус |
|---|---|
| Анализ соцсетей + архетип бренда | ✅ Готово |
| Дашборд СММ (платформы, стратегия, примеры постов) | ✅ Готово |

### Анализ отзывов ⚠️ В работе
| Модуль | Статус |
|---|---|
| Авто-подтягивание отзывов Google + 2GIS по имени | ✅ Готово |
| Извлечение отзывов из скрина (GPT-4o Vision) | ✅ Готово |
| AI-анализ: тональность, темы, рекомендации | ✅ Готово |
| Шаблоны ответов на отзывы | ✅ Готово |
| Поиск по адресу в 2GIS / Yandex (не всегда находит) | 🔧 В работе |

### Контент-завод
| Модуль | Статус |
|---|---|
| План контента (AI-генерация) | ✅ Готово |
| Генерация постов с расширением промпта | ✅ Готово |
| Генерация рилс-сценариев | ✅ Готово |
| Видео-рилс через HeyGen-аватар | ✅ Готово |
| Сторис-сценарии | ✅ Готово |
| Проверка тона голоса (ToV checker) | ✅ Готово |
| Аналитика контента + ROI-калькулятор | ✅ Готово |
| Брендбук (ручное редактирование + применение из ЦА) | ✅ Готово |

### Бренд-презентация ⚠️ В работе
| Модуль | Статус |
|---|---|
| Генерация 9-14 слайдов из всех анализов | ✅ Готово |
| CSS-рендер: cover/bullets/stats/quote/two-col/CTA | ✅ Готово (редизайн) |
| Полноэкранный показ слайдов | ✅ Готово |
| Экспорт в PDF (print) | ✅ Готово |
| Экспорт в .pptx (pptxgenjs) | ✅ Готово |
| Улучшение дизайна слайдов | 🔧 В работе |
| Генерация лендинга/сайта (одностраничник из данных анализа) | ✅ Готово |

### Лендинги и сайты
| Модуль | Статус |
|---|---|
| Генерация HTML-лендинга из данных компании + брендбука (`generate-landing`) | ✅ Готово |
| Редактор блоков лендинга (hero, услуги, преимущества, CTA) + автосохранение (`landing-edit-save`) | ✅ Готово |
| Экспорт в HTML (`landing-export-html`), деплой на Vercel (`landing-deploy-vercel`) | ✅ Готово |
| SEO-мета, пиксели аналитики, варианты hero, шаринг, перевод (`landing-seo-meta`, `landing-pixels`, `landing-hero-variants`, `landing-share`, `landing-translate`) | ✅ Готово |
| Приём заявок с лендинга (`landing-submit`, `landing_submissions`) | ✅ Готово |

### Система
| Модуль | Статус |
|---|---|
| Мультиаккаунт с DB-синком между устройствами + шеринг воркспейсов (editor/viewer) | ✅ Готово |
| Telegram-уведомления (анализ, конкуренты, дайджест) | ✅ Готово |
| Контент-лента канала @company24pro: AI-черновик по команде/расписанию, правки текстом, одобрение менеджером (бот @market_radar1_bot, `src/lib/channel-poster.ts`) | ✅ Готово |
| Светлая / тёмная тема | ✅ Готово |
| Настройки аккаунта | ✅ Готово |
| Отчёты (просмотр) | 📋 Планируется |

---

## Хранилище данных

**БД есть** (Postgres). Раздел ниже раньше был озаглавлен «БД нет» — это было устаревшим описанием, оставшимся с ранней стадии проекта.

Основной механизм — generic key/value store, таблица `user_data`:

```sql
user_data (id, user_id, key TEXT, value JSONB, updated_at, UNIQUE(user_id, key))
```

- `GET/POST/DELETE /api/data` — читает/пишет по `(userId, key)`.
- `syncToServer` (`src/lib/user.ts`) и `mirror-sync.ts` — покрывают ~35 типов контента (компания, конкуренты, ЦА, СММ, контент-план, посты/рилсы/сторис/карусели, брендбук, история анализов, настройки аватара и т.д.) — те же ключи, что раньше жили только в `localStorage` (`mr_company_*`, `mr_ta_*`, `mr_content_*`, …).
- При загрузке страницы приоритет — сервер: `get(key) ?? JSON.parse(localStorage...)`. `localStorage` остаётся write-through кэшем и офлайн-фолбэком, не источником правды.
- Известные 3 пробела, ещё не заведённые в `user_data` (localStorage-only): `mr_offers_*` (офферы конкурентов), `mr_admin_promo_reel_form`/`mr_admin_promo_reels` (админка промо-роликов), `mr_aisum_*` (AI-саммари дашборда).

Дополнительные таблицы:

- `workspace_members`, `workspace_invites` — шеринг воркспейса между пользователями (роли `editor`/`viewer`, `workspaceId === user.id` владельца); `/api/workspace/{list,invite,accept,members,snapshot}`.
- `scheduled_posts` (`id, user_id, kind, payload, platforms, scheduled_for, status, ...`) — очередь автопубликации постов/рилсов/сторис/каруселей; `kind IN ('post','reel','story','carousel')`.
- `agent_runs` — запуски фоновых агентов (автопубликатор и др.), inbox-карточки, approve/dismiss.

---

## Переменные окружения (.env)

Задаются в `.env` на VPS (next to `package.json`):

```
ANTHROPIC_API_KEY=        # Claude API (основной AI)
OPENAI_API_KEY=           # GPT-4o (резервный, vision tasks)
GEMINI_API_KEY=           # Google Gemini (опционально)
GOOGLE_PLACES_API_KEY=    # Google Maps / Places (рейтинги, отзывы)
YANDEX_MAPS_API_KEY=      # Yandex Maps Search API (рейтинги)
TWOGIS_API_KEY=           # 2GIS Catalog API (рейтинги, отзывы)
HEYGEN_API_KEY=           # HeyGen (генерация видео с аватаром)
HEYGEN_AVATAR_ID=         # ID аватара по умолчанию в HeyGen
HEYGEN_VOICE_ID=          # ID голоса по умолчанию в HeyGen
TELEGRAM_BOT_TOKEN=       # Telegram Bot (уведомления)
KEYSO_API_TOKEN=          # Key.so (SEO-данные, опционально)
DADATA_API_KEY=           # DaData (реквизиты компаний РФ)
CRON_SECRET=              # Секрет для всех /api/cron/* эндпоинтов
TELEGRAM_CHANNEL_ID=      # Канал для контент-ленты бота, по умолчанию @company24pro
CHANNEL_MANAGER_TG_CHAT_ID= # chat_id ответственного за канал (через запятую — несколько); фолбэк KP_MANAGER_TG_CHAT_ID
CHANNEL_AUTOPOST_DAYS=    # Дни авто-черновиков в канал, 1=пн..7=вс (по умолч. 1,3,5)
CHANNEL_AUTOPOST_HOUR=    # Час МСК авто-черновика (по умолч. 10)
CHANNEL_AUTOPOST_ENABLED= # "false" выключает авто-режим (по умолч. включён)
```

---

## Деплой

- **Платформа:** собственный VPS (Moscow, `maria@72.56.241.159`)
- **Процесс-менеджер:** PM2 (`pm2 restart market-radar`)
- **Команда сборки:** `npm run build`
- **Команда запуска:** `npm start` (через PM2)
- **Node.js runtime:** требуется для `pptxgenjs` и серверных API-routes
- **Переменные окружения:** `.env` файл в корне проекта
- **Anthropic proxy:** через Cloudflare Worker (`ANTHROPIC_BASE_URL`) — обход гео-блока РФ
- **Репозиторий:** `github.com/probizresurs-cyber/market-radar`
- **Процесс деплоя:** `git pull && npm install && npm run build && pm2 restart market-radar`

---

## Известные проблемы

| # | Проблема | Статус |
|---|---|---|
| 1 | Анализ отзывов: поиск по адресу в 2GIS/Yandex срабатывает не всегда (API не находит компанию по неточному названию) | 🔧 В работе |
| 2 | Общий дизайн интерфейса требует улучшения (Typography, spacing, visual polish) | 🔧 В работе |
| 3 | CSS-рендер слайдов презентации — дальнейший полиш дизайна | 🔧 В работе |
| 4 | `page.tsx` ~9500 строк — нужна декомпозиция на компоненты | 📋 Технический долг |
| 5 | 3 типа данных ещё не заведены в `user_data` и теряются при смене браузера/устройства: `mr_offers_*`, `mr_admin_promo_reel_form`/`mr_admin_promo_reels`, `mr_aisum_*` (остальной контент синкается через БД, см. «Хранилище данных») | 🔧 В работе |
| 6 | HeyGen видео-генерация может занимать 2-5 минут (статус поллинг) | Ограничение API |
| 7 | ~~Лендинг/сайт из данных анализа — не реализован~~ — реализован, см. «Лендинги и сайты» выше | Закрыто |
