/**
 * Доменные типы. Зеркалят БД, но не один-в-один — с учётом потребностей UI.
 */

export type UserRole = "admin" | "director" | "manager" | "curator" | "teacher";

export type TeacherStatus = "active" | "archived";
export type StudentStatus = "active" | "paused" | "archived";

export type LessonStatus =
  | "conducted"
  | "penalty"
  | "cancelled_by_teacher"
  | "cancelled_by_student";

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

export interface Teacher {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  telegram_username: string | null;
  status: TeacherStatus;
  hired_at: Date | null;
  archived_at: Date | null;
}

export interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  telegram_username: string | null;
  teacher_id: string | null;
  balance: number;
  is_charity: boolean;
  charity_since: Date | null;
  charity_note: string | null;
  status: StudentStatus;
  enrolled_at: Date | null;
}

export interface Lesson {
  id: string;
  student_id: string;
  teacher_id: string;
  lesson_date: Date;
  lesson_time: string | null;
  status: LessonStatus;
  duration_units: number;
  topic: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
}

export interface BalanceTopup {
  id: string;
  student_id: string;
  lessons_added: number;
  reason: string | null;
  added_by: string | null;
  created_at: Date;
}

// Отображаемые статусы уроков на русском — для UI и экспорта
export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  conducted: "Проведён",
  penalty: "Штрафной",
  cancelled_by_teacher: "Отменён учителем",
  cancelled_by_student: "Отменён учеником",
};

export const LESSON_STATUS_DEDUCTS: Record<LessonStatus, boolean> = {
  conducted: true,
  penalty: true,
  cancelled_by_teacher: false,
  cancelled_by_student: false,
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: "Администратор",
  director: "Директор",
  manager: "Менеджер",
  curator: "Куратор",
  teacher: "Учитель",
};
