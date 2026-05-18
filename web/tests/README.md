# Тесты

## Что есть

- **vitest** — runner для unit-тестов.
- **testcontainers/postgresql** — поднимает свежий Postgres 16 в Docker перед прогоном.
- Миграции применяются автоматически из `db/migrations/*.sql`.

## Структура

```
tests/
├── setup.ts          # глобальный bootstrap: контейнер + миграции
├── helpers.ts        # resetDb(), seed() — посеять минимальный набор
├── lib/              # pure-функции (валидаторы, форматтеры, политики)
└── repos/            # функции из src/lib/repos/*, требуют БД
```

## Запуск

```
cd web
npm install              # установит vitest + testcontainers
npm test                 # прогон один раз
npm run test:watch       # вотчер
```

Перед первым прогоном Docker должен быть запущен. Контейнер живёт всё время прогона.

## Что покрыто сейчас

- `assertTeacherOwnsStudent` / `assertTeacherOwnsLesson` — основной P0-кейс
  (учитель A не может трогать ученика/урок учителя B).
- `canTransitionStudentStatus` — политика терминальных переходов.
- `normalizePhone` — нормализация телефонов.
- `toCSV` — экранирование и BOM.

## Чего не хватает

- Тесты на `createLessonAction` и пр. server actions. Они используют
  `next/headers` — потребуется мок auth-сессии. Можно через моки `@/lib/auth/session`,
  но мок server actions пока сложно из-за RSC.
- Reconcile-сценарии (E2E через `applyReconcile`).
- Snapshot-тесты на UI (можно playwright если нужно).
