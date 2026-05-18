-- 0012 Telegram phone for students/users
-- Отдельное поле для номера, привязанного к Telegram (часто отличается от основного).
alter table students add column if not exists telegram_phone text;
alter table users    add column if not exists telegram_phone text;
