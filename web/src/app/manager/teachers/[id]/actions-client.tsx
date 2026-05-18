"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import {
  setTeacherStatusAction,
  reassignAllStudentsAction,
} from "../actions";

type Status = "active" | "paused" | "fired" | "archived";

const NEXT_STATUSES: { value: Status; label: string; tone: "good" | "warn" | "bad" | "neutral" }[] = [
  { value: "active", label: "Активный", tone: "good" },
  { value: "paused", label: "Пауза (не берёт новых)", tone: "warn" },
  { value: "fired", label: "Уволен", tone: "bad" },
  { value: "archived", label: "Архив", tone: "neutral" },
];

export function TeacherActions({
  teacherId,
  currentStatus,
  activeStudentsCount,
  otherTeachers,
}: {
  teacherId: string;
  currentStatus: string;
  activeStudentsCount: number;
  otherTeachers: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [confirmStatus, setConfirmStatus] = useState<Status | null>(null);
  const [confirmReassign, setConfirmReassign] = useState<{ toNull: boolean; toId: string | null } | null>(null);

  function changeStatus(s: Status) {
    if (s === currentStatus) return;
    if ((s === "fired" || s === "archived") && activeStudentsCount > 0) {
      setError(
        `У учителя ${activeStudentsCount} активных. Сначала переведи их к другому учителю или сними назначение.`,
      );
      return;
    }
    setError(null);
    setConfirmStatus(s);
  }

  function applyStatus() {
    if (!confirmStatus) return;
    startTransition(async () => {
      const res = await setTeacherStatusAction({
        teacher_id: teacherId,
        status: confirmStatus,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConfirmStatus(null);
      router.refresh();
    });
  }

  function reassign(toNull: boolean) {
    setError(null);
    const to = toNull ? null : reassignTo || null;
    if (!toNull && !to) {
      setError("Выбери учителя или нажми «снять назначение»");
      return;
    }
    setConfirmReassign({ toNull, toId: to });
  }

  function applyReassign() {
    if (!confirmReassign) return;
    startTransition(async () => {
      const res = await reassignAllStudentsAction({
        from_teacher_id: teacherId,
        to_teacher_id: confirmReassign.toId,
      });
      if (!res.ok) {
        setError(res.error);
        setConfirmReassign(null);
        return;
      }
      setReassignTo("");
      setConfirmReassign(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Bulk reassign */}
      {activeStudentsCount > 0 && (
        <div
          className="bg-ivory rounded-[14px] p-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <div className="text-[12px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
            Перевести всех учеников
          </div>
          <select
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            disabled={pending}
            className="w-full bg-ivory text-near-black text-[14px] rounded-[10px] px-3 py-2 mb-2"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            <option value="">— выбери учителя —</option>
            {otherTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={pending || !reassignTo}
              onClick={() => reassign(false)}
              className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
            >
              Перевести {activeStudentsCount}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => reassign(true)}
              className="text-[13px] font-medium text-charcoal px-3 py-2 rounded-[10px] bg-ivory disabled:opacity-40"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Снять назначение (в очередь куратора)
            </button>
          </div>
        </div>
      )}

      {/* Status change */}
      <div
        className="bg-ivory rounded-[14px] p-4"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div className="text-[12px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Сменить статус
        </div>
        <div className="flex flex-wrap gap-2">
          {NEXT_STATUSES.filter((s) => s.value !== currentStatus).map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={pending}
              onClick={() => changeStatus(s.value)}
              className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-ivory text-charcoal disabled:opacity-40"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {confirmReassign && (
        <div
          className="bg-ivory rounded-[14px] p-4"
          style={{ boxShadow: "inset 0 0 0 1px rgba(201,100,66,0.5)" }}
        >
          <div className="text-[14px] mb-2">
            Перевести <strong>{activeStudentsCount}</strong>{" "}
            {activeStudentsCount === 1 ? "ученика" : "учеников"}{" "}
            {confirmReassign.toNull ? (
              <>
                в <strong>очередь куратора</strong> (без учителя)?
              </>
            ) : (
              <>
                к учителю{" "}
                <strong>
                  {otherTeachers.find((t) => t.id === confirmReassign.toId)?.full_name ?? "?"}
                </strong>
                ?
              </>
            )}
          </div>
          <div className="text-[12px] text-stone mb-3">
            Действие необратимо. Все активные ученики этого учителя будут переназначены.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={applyReassign}
              className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
            >
              {pending ? "Перевожу…" : `Да, перевести ${activeStudentsCount}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmReassign(null)}
              className="text-[13px] font-medium text-stone px-3 py-2 rounded-[10px] bg-ivory disabled:opacity-40"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {confirmStatus && (
        <div
          className="bg-ivory rounded-[14px] p-4"
          style={{ boxShadow: "inset 0 0 0 1px rgba(201,100,66,0.5)" }}
        >
          <div className="text-[14px] mb-2">
            Подтвердить смену статуса на «
            <strong>
              {NEXT_STATUSES.find((x) => x.value === confirmStatus)?.label}
            </strong>
            »?
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={applyStatus}
              className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
            >
              {pending ? "Сохраняю…" : "Подтвердить"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmStatus(null)}
              className="text-[13px] font-medium text-stone px-3 py-2 rounded-[10px] bg-ivory disabled:opacity-40"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div>
          <Chip tone="bad" size="m">{error}</Chip>
        </div>
      )}
    </div>
  );
}
