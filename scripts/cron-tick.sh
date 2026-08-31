#!/bin/bash
# Периодические задачи market-radar: дожим лида и ТГ-прогрев.
#
# Живёт в репозитории, а не в самом crontab, по одной причине: строка crontab
# с заголовком, кавычками и подстановкой секрета не переживает передачу через
# ssh из PowerShell — кавычки съедаются, и cron получает мусор («bad hour»).
# Здесь же кавычки под контролем, а в crontab остаётся одна простая строка:
#
#   5 * * * * /bin/bash /var/www/market-radar/scripts/cron-tick.sh
#
# Секрет читается из .env.local — того же файла, что и приложение, поэтому
# ротация ключа не требует правки расписания.
set -u

APP_DIR="/var/www/market-radar"
SITE="https://marketradar24.ru"
LOG="/var/log/mr-cron.log"

# .env.local приоритетнее .env — тот же порядок, что у Next.
SECRET=""
for f in "$APP_DIR/.env.local" "$APP_DIR/.env"; do
  if [ -f "$f" ]; then
    v="$(grep -m1 '^CRON_SECRET=' "$f" | cut -d= -f2- | tr -d '\r\n\"')"
    if [ -n "$v" ]; then SECRET="$v"; break; fi
  fi
done

if [ -z "$SECRET" ]; then
  echo "$(date -Is) CRON_SECRET не найден — задачи пропущены" >> "$LOG" 2>/dev/null
  exit 1
fi

run() {
  # Пишем только код ответа: тело нам не нужно, а лог не должен пухнуть.
  code="$(curl -fsS -o /dev/null -w '%{http_code}' \
    -H "x-cron-secret: $SECRET" "$SITE/api/cron/$1" 2>/dev/null || echo 000)"
  echo "$(date -Is) $1 -> $code" >> "$LOG" 2>/dev/null
}

run "lead-followups"
run "kp-tg-warm"
