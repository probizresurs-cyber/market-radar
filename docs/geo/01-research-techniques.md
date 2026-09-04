# GEO (Generative Engine Optimization): обзор техник и доказательной базы

*Собрано в сентябре 2026. Проведено 20 поисков (EN/RU), прочитано целиком ~25 материалов: оригинальная статья Princeton/GaTech, исследования Ahrefs (6 шт.), Semrush (4), Seer Interactive, Vercel/MERJ, Profound, Otterly (3), SE Ranking, официальные доки OpenAI/Anthropic/Perplexity/Яндекс и русские источники. Цифры приводятся только из прочитанного, с источником. Где данных нет — сказано прямо.*

---

## 0. Главные выводы в пять строк

1. **Попасть в ответ = попасть в retrieval-слой конкретного движка.** ChatGPT берёт кандидатов из Bing (87% цитат = топ-Bing, Seer), Алиса AI — из топ-10 Яндекса (официальная справка Вебмастера), AI Overviews — через query fan-out из смежных SERP (лишь 38% цитат из топ-10, Ahrefs). Без индексации и позиций в «донорском» поиске остальные техники не работают.
2. **Самые доказанные on-page приёмы** — статистика, цитаты экспертов, ссылки на источники, «ответ-первым» блок в начале страницы, вопросительные H2, компактные самодостаточные абзацы. Прирост видимости в контролируемых экспериментах 28–43% (Aggarwal et al., KDD 2024).
3. **Внешние упоминания сильнее ссылок.** Корреляция AI-видимости с упоминаниями бренда на YouTube ~0.74, с упоминаниями в вебе 0.66–0.71, с DR всего 0.27–0.33 (Ahrefs, 75 000 брендов).
4. **llms.txt не работает** (Google, SE Ranking на 300k доменов, Ahrefs на 137k сайтов), **Schema.org сама по себе не даёт прироста цитирований** (Ahrefs, 1885 страниц с контрольной группой), но остаётся гигиеной.
5. **LLM-краулеры не выполняют JS** (Vercel/MERJ), поэтому нужен SSR/SSG, открытые search-боты в robots.txt и индексация в Bing (IndexNow) для ChatGPT/Copilot.

---

## 1. Как движки выбирают источники (retrieval-слой)

| Движок | Откуда кандидаты | Ключевые цифры | Источник |
|---|---|---|---|
| **ChatGPT Search** | Индекс Bing + лицензированные партнёры | 87% цитат SearchGPT совпадают с топ-выдачей Bing по тому же вопросу (большинство — топ-10, хвост — 11–20); с Google совпадение 56%, медианная позиция 17 | Seer Interactive, 500+ цитат/100 запросов |
| **Google AI Overviews** | Индекс Google + query fan-out | Доля цитат из топ-10 упала с ~76% (июль 2025) до 38% (2026); 31% — позиции 11–100, 31% — за пределами топ-100 | Ahrefs, 863k SERP / 4M URL |
| **Google AI Mode** | То же, но слабее связь с SERP | Пересечение с топ-10: 54% по доменам / 35% по URL; Perplexity — 91/82%, AIO — 86/67% | Semrush, 5000 запросов, 150k цитат |
| **Perplexity** | Собственный индекс + сильная привязка к ранжированию | 28,6% цитат из топ-10 Google, 16,6% из топ-10 Bing — выше, чем у любого другого ассистента | Ahrefs, 15 000 long-tail запросов |
| **Gemini** | Google (Googlebot рендерит JS) | 8,6% из топ-10 Google, 14% из топ-10 Bing; в среднем 3 источника на ответ (у ChatGPT — 15) | Ahrefs; Semrush AI Visibility Index |
| **Алиса AI (Яндекс)** | Топ выдачи Яндекса | Официально: источники — «страницы, занимающие высокие позиции в Поиске по основному запросу» + качество по ЭПОС. Быстрые ответы — 46,5 млн пользователей/мес | Справка Вебмастера, блог Яндекса, новость 07.04.2026 |
| **GigaChat** | Встроенный веб-поиск (GigaSearch, RAG) | По данным агентства Optimentor: классификатор выделяет фактологические вопросы, в промпт кладутся топ-3 документа. Официального описания не найдено | Optimentor (страница закрыта 403, цитата из сниппета) |

Только 12% URL, процитированных AI-ассистентами, ранжируются в топ-10 Google по исходному промпту, ~80% не входят в топ-100 — потому что движки переписывают запрос в пачку подзапросов (query fan-out) и цитируют страницы, релевантные подзапросам (Ahrefs). Отсюда практика: покрывать не один ключ, а кластер вопросов вокруг темы.

