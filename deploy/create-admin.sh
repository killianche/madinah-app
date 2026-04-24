#!/usr/bin/env bash
# Создаёт первого admin-пользователя в БД.
# Запуск: bash /opt/madinah-app/deploy/create-admin.sh
# Работает только когда setup.sh и deploy.sh уже выполнены.

set -euo pipefail

APP_DIR="/opt/madinah-app"
ENV_FILE="${APP_DIR}/web/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE — запусти сначала setup.sh" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "=== Создание первого admin ==="
read -rp "ФИО (например «Руслан Чербижев»): " FULL_NAME
read -rp "Телефон (для входа, например +79990001122): " PHONE
read -rp "Email: " EMAIL
read -rsp "Пароль (минимум 8 символов, никому не показывай): " PASSWORD
echo
read -rsp "Повтори пароль: " PASSWORD2
echo

if [[ "$PASSWORD" != "$PASSWORD2" ]]; then
  echo "Пароли не совпали." >&2
  exit 1
fi

if [[ ${#PASSWORD} -lt 8 ]]; then
  echo "Пароль слишком короткий (минимум 8)." >&2
  exit 1
fi

echo
echo "→ Хэширую пароль через argon2id внутри контейнера…"

# Используем уже собранный образ madinah-web — в нём есть @node-rs/argon2
HASH="$(docker run --rm --entrypoint node madinah-web:latest -e "
  const { hash } = require('@node-rs/argon2');
  hash(process.argv[1], { memoryCost: 19456, timeCost: 2, parallelism: 1 }).then(h => process.stdout.write(h));
" "$PASSWORD")"

if [[ -z "$HASH" ]]; then
  echo "Не удалось получить хэш пароля." >&2
  exit 1
fi

echo "→ Вставляю запись в users…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v full_name="$FULL_NAME" \
  -v phone="$PHONE" \
  -v email="$EMAIL" \
  -v hash="$HASH" <<'SQL'
insert into users (role, full_name, phone, email, password_hash, is_active)
values ('admin', :'full_name', :'phone', :'email', :'hash', true)
on conflict (phone) do update
  set password_hash = excluded.password_hash,
      full_name     = excluded.full_name,
      email         = excluded.email,
      is_active     = true;
SQL

echo
echo "✓ Admin создан/обновлён."
echo "  Телефон: $PHONE"
echo "  Логинься на https://app.madinah.ru"
echo
