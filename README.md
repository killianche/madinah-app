# Madinah App

Веб-приложение журнала уроков арабской школы. Замена Telegram-бота `@taubalessbot` (Madinah Journal) на нативный мобильный веб — под блокировки Telegram в РФ и требования 152-ФЗ.

- **Домен:** `app.madinah.ru` (поддомен существующего `madinah.ru`)
- **Стек:** Next.js 15 + TypeScript + PostgreSQL 16 + Tailwind + Lucia Auth
- **Хостинг:** TimeWeb Cloud (Москва), managed Postgres
- **Дизайн:** Claude / Anthropic (parchment, terracotta, Anthropic Serif)

---

## Документы

| Документ | О чём |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | План разработки: этапы, MVP/V2/V3, сроки |
| [`docs/TEACHERS.md`](docs/TEACHERS.md) | Список учителей (активных + архивных) |
| [`docs/JOURNAL.md`](docs/JOURNAL.md) | Анализ исторического журнала, статистика, структура |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Ключевые решения: почему Next.js, почему не Supabase, и т.д. |
| [`INFRA.md`](INFRA.md) | Чек-лист покупки инфраструктуры (VPS + Postgres) |
| [`db/migrations/0001_init.sql`](db/migrations/0001_init.sql) | Схема БД |
| [`scripts/import_from_csv.py`](scripts/import_from_csv.py) | Импорт из CSV журнала |
| [`config/active_teachers.json`](config/active_teachers.json) | Список активных учителей для импорта |

---

## Локальный запуск (разработка)

```bash
# 1. Postgres в Docker
docker compose up -d db

# 2. Накатить миграции
psql postgres://madinah:madinah@localhost:5433/madinah -f db/migrations/0001_init.sql

# 3. Прогнать dry-run импорта (проверка без записи)
python3 scripts/import_from_csv.py \
  --csv "/путь/к/журнал.csv" \
  --dry-run

# 4. Реальный импорт в локальную базу
python3 scripts/import_from_csv.py \
  --csv "/путь/к/журнал.csv" \
  --dsn postgres://madinah:madinah@localhost:5433/madinah

# 5. Фронт (в другом терминале)
cd web
npm install
npm run dev
# → http://localhost:3000
```

---

## Статус

На 2026-04-24 **(сессия автономной разработки)**:
- ✅ Схема БД готова (6 таблиц, RLS план, audit_log партиционирован)
- ✅ Скрипт импорта проверен на 39 475 уроков (dry-run, 0 потерянных строк)
- ✅ Список 32 активных учителей зафиксирован
- ✅ Репозиторий создан: `killianche/madinah-app` (private)
- 🚧 Next.js приложение — строится
- ⏳ VPS + managed Postgres на TimeWeb — ожидает покупки владельцем
- ⏳ DNS app.madinah.ru — ожидает настройки после покупки VPS
- ⏳ Пилот на 5-10 учителях — после всего выше
