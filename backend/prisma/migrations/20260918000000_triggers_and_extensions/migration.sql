-- ============================================================
-- Триггеры защиты + PII-шифрование + cleanup-функции.
-- Self-hosted Postgres (без Supabase).
--
-- ВАЖНО: НЕ используем GRANT ... TO service_role / anon / authenticated —
-- этих ролей в обычном Postgres нет. Авторизация целиком на бэкенде
-- через middleware, RLS в self-hosted не работает (владелец БД её обходит).
-- ============================================================

-- ============================================================
-- 1. Расширения
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. Защита полей профиля (роль, блокировка)
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_role text;
BEGIN
  v_role := NULLIF(current_setting('app.current_user_role', true), '');
  IF v_role IS NULL THEN RETURN NEW; END IF;

  IF v_role <> 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Только администратор может менять роль'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.blocked IS DISTINCT FROM OLD.blocked THEN
      RAISE EXCEPTION 'Только администратор может менять блокировку'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_protect_columns ON public.profiles;
CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ============================================================
-- 3. Защита поля manager в universities
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_manager_field()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_role text;
BEGIN
  v_role := NULLIF(current_setting('app.current_user_role', true), '');
  IF v_role IS NULL THEN RETURN NEW; END IF;

  IF v_role = 'nam' AND (
    NEW.manager IS DISTINCT FROM OLD.manager
    OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
  ) THEN
    RAISE EXCEPTION 'Роль Пользователь (НАМ) не может менять ответственного менеджера'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS universities_protect_manager ON public.universities;
CREATE TRIGGER universities_protect_manager
  BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.protect_manager_field();

-- ============================================================
-- 4. PII-шифрование (152-ФЗ)
-- ============================================================
CREATE OR REPLACE FUNCTION public.encrypt_pii(plain text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_key text;
BEGIN
  IF plain IS NULL OR plain = '' THEN RETURN plain; END IF;
  IF plain LIKE 'enc:v1:%' THEN RETURN plain; END IF;

  v_key := NULLIF(current_setting('app.settings.pii_key', true), '');
  IF v_key IS NULL THEN RETURN plain; END IF;

  RETURN 'enc:v1:' || encode(pgp_sym_encrypt(plain, v_key), 'base64');
END $$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(cipher text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_key text;
BEGIN
  IF cipher IS NULL OR cipher = '' THEN RETURN cipher; END IF;
  IF cipher NOT LIKE 'enc:v1:%' THEN RETURN cipher; END IF;

  v_key := NULLIF(current_setting('app.settings.pii_key', true), '');
  IF v_key IS NULL THEN RETURN cipher; END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(substr(cipher, 8), 'base64'), v_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN cipher;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.encrypt_university_pii()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.contact_email := public.encrypt_pii(NEW.contact_email);
  NEW.contact_phone := public.encrypt_pii(NEW.contact_phone);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS universities_encrypt_pii ON public.universities;
CREATE TRIGGER universities_encrypt_pii
  BEFORE INSERT OR UPDATE OF contact_email, contact_phone ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_university_pii();

-- ============================================================
-- 5. Cleanup-функции для cron
-- Все обёрнуты в проверку существования таблицы, чтобы миграция
-- применялась на любой инсталляции независимо от порядка.
-- ============================================================

-- Очистка soft-deleted записей
CREATE OR REPLACE FUNCTION public.cleanup_trash(days_old int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total int := 0;
      v_count int;
BEGIN
  DELETE FROM public.universities
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM public.interactions
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM public.tasks
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM public.workflows
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM public.contracts
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM public.integrations
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  RETURN v_total;
END $$;

-- Очистка прочитанных уведомлений
CREATE OR REPLACE FUNCTION public.cleanup_notifications(days_old int DEFAULT 30)
RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  WITH deleted AS (
    DELETE FROM public.notifications
    WHERE read = true AND created_at < now() - (days_old || ' days')::interval
    RETURNING 1
  )
  SELECT count(*)::int FROM deleted;
$$;

-- Очистка ключей идемпотентности — только если таблица есть
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'idempotency_keys'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.cleanup_idempotency_keys()
      RETURNS int LANGUAGE sql SECURITY DEFINER AS $body$
        WITH deleted AS (
          DELETE FROM public.idempotency_keys
          WHERE expires_at < now()
          RETURNING 1
        )
        SELECT count(*)::int FROM deleted;
      $body$;
    $fn$;
  END IF;
END $$;