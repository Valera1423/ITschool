/*
  Warnings:

  - You are about to drop the column `search_vector` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `embedding` on the `kb_articles` table. All the data in the column will be lost.
  - You are about to drop the `ai_chat_messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_chat_messages" DROP CONSTRAINT "ai_chat_messages_user_id_fkey";

-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_custom_role_id_fkey";

-- DropIndex
DROP INDEX "comments_attachments_gin_idx";

-- DropIndex
DROP INDEX "documents_name_trgm_idx";

-- DropIndex
DROP INDEX "documents_search_idx";

-- DropIndex
DROP INDEX "kb_articles_embedding_ivfflat";

-- DropIndex
DROP INDEX "profiles_custom_role_idx";

-- DropIndex
DROP INDEX "reminder_log_entity_type_entity_id_minutes_before_key";

-- DropIndex
DROP INDEX "reminder_log_user_id_idx";

-- AlterTable
ALTER TABLE "custom_roles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "kb_articles" DROP COLUMN "embedding";

-- AlterTable
ALTER TABLE "user_sessions" ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "revoked_reason" TEXT;

-- DropTable
DROP TABLE "ai_chat_messages";

-- CreateTable
CREATE TABLE "workflow_transition_rules" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "from_step_id" UUID NOT NULL,
    "to_step_id" UUID NOT NULL,
    "condition" JSONB NOT NULL DEFAULT '{}',
    "requires_comment" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pii_access_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "user_email" TEXT,
    "subject_id" UUID,
    "entity" TEXT NOT NULL DEFAULT 'universities',
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "purpose" TEXT NOT NULL DEFAULT 'view',
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pii_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_transition_rules_workflow_id_idx" ON "workflow_transition_rules"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_transition_rules_from_step_id_idx" ON "workflow_transition_rules"("from_step_id");

-- CreateIndex
CREATE INDEX "workflow_transition_rules_to_step_id_idx" ON "workflow_transition_rules"("to_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transition_rules_workflow_id_from_step_id_to_step__key" ON "workflow_transition_rules"("workflow_id", "from_step_id", "to_step_id");

-- CreateIndex
CREATE INDEX "pii_access_log_user_id_created_at_idx" ON "pii_access_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "pii_access_log_subject_id_created_at_idx" ON "pii_access_log"("subject_id", "created_at");

-- CreateIndex
CREATE INDEX "pii_access_log_created_at_idx" ON "pii_access_log"("created_at");

-- CreateIndex
CREATE INDEX "user_sessions_last_active_at_idx" ON "user_sessions"("last_active_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_rules" ADD CONSTRAINT "workflow_transition_rules_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_rules" ADD CONSTRAINT "workflow_transition_rules_from_step_id_fkey" FOREIGN KEY ("from_step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_rules" ADD CONSTRAINT "workflow_transition_rules_to_step_id_fkey" FOREIGN KEY ("to_step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edo_documents" ADD CONSTRAINT "edo_documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "custom_roles_active_idx" RENAME TO "custom_roles_active_sort_order_idx";