Пересечение между движками минимально: в анализе 3,7 млн цитирований только 2,37% URL появились во всех трёх ИИ по одному запросу, 91% были эксклюзивны для одного движка (vc.ru); «только 11% доменов цитируются и ChatGPT, и Perplexity» (Shadow). Профиль источников нужно строить под каждый движок отдельно.

**Приоритет: высокий.** Без позиций в Bing (для ChatGPT/Copilot) и Яндексе (для Алисы) остальное бессмысленно.

---

## 2. On-page техники: что мерили и на сколько

### 2.1. Оригинальный эксперимент GEO (Aggarwal et al., Princeton/IIT Delhi/Allen AI, KDD 2024)

Тестировали 9 методов переписывания страницы на бенчмарке GEO-bench (~10k запросов из 9 источников), измеряя **Position-Adjusted Word Count** (сколько слов ответа приходится на источник, с поправкой на позицию) и **Subjective Impression** (оценка LLM-судьёй). Базовая линия — 19,3.

| Метод | Δ Position-Adjusted Word Count | Δ Subjective Impression |
|---|---|---|
| **Quotation Addition** (цитаты экспертов/источников) | **+43,5%** | **+28,0%** |
| **Statistics Addition** (числа, статистика) | **+34,2%** | +22,8% |
| **Fluency Optimization** (гладкость текста) | +30,1% | +13,5% |
| **Cite Sources** (ссылки на источники) | +29,0% | +13,5% |
| Technical Terms | +19,7% | — |
| Easy-to-Understand | +14,9% | — |
| Authoritative (уверенный тон) | +12,9% | — |
| Unique Words | +7,3% | — |
| **Keyword Stuffing** | **−8,3%** | — |

Дополнительные находки:
- **Сайты с низкой позицией выигрывают больше всего.** Для источника на 5-й позиции Cite Sources дал +115%, Quotation +99,7%, Statistics +97,9%; для сайта на 1-й позиции Cite Sources дал −30%. GEO — инструмент «догоняющего».
- **По доменам** методы работают по-разному: Law & Government — статистика; Debate, History — авторитетный тон + цитаты; Science, Business — fluency.
- **Валидация на живом Perplexity.ai**: Quotation +22% Position-Adjusted Word Count, Statistics +37% Subjective Impression, Keyword Stuffing −10%.

Как применять: в каждом ключевом разделе — 1–2 числа с указанием источника, 1 прямая цитата эксперта (с именем и должностью), 2–3 ссылки на первоисточники. Убрать вхождения ключевых слов «для плотности». **Приоритет: высокий.**

### 2.2. Позиция ответа на странице (Kevin Indig, 1,2 млн ответов ChatGPT, 18 012 верифицированных цитат)

- **44,2% цитат берутся из первых 30% страницы** («лыжный трамплин»), 31,1% — из середины, 24,7% — из последней трети с резким падением у футера.
- Внутри абзаца: 53% цитат — из середины абзаца, 24,5% — из первого предложения, 22,5% — из последнего.
- «Answer capsules» — самодостаточное объяснение в 40–60 слов сразу после заголовка — цитируются в 72,4% случаев.
- **91% процитированных капсул не содержали гиперссылок** — ссылки внутри блока-ответа снижают шанс цитирования.
- Черты цитируемого текста: дефинитивные конструкции («X — это…») в 2 раза чаще; вопросительная структура в 2 раза чаще; плотность сущностей 20,6% vs обычные 5–8%.

Как применять: под каждым H2 — первый абзац 40–60 слов с прямым ответом, без ссылок, с названиями сущностей. Самое ценное — в первой трети страницы. **Приоритет: высокий.**

### 2.3. Структура: заголовки, таблицы, FAQ, длина

Синтез вторичных исследований (Machine Relations, Digital Applied): строгая иерархия H1→H2→H3 — 68,7% цитируемых страниц vs 40% нецитируемых; 3+ таблицы сравнения +25,7% цитат; FAQ с вопросительными заголовками — 3,2× шанс в AI Overviews; 5–7 статистик в первых 500 словах ~+20%.

**Длина — не фактор.** Ahrefs (560 346 AI Overviews): корреляция длина↔цитирование **0,04**; 53,4% цитируемых страниц короче 1000 слов. При этом SE Ranking: статьи >2900 слов на 59% чаще цитируются в ChatGPT, чем <800 — расхождение по движку (AIO любит короткие ответы, ChatGPT — полные справочники).

