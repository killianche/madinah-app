# 🔧 Troubleshooting — известные ошибки и фиксы

Лог проблем, которые встречались, и как они были решены.
Полезно для будущих сессий и отладки.

---

## 1. Container держит старый env-file после изменения

**Симптом:** Изменил `.env.production`, перезапустил `docker restart madinah-web` — изменения не применились.

**Причина:** `--env-file` читается ОДНОКРАТНО при `docker run`. `docker restart` НЕ перечитывает.

**Фикс:** Использовать `bash /opt/madinah-app/deploy/redeploy.sh` — он делает `stop + rm + run`. Никогда не использовать `docker restart` если env поменялся.

---

## 2. Сессия теряется при HTTPS через Cloudflare Flexible

**Симптом:** Залогинился — сразу выкидывает на /login.

**Причина:** В `session.ts` cookie `secure: APP_URL.startsWith("https://")`. Если APP_URL=https и пользователь зашёл через CF Flexible, серверу приходит HTTP, cookie с `Secure: true` ставится, но браузер на HTTP не отдаёт обратно.

**Фикс:** Установить `APP_URL=http://app.madinah.ru` в env-file (даже если фронт по HTTPS через CF). cookie secure=false → работает на любом протоколе. CF проксирует HTTPS → HTTP.

---

## 3. Дата показывается в UTC, а не в Moscow

**Симптом:** В Москве 25 апреля, а сайт показывает «Пятница, 24 апреля».

**Причина:** `new Date().toISOString().slice(0, 10)` возвращает UTC-дату. В UTC всё ещё 24 апреля, в Moscow уже 25.

**Фикс:** Использовать `new Date().toLocaleDateString("sv-SE")` — возвращает `YYYY-MM-DD` в **локальной** TZ. Контейнер запущен с `TZ=Europe/Moscow` env, поэтому Node даёт московское время.

Проверка внутри контейнера: `docker exec madinah-web node -e 'console.log(new Date().toString())'`

---

## 4. NS reg.ru не пропускает на Cloudflare

**Симптом:** Поменяли NS на cloudflare, но `dig madinah.ru` всё ещё возвращает `tildadns.com`.

**Причина:** Пропагация `.ru`-зоны 30 мин – 2 часа.

**Фикс:** Подождать. Для проверки:
```
dig @1.1.1.1 +short NS madinah.ru
curl -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE" | jq .result.status
```
Status должен стать `active`.

---

## 5. CF SSL Mode = Full → ошибка 521

**Симптом:** `https://app.madinah.ru` отдаёт 521 «Web server is down».

**Причина:** SSL Mode = Full (or Strict) → CF пытается подключиться к origin по HTTPS:443, у нас только HTTP:80.

**Фикс:** В Cloudflare Dashboard → SSL/TLS → Overview → выбрать **Flexible**.

Через API недоступно если у токена нет `Zone Settings: Edit`.

---

## 6. audit_log no partition for date

**Симптом:** При вставке `audit_log` за прошлую дату: `no partition of relation "audit_log" found for row`.

**Причина:** Таблица партиционирована по месяцам. По умолчанию созданы партиции 2026-04 и 2026-05.

**Фикс:** Создать партиции для всех нужных лет/месяцев:
```sql
do $$ declare y int; m int; begin
  for y in 2024..2027 loop
    for m in 1..12 loop
      execute format('create table if not exists audit_log_%s_%s partition of audit_log for values from (%L) to (%L)',
        y, lpad(m::text,2,'0'),
        make_date(y,m,1), (make_date(y,m,1)+interval '1 month')::date);
    end loop;
  end loop;
end $$;
```

---

## 7. Build падает: scheduled_date не существует

**Симптом:** При `python3 import_from_csv.py` ошибка `null value in column "scheduled_date"`.

**Причина:** В миграции 0003 добавили `scheduled_date NOT NULL` в `lessons`, но скрипт импорта не выставлял его.

**Фикс v1:** Патчить INSERT в скрипте — `scheduled_date = lesson_date`.

**Фикс v2 (применён):** Миграция 0005 удалила `scheduled_date` совсем. Концепцию «вне графика» убрали по решению пользователя.

---

## 8. Docker Desktop умер во время билда

**Симптом:** `docker buildx build` завершается с ошибкой `dial unix /Users/.../docker.sock: connect: no such file`.

