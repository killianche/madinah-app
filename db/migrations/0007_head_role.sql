-- Madinah App — роль «руководитель учителей» (head).
-- Права как у куратора: видит всех учеников, может менять учителя/статус,
-- видит «Проблемных» и «Серую зону».

set search_path = public;

alter type user_role add value if not exists 'head';

comment on type user_role is
  'admin — суперадмин; director — директор; manager — менеджер; curator — куратор групп учителей; head — руководитель учителей; teacher — учитель';
