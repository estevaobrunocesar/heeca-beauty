-- CreateEnum
CREATE TYPE "ClientPackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackageSessionStatus" AS ENUM ('SCHEDULED', 'DONE', 'NO_SHOW', 'CANCELLED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "faltaConsomeSessao" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceId" TEXT,
    "categoryId" TEXT,
    "sessionsCount" INTEGER NOT NULL,
    "validityDays" INTEGER,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "onlineVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "packageId" TEXT,
    "serviceId" TEXT,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "sessionsTotal" INTEGER NOT NULL,
    "startsAt" DATE NOT NULL,
    "expiresAt" DATE,
    "priceCents" INTEGER NOT NULL,
    "status" "ClientPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientPackageId" TEXT NOT NULL,
    "itemId" TEXT,
    "status" "PackageSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "performedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Package_tenantId_active_sortOrder_idx" ON "Package"("tenantId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "ClientPackage_tenantId_status_expiresAt_idx" ON "ClientPackage"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ClientPackage_clientId_status_idx" ON "ClientPackage"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PackageSession_itemId_key" ON "PackageSession"("itemId");

-- CreateIndex
CREATE INDEX "PackageSession_clientPackageId_status_idx" ON "PackageSession"("clientPackageId", "status");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSession" ADD CONSTRAINT "PackageSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSession" ADD CONSTRAINT "PackageSession_clientPackageId_fkey" FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSession" ADD CONSTRAINT "PackageSession_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AppointmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
