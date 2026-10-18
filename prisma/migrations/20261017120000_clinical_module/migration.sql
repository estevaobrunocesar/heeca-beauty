-- CreateEnum
CREATE TYPE "PlanPaymentMethod" AS ENUM ('PIX', 'CASH', 'CREDIT', 'DEBIT', 'TRANSFER');

-- AlterTable
ALTER TABLE "ClientPackage" ADD COLUMN     "assessmentId" TEXT,
ADD COLUMN     "intervalDays" INTEGER,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "professionalId" TEXT,
ADD COLUMN     "protocolId" TEXT;

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "protocolId" TEXT;

-- AlterTable
ALTER TABLE "PackageSession" ADD COLUMN     "evolution" TEXT,
ADD COLUMN     "productsUsed" TEXT;

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "sessionsCount" INTEGER NOT NULL,
    "intervalDays" INTEGER,
    "products" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolStep" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ProtocolStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "complaints" TEXT,
    "analysis" TEXT,
    "notes" TEXT,
    "recommendedProtocolId" TEXT,
    "suggestedSessions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentService" (
    "assessmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "AssessmentService_pkey" PRIMARY KEY ("assessmentId","serviceId")
);

-- CreateTable
CREATE TABLE "ClientPackagePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientPackageId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PlanPaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPackagePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Protocol_tenantId_active_sortOrder_idx" ON "Protocol"("tenantId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "ProtocolStep_serviceId_idx" ON "ProtocolStep"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolStep_protocolId_order_key" ON "ProtocolStep"("protocolId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_appointmentId_key" ON "Assessment"("appointmentId");

-- CreateIndex
CREATE INDEX "Assessment_tenantId_performedAt_idx" ON "Assessment"("tenantId", "performedAt");

-- CreateIndex
CREATE INDEX "Assessment_clientId_performedAt_idx" ON "Assessment"("clientId", "performedAt");

-- CreateIndex
CREATE INDEX "AssessmentService_serviceId_idx" ON "AssessmentService"("serviceId");

-- CreateIndex
CREATE INDEX "ClientPackagePayment_clientPackageId_idx" ON "ClientPackagePayment"("clientPackageId");

-- CreateIndex
CREATE INDEX "ClientPackagePayment_tenantId_paidAt_idx" ON "ClientPackagePayment"("tenantId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPackage_assessmentId_key" ON "ClientPackage"("assessmentId");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolStep" ADD CONSTRAINT "ProtocolStep_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolStep" ADD CONSTRAINT "ProtocolStep_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_recommendedProtocolId_fkey" FOREIGN KEY ("recommendedProtocolId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentService" ADD CONSTRAINT "AssessmentService_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentService" ADD CONSTRAINT "AssessmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackagePayment" ADD CONSTRAINT "ClientPackagePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackagePayment" ADD CONSTRAINT "ClientPackagePayment_clientPackageId_fkey" FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

