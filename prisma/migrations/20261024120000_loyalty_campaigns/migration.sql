-- CreateEnum
CREATE TYPE "CashbackKind" AS ENUM ('EARN', 'REVERSAL', 'REDEEM', 'ADJUST');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "birthdayMessage" TEXT,
ADD COLUMN     "cashbackPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reactivationDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "reactivationMessage" TEXT;

-- CreateTable
CREATE TABLE "CashbackEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "kind" "CashbackKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashbackEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashbackEntry_clientId_createdAt_idx" ON "CashbackEntry"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "CashbackEntry_appointmentId_idx" ON "CashbackEntry"("appointmentId");

-- CreateIndex
CREATE INDEX "CashbackEntry_tenantId_createdAt_idx" ON "CashbackEntry"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignSend_tenantId_kind_createdAt_idx" ON "CampaignSend"("tenantId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSend_tenantId_clientId_kind_periodKey_key" ON "CampaignSend"("tenantId", "clientId", "kind", "periodKey");

-- AddForeignKey
ALTER TABLE "CashbackEntry" ADD CONSTRAINT "CashbackEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackEntry" ADD CONSTRAINT "CashbackEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackEntry" ADD CONSTRAINT "CashbackEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

