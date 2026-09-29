/*
  Warnings:

  - You are about to drop the column `search_vector` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `value_json` on the `custom_field_values` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `interactions` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `kb_articles` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `universities` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Made the column `storage_path` on table `contract_versions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `contract_versions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `uploaded_by` on table `contract_versions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `university_id` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mime_type` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `integration_id` on table `integration_sync_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `records_fetched` on table `integration_sync_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `records_created` on table `integration_sync_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `records_updated` on table `integration_sync_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `records_skipped` on table `integration_sync_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `records_failed` on table `integration_sync_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `last_sync_count` on table `integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sync_schedule` on table `integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `interactions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_by` on table `ip_whitelist` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subject_email` on table `pd_consents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `source` on table `pd_consents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `comment` on table `workflow_transitions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "user_scopes" DROP CONSTRAINT "user_scopes_user_id_fkey";

-- DropIndex
DROP INDEX "comments_body_trgm_idx";

-- DropIndex
DROP INDEX "comments_search_idx";

-- DropIndex
DROP INDEX "interactions_search_idx";

-- DropIndex
DROP INDEX "interactions_title_trgm_idx";

-- DropIndex
DROP INDEX "kb_articles_search_idx";

-- DropIndex
DROP INDEX "tasks_search_idx";

-- DropIndex
DROP INDEX "tasks_title_trgm_idx";

-- DropIndex
DROP INDEX "universities_city_trgm_idx";

-- DropIndex
DROP INDEX "universities_name_trgm_idx";

-- DropIndex
DROP INDEX "universities_search_idx";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "search_vector",
ADD COLUMN     "interaction_id" UUID,
ADD COLUMN     "task_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "contract_versions" ALTER COLUMN "storage_path" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "uploaded_by" SET NOT NULL;

-- AlterTable
ALTER TABLE "custom_field_values" DROP COLUMN "value_json",
ADD COLUMN     "valueJson" JSONB;

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "university_id" SET NOT NULL,
ALTER COLUMN "mime_type" SET NOT NULL;

-- AlterTable
ALTER TABLE "integration_endpoints" ALTER COLUMN "entity" DROP NOT NULL;

-- AlterTable
ALTER TABLE "integration_sync_logs" ALTER COLUMN "integration_id" SET NOT NULL,
ALTER COLUMN "records_fetched" SET NOT NULL,
ALTER COLUMN "records_created" SET NOT NULL,
ALTER COLUMN "records_updated" SET NOT NULL,
ALTER COLUMN "records_skipped" SET NOT NULL,
ALTER COLUMN "records_failed" SET NOT NULL;

-- AlterTable
ALTER TABLE "integrations" ALTER COLUMN "last_sync_count" SET NOT NULL,
ALTER COLUMN "sync_schedule" SET NOT NULL;

-- AlterTable
ALTER TABLE "interactions" DROP COLUMN "search_vector",
ALTER COLUMN "reminder_minutes" DROP DEFAULT,
ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "ip_whitelist" ALTER COLUMN "created_by" SET NOT NULL;

-- AlterTable
ALTER TABLE "kb_articles" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "pd_consents" ALTER COLUMN "subject_email" SET NOT NULL,
ALTER COLUMN "source" SET NOT NULL;

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "universities" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "user_scopes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflow_transitions" ALTER COLUMN "comment" SET NOT NULL;

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "external_id" TEXT,
    "thread_id" TEXT,
    "from_address" TEXT NOT NULL,
    "from_name" TEXT,
    "to_address" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "university_id" UUID,
    "interaction_id" UUID,
    "manager" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" BIGSERIAL NOT NULL,
    "integration_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "body" JSONB NOT NULL DEFAULT '{}',
    "status" INTEGER NOT NULL DEFAULT 200,
    "error" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "entity" TEXT NOT NULL DEFAULT 'universities',
    "trigger_type" TEXT NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" BIGSERIAL NOT NULL,
    "rule_id" UUID NOT NULL,
    "entity_id" UUID,
    "trigger_payload" JSONB,
    "actions_result" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "email" TEXT,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "sync_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" UUID,
    "endpoint" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_versions" (
    "id" BIGSERIAL NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "author_id" UUID,
    "author_name" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentions" (
    "id" BIGSERIAL NOT NULL,
    "comment_id" UUID NOT NULL,
    "mentioned_id" UUID NOT NULL,
    "mentioned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_export_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rows_count" INTEGER NOT NULL,
    "filter_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "excel_export_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_report_links" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_view_at" TIMESTAMP(3),
    "password" TEXT,

    CONSTRAINT "public_report_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID,
    "type" TEXT NOT NULL DEFAULT 'finish_to_start',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout" INTEGER,
    "config" JSONB NOT NULL DEFAULT '{}',
    "allowed_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "variants" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_events" (
    "id" BIGSERIAL NOT NULL,
    "test_key" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_export_logs" (
    "id" BIGSERIAL NOT NULL,
    "system" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "external_id" TEXT,
    "payload" JSONB,
    "response" JSONB,
    "error" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "external_export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edo_documents" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "document_type" TEXT NOT NULL DEFAULT 'contract',
    "box_id" TEXT,
    "signed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_comment" TEXT,
    "raw_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edo_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "event_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbox_messages_university_id_idx" ON "inbox_messages"("university_id");

-- CreateIndex
CREATE INDEX "inbox_messages_channel_direction_idx" ON "inbox_messages"("channel", "direction");

-- CreateIndex
CREATE INDEX "inbox_messages_received_at_idx" ON "inbox_messages"("received_at");

-- CreateIndex
CREATE INDEX "inbox_messages_read_archived_idx" ON "inbox_messages"("read", "archived");

-- CreateIndex
CREATE INDEX "webhook_logs_integration_id_idx" ON "webhook_logs"("integration_id");

-- CreateIndex
CREATE INDEX "webhook_logs_received_at_idx" ON "webhook_logs"("received_at");

-- CreateIndex
CREATE INDEX "automation_rules_enabled_entity_idx" ON "automation_rules"("enabled", "entity");

-- CreateIndex
CREATE INDEX "automation_runs_rule_id_ran_at_idx" ON "automation_runs"("rule_id", "ran_at");

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_tokens_user_id_key" ON "google_oauth_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "entity_versions_entity_entity_id_created_at_idx" ON "entity_versions"("entity", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "entity_versions_entity_entity_id_version_key" ON "entity_versions"("entity", "entity_id", "version");

-- CreateIndex
CREATE INDEX "mentions_mentioned_id_read_idx" ON "mentions"("mentioned_id", "read");

-- CreateIndex
CREATE UNIQUE INDEX "mentions_comment_id_mentioned_id_key" ON "mentions"("comment_id", "mentioned_id");

-- CreateIndex
CREATE INDEX "excel_export_sessions_user_id_created_at_idx" ON "excel_export_sessions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "public_report_links_token_key" ON "public_report_links"("token");

-- CreateIndex
CREATE INDEX "public_report_links_token_idx" ON "public_report_links"("token");

-- CreateIndex
CREATE INDEX "task_dependencies_task_id_idx" ON "task_dependencies"("task_id");

-- CreateIndex
CREATE INDEX "task_dependencies_depends_on_task_id_idx" ON "task_dependencies"("depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_task_id_key" ON "task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ab_tests_key_key" ON "ab_tests"("key");

-- CreateIndex
CREATE INDEX "ab_test_events_test_key_variant_event_type_idx" ON "ab_test_events"("test_key", "variant", "event_type");

-- CreateIndex
CREATE INDEX "ab_test_events_user_id_idx" ON "ab_test_events"("user_id");

-- CreateIndex
CREATE INDEX "external_export_logs_system_entity_idx" ON "external_export_logs"("system", "entity");

-- CreateIndex
CREATE INDEX "external_export_logs_status_idx" ON "external_export_logs"("status");

-- CreateIndex
CREATE INDEX "edo_documents_contract_id_idx" ON "edo_documents"("contract_id");

-- CreateIndex
CREATE INDEX "edo_documents_provider_external_id_idx" ON "edo_documents"("provider", "external_id");

-- CreateIndex
CREATE INDEX "sms_subscriptions_user_id_enabled_idx" ON "sms_subscriptions"("user_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "sms_subscriptions_user_id_phone_key" ON "sms_subscriptions"("user_id", "phone");

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_tokens" ADD CONSTRAINT "google_oauth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "user_scopes_user_entity_uniq" RENAME TO "user_scopes_user_id_entity_key";
