-- 0016 Логин (username) + plaintext пароль для учителей
-- password_plain хранится только для удобства куратора, чтобы он мог напомнить
-- учителю его пароль. Не для production-best-practice; пользователь явно попросил.

alter table users
  add column if not exists login         text,
  add column if not exists password_plain text;

create unique index if not exists idx_users_login_unique
  on users (login) where login is not null;
