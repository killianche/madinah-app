import { sql } from "@/lib/db";

export interface AvailabilitySlot {
  weekday: number; // 1..7
  time_at: string; // "HH:MM" (only :00 or :30)
}

export interface TeacherCapacity {
  max_new_students: number | null;
}

export async function getTeacherAvailability(teacherId: string): Promise<{
  slots: AvailabilitySlot[];
  max_new_students: number | null;
}> {
  const [slots, capacity] = await Promise.all([
    sql<AvailabilitySlot[]>`
      select weekday, to_char(time_at, 'HH24:MI') as time_at
      from teacher_availability
      where teacher_id = ${teacherId}
      order by weekday, time_at
    `,
    sql<Array<{ max_new_students: number | null }>>`
      select max_new_students from teachers where id = ${teacherId} limit 1
    `,
  ]);
  return {
    slots,
    max_new_students: capacity[0]?.max_new_students ?? null,
  };
}

/** Полный реплейс слотов учителя — atomic. */
export async function replaceTeacherAvailability(
  teacherId: string,
  slots: AvailabilitySlot[],
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from teacher_availability where teacher_id = ${teacherId}`;
    if (slots.length === 0) return;
    const values = slots.map((s) => ({
      teacher_id: teacherId,
      weekday: s.weekday,
      time_at: s.time_at,
    }));
    await tx`
      insert into teacher_availability ${tx(values, "teacher_id", "weekday", "time_at")}
    `;
  });
}

export async function setTeacherCapacity(
  teacherId: string,
  maxNewStudents: number | null,
): Promise<void> {
  await sql`
    update teachers
    set max_new_students = ${maxNewStudents}, updated_at = now()
    where id = ${teacherId}
  `;
}

export interface BusySlot {
  weekday: number;
  time_at: string; // HH:MM, 30-min granularity
  student_id: string;
  student_name: string;
}

export interface TeacherAvailabilityRow {
  teacher_id: string;
  full_name: string;
  status: string;
  max_new_students: number | null;
  active_students: number;
  slots: Array<{ weekday: number; time_at: string }>;
}

/** Все учителя (active+paused) + их availability + capacity + текущая нагрузка. */
export async function listTeachersAvailabilityForCurator(): Promise<TeacherAvailabilityRow[]> {
  return sql<TeacherAvailabilityRow[]>`
    select
      t.id as teacher_id,
      t.full_name,
      t.status::text as status,
      t.max_new_students,
      coalesce(s.cnt, 0)::int as active_students,
      coalesce(av.slots, '[]'::jsonb) as slots
    from teachers t
    left join lateral (
      select count(*)::int as cnt
      from students
      where teacher_id = t.id and status = 'active'
    ) s on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'weekday', weekday,
        'time_at', to_char(time_at, 'HH24:MI')
      )) as slots
      from teacher_availability
      where teacher_id = t.id
    ) av on true
    where t.status in ('active', 'paused')
    order by t.full_name
  `;
}

export async function getTeacherSlotsForCurator(
  teacherId: string,
): Promise<AvailabilitySlot[]> {
  return sql<AvailabilitySlot[]>`
    select weekday, to_char(time_at, 'HH24:MI') as time_at
    from teacher_availability
    where teacher_id = ${teacherId}
    order by weekday, time_at
  `;
}

/**
 * Расписания активных учеников учителя, развёрнутые на 30-минутные слоты.
 * Урок 60 мин в 10:00 → две записи 10:00 и 10:30.
 */
export async function getTeacherBusySlots(teacherId: string): Promise<BusySlot[]> {
  return sql<BusySlot[]>`
    with expanded as (
      select
        ss.weekday,
        ss.time_at + (n * interval '30 minutes') as slot_time,
        s.id as student_id,
        s.full_name as student_name
      from student_schedules ss
      join students s on s.id = ss.student_id
      cross join generate_series(0, ceil(ss.duration_min::numeric / 30)::int - 1) as n
      where ss.active = true
        and s.teacher_id = ${teacherId}
        and s.status in ('active', 'paused')
    )
    select
      weekday,
      to_char(slot_time, 'HH24:MI') as time_at,
      student_id,
      student_name
    from expanded
    order by weekday, slot_time, student_name
  `;
}
