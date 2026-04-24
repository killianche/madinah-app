#!/usr/bin/env python3
"""
Madinah App — импорт истории уроков из CSV журнала в PostgreSQL.

Использование:
    python3 import_from_csv.py --csv path/to/journal.csv --dsn postgres://... [--dry-run]

Логика:
    1. Читает CSV журнала (39 475+ записей).
    2. Собирает уникальных учителей (по UUID из журнала). Для каждого:
       - Если имя в config/active_teachers.json → status=active, UUID из журнала сохраняется.
       - Иначе → status=archived, UUID сохраняется.
    3. Собирает уникальных учеников.
       - Основной ключ — UUID из журнала.
       - Для строк без UUID ученика (их ~1284): ищем по имени среди уже известных;
         если не нашли — создаём нового с синтетическим UUID.
       - is_charity=false у всех (проставят менеджеры после запуска).
    4. Вставляет 39 475+ уроков с новыми UUID. Соответствие статусов:
       проведен → conducted, штрафной → penalty,
       отменен_учителем → cancelled_by_teacher, отменен_учеником → cancelled_by_student.
    5. Печатает подробный отчёт. При --dry-run — НЕ пишет в БД.

Требования: Python 3.11+, psycopg[binary]>=3.1
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Optional

# psycopg импортируем лениво — dry-run работает и без него
psycopg = None  # type: ignore


def _load_psycopg():
    global psycopg
    if psycopg is None:
        try:
            import psycopg as _p  # type: ignore
            psycopg = _p
        except ImportError:
            print("ERR: нужен psycopg[binary]. Установи: pip install 'psycopg[binary]>=3.1'", file=sys.stderr)
            sys.exit(1)


STATUS_MAP = {
    "проведен": "conducted",
    "штрафной": "penalty",
    "отменен_учителем": "cancelled_by_teacher",
    "отменен_учеником": "cancelled_by_student",
}


@dataclass
class TeacherRecord:
    id: str           # UUID (из журнала)
    name: str
    last_lesson: Optional[date] = None
    first_lesson: Optional[date] = None
    lesson_count: int = 0
    status: str = "archived"  # active | archived — вычисляется позже


@dataclass
class StudentRecord:
    id: str
    name: str
    lesson_count: int = 0
    teacher_ids_seen: set[str] = field(default_factory=set)
    # из какого имени мы этот UUID взяли (для диагностики дубликатов)
    synthetic: bool = False


@dataclass
class LessonRecord:
    id: str                # свежий UUID
    student_id: str
    teacher_id: str
    lesson_date: date
    status: str            # enum value
    source_row: int        # номер строки в CSV для трейсинга


def parse_date(s: str) -> date:
    return datetime.strptime(s.strip(), "%d.%m.%Y").date()


def norm_name(n: str) -> str:
    return n.strip().lower()


def load_active_teachers(path: Path) -> list[str]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    names = data.get("active", [])
    if not names:
        print(f"WARN: config/active_teachers.json не содержит active[] — все учителя станут archived", file=sys.stderr)
    return names


def read_csv(csv_path: Path):
    teachers: dict[str, TeacherRecord] = {}  # teacher_id → rec
    students: dict[str, StudentRecord] = {}  # student_id → rec
    name_to_sid: dict[str, str] = {}         # lowercased name → student_id (для сопоставления строк без id)
    lessons: list[LessonRecord] = []
    skipped_rows: list[tuple[int, str]] = []  # (line_no, reason)

    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=2):  # номер строки в файле (с учётом header = 1)
            try:
                ldate = parse_date(row["Дата"])
                t_id = row["Учитель_id"].strip()
                t_name = row["Учитель_имя"].strip()
                s_id = row["Ученик_id"].strip()
                s_name = row["Ученик_имя"].strip()
                status_raw = row["Статус_урока"].strip()
            except (KeyError, ValueError) as e:
                skipped_rows.append((idx, f"parse error: {e}"))
                continue

            if status_raw not in STATUS_MAP:
                skipped_rows.append((idx, f"unknown status: {status_raw!r}"))
                continue
            if not t_id or not t_name:
                skipped_rows.append((idx, "teacher id/name missing"))
                continue
            if not s_name:
                skipped_rows.append((idx, "student name missing"))
                continue

            # Учитель
            t = teachers.get(t_id)
            if t is None:
                t = TeacherRecord(id=t_id, name=t_name, first_lesson=ldate, last_lesson=ldate)
                teachers[t_id] = t
            t.lesson_count += 1
            if t.first_lesson is None or ldate < t.first_lesson:
                t.first_lesson = ldate
            if t.last_lesson is None or ldate > t.last_lesson:
                t.last_lesson = ldate

            # Ученик
            if not s_id:
                # строка без student_id → пытаемся найти по имени
                key = norm_name(s_name)
                matched = name_to_sid.get(key)
                if matched:
                    s_id = matched
                else:
                    # синтетический UUID для уникальной строки без id
                    s_id = str(uuid.uuid4())
                    name_to_sid[key] = s_id
                    students[s_id] = StudentRecord(id=s_id, name=s_name, synthetic=True)

            s = students.get(s_id)
            if s is None:
                s = StudentRecord(id=s_id, name=s_name)
                students[s_id] = s
                name_to_sid.setdefault(norm_name(s_name), s_id)
            s.lesson_count += 1
            s.teacher_ids_seen.add(t_id)

            # Урок
            lessons.append(LessonRecord(
                id=str(uuid.uuid4()),
                student_id=s_id,
                teacher_id=t_id,
                lesson_date=ldate,
                status=STATUS_MAP[status_raw],
                source_row=idx,
            ))

    return teachers, students, lessons, skipped_rows


def classify_teachers(teachers: dict[str, TeacherRecord], active_names: list[str]) -> tuple[int, int, list[str]]:
    """Ставит status=active тем учителям, чьё имя в active_names. Возвращает (active_cnt, archived_cnt, unmatched_active_names)."""
    active_set = {norm_name(n) for n in active_names}
    matched: set[str] = set()
    active_cnt = 0
    for t in teachers.values():
        if norm_name(t.name) in active_set:
            t.status = "active"
            active_cnt += 1
            matched.add(norm_name(t.name))
    archived_cnt = len(teachers) - active_cnt
    unmatched = sorted(set(norm_name(n) for n in active_names) - matched)
    return active_cnt, archived_cnt, unmatched


def print_report(teachers, students, lessons, skipped, active_cnt, archived_cnt, unmatched_active):
    print("=" * 72)
    print("ОТЧЁТ ИМПОРТА (до записи в БД)")
    print("=" * 72)
    print(f"Учителя:   {len(teachers):>6}  ({active_cnt} active, {archived_cnt} archived)")
    print(f"Ученики:   {len(students):>6}  ({sum(1 for s in students.values() if s.synthetic)} синтетических, без UUID в журнале)")
    print(f"Уроки:     {len(lessons):>6}")
    print(f"Пропущено: {len(skipped):>6}")
    print()
    # статусы уроков
    status_counts = defaultdict(int)
    for l in lessons:
        status_counts[l.status] += 1
    print("Статусы уроков:")
    for st, cnt in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"  {st:<24} {cnt:>6}")
    print()
    if unmatched_active:
        print("⚠️  Активные учителя из config, НЕ найденные в журнале (будут созданы как новые):")
        for n in unmatched_active:
            print(f"   - {n}")
        print()
    if skipped:
        print(f"Пропущенные строки CSV (первые 10 из {len(skipped)}):")
        for row_no, reason in skipped[:10]:
            print(f"  строка {row_no}: {reason}")
        print()


def write_to_db(dsn: str, teachers, students, lessons):
    _load_psycopg()
    print("Подключаюсь к БД...")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            # проверка: схема накатана?
            cur.execute("select 1 from information_schema.tables where table_name = 'teachers'")
            if cur.fetchone() is None:
                raise RuntimeError("таблицы не найдены — сначала накати 0001_init.sql")

            # Учителя
            print(f"Вставляю учителей ({len(teachers)})...")
            cur.executemany(
                """insert into teachers (id, full_name, status, archived_at)
                   values (%s, %s, %s, %s)
                   on conflict (id) do nothing""",
                [
                    (
                        t.id, t.name, t.status,
                        t.last_lesson if t.status == "archived" else None,
                    )
                    for t in teachers.values()
                ],
            )

            # Ученики (teacher_id пока не ставим — неясно, к какому "последнему" учителю привязать; менеджер свяжет после)
            print(f"Вставляю учеников ({len(students)})...")
            cur.executemany(
                """insert into students (id, full_name, status, is_charity)
                   values (%s, %s, 'active', false)
                   on conflict (id) do nothing""",
                [(s.id, s.name) for s in students.values()],
            )

            # Уроки — батчем по 5000
            print(f"Вставляю уроки ({len(lessons)})...")
            BATCH = 5000
            for i in range(0, len(lessons), BATCH):
                chunk = lessons[i:i + BATCH]
                cur.executemany(
                    """insert into lessons (id, student_id, teacher_id, lesson_date, status)
                       values (%s, %s, %s, %s, %s)""",
                    [(l.id, l.student_id, l.teacher_id, l.lesson_date, l.status) for l in chunk],
                )
                print(f"  {min(i + BATCH, len(lessons))}/{len(lessons)}")

        conn.commit()
    print("Готово. Коммит прошёл.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, type=Path, help="путь к journal.csv")
    ap.add_argument("--config", type=Path, default=Path(__file__).parent.parent / "config" / "active_teachers.json")
    ap.add_argument("--dsn", help="postgres DSN (например, postgres://user:pwd@host/db). Обязателен без --dry-run.")
    ap.add_argument("--dry-run", action="store_true", help="не писать в БД, только отчёт")
    args = ap.parse_args()

    active_names = load_active_teachers(args.config)
    print(f"Загружено активных учителей из конфига: {len(active_names)}")

    print(f"Читаю {args.csv}...")
    teachers, students, lessons, skipped = read_csv(args.csv)

    active_cnt, archived_cnt, unmatched = classify_teachers(teachers, active_names)
    print_report(teachers, students, lessons, skipped, active_cnt, archived_cnt, unmatched)

    if args.dry_run:
        print("--dry-run: в БД ничего не пишу. Перезапусти без --dry-run и с --dsn.")
        return

    if not args.dsn:
        print("ERR: нужен --dsn. Прерываюсь.", file=sys.stderr)
        sys.exit(2)

    ans = input("Подтверди запись в БД (yes/no): ").strip().lower()
    if ans != "yes":
        print("Отмена.")
        return

    write_to_db(args.dsn, teachers, students, lessons)


if __name__ == "__main__":
    main()
