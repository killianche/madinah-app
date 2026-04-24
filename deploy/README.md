# Развёртывание на TimeWeb VPS

## Предварительно

- [ ] Куплен VPS Ubuntu 24.04 (Москва), IP известен
- [ ] Куплен managed PostgreSQL 16 (Москва), DSN известен
- [ ] В reg.ru добавлена A-запись: `app` → `<IP VPS>`
- [ ] На VPS добавлен SSH-ключ разработчика (`~/.ssh/id_ed25519.pub`)

## Первичная настройка сервера (одноразово)

```bash
ssh root@<IP>

# базовые вещи
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin caddy git ufw

# файрвол
ufw allow 22,80,443/tcp
ufw --force enable

# пользователь под приложение
useradd -m -s /bin/bash madinah
usermod -aG docker madinah
```

## Деплой приложения

```bash
# под пользователем madinah
sudo -u madinah -i
cd /home/madinah

# клон репо (нужен deploy key или прокинуть токен)
git clone https://github.com/killianche/madinah-app.git app
cd app

# .env
cat > web/.env <<EOF
DATABASE_URL=postgres://user:pwd@managed-postgres-host:5432/madinah
APP_URL=https://app.madinah.ru
SESSION_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF

# прокат миграций
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -f db/migrations/0002_sessions.sql

# импорт истории (ОДНОКРАТНО!)
pip install 'psycopg[binary]>=3.1'
python3 scripts/import_from_csv.py \
  --csv /home/madinah/journal.csv \
  --dsn "$DATABASE_URL"

# сборка и запуск Docker
cd web
docker build -t madinah-web .
docker run -d \
  --name madinah-web \
  --restart unless-stopped \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  madinah-web
```

## Caddy

```bash
# как root
cp /home/madinah/app/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

Через 30 секунд https://app.madinah.ru должен отдавать приложение с валидным сертификатом.

## Создание первого админа

У нас в БД нет пользователей. Создаём руками через psql:

```bash
# генерируем argon2id хэш пароля
docker run --rm -v $(pwd):/app -w /app node:22-alpine sh -c "
  npm init -y >/dev/null 2>&1
  npm install @node-rs/argon2 >/dev/null 2>&1
  node -e \"
    const { hash } = require('@node-rs/argon2');
    hash(process.argv[1], { memoryCost: 19456, timeCost: 2 }).then(h => console.log(h));
  \" 'mySecurePassword123'
"

# вставляем в БД
psql "$DATABASE_URL" <<SQL
insert into users (role, full_name, phone, password_hash, is_active)
values ('admin', 'Руслан Чербижев', '+79990000000', '<argon2-hash-сверху>', true);
SQL
```

После этого логинимся на https://app.madinah.ru под этим телефоном + паролем, и всех остальных создаём уже через UI.

## Обновления

```bash
cd /home/madinah/app
git pull
cd web
docker build -t madinah-web .
docker stop madinah-web && docker rm madinah-web
docker run -d --name madinah-web --restart unless-stopped --env-file .env -p 127.0.0.1:3000:3000 madinah-web
```

## Бэкапы

Managed Postgres делает автобэкапы (7 дней по умолчанию). Если нужен локальный дубликат:

```bash
# cron: 0 3 * * *
pg_dump "$DATABASE_URL" | gzip > /home/madinah/backups/madinah-$(date +\%F).sql.gz
find /home/madinah/backups -name "madinah-*.sql.gz" -mtime +30 -delete
```

## Мониторинг

- **UptimeRobot** — пинг `https://app.madinah.ru/api/health` каждые 5 минут
- **Sentry** (опционально) — прописать DSN в `.env` и инициализировать в `instrumentation.ts`
