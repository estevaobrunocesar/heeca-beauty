-- Vínculo do tenant com a assinatura do portal heeca.com.br (espelho de plano/status; o Nail não cobra).
ALTER TABLE "Tenant"
  ADD COLUMN "heecaSubscriptionId" TEXT,
  ADD COLUMN "heecaAccountId" TEXT,
  ADD COLUMN "heecaPlan" TEXT,
  ADD COLUMN "heecaStatus" TEXT,
  ADD COLUMN "heecaBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "heecaSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Tenant_heecaSubscriptionId_key" ON "Tenant"("heecaSubscriptionId");
