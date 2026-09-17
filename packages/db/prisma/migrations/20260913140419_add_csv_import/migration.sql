-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'MAPPED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "ImportRowDisposition" AS ENUM ('PENDING', 'CREATE', 'UPDATE', 'SKIP', 'REJECT');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "columnHeaders" TEXT[],
    "fieldMapping" JSONB,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "mappedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "committedById" TEXT,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "disposition" "ImportRowDisposition" NOT NULL DEFAULT 'PENDING',
    "matchReason" TEXT,
    "rejectReason" TEXT,
    "matchedPartnerId" TEXT,
    "forceCreate" BOOLEAN NOT NULL DEFAULT false,
    "committedPartnerId" TEXT,
    "committedPartnershipId" TEXT,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_tenantId_idx" ON "import_batches"("tenantId");

-- CreateIndex
CREATE INDEX "import_rows_batchId_idx" ON "import_rows"("batchId");

-- CreateIndex
CREATE INDEX "import_rows_tenantId_idx" ON "import_rows"("tenantId");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_committedById_fkey" FOREIGN KEY ("committedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
