#!/usr/bin/env bash
# Madinah App — первичная настройка свежего Ubuntu 24.04 VPS.
# Запуск: curl -fsSL https://raw.githubusercontent.com/killianche/madinah-app/main/deploy/setup.sh | bash
# Идемпотентный — можно запускать повторно.

set -euo pipefail

log() { printf "\033[36m==>\033[0m %s\n" "$*"; }
ok()  { printf "\033[32m ✓ \033[0m %s\n" "$*"; }
warn(){ printf "\033[33m ! \033[0m %s\n" "$*"; }

APP_DIR="/opt/madinah-app"
REPO_URL="https://github.com/killianche/madinah-app.git"
ENV_FILE="${APP_DIR}/web/.env.production"

if [[ $EUID -ne 0 ]]; then
  echo "Запускай от root (или через sudo)." >&2
  exit 1
fi

# ============================================================
# 1. Системные обновления
# ============================================================
log "Обновляю систему"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq \
  -o Dpkg::Options::="--force-confdef" \
  -o Dpkg::Options::="--force-confold"
ok "Система обновлена"

# ============================================================
# 2. Базовые пакеты
# ============================================================
log "Устанавливаю пакеты (docker, caddy, git, ufw, fail2ban, postgresql-client, ...)"

# caddy ставится из официального apt-репозитория
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg ca-certificates
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
fi

apt-get install -y -qq \
  docker.io docker-compose-v2 \
  caddy \
  git ufw fail2ban \
  curl jq openssl \
  postgresql-client-16 \
  python3 python3-pip python3-venv

ok "Пакеты установлены"

# ============================================================
# 3. Docker
# ============================================================
log "Включаю Docker"
systemctl enable --now docker
ok "Docker запущен: $(docker --version)"

# ============================================================
# 4. Firewall (UFW)
# Разрешаем только SSH, HTTP, HTTPS. Внутренняя сеть Postgres
# (192.168.0.0/24) работает через отдельный интерфейс, ufw её не режет.
# ============================================================
log "Настраиваю firewall"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'SSH'
ufw allow 80/tcp  comment 'HTTP (Caddy)'
ufw allow 443/tcp comment 'HTTPS (Caddy)'
# внутренний трафик 192.168.0.0/24 (managed Postgres)
ufw allow from 192.168.0.0/24 comment 'private network'
ufw --force enable >/dev/null
ok "UFW: $(ufw status | head -n1)"

# ============================================================
# 5. fail2ban (защита SSH от брутфорса)
# ============================================================
log "Включаю fail2ban"
systemctl enable --now fail2ban
ok "fail2ban активен"

# ============================================================
# 6. Отключаем парольный SSH (ты уже зашёл по ключу)
# Делаем это ПОСЛЕ того, как убедились в работе ключа — если
# SSH-сессия жива сейчас, значит ключ работает.
# ============================================================
log "Отключаю парольный SSH"
SSHD_CONFIG="/etc/ssh/sshd_config.d/99-madinah.conf"
cat > "$SSHD_CONFIG" <<'EOF'
# Managed by Madinah setup.sh
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
chmod 600 "$SSHD_CONFIG"
systemctl reload ssh
ok "Парольный SSH отключён (доступ только по ключу)"

# ============================================================
# 7. Клонирование репо
# ============================================================
if [[ -d "$APP_DIR/.git" ]]; then
  log "Обновляю репозиторий в $APP_DIR"
  git -C "$APP_DIR" pull --ff-only
else
  log "Клонирую репозиторий в $APP_DIR"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
ok "Репо: $(cd "$APP_DIR" && git log -1 --format='%h %s')"

# ============================================================
# 8. Шаблон .env.production
# SESSION_SECRET генерим сразу, DATABASE_URL оставляем заглушкой
# — пользователь подставит после создания Postgres.
# ============================================================
if [[ ! -f "$ENV_FILE" ]]; then
  log "Создаю .env.production"
  SESSION_SECRET="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
# Заполни DATABASE_URL после создания managed Postgres в TimeWeb.
# Формат: postgresql://user:password@192.168.0.4:5432/default_db
DATABASE_URL=postgresql://REPLACE_ME@192.168.0.4:5432/REPLACE_ME

APP_URL=https://app.madinah.ru
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
EOF
  chmod 600 "$ENV_FILE"
  ok ".env.production создан, SESSION_SECRET сгенерирован"
else
  ok ".env.production уже существует, не трогаю"
fi

# ============================================================
# 9. Подготовка Caddy
# ============================================================
log "Настраиваю Caddy"
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl enable caddy
# reload только если уже запущен; иначе просто enable — стартанём позже
if systemctl is-active --quiet caddy; then
  systemctl reload caddy
fi
ok "Caddyfile установлен"

# ============================================================
# 10. Итог
# ============================================================
echo
echo "============================================"
echo "  Инфраструктура готова."
echo "============================================"
echo
echo "Следующие шаги:"
echo "  1. Дождись, пока managed Postgres создастся в TimeWeb."
echo "  2. Пропиши строку подключения в:"
echo "     ${ENV_FILE}"
echo "     (заменить строку DATABASE_URL)"
echo "  3. Добавь в reg.ru DNS A-запись:  app.madinah.ru -> $(curl -s -4 ifconfig.me || echo '<IP VPS>')"
echo "  4. Запусти деплой:"
echo "     bash ${APP_DIR}/deploy/deploy.sh"
echo