**Фикс:** `open -a Docker` и подождать. Затем `until docker ps >/dev/null 2>&1; do sleep 3; done`.

---

## 9. Lock for scheduled npm/Cloudflare блокировки на TimeWeb

**Симптом:** `docker build` на сервере падает на `npm install` из registry.npmjs.org.

**Причина:** TimeWeb блокирует Cloudflare-IP исходящего трафика к Docker Hub / npm.

**Фикс:** Билдить локально на Mac, переносить готовый образ на сервер `docker save` → `scp` → `docker load`.

---

## 10. GitHub Push Protection блокирует commit с секретами

**Симптом:** `git push` отклонён с сообщением `Push cannot contain secrets` (например Cloudflare API token).

**Фикс:**
1. Удалить секрет из файла
2. `git add <file> && git commit --amend --no-edit` — заменить последний коммит
3. `git push --force-with-lease`

Если `--amend --no-edit` не подхватил изменения — сначала `git add` явно, потом amend.

---

## 11. Type error в build при splitting array элементов

**Симптом:** `Type error: Argument of type 'number | undefined' is not assignable to parameter of type 'number'`.

**Причина:** TypeScript strict обработка `[h, m] = "12:00".split(":").map(Number)` — h и m имеют тип `number | undefined`.

**Фикс:**
```ts
const parts = "12:00".split(":").map(Number);
const h = parts[0];
const m = parts[1];
if (h === undefined || m === undefined || isNaN(h) || isNaN(m)) return null;
```

---

## 12. Webpack: Identifier already declared

**Симптом:** `Module parse failed: Identifier 'Link' has already been declared`.

**Причина:** Дубликат `import Link from "next/link"` после рефакторинга.

**Фикс:** Удалить дубликат строки.

Превентивно: VSCode умеет автоматически чистить дубликаты импортов через Quick Fix.

---

## 13. Слоты расписания не отображаются в «Сегодня»

**Симптом:** Учитель добавил расписание, но «По расписанию» пусто.

**Причина:** `student_schedules.weekday` сохранён в UTC-day, не в Moscow-day. На границе суток разойдётся.

**Фикс:** В Python-скрипте seed_today.py использовать `date.today().isoweekday()` от Moscow-времени, не UTC. Если сервер в UTC — добавить +3 часа или использовать contained python с `TZ=Europe/Moscow`.

В коде агенды `extract(isodow from p_date)::smallint` — это локальная дата (которую пришёл аргумент функции), всё нормально.

---

## 14. Push-protection блокирует CF token в публичном репо

**Симптом:** GitHub Secret Scanning детектирует `cfut_*` token и блокирует push.

**Фикс:** Не записывать CF token в файлы, которые идут в git. Хранить только в `.env.local` или `.claude/settings.json` (gitignored).

---

## 15. «Application error: a client-side exception»

**Симптом:** Открывается белая страница с этим сообщением.

**Причина:** Runtime error в React-компоненте, ловится Error Boundary. Чаще всего — undefined access (`obj.field` где obj=null).

**Фикс:**
1. `docker logs madinah-web --tail 50` — серверные ошибки
2. Открыть DevTools Console в браузере — точное место ошибки
3. Добавить optional-chaining `?.` или null-guards

---

## 16. Тестовые слоты на UTC-день вместо Moscow-день

**Симптом:** Создал тест-данные с `date.today()` через python на UTC-сервере — слоты на пятницу, а в Moscow уже суббота.

**Фикс:** Перед `update student_schedules set weekday = X` нужно использовать Moscow-день. Можно через container python (он с TZ=Moscow):
```bash
docker exec madinah-web node -e 'console.log(new Date().getDay())'
```
Или хардкодить нужный weekday.

---

## 📌 Полезные команды

```bash
# Health check
curl -s http://localhost/api/health

# DNS
dig @1.1.1.1 +short app.madinah.ru
dig @1.1.1.1 +short NS madinah.ru

# Container
docker ps
docker logs madinah-web --tail 50
docker exec madinah-web env | grep -E '(APP_URL|TZ|NODE_ENV)'

# Deploy fresh env
bash /opt/madinah-app/deploy/redeploy.sh

# Cleanup test data
bash /opt/madinah-app/deploy/cleanup-test-data.sh

# Cron functions test
psql "$DATABASE_URL" -c "select auto_drop_stale_students(20), reconcile_balances();"
```
