-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AccountSource" AS ENUM ('MANUAL', 'CSV', 'SEED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedDomain" TEXT,
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headcount" INTEGER,
    "hqCity" TEXT,
    "hqCountry" TEXT,
    "industryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lists" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentName" TEXT,
    "parentDomain" TEXT,
    "revenue" DECIMAL(18,4),
    "source" "AccountSource" NOT NULL DEFAULT 'MANUAL',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_similarity_edges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "targetAccountId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "calculationVersion" TEXT NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_similarity_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_partner_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "relationship" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "account_partner_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_tenantId_idx" ON "accounts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenantId_normalizedDomain_key" ON "accounts"("tenantId", "normalizedDomain");

-- CreateIndex
CREATE INDEX "account_similarity_edges_tenantId_idx" ON "account_similarity_edges"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "account_similarity_edges_tenantId_sourceAccountId_targetAccountId_key" ON "account_similarity_edges"("tenantId", "sourceAccountId", "targetAccountId");

-- CreateIndex
CREATE INDEX "account_partner_links_tenantId_idx" ON "account_partner_links"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "account_partner_links_tenantId_accountId_partnerId_key" ON "account_partner_links"("tenantId", "accountId", "partnerId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_similarity_edges" ADD CONSTRAINT "account_similarity_edges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_similarity_edges" ADD CONSTRAINT "account_similarity_edges_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_similarity_edges" ADD CONSTRAINT "account_similarity_edges_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_partner_links" ADD CONSTRAINT "account_partner_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_partner_links" ADD CONSTRAINT "account_partner_links_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_partner_links" ADD CONSTRAINT "account_partner_links_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_partner_links" ADD CONSTRAINT "account_partner_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
