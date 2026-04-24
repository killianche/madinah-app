#!/usr/bin/env bash
# Полная перезагрузка контейнера — всегда с fresh --env-file.
# Использовать ПОСЛЕ docker load ИЛИ после любого изменения .env.production.
# docker restart НЕ подхватывает новый env — поэтому всегда stop+rm+run.
set -euo pipefail

IMAGE=${IMAGE:-madinah-web:latest}
NAME=${NAME:-madinah-web}
ENV_FILE=/opt/madinah-app/web/.env.production

echo '=== stop + rm (если есть) ==='
docker stop "$NAME" 2>/dev/null || true
docker rm "$NAME" 2>/dev/null || true

echo '=== run с fresh --env-file ==='
docker run -d --name "$NAME" --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:3000:3000 \
  "$IMAGE"

sleep 3
echo '=== статус ==='
docker ps --format '{{.Names}}: {{.Status}}' | grep "$NAME" || { echo 'контейнер не поднялся'; exit 1; }
echo '=== env внутри контейнера ==='
docker exec "$NAME" env | grep -E '^(APP_URL|TZ|NODE_ENV)='
echo '=== health ==='
curl -s -o /dev/null -w 'health:%{http_code}\n' http://localhost/api/health
