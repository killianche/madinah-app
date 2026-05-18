/**
 * Высокоуровневые триггеры уведомлений. Вызываются ПОСЛЕ основной транзакции
 * (insert lesson / topup / assign), чтобы сбой в notify не откатывал бизнес-операцию.
 *
 * Все функции «тихие»: ловят ошибки внутрь — потому что уведомление никогда
 * не должно мешать основной операции.
 */

import { sql } from "@/lib/db";
import {
  createNotification,
  recentLowBalanceExists,
} from "@/lib/repos/notifications";

const LOW_BALANCE_THRESHOLD = 4;
const LOW_BALANCE_DEDUP_DAYS = 7;

/** Получает teacher user_id (users.id) ученика. null если нет учителя или у учителя нет user-аккаунта. */
async function getStudentTeacherUserId(studentId: string): Promise<string | null> {
  const rows = await sql<Array<{ user_id: string | null }>>`
    select t.user_id from students s
    left join teachers t on t.id = s.teacher_id
    where s.id = ${studentId}
    limit 1
  `;
  return rows[0]?.user_id ?? null;
}

async function getStudentBrief(
  studentId: string,
): Promise<{ name: string; balance: number; teacher_user_id: string | null; creator_user_id: string | null } | null> {
  const rows = await sql<Array<{
    full_name: string;
    balance: number;
    teacher_user_id: string | null;
    created_by_user_id: string | null;
  }>>`
    select s.full_name, s.balance::int, t.user_id as teacher_user_id, s.created_by_user_id
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.id = ${studentId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    name: r.full_name,
    balance: r.balance,
    teacher_user_id: r.teacher_user_id,
    creator_user_id: r.created_by_user_id,
  };
}

/** Учителю — «ученик пополнил баланс». Тихо. */
export async function notifyTopup(
  studentId: string,
  lessonsAdded: number,
  actorId: string,
): Promise<void> {
  try {
    if (lessonsAdded <= 0) return; // отрицательные коррекции — без уведомления
    const teacherUserId = await getStudentTeacherUserId(studentId);
    if (!teacherUserId) return;
    if (teacherUserId === actorId) return; // сам себе не уведомляю (учитель пополнил)
    const brief = await getStudentBrief(studentId);
    if (!brief) return;
    await createNotification({
      user_id: teacherUserId,
      kind: "topup",
      payload: {
        student_id: studentId,
        student_name: brief.name,
        lessons_added: lessonsAdded,
      },
    });
  } catch (err) {
    console.error("notifyTopup failed:", err);
  }
}

/** Новому учителю — «к вам прикреплён ученик». Тихо. */
export async function notifyTeacherAssigned(
  studentId: string,
  newTeacherId: string,
  actorId: string,
): Promise<void> {
  try {
    const rows = await sql<Array<{ user_id: string | null; student_name: string }>>`
      select t.user_id, s.full_name as student_name
      from teachers t, students s
      where t.id = ${newTeacherId} and s.id = ${studentId}
      limit 1
    `;
    const r = rows[0];
    if (!r || !r.user_id) return;
    if (r.user_id === actorId) return;
    await createNotification({
      user_id: r.user_id,
      kind: "student_assigned",
      payload: { student_id: studentId, student_name: r.student_name },
    });
  } catch (err) {
    console.error("notifyTeacherAssigned failed:", err);
  }
}

/**
 * Если у ученика баланс упал в «низкую» зону (≤ THRESHOLD) и в последние
 * LOW_BALANCE_DEDUP_DAYS дней такого уведомления не было — шлём:
 * - менеджеру-создателю
 * - учителю (user_id)
 */
export async function notifyLowBalanceIfNeeded(studentId: string): Promise<void> {
  try {
    const brief = await getStudentBrief(studentId);
    if (!brief) return;
    if (brief.balance > LOW_BALANCE_THRESHOLD) return;

    const recipients: string[] = [];
    if (brief.creator_user_id) recipients.push(brief.creator_user_id);
    if (brief.teacher_user_id && brief.teacher_user_id !== brief.creator_user_id) {
      recipients.push(brief.teacher_user_id);
    }
    for (const userId of recipients) {
      const recent = await recentLowBalanceExists(userId, studentId, LOW_BALANCE_DEDUP_DAYS);
      if (recent) continue;
      await createNotification({
        user_id: userId,
        kind: "low_balance",
        payload: {
          student_id: studentId,
          student_name: brief.name,
          balance: brief.balance,
        },
      });
    }
  } catch (err) {
    console.error("notifyLowBalanceIfNeeded failed:", err);
  }
}
