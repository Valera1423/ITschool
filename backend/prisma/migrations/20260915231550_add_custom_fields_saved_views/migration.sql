-- CreateTable
CREATE TABLE "custom_fields" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_value" TEXT,
    "help_text" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "show_in_table" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "entity" TEXT NOT NULL DEFAULT 'universities',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "value_text" TEXT,
    "value_number" DOUBLE PRECISION,
    "value_date" DATE,
    "value_bool" BOOLEAN,
    "value_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'universities',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "sort" JSONB,
    "color" TEXT,
    "icon" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_key_key" ON "custom_fields"("key");

-- CreateIndex
CREATE INDEX "custom_fields_entity_sort_order_idx" ON "custom_fields"("entity", "sort_order");

-- CreateIndex
CREATE INDEX "custom_field_values_entity_id_idx" ON "custom_field_values"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_field_id_entity_id_key" ON "custom_field_values"("field_id", "entity_id");

-- CreateIndex
CREATE INDEX "saved_views_user_id_entity_idx" ON "saved_views"("user_id", "entity");

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
