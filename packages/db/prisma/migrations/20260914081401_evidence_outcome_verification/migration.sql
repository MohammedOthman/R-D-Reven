-- CreateEnum
CREATE TYPE "EvidenceClassification" AS ENUM ('INTERNAL', 'SHAREABLE');

-- CreateEnum
CREATE TYPE "OutcomeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFICATION_REQUIRED', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnershipId" TEXT,
    "initiativeId" TEXT,
    "actionId" TEXT,
    "outcomeId" TEXT,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "narrative" TEXT NOT NULL,
    "classification" "EvidenceClassification" NOT NULL DEFAULT 'INTERNAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contributionId" TEXT,
    "outcomeId" TEXT,
    "source" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "classification" "EvidenceClassification" NOT NULL DEFAULT 'INTERNAL',
    "replacesEvidenceId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcomes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "type" TEXT NOT NULL,
    "claimedResult" TEXT NOT NULL,
    "value" DECIMAL(18,4),
    "unit" TEXT,
    "period" TEXT,
    "status" "OutcomeStatus" NOT NULL DEFAULT 'DRAFT',
    "verifierId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifierDisposition" TEXT,
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributions_tenantId_idx" ON "contributions"("tenantId");

-- CreateIndex
CREATE INDEX "contributions_partnershipId_idx" ON "contributions"("partnershipId");

-- CreateIndex
CREATE INDEX "contributions_initiativeId_idx" ON "contributions"("initiativeId");

-- CreateIndex
CREATE INDEX "contributions_actionId_idx" ON "contributions"("actionId");

-- CreateIndex
CREATE INDEX "contributions_outcomeId_idx" ON "contributions"("outcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_replacesEvidenceId_key" ON "evidence"("replacesEvidenceId");

-- CreateIndex
CREATE INDEX "evidence_tenantId_idx" ON "evidence"("tenantId");

-- CreateIndex
CREATE INDEX "evidence_contributionId_idx" ON "evidence"("contributionId");

-- CreateIndex
CREATE INDEX "evidence_outcomeId_idx" ON "evidence"("outcomeId");

-- CreateIndex
CREATE INDEX "outcomes_tenantId_idx" ON "outcomes"("tenantId");

-- CreateIndex
CREATE INDEX "outcomes_partnershipId_idx" ON "outcomes"("partnershipId");

-- CreateIndex
CREATE INDEX "outcomes_initiativeId_idx" ON "outcomes"("initiativeId");

-- CreateIndex
CREATE INDEX "outcomes_verifierId_idx" ON "outcomes"("verifierId");

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_replacesEvidenceId_fkey" FOREIGN KEY ("replacesEvidenceId") REFERENCES "evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
