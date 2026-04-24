#!/usr/bin/env bash
# Ночной cron для Madinah App:
#  - auto_drop_stale_students: dropped после 20 дней без conducted-урока
#  - reconcile_balances: выровнять students.balance с историей
# Установка: crontab -e → `0 3 * * * bash /opt/madinah-app/deploy/nightly-cron.sh`
set -euo pipefail
source /opt/madinah-app/web/.env.production

LOG=/var/log/madinah-cron.log
exec >> "$LOG" 2>&1

echo "=== $(date -Is) ==="
psql "$DATABASE_URL" -c "select auto_drop_stale_students(20) as auto_dropped, reconcile_balances() as balances_fixed;"
