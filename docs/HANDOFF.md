# 🚀 Madinah App — handoff для следующей сессии

**Состояние: v9 в проде (после последнего commit/deploy). Пилот готов.**

## 🌐 Доступы

- **URL HTTPS:** https://app.madinah.ru (через Cloudflare, Flexible SSL)
- **URL HTTP fallback:** http://app.72-56-15-189.nip.io
- **SSH:** `ssh root@72.56.15.189`
- **БД DSN:** `/opt/madinah-app/web/.env.production`
- **GitHub:** https://github.com/killianche/madinah-app
- **Cloudflare API token:** спросить у пользователя (zone `ffd5a875064a997f1eea0d0cd4bfc16b`)
- **Admin логин:** phone `+79999999999` или email `pmrhhm@gmail.com`, пароль `6d0HRtjysBe1E`
- **Все 41 логин:** файл `accounts.csv` на Desktop

## 🏗 Архитектура

- **Web:** Next.js 15 App Router + React 19 + TypeScript strict + Tailwind + Anthropic design tokens
- **БД:** managed Postgres 16 (Moscow), DSN в env-file
- **Auth:** свои сессии (argon2id + SHA-256 токенов, cookie 30 дней)
- **Роли:** admin / director / manager / curator / head / teacher
- **Docker:** образ `madinah-web:latest`, контейнер `madinah-web` на :3000, Caddy :80
- **TZ:** `Europe/Moscow` в env-file и в контейнере
- **Cloudflare:** proxy + Flexible SSL, NS на reg.ru = aitana/valentin.ns.cloudflare.com

## 🔁 Деплой

1. Редактируй локально в `/tmp/madinah-app`
2. Коммит в GitHub
3. Build: `docker buildx build --platform linux/amd64 --load -t madinah-web:latest /tmp/madinah-app/web`
4. `docker save madinah-web:latest -o /tmp/madinah-web.tar`
5. `scp /tmp/madinah-web.tar root@72.56.15.189:/tmp/`
6. `ssh root@72.56.15.189 "docker load -i /tmp/madinah-web.tar && bash /opt/madinah-app/deploy/redeploy.sh"`

**Критично:** `redeploy.sh` делает `stop + rm + run` — НЕ restart. Иначе контейнер держит старый env-file.

## 🗄 Миграции

- 0001 — init (6 таблиц + audit_log партиционирован)
- 0002 — sessions
- 0003 — student_schedules + scheduled_date (потом удалено в 0005)
- 0004 — v_student_teacher_stats (разбивка уроков по учителям)
- 0005 — статусы graduated/dropped + drop scheduled_*
- 0006 — v_student_attention (серая зона)
- 0007 — роль `head`
- 0008 — v_student_attention v2 (+ graduated, skipping=penalty/cancelled_by_student)
- 0009 — auto_drop_stale_students() + reconcile_balances()

## 📊 Данные

- **69 учителей** (32 active + 37 archived)
- **~2020 учеников** (650 active + 680 graduated + 688 dropped + ~2 archived)
- **39 475 уроков** импортированы из CSV
- **Балансы** синхронизированы с CSV «Ученики» (2025 синков, 1032 пополнений)
- **Тестовые:** Лейла Тестова, ТЕСТ Иван, Хамза, Омар, Иван, Марьям, Абдулла, Алим (paused), Рашид (graduated), Заира (dropped)
- **Очистка тестовых:** `bash /opt/madinah-app/deploy/cleanup-test-data.sh`

## 📋 Функционал (см. `docs/FEATURES_STATUS.md`)

**Semantics lessons:**
- `conducted` + `penalty` → списывают 1 с баланса (урок сгорает)
- `cancelled_by_student` + `cancelled_by_teacher` → баланс НЕ трогаем
- Везде где «провёл N» → также показываем «штраф M»

**Серая зона:**
- Вычисляется в `v_student_attention`, не сохраняется в БД
- `stale`: active + 10+ дней без `conducted`
- `skipping`: active + 3 подряд в (`penalty`, `cancelled_by_student`)
- UI: chip «Серая зона» заменяет «Обучается» на карточке

**Семантика статусов ученика:**
- active / paused (отпуск) / graduated (выпускник) / dropped / archived
- Авто-dropped через 20 дней без conducted (cron 03:00 MSK)

## 🎨 Дизайн

- **Палитра:** parchment `#f5f4ed`, ivory `#faf9f5`, terracotta `#c96442`, moss `#3f6b3d` (conducted), crimson `#b53333` (penalty), amber (отмены)
- **Типографика:** SERIF (Georgia fallback) для заголовков/чисел, SANS (system) для UI
- **BottomNav 5 табов** с центральным FAB [+]
- Teacher: Сегодня / Ученики / [+ Урок] / Статистика / Профиль
- Manager: Ученики / Внимание / [+ Ученик] / Проблемные / Профиль
- **Тёмная тема** — toggle в профиле, persist в localStorage, класс `html.dark`

## 🔧 Ежедневный cron (03:00 MSK)

`/opt/madinah-app/deploy/nightly-cron.sh` вызывает:
- `auto_drop_stale_students(20)` — dropped тем, у кого 20+ дней без conducted
- `reconcile_balances()` — выравнивает students.balance

Логи: `/var/log/madinah-cron.log`

## ❌ Отвергнуто (не делать):

- Групповые уроки, домашка, оценка урока
- Копия прошлого урока, шаблоны
- Редактирование уроков задним числом
- Массовая отметка
- Кнопка «Написать в Telegram», копирование номера, именинники
- Дашборд директора / аналитика школы (отложено)

## ⚠️ Известные баги/ограничения

- Session cookie: при HTTPS через Cloudflare Flexible — secure=false в env
- Client-side errors очень редки; если «Application error» — чек logs `docker logs madinah-web`
- Ограничение картинок в сессии Claude: скриншоты >2000px блокируются. Пользователь не любит когда я спрашиваю скриншоты.

## 📜 Правила работы

Из `CLAUDE.md`:
- Русский язык в общении
- Английский в коде/коммитах
- Без эмодзи в UI и коде (только в доках)
- Terse-стиль ответа, ≤ 100 слов
- Подтверждение НЕ требуется для: docker/ssh/git/etc (есть bypass-permissions)
- `redeploy.sh` — всегда, не restart
