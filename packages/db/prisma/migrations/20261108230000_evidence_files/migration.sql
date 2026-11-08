-- CreateTable
CREATE TABLE "evidence_files" (
    "storageKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("storageKey")
);

-- CreateIndex
CREATE INDEX "evidence_files_tenantId_idx" ON "evidence_files"("tenantId");