Тип страницы (Otterly, 1,03 млн URL): guide — 2,7 цитаты в среднем (+42% к базе), blog/help — 2,0, news — 1,7, pricing — 1,5. URL с query-параметрами цитируются на 24% реже.

Как применять: страницы-гайды и сравнения; вопросительные H2; ответ-капсула под каждым; таблица сравнения с реальными числами; FAQ из 5–8 вопросов по 40–80 слов; чистые URL без параметров. **Приоритет: высокий.**

### 2.4. Сравнительный контент и упоминания бренда (Semrush + Indig, «ghost citations»)

- **62% AI-цитат — «призрачные»**: сайт стоит в источниках, но бренд в тексте ответа не назван. Только 13,2% — и цитата, и упоминание.
- Gemini называет бренд в 83,7% случаев, но ссылается в 21,4%; ChatGPT — наоборот: 20,7%/87%.
- **Сравнительный контент даёт 2,4× больше упоминаний бренда**, чем информационный.

Как применять: страницы «X vs Y», «альтернативы X», «лучшие X для Y» с явным названием собственного бренда. **Приоритет: высокий** для коммерческих целей.

### 2.5. Свежесть

Ahrefs (16,975 млн цитат): AI-ассистенты цитируют контент **на 25,7% свежее**, чем органика Google; ChatGPT — на 458 дней свежее органики. Топ-1000 страниц ChatGPT: 89,7% обновлялись в 2025, 76,4% — за последние 1–6 месяцев. SE Ranking: обновление за 3 месяца → в 2 раза вероятнее цитируется в ChatGPT.

Как применять: видимая дата обновления (`dateModified` + текст «Обновлено: …»), ежеквартальный рефреш ключевых материалов. **Приоритет: высокий.**

### 2.6. Schema.org

Единственный контролируемый тест — **Ahrefs, 1885 страниц с JSON-LD vs 4000 контрольных**: AI Overviews −4,6%, AI Mode +2,4%, ChatGPT +2,2% (статистически неотличимо от нуля). Google не подтверждал связь FAQPage с AI-цитированием. Противоположные вендорские заявления — без контрольных групп, доверять нельзя.

Как применять: держать Organization (с sameAs), Article, Product/Offer, FAQPage как гигиену для Knowledge Graph и Яндекса, не ожидая прироста цитирований. **Приоритет: средний (низкий как самостоятельный рычаг).**

---

## 3. Внешние источники: где ИИ берёт мнение о бренде

### 3.1 Какие домены цитируют

- **Profound (680 млн цитат)**: ChatGPT — Wikipedia 7,8%, Reddit 1,8%, Forbes 1,1%, G2 1,1%; AIO — Reddit 2,2%, YouTube 1,9%, Quora 1,5%; Perplexity — Reddit 6,6%.
- **Semrush**: доля Reddit в ChatGPT упала с ~60% до ~10% к сентябрю 2025 — намеренная дедупликация источников OpenAI.
- **Ahrefs (топ-1000 цитат ChatGPT)**: 67% — «недоступны маркетологу» (Wikipedia, главные страницы, app stores); медианный DR 90, но медианный UR страницы всего 6 — авторитет домена важен, авторитет страницы нет.

### 3.2 YouTube обогнал Reddit в 2026

Ahrefs: YouTube — самый цитируемый домен в AI Overviews (5,6% всех цитат, +34% за полгода). **94% цитат — длинные видео, не Shorts**; Google цитирует с таймкодами. Ahrefs (75 000 брендов): **упоминания на YouTube ~0,74** корреляции с видимостью в ChatGPT/AI Mode/AIO — сильнейший фактор; брендовые упоминания в вебе 0,66–0,71; DR 0,27–0,33.

### 3.3 Отзовики и листиклы

Quoleady: каждый инструмент, названный ChatGPT в софт-нише, имел отзывы на Capterra, 99% — на G2. Присутствие на 2+ отзовиках — 3,4× вероятность упоминания.

### 3.4 Wikipedia / Wikidata

Прямых контролируемых исследований нет. Wikipedia — крупнейший источник ChatGPT (см. выше). Рекомендация: запись в Wikidata + sameAs в Organization — низкие затраты. **Приоритет: средний.**

Порядок по силе сигнала: 1) длинные YouTube-видео с главами; 2) упоминания в отраслевых медиа и листиклах; 3) профили и отзывы на 2+ отзовиках; 4) Reddit/профильные сообщества (для Рунета — vc.ru, Хабр); 5) Wikidata. **Приоритет: высокий.**

---

## 4. Технические требования

### 4.1 Краулеры и robots.txt

| User-agent | Кто | Назначение | Что даёт разрешение |
|---|---|---|---|
| OAI-SearchBot | OpenAI | Индекс ChatGPT Search | Обязателен: закрытые сайты не показываются в ответах ChatGPT search |
| ChatGPT-User | OpenAI | Живой фетч по действию пользователя | Не влияет на попадание в Search |
| GPTBot | OpenAI | Обучение | Блокировка не влияет на ChatGPT Search |
| Claude-SearchBot / Claude-User | Anthropic | Поиск/фетч для Claude | Блокировка снижает видимость |
| ClaudeBot | Anthropic | Обучение | Только тренировка |
| PerplexityBot / Perplexity-User | Perplexity | Индекс / фетч | Без него сайт не появится в Perplexity |
| Google-Extended | Google | Токен обучения Gemini | Не влияет на AIO/AI Mode |
| Bingbot | Microsoft | Индекс Bing → ChatGPT Search, Copilot | Критичен |
| YandexBot | Яндекс | Индекс → Алиса, Нейро | Критичен для Рунета |
| Applebot-Extended | Apple | Обучение | Applebot — поиск/Siri |
| CCBot, Bytespider, Amazonbot, Meta-ExternalAgent | Разные | Обучение/датасеты | На цитируемость не влияют |

Otterly: у 73% сайтов есть технические барьеры для AI-краулеров. Рекомендация: разрешить всех search/user-ботов и Bingbot/Googlebot/YandexBot; проверить, что WAF/CDN не режет их по UA. **Приоритет: высокий.**

### 4.2 JavaScript и рендеринг

Vercel + MERJ: **краулеры OpenAI, Anthropic, Meta, ByteDance, Perplexity не выполняют JavaScript** — JS скачивается как текст, но не исполняется. Исключения — Gemini и Applebot. 34,8% запросов ChatGPT упираются в 404 (у Googlebot 8,2%).

Как применять: контент, цены, FAQ, таблицы — в HTML на сервере (SSR/SSG), никаких lazy-loaded аккордеонов с текстом по клику. **Приоритет: высокий.**

### 4.3 Bing, IndexNow, Яндекс Вебмастер

Без индекса Bing страница не попадёт в ChatGPT Search и Copilot. Bing Webmaster Tools — sitemap + IndexNow (пуш URL, тот же ключ работает и для Яндекса). Яндекс Вебмастер с 7 апреля 2026 — отчёт **«Видимость сайта в Алисе AI»**: SoV = доля ответов Алисы с упоминанием сайта среди запросов, где сайт есть в выдаче. **Приоритет: высокий.**

### 4.4 E-E-A-T, автор, canonical

Прямых количественных исследований влияния блока автора на AI-цитирование не найдено. Косвенно: Indig — цитируемые капсулы плотны сущностями; Яндекс — критерии ЭПОС. Практика: реальный автор с профилем, дата, canonical, отсутствие дублей. **Приоритет: средний.**

---

## 5. llms.txt — не работает (по состоянию на 2026)

- Google (Гэри Илш, июль 2025): не поддерживает и не планирует; 2 июня 2026: «ни одна AI-система его не использует».
- SE Ranking, 300 000 доменов: корреляции с цитированием нет; из 50 самых цитируемых доменов llms.txt есть у одного.
- Ahrefs, 137 000 сайтов: 97% файлов llms.txt получили ноль трафика.
- OpenAI, Anthropic, Perplexity в документации llms.txt не упоминают.

Русские гайды продолжают его рекомендовать без доказательств. **Приоритет: низкий** (не вредит, 15 минут работы, ожидать нечего).

---

## 6. Специфика Рунета

### 6.1 Алиса AI / «Поиск с Алисой»

Официально (апрель 2026): ответ генерирует Alice AI LLM, опираясь на несколько сайтов-источников; условие — высокие позиции по основному запросу + ЭПОС. Отчёт SoV в Вебмастере с 07.04.2026.

Неофициальные оценки (GEO Scout, метод не раскрыт): 50–60% источников — топ-10 органики Яндекса, 8–12% русская Wikipedia, 6–10% Карты/Бизнес, 5–8% отзовики, 5–8% Хабр/vc.ru.

Как применять: SEO в Яндексе — фундамент; заполненная карточка Яндекс Бизнес с отзывами; экспертные материалы на vc.ru/Хабре; FAQ; контроль SoV в Вебмастере. **Приоритет: высокий для РФ.**

### 6.2 GigaChat

Официального описания источников нет. По агентским материалам: GigaSearch на базе RAG, топ-3 документа в промпт; ориентация на русскую Wikipedia/Wikidata, российские СМИ. **Приоритет: средний**, техники те же, что для Алисы.

### 6.3 Площадки дистрибуции в Рунете

vc.ru, Хабр, РБК Pro, Forbes, отраслевые Telegram-каналы, профильные рейтинги, отраслевые медиа.

---

## 7. Метрики и измерение

- **Citation rate** — доля промптов, где URL сайта попал в источники.
- **Mention rate** — доля ответов, где бренд назван в тексте (разрыв с citation — «ghost citations»).
- **AI Share of Voice** — доля появлений бренда относительно суммы появлений конкурентов.
- Методика: 15–50 промптов трёх типов (брендовые/категорийные/сравнительные), еженедельно по 2–3 движкам, ежемесячно полный набор, несколько повторов (ответы недетерминированы).

**Приоритет: высокий** — без измерения нельзя отличить работающее от неработающего.

---

## 8. Сводная таблица приоритетов

| Техника | Доказательность | Приоритет |
|---|---|---|
| Индексация и позиции в Bing (IndexNow) и Яндексе | Seer 87%; справка Яндекса | Высокий |
| SSR/чистый HTML, открытые search-боты, WAF | Vercel/MERJ; доки OpenAI/Anthropic/Perplexity | Высокий |
| Статистика + цитаты + ссылки на источники в тексте | Aggarwal et al. +29…+43% | Высокий |
| Answer-first капсула 40–60 слов под каждым H2, без ссылок | Indig, 1,2M ответов | Высокий |
| Вопросительные H2, таблицы сравнения, FAQ-блок | Indig 2×; вторичные исследования +17…26% | Высокий |
| Сравнительные страницы с названием бренда | Semrush/Indig 2,4× | Высокий |
| Регулярное обновление + видимая дата | Ahrefs 16,9M цитат; SE Ranking 2× | Высокий |
| YouTube (длинные видео с главами), медиа, отзовики | Ahrefs r≈0,74/0,66–0,71; Quoleady 3× | Высокий |
| Кластер подзапросов вместо одного ключа (fan-out) | Ahrefs 12%/38% | Высокий |
| Prompt tracking по движкам + SoV в Вебмастере | Semrush, Shadow, Яндекс | Высокий |
| Яндекс Бизнес/Карты, vc.ru/Хабр для Алисы и GigaChat | Официальные советы Яндекса + агентские оценки | Высокий (РФ) |
| Schema.org (Organization/Article/FAQPage/Product, sameAs) | Ahrefs: нет прироста | Средний (гигиена) |
| Wikidata/Wikipedia-запись | Косвенно | Средний |
| Автор/E-E-A-T-блоки | Нет количественных данных, есть ЭПОС Яндекса | Средний |
| Keyword stuffing | Aggarwal −8…−10% | Вредно |
| llms.txt | Google, SE Ranking 300k, Ahrefs 137k — нулевой эффект | Низкий |
| Длина текста как самоцель | Ahrefs r=0,04 | Низкий |

---

## Источники

1. Aggarwal et al., GEO: Generative Engine Optimization (KDD 2024) — https://arxiv.org/abs/2311.09735
2. Ahrefs, ChatGPT's most cited pages — https://ahrefs.com/blog/chatgpts-most-cited-pages
3. Ahrefs, Do AI assistants prefer fresh content — https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content
4. Ahrefs, AI brand visibility correlations (75k brands) — https://ahrefs.com/blog/ai-brand-visibility-correlations
5. Ahrefs, Schema & AI citations (1885 pages) — https://ahrefs.com/blog/schema-ai-citations
6. Ahrefs, Short vs long content in AI Overviews — https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/
7. Ahrefs, 38% of AI Overview citations from top-10 — https://ahrefs.com/blog/ai-overview-citations-top-10/
8. Ahrefs, Only 12% of AI-cited URLs rank in top-10 — https://ahrefs.com/blog/ai-search-overlap/
9. Seer Interactive, 87% of SearchGPT citations match Bing — https://www.seerinteractive.com/insights/87-percent-of-searchgpt-citations-match-bings-top-results
10. Search Engine Land, Bing not Google shapes ChatGPT — https://searchengineland.com/bing-ranking-chatgpt-visibility-study-473680
11. Semrush, Ghost citations study — https://www.semrush.com/blog/the-ghost-citations-study/
12. Semrush, Most-cited domains in AI — https://www.semrush.com/blog/most-cited-domains-ai/
13. Semrush, 2026 AI Visibility Index — https://www.semrush.com/news/463141-semrush-releases-expanded-2026-ai-visibility-index-analyzing-126-million-ai-search-prompts/
14. Semrush, Topic authority study — https://www.semrush.com/blog/chatgpt-topic-authority-study/
15. Semrush, AI Mode comparison study — https://www.semrush.com/blog/ai-mode-comparison-study/
16. ALM Corp, пересказ исследования Kevin Indig — https://almcorp.com/blog/chatgpt-citations-study-44-percent-first-third-content/
17. Growth Memo, 2026 research summary (пейвол) — https://www.growth-memo.com/p/2026-growth-memo-research-summary
18. Profound, AI platform citation patterns — https://www.tryprofound.com/blog/ai-platform-citation-patterns
19. Otterly, AI Citations Report 2026 — https://otterly.ai/blog/the-ai-citations-report-2026/
20. Otterly, YouTube AI citation study 2026 — https://otterly.ai/blog/youtube-ai-citation-study-2026/
21. Otterly, URL structure study — https://otterly.ai/blog/url-ai-citations-study/
22. SE Ranking, AI search stats — https://seranking.com/blog/ai-statistics/
23. SEJ, llms.txt shows no clear effect (300k domains) — https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/
24. SEJ, Google: llms.txt purely speculative — https://www.searchenginejournal.com/google-says-llms-txt-is-purely-speculative-for-now/577576/
25. 1ClickReport, llms.txt evidence 2026 — https://www.1clickreport.com/blog/llms-txt-evidence-2026
26. Vercel/MERJ, The rise of the AI crawler — https://vercel.com/blog/the-rise-of-the-ai-crawler
27. OpenAI, Bots documentation — https://developers.openai.com/api/docs/bots
28. Anthropic, Crawlers — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
29. Perplexity, Bots — https://docs.perplexity.ai/guides/bots
30. Cite.sh, AI crawler guide 2026 — https://www.cite.sh/blog/ai-crawler-guide/
31. Machine Relations, Content structure & citation rates — https://machinerelations.ai/research/content-structure-ai-citation-rates-2026
32. Shadow, How to measure AI share of voice — https://www.shadow.inc/resources/how-to-measure-ai-share-of-voice
33. Position Digital, ChatGPT ranking factors B2B SaaS — https://www.position.digital/blog/chatgpt-ranking-factors/
34. Quoleady, G2/Capterra & ChatGPT — https://www.quoleady.com/llmo-research/
35. Яндекс, новость 07.04.2026 — https://yandex.ru/company/news/07-04-2026-01
36. Блог Яндекс Вебмастера, Видимость в Алисе AI — https://webmaster.yandex.ru/blog/efficiency-alice
37. Справка Вебмастера, отчёт Алисы AI — https://yandex.ru/support/webmaster/ru/service/alice-answers
38. Ашманов и партнёры, обновление Алисы AI — https://www.ashmanov.com/education/articles/alisa-ai-yandeksa-menyaet-pravila-igry-obnovleniya-poiska-i-novye-instrumenty/
39. GEO Scout, Поиск с Алисой — https://geoscout.pro/ru/blog/poisk-s-alisoj-kak-rabotaet
40. Тригуб, GEO в 2026 — https://trigub.ru/geo-v-2026-godu/
41. vc.ru, GEO-оптимизация 2026 — https://vc.ru/seo/2975086-geo-optimizatsiya-dlya-biznesa
42. Habr, GEO/AEO технический гайд — https://habr.com/ru/articles/987506/
43. Optimentor, источники GigaChat — https://optimentor.ru/gigachat-istochniki/
44. Smirnov Marketing, продвижение в GigaChat — https://smirnov.marketing/prodvizhenie-v-gigachat

*Чего не нашли:* контролируемых исследований влияния блока автора на цитирование; официальных данных Яндекса о доле типов источников Алисы (только SoV-отчёт); официальной документации Сбера о GigaSearch; количественных данных по Дзену/Кью; исследований YandexGPT в поиске отдельно от Алисы AI.
