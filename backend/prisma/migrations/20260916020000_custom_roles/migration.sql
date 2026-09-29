-- ============================================================
-- Кастомные роли-пресеты (RBAC-lite).
--
-- Не заменяют Keycloak realm-roles (admin/manager/nam),
-- а расширяют их: дают точечные permissions поверх базовой.
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         varchar(64)  NOT NULL UNIQUE,
  label        varchar(200) NOT NULL,
  description  text,
  permissions  text[]       NOT NULL DEFAULT ARRAY[]::text[],
  base_role    varchar(20)  NOT NULL DEFAULT 'nam',
  active       boolean      NOT NULL DEFAULT true,
  sort_order   int          NOT NULL DEFAULT 100,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_roles_active_idx ON custom_roles(active, sort_order);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES custom_roles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_custom_role_idx ON profiles(custom_role_id);