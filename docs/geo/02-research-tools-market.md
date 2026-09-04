# Что делают инструменты и агентства GEO / AI-visibility (сентябрь 2026)

*~30 поисков, ~55 прочитанных страниц: продукты, доки, обзоры, GitHub-репозитории, страницы агентств. Полные транскрипты YouTube были недоступны — использованы описания, главы и обзоры видео.*

## Ключевой вывод

Рынок сошёлся на одном ядре: набор промптов × набор LLM → регулярный опрос → парсинг ответа на упоминания бренда/конкурентов/URL → метрики visibility / share of voice / citation rate. Различия — в широте моделей, способе формирования промптов, единице тарификации и «слое действий» (аудит, рекомендации, контент, outreach).

Для российского рынка критично: Алиса AI / Поиск с Алисой (Нейро) и GigaChat — западные трекеры (Ahrefs, Semrush, Otterly) их не поддерживают. У Яндекса есть официальный отчёт в Вебмастере «Видимость сайта в Алисе AI» (с 07.04.2026).

## Функции, которые есть «у всех» (must-have)

1. Банк промптов с группировкой + AI-генерация из сайта/ниши.
2. Мультимодельный опрос по расписанию, с фиксацией поверхности (API vs веб-интерфейс, с поиском/без).
3. Хранение полного текста ответа с подсветкой упоминаний.
4. Метрики: Visibility/Mention Rate, Share of Voice, Citation Rate, средняя позиция, тональность.
5. Конкуренты (5–10) с той же метрикой.
6. Источники цитирования — какие домены/URL модель использует по нише.
7. История, динамика, алерты на падение.
8. Экспорт, минимальный AI-readiness аудит сайта (robots, llms.txt, Schema, SSR).
9. Рекомендации уровня «где вас нет, а конкуренты есть».

## Редкие / дифференцирующие функции

- Панельные данные реальных промптов (Profound, Evertune) — в РФ аналогов нет.
- Статистическое сэмплирование с доверительными интервалами (Evertune, geobench).
- Логи AI-краулеров через CDN (Profound Agent Analytics, Cloudflare: 79% AI-краулинга — обучение, 17% — поиск, 3% — действия пользователя).
- Agent Experience Platform — машиночитаемая версия страниц для агентов (Scrunch).
- Integrity / детекция галлюцинаций о бренде (AIMonitor, Visiobrand).
- Outreach-агент к издателям по найденным citation gap (Goodie).
- Citation Intelligence — связь Google-позиций с AI-видимостью (Nightwatch).
- MCP-сервер / API для агентов (Otterly, Peec, GeoScout, Keys.so).

## Единый чек-лист GEO-аудита сайта (дедуплицирован)

**Техника и доступность**: robots.txt не блокирует AI-краулеров (+ YandexAdditional для РФ); llms.txt валидный (хотя провайдеры официально не подтверждают его чтение); страницы отдают 200, SSR-контент виден без JS; HTTPS, sitemap с lastmod; логи краулеров.

**Контент**: answer-first в первых 1–2 предложениях; вопросительные заголовки; факты/статистика/цитаты; полное закрытие интента (определения, сравнения, «best/vs/pricing»); отдельные страницы под подтемы.

**Структурированные данные**: Organization/WebSite/BreadcrumbList/Article/FAQPage/HowTo/Product-Offer/Person; Wikidata-присутствие; единый NAP.

**Внешние сигналы**: страницы авторов с регалиями; присутствие в каталогах/отзовиках/картах/СМИ единообразно; YouTube с длинными видео и главами; обратный инжиниринг — в каких источниках движок уже цитирует нишу, и усиление именно там.

**Мониторинг**: банк 50–100 промптов, 3+ прогона на промпт (недетерминированность ответов), citation rate по посадочным, AI-реферальный трафик в аналитике, отчёт Вебмастера по Алисе.

## Российский рынок: сервисы и агентства

Сервисы мониторинга (Keys.so Трекер ИИ, Topvisor AI Tracker, Rush Analytics, PR-CY, Пиксель Тулс, Brandfound, Visiobrand, GeoScout, AIMonitor.pro) — почти все уже покрывают Алису и часть — GigaChat; различаются способом формирования промптов (ручной / автогенерация / персоны) и глубиной метрик (базовые mention-rate vs Integrity/детекция галлюцинаций).

Агентства (Ашманов и партнёры, Kokoc, «Агентство Ковалёвы», Megagroup, LidFly) продают связку: аудит присутствия → семантика вопросов → техфундамент → контент по Q&A → внешние публикации/отзывы → мониторинг. Цены от 45 000 ₽ (разовый аудит) до 300 000+ ₽/мес (комплексное ведение); первые упоминания — 2–4 недели, устойчивый рост — 3–6 месяцев.

«GEO-аудит» по-русски (типовая методология): 20–50 промптов по кластерам → citation rate вручную по 3–4 платформам, несколько прогонов → robots.txt/логи/llms.txt → Schema → извлекаемость фактов → E-E-A-T → внешний след → план на 30 дней.

## Что это значит для нашего агента

- Ядро — must-have выше; единица тарификации по образцу Keys.so/Rush — «проверка = промпт × модель × прогон», с явным указанием режима (API/веб, с поиском/без).
- Обязательная российская поверхность: Алиса AI (чат и Поиск), GigaChat, плюс интеграция с отчётом Вебмастера и AI-трафиком в Метрике — этого нет у западных инструментов.
- Дёшево реализуемые дифференциаторы: несколько прогонов на промпт вместо одного, evidence trail «промпт → ответ → источники → страница», разбор кого цитируют вместо нас (реализовано), 30-дневный план (реализовано).

## Источники

- https://www.datadab.com/research/profound-vs-hubspot-aeo-vs-scrunch-vs-otterly-vs-peec-vs-athenahq
- https://docs.tryprofound.com/agent-analytics/overview
- https://www.semrush.com/kb/1568-tracking-ai-visibility-and-rankings-using-ai-toolkit
- https://ahrefs.com/blog/brand-radar-methodology/
- https://ahrefs.com/academy/aeo-course
- https://nightwatch.io/ai-tracking/
- https://www.otterly.ai/
- https://scrunch.com/
- https://peec.ai/
- https://rankscale.ai/
- https://www.seranking.com/ai-visibility-tracker.html
- https://www.hubspot.com/ai-search-grader
- https://www.evertune.ai/resources/insights-on-ai/top-15-generative-engine-optimization-geo-platforms-for-2026
- https://blog.cloudflare.com/crawlers-click-ai-bots-training/
- https://help.keys.so/treker-ii
- https://www.rush-analytics.ru/land/ai-treker
- https://www.ashmanov.com/seo-prodvizhenie/generative-optimization/
- https://kokoc.com/seo-prodvijenie-saytov/v-nejrosetyah/
- https://vc.ru/marketing/2950105-prodvizhenie-v-neyrosetyakh-top-14-geo-agentstv-dlya-biznesa-v-rossii
- https://vc.ru/marketing/3055706-neyropoisk-yandeksa-kak-popast-v-otvety-alisy
- https://seo-impulse.ru/novosti/kak-sdelat-geo-audit/
- https://github.com/NomaDamas/geobench
- https://github.com/amplifying-ai/awesome-generative-engine-optimization
- https://www.youtube.com/watch?v=zHIgJPsvIW8 (Exposure Ninja — AI Visibility Pyramid)
- https://www.youtube.com/watch?v=LXdtraYM1dg, https://www.youtube.com/watch?v=uza9GX0E2mw (Ahrefs AEO course)

*Полная версия с таблицей из ~25 инструментов, ценами и цитатами роликов — в истории разработки; здесь оставлена выжимка, релевантная реализованному агенту.*
