-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_methods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contact_name" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_streams" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learners" (
    "id" UUID NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "snils" TEXT,
    "passport_series" TEXT,
    "passport_number" TEXT,
    "passport_issued_by" TEXT,
    "passport_issued_at" DATE,
    "passport_dept_code" TEXT,
    "birth_date" DATE,
    "gender" TEXT,
    "reg_region" TEXT,
    "reg_city" TEXT,
    "reg_street" TEXT,
    "reg_house" TEXT,
    "reg_flat" TEXT,
    "reg_index" TEXT,
    "education_level" TEXT,
    "diploma_profession" TEXT,
    "diploma_institution" TEXT,
    "diploma_last_name" TEXT,
    "diploma_number" TEXT,
    "diploma_series" TEXT,
    "diploma_reg_number" TEXT,
    "diploma_issued_at" DATE,
    "phone_hash" TEXT,
    "email_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "course_id" UUID NOT NULL,
    "stream_id" UUID,
    "learner_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Новая',
    "paid_at" TIMESTAMP(3),
    "amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_name_key" ON "courses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "course_streams_course_id_number_key" ON "course_streams"("course_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "learners_phone_hash_key" ON "learners"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "learners_email_hash_key" ON "learners"("email_hash");

-- CreateIndex
CREATE INDEX "learners_last_name_first_name_idx" ON "learners"("last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "orders_external_id_key" ON "orders"("external_id");

-- CreateIndex
CREATE INDEX "orders_learner_id_idx" ON "orders"("learner_id");

-- CreateIndex
CREATE INDEX "orders_course_id_idx" ON "orders"("course_id");

-- CreateIndex
CREATE INDEX "orders_stream_id_idx" ON "orders"("stream_id");

-- AddForeignKey
ALTER TABLE "course_streams" ADD CONSTRAINT "course_streams_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "course_streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
