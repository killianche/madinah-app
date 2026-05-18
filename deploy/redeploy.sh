#!/usr/bin/env bash
set -euo pipefail
IMAGE=${IMAGE:-madinah-web:latest}
NAME=${NAME:-madinah-web}
ENV_FILE=/opt/madinah-app/web/.env.production

echo "=== stop + rm ==="
docker stop "$NAME" 2>/dev/null || true
docker rm "$NAME" 2>/dev/null || true

echo "=== run ==="
docker run -d --name "$NAME" --restart unless-stopped   --network host   --env-file "$ENV_FILE"   "$IMAGE"

sleep 4
echo "=== status ==="
docker ps --format "{{.Names}}: {{.Status}}" | grep "$NAME" || { echo no; exit 1; }
echo "=== health ==="
curl -s -o /dev/null -w "health:%{http_code}\n" http://localhost:3000/api/health
