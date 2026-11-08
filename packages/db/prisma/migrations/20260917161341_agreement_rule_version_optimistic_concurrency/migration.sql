-- AlterTable
ALTER TABLE "agreement_versions" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "commercial_rule_versions" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
