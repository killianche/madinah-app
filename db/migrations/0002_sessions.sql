-- Сессии Lucia Auth
-- Хранятся в БД, проверяются на каждом запросе через middleware.

create table user_sessions (
  id             text primary key,       -- Lucia генерирует криптостойкий id
  user_id        uuid not null references users(id) on delete cascade,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  user_agent     text,
  ip             inet
);

create index idx_sessions_user on user_sessions(user_id);
create index idx_sessions_expires on user_sessions(expires_at);

-- Одноразовый токен для первого входа (вместо того чтобы гонять пароль в мессенджере)
create table password_reset_tokens (
  token_hash     text primary key,       -- sha256 от токена, сам токен не храним
  user_id        uuid not null references users(id) on delete cascade,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index idx_reset_tokens_user on password_reset_tokens(user_id);
