#!/usr/bin/env bash
# Бэкап боевой базы (db.json + загруженные файлы) с ротацией старых копий.
#
# Использование на сервере:
#   ./scripts/backup-db.sh              # разовый бэкап прямо сейчас
#
# Ежедневный автоматический бэкап — добавь в crontab на сервере (crontab -e):
#   0 3 * * * cd /путь/к/проекту && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Бэкапы кладутся в backups/ рядом с проектом (в git не попадают, см. .gitignore)
# и хранятся 30 дней, старые удаляются автоматически.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f db.json ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ОШИБКА: db.json не найден в $(pwd) — нечего бэкапить" >&2
  exit 1
fi

mkdir -p backups
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"

cp db.json "backups/db_${STAMP}.json"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: backups/db_${STAMP}.json"

if [ -d uploads ]; then
  tar -czf "backups/uploads_${STAMP}.tar.gz" uploads
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: backups/uploads_${STAMP}.tar.gz"
fi

# Ротация: хранить бэкапы за последние 30 дней
find backups -maxdepth 1 -name 'db_*.json' -mtime +30 -delete
find backups -maxdepth 1 -name 'uploads_*.tar.gz' -mtime +30 -delete
