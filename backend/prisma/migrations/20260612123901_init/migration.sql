-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('PHYSICAL', 'REMOTE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'ASSIGNED', 'TRANSCRIBED', 'REVIEWED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "PayeeType" AS ENUM ('REPORTER', 'EDITOR');

-- CreateTable
CREATE TABLE "job" (
    "job_id" TEXT NOT NULL,
    "case_name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "location_type" "LocationType" NOT NULL,
    "city" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',
    "reporter_id" TEXT,
    "editor_id" TEXT,
    "reporter_amount" INTEGER,
    "editor_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "reporter" (
    "reporter_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reporter_pkey" PRIMARY KEY ("reporter_id")
);

-- CreateTable
CREATE TABLE "editor" (
    "editor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "editor_pkey" PRIMARY KEY ("editor_id")
);

-- CreateTable
CREATE TABLE "reporter_balance" (
    "reporter_id" TEXT NOT NULL,
    "current_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporter_balance_pkey" PRIMARY KEY ("reporter_id")
);

-- CreateTable
CREATE TABLE "editor_balance" (
    "editor_id" TEXT NOT NULL,
    "current_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_balance_pkey" PRIMARY KEY ("editor_id")
);

-- CreateTable
CREATE TABLE "balance_ledger" (
    "ledger_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "payee_type" "PayeeType" NOT NULL,
    "payee_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "before_balance" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_ledger_pkey" PRIMARY KEY ("ledger_id")
);

-- CreateIndex
CREATE INDEX "job_status_idx" ON "job"("status");

-- CreateIndex
CREATE INDEX "reporter_status_city_idx" ON "reporter"("status", "city");

-- CreateIndex
CREATE INDEX "editor_status_idx" ON "editor"("status");

-- CreateIndex
CREATE INDEX "balance_ledger_payee_type_payee_id_idx" ON "balance_ledger"("payee_type", "payee_id");

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "reporter"("reporter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "editor"("editor_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporter_balance" ADD CONSTRAINT "reporter_balance_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "reporter"("reporter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_balance" ADD CONSTRAINT "editor_balance_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "editor"("editor_id") ON DELETE RESTRICT ON UPDATE CASCADE;
