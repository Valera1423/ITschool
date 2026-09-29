-- ============================================================
-- 1. user_scopes — разграничение доступа по данным
-- ============================================================
CREATE TABLE IF NOT EXISTS user_scopes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity      text NOT NULL DEFAULT 'universities',
  filter      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_scopes_user_entity_uniq UNIQUE (user_id, entity)
);

CREATE INDEX IF NOT EXISTS user_scopes_entity_idx ON user_scopes(entity);

-- Автоматически обновляем updated_at
CREATE OR REPLACE FUNCTION public.touch_user_scopes_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_scopes_touch_updated_at ON user_scopes;
CREATE TRIGGER user_scopes_touch_updated_at
  BEFORE UPDATE ON user_scopes
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_scopes_updated_at();

-- ============================================================
-- 2. workflows.is_default — вместо хардкода имени в сервисах
-- ============================================================
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Ровно один workflow может быть дефолтным
CREATE UNIQUE INDEX IF NOT EXISTS workflows_single_default_uniq
  ON workflows ((true))
  WHERE is_default = true;

-- Помечаем текущий «Полный цикл взаимодействия с вузом» как дефолтный,
-- если он существует и ещё не помечен
UPDATE workflows
  SET is_default = true
  WHERE name = 'Полный цикл взаимодействия с вузом'
    AND deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM workflows WHERE is_default = true);