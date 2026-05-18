-- 0015 Ставки оплаты учителей и глобальные дефолты
-- Зарплата = conducted × rate_conducted + penalty × rate_penalty.
-- NULL у учителя = брать из settings (school_settings).

alter table teachers
  add column if not exists rate_conducted numeric(10, 2),
  add column if not exists rate_penalty   numeric(10, 2);

create table if not exists school_settings (
  id              int primary key default 1 check (id = 1),
  rate_conducted  numeric(10, 2) not null default 500,
  rate_penalty    numeric(10, 2) not null default 250,
  currency        text not null default 'RUB',
  updated_at      timestamptz not null default now()
);

insert into school_settings (id) values (1) on conflict (id) do nothing;
