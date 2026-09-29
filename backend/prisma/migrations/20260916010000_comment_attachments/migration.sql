-- Прикреплённые файлы в комментариях.
-- Хранятся как JSON-массив: [{ name, url, size?, mime? }]
-- Файлы физически в MinIO, в БД — только метаданные.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS comments_attachments_gin_idx
  ON comments USING GIN (attachments jsonb_path_ops);

