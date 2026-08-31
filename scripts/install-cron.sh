#!/bin/bash
# Ставит расписание задач market-radar. Запускать так:
#   ssh -n maria@72.56.241.159 bash /var/www/market-radar/scripts/install-cron.sh
#
# Зачем отдельный скрипт: строку crontab не удаётся передать через
# PowerShell → ssh → bash. PowerShell вырезает двойные кавычки внутри
# аргумента нативной команды, до сервера доезжает мусор вида
# `-H " x-cron-secret: \\`, и crontab отвечает «bad hour». Здесь кавычек в
# передаваемой команде нет вовсе — только путь к файлу.
#
# Скрипт идемпотентный: сначала выбрасывает все наши прошлые записи (включая
# обломки неудачных попыток), потом ставит одну рабочую.
set -u

TMP="$(mktemp)"
KEEP="$(mktemp)"

crontab -l 2>/dev/null > "$TMP" || true

# Выбрасываем всё своё: и текущую строку, и обломки прежних попыток.
grep -v 'lead-followups' "$TMP" \
  | grep -v 'kp-tg-warm' \
  | grep -v 'cron-tick' \
  > "$KEEP" || true

# Оставляем только то, что похоже на настоящую запись cron: комментарий,
# присвоение переменной или строку, начинающуюся с минуты. Разорванные
# хвосты прошлых попыток так отсеиваются — именно они ломали установку.
grep -E '^[[:space:]]*(#|[0-9*]|[A-Za-z_]+=)' "$KEEP" > "$TMP" || true

echo '5 * * * * /bin/bash /var/www/market-radar/scripts/cron-tick.sh' >> "$TMP"

if crontab "$TMP" < /dev/null; then
  echo "Расписание установлено:"
  crontab -l
else
  echo "Не удалось установить. Текущее расписание не изменено." >&2
  exit 1
fi

rm -f "$TMP" "$KEEP"
