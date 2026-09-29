-- ============================================================
-- Полнотекстовый поиск по документам (имя + описание).
-- OCR содержимого файлов НЕ реализуем (вне ТЗ), но имя и
-- описание файла ищем.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE documents SET search_vector = to_tsvector('russian',
  coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS documents_search_idx
  ON documents USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS documents_name_trgm_idx
  ON documents USING GIN(name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.update_document_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian',
    coalesce(NEW.name,'') || ' ' || coalesce(NEW.description,'') || ' ' || coalesce(NEW.category,''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS documents_search_vector_update ON documents;
CREATE TRIGGER documents_search_vector_update
  BEFORE INSERT OR UPDATE OF name, description, category ON documents
  FOR EACH ROW EXECUTE FUNCTION public.update_document_search_vector();