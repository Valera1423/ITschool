-- ============================================================
-- Ранее: unique (entity_type, entity_id, minutes_before) —
-- глобальный ключ, из-за чего напоминание получал только первый
-- пользователь, попавший в cron. Второй получатель блокировался
-- наличием записи от первого.
--
-- Стало: unique (entity_type, entity_id, user_id, minutes_before) —
-- dedup теперь ПО КАЖДОМУ получателю.
-- ============================================================

-- PostgreSQL допускает NULL в unique-индексах и не считает их равными,
-- поэтому для существующих записей со старым NULL-userId поведение
-- остаётся прежним (без дедупликации). Но новые записи всегда пишут
-- userId, так что это безопасно.

ALTER TABLE reminder_log
  DROP CONSTRAINT IF EXISTS reminder_log_entity_type_entity_id_minutes_before_key;

ALTER TABLE reminder_log
  ADD CONSTRAINT reminder_log_entity_type_entity_id_user_id_minutes_before_key
  UNIQUE (entity_type, entity_id, user_id, minutes_before);

-- Индекс для быстрого поиска по пользователю
CREATE INDEX IF NOT EXISTS reminder_log_user_id_idx
  ON reminder_log (user_id);