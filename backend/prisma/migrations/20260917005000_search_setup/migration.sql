-- ============================================================
-- Полнотекстовый поиск: pg_trgm + tsvector + GIN + триггеры.
-- search_vector не описан в schema.prisma (Prisma не умеет tsvector),
-- но это ок — $queryRaw в SearchService работает с колонкой напрямую.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- universities ----------
ALTER TABLE universities ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE universities SET search_vector = to_tsvector('russian',
  coalesce(name,'') || ' ' || coalesce(city,'') || ' ' || coalesce(contact_name,''));

CREATE INDEX IF NOT EXISTS universities_search_idx
  ON universities USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS universities_name_trgm_idx
  ON universities USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS universities_city_trgm_idx
  ON universities USING GIN(city gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.update_university_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian',
    coalesce(NEW.name,'') || ' ' || coalesce(NEW.city,'') || ' ' || coalesce(NEW.contact_name,''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS universities_search_vector_update ON universities;
CREATE TRIGGER universities_search_vector_update
  BEFORE INSERT OR UPDATE OF name, city, contact_name ON universities
  FOR EACH ROW EXECUTE FUNCTION public.update_university_search_vector();

-- ---------- tasks ----------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE tasks SET search_vector = to_tsvector('russian',
  coalesce(title,'') || ' ' || coalesce(description,''));

CREATE INDEX IF NOT EXISTS tasks_search_idx ON tasks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS tasks_title_trgm_idx ON tasks USING GIN(title gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.update_task_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian',
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_search_vector_update ON tasks;
CREATE TRIGGER tasks_search_vector_update
  BEFORE INSERT OR UPDATE OF title, description ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_task_search_vector();

-- ---------- interactions ----------
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE interactions SET search_vector = to_tsvector('russian',
  coalesce(title,'') || ' ' || coalesce(details,''));

CREATE INDEX IF NOT EXISTS interactions_search_idx
  ON interactions USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS interactions_title_trgm_idx
  ON interactions USING GIN(title gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.update_interaction_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian',
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.details,''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS interactions_search_vector_update ON interactions;
CREATE TRIGGER interactions_search_vector_update
  BEFORE INSERT OR UPDATE OF title, details ON interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_interaction_search_vector();

-- ---------- comments ----------
ALTER TABLE comments ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE comments SET search_vector = to_tsvector('russian', coalesce(body,''));

CREATE INDEX IF NOT EXISTS comments_search_idx ON comments USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS comments_body_trgm_idx ON comments USING GIN(body gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.update_comment_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian', coalesce(NEW.body,''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS comments_search_vector_update ON comments;
CREATE TRIGGER comments_search_vector_update
  BEFORE INSERT OR UPDATE OF body ON comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_search_vector();

-- ---------- kb_articles ----------
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE kb_articles SET search_vector = to_tsvector('russian',
  coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,''));

CREATE INDEX IF NOT EXISTS kb_articles_search_idx
  ON kb_articles USING GIN(search_vector);

CREATE OR REPLACE FUNCTION public.update_kb_article_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian',
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.excerpt,'') || ' ' || coalesce(NEW.content,''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kb_articles_search_vector_update ON kb_articles;
CREATE TRIGGER kb_articles_search_vector_update
  BEFORE INSERT OR UPDATE OF title, excerpt, content ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_kb_article_search_vector();