#!/usr/bin/env bash
# Madinah App — деплой приложения после того, как настроена инфраструктура и БД.
# Запуск: bash /opt/madinah-app/deploy/deploy.sh
# Предварительно:
#   1. setup.sh выполнен
#   2. Managed Postgres создан в TimeWeb, строка подключения прописана в
#      /opt/madinah-app/web/.env.production

set -euo pipefail

log()  { printf "\033[36m==>\033[0m %s\n" "$*"; }
ok()   { printf "\033[32m ✓ \033[0m %s\n" "$*"; }
warn() { printf "\033[33m ! \033[0m %s\n" "$*"; }
err()  { printf "\033[31m ✗ \033[0m %s\n" "$*" >&2; }

APP_DIR="/opt/madinah-app"
ENV_FILE="${APP_DIR}/web/.env.production"
MIGRATIONS_DIR="${APP_DIR}/db/migrations"
COMPOSE_FILE="${APP_DIR}/deploy/docker-compose.prod.yml"

cd "$APP_DIR"

# ============================================================
# 0. Sanity checks
# ============================================================
if [[ ! -f "$ENV_FILE" ]]; then
  err "Нет $ENV_FILE — запусти сначала setup.sh"
  exit 1
fi

if grep -q "REPLACE_ME" "$ENV_FILE"; then
  err "В $ENV_FILE осталась заглушка REPLACE_ME — сначала пропиши DATABASE_URL"
  err "Открой файл: nano $ENV_FILE"
  exit 1
fi

# Экспортируем переменные из .env для psql
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  err "DATABASE_URL не определён"
  exit 1
fi

# ============================================================
# 1. Проверка связи с БД
# ============================================================
log "Проверяю соединение с Postgres"
# Выделим host:port из DSN для pg_isready (universally)
DB_HOST="$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/?]+).*|\1|')"
DB_PORT="$(echo "$DATABASE_URL" | sed -E 's|.*@[^:/?]+:?([0-9]*).*|\1|')"
DB_PORT="${DB_PORT:-5432}"

for i in {1..10}; do
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    ok "Postgres отвечает на $DB_HOST:$DB_PORT"
    break
  fi
  if [[ $i -eq 10 ]]; then
    err "Postgres не отвечает на $DB_HOST:$DB_PORT после 10 попыток"
    err "Проверь: 1) приватная сеть (ip -4 addr show | grep 192.168),"
    err "          2) firewall БД в TimeWeb разрешает доступ с VPS,"
    err "          3) DSN в .env корректный"
    exit 1
  fi
  sleep 2
done

# ============================================================
# 2. Миграции (идемпотентно — CREATE IF NOT EXISTS)
# ============================================================
log "Применяю миграции"
for migration in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$migration")"
  printf "   → %s ... " "$name"
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$migration" >/tmp/migrate.log 2>&1; then
    printf "ok\n"
  else
    printf "FAIL\n"
    err "Миграция $name упала. Лог:"
    cat /tmp/migrate.log
    # Если миграция уже была применена — это нормально, продолжаем
    if grep -q "already exists" /tmp/migrate.log; then
      warn "похоже, уже применена — продолжаю"
    else
      exit 1
    fi
  fi
done
ok "Миграции применены"

# ============================================================
# 3. Сборка образа
# ============================================================
log "Собираю Docker-образ (это может занять пару минут)"
docker compose -f "$COMPOSE_FILE" build web
ok "Образ madinah-web собран"

# ============================================================
# 4. Запуск контейнера
# ============================================================
log "Поднимаю контейнер"
docker compose -f "$COMPOSE_FILE" up -d web

# Ждём, пока healthcheck станет healthy
log "Жду готовности приложения"
for i in {1..20}; do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    ok "Приложение отвечает на localhost:3000"
    break
  fi
  if [[ $i -eq 20 ]]; then
    err "Приложение не ответило за 40 секунд"
    err "Логи: docker logs madinah-web --tail 100"
    exit 1
  fi
  sleep 2
done

# ============================================================
# 5. Перезагружаем Caddy
# ============================================================
log "Перезагружаю Caddy"
if systemctl is-active --quiet caddy; then
  systemctl reload caddy
else
  systemctl start caddy
fi
ok "Caddy активен"

# ============================================================
# 6. Итог
# ============================================================
echo
echo "============================================"
echo "  Деплой готов."
echo "============================================"
echo
echo "Приложение:   https://app.madinah.ru"
echo "Локально:     http://127.0.0.1:3000/api/health"
echo
echo "Логи:        docker logs -f madinah-web"
echo "Рестарт:     docker compose -f ${COMPOSE_FILE} restart web"
echo "Caddy:       journalctl -u caddy -f"
echo
echo "Осталось:"
echo "  - DNS A-запись app.madinah.ru -> $(curl -s -4 ifconfig.me || echo '<IP VPS>')"
echo "  - Создать первого admin: bash ${APP_DIR}/deploy/create-admin.sh"
echo
