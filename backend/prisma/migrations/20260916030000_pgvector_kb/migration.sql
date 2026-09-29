CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE kb_articles
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS kb_articles_embedding_ivfflat
  ON kb_articles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Кэш чатов (для аналитики и дедупликации)
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  session_id   uuid NOT NULL,
  role         varchar(20) NOT NULL,  -- 'user' | 'assistant'
  content      text NOT NULL,
  sources      jsonb DEFAULT '[]',
  tokens_used  int,
  latency_ms   int,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_session_idx
  ON ai_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS ai_chat_messages_user_idx
  ON ai_chat_messages(user_id, created_at);