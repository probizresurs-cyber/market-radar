# Парсер hh.ru → Google Sheets

Автономный Node-скрипт (без билда). Собирает работодателей по двум ролям —
**РОП** (руководитель отдела продаж) и **МОП** (менеджер по продажам) — по городам
России в порядке: Москва → ЦФО → СЗФО → ЮФО → Урал → Поволжье → Сибирь → ДВ.
Республики Кавказа исключены. Каждая роль пишется в свою вкладку Google-таблицы.

## Как работает

```
для каждой роли (РОП, МОП):
  для каждого города (REGION_ORDER в config.mjs):
    /vacancies?text=…&area=…   (пагинация, паузы)
      → дедуп по работодателю
      → /employers/{id}         (сайт, тип, описание)
      → отсев агентств
      → парсинг телефона с сайта компании (tel: / regex)
      → нормализация РФ-номера, отсев 8-800
      → дедуп по таблице (ссылка на hh)
      → запись во вкладку РОП / МОП
    прогресс сохраняется в state.json → можно прервать и продолжить
```

## Что важно знать (ограничения hh.ru)

- **Телефоны.** В API контакты почти всегда скрыты, поэтому телефон берётся
  парсингом сайта компании. Покрытие частичное (≈40–60%) — это потолок hh, не баг.
- **Пагинация ≤ 2000** результатов на запрос (`page*per_page`). Поэтому крошим по
  городам — иначе крупные регионы обрезаются. (`maxPages*perPage` в config ≤ 2000.)
- **Рейт-лимиты / гео-блок.** Между запросами стоят паузы (config → `SETTINGS`).
  Если hh отдаёт `403 forbidden` со всех запросов `/vacancies` (а `/areas` при этом
  работает) — это блок по IP (датацентр/не-РФ), а не ошибка кода. На VPS в Москве
  обычно ок. Иначе задай прокси `HH_PROXY` в `.env` (см. `.env.example`).

## Настройка (один раз)

1. **Зависимости** (из корня проекта):
   ```
   pnpm install
   ```
2. **Включить Google Sheets API** в Google Cloud Console (поиск → Google Sheets API → Enable).
3. **Авторизация — выбери один способ:**

   **A0) OAuth личным аккаунтом — БЕЗ gcloud и БЕЗ ключа (проще всего на localhost).**
   - OAuth consent screen (External, добавь себя в Test users) →
     Credentials → Create OAuth client ID → **Desktop app** → Download JSON →
     положить в `scripts/hh-parser/oauth-client.json`.
   - Один раз: `pnpm hh:auth` → открыть ссылку, разрешить → сохранится `token.json`.
   - В `.env` достаточно `HH_SPREADSHEET_ID`. Таблица твоя — шарить не нужно.

   Способы ниже требуют Google Cloud CLI: https://cloud.google.com/sdk/docs/install

   **A) Сервисный аккаунт БЕЗ КЛЮЧА — impersonation.**
   Работает, даже если политика `iam.disableServiceAccountKeyCreation` запрещает ключи.
   Твой аккаунт «выдаёт себя» за СА; ключ-файл не нужен.
   - Включить **IAM Service Account Credentials API** в консоли.
   - Дать своему аккаунту роль **Service Account Token Creator** на этом СА
     (Service Accounts → выбрать СА → Permissions → Grant access → твой email → роль
     `roles/iam.serviceAccountTokenCreator`).
   - В Google-таблице «Поделиться» → **Редактор** на email СА (`...@...iam.gserviceaccount.com`).
   - Залогиниться: `gcloud auth application-default login`
   - В `.env`: `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT=hh-parsesr@...iam.gserviceaccount.com`

   **B) Свой личный аккаунт через ADC (без СА вообще).**
   - `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform`
   - В `.env` НЕ указывать `GOOGLE_*` переменные СА. Доступ к таблице уже есть — шарить не нужно.

   **C) Сервисный аккаунт + ключ-файл** (только если ключи разрешены политикой).
   - Создать ключ **JSON** → `scripts/hh-parser/service-account.json` (в .gitignore).
   - В таблице «Поделиться» → **Редактор** на email СА.
   - В `.env`: `GOOGLE_SERVICE_ACCOUNT_KEY=./scripts/hh-parser/service-account.json`

4. **ENV** — в корневой `.env`:
   ```
   HH_SPREADSHEET_ID=<id из URL таблицы: .../d/ВОТ_ЭТО/edit>
   # + одна строка из выбранного способа выше (A: GOOGLE_IMPERSONATE_SERVICE_ACCOUNT, C: GOOGLE_SERVICE_ACCOUNT_KEY)
   ```
   Вкладки `РОП` и `МОП` создавать вручную не нужно — скрипт создаст их сам с шапкой.

## Запуск (localhost)

> Требуется **Node 20.6+** (флаг `--env-file`). Проверить: `node -v`.

```bash
# тестовый прогон — первые 5 городов
node --env-file=.env scripts/hh-parser/run.mjs --cities 5

# полный прогон
pnpm hh:parse

# только одна роль
node --env-file=.env scripts/hh-parser/run.mjs --role rop

# сбросить прогресс и начать заново
pnpm hh:reset
```

Можно прервать `Ctrl+C` — прогресс сохранится, следующий запуск продолжит с места.

## Запуск на VPS (PM2 / cron)

«По максимуму в день» удобно сделать так: ставим окно через `HH_MAX_MINUTES` и
дёргаем скрипт по cron раз в день — он отработает N минут с того места, где
остановился, и сохранит прогресс.

```bash
# .env:  HH_MAX_MINUTES=180

# cron (ежедневно в 03:00):
0 3 * * * cd /path/to/app && node --env-file=.env scripts/hh-parser/run.mjs >> logs/hh.log 2>&1
```

Либо разовый long-running через PM2:
```bash
pm2 start "node --env-file=.env scripts/hh-parser/run.mjs" --name hh-parser --no-autorestart
```

## Где что править

| Нужно | Файл |
|---|---|
| Поисковые запросы ролей, порядок | `config.mjs` → `ROLES`, `ROLE_ORDER` |
| Порядок округов / список регионов | `config.mjs` → `REGION_ORDER` |
| Исключения (Кавказ и т.п.) | `config.mjs` → `EXCLUDED_REGION_KEYS` |
| Паузы, лимиты, отсев агентств/8-800 | `config.mjs` → `SETTINGS` |
| Колонки таблицы | `sheets.mjs` → `COLUMNS` + `phone.mjs` → `buildRow` |
| Логика телефона | `phone.mjs` |
