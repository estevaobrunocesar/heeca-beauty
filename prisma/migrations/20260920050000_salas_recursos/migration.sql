-- AlterTable
ALTER TABLE "AppointmentItem" ADD COLUMN     "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomId" TEXT;

-- AlterTable
ALTER TABLE "ScheduleBlock" ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "roomId" TEXT,
ALTER COLUMN "professionalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "salasAtivas" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRoom" (
    "serviceId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "ServiceRoom_pkey" PRIMARY KEY ("serviceId","roomId")
);

-- CreateTable
CREATE TABLE "ServiceResource" (
    "serviceId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceResource_pkey" PRIMARY KEY ("serviceId","resourceId")
);

-- CreateTable
CREATE TABLE "AppointmentItemResource" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AppointmentItemResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_tenantId_active_sortOrder_idx" ON "Room"("tenantId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "Resource_tenantId_active_sortOrder_idx" ON "Resource"("tenantId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "ServiceRoom_roomId_idx" ON "ServiceRoom"("roomId");

-- CreateIndex
CREATE INDEX "ServiceResource_resourceId_idx" ON "ServiceResource"("resourceId");

-- CreateIndex
CREATE INDEX "AppointmentItemResource_resourceId_idx" ON "AppointmentItemResource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentItemResource_itemId_resourceId_key" ON "AppointmentItemResource"("itemId", "resourceId");

-- CreateIndex
CREATE INDEX "AppointmentItem_roomId_startsAt_endsAt_idx" ON "AppointmentItem"("roomId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_roomId_startsAt_endsAt_idx" ON "ScheduleBlock"("roomId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_resourceId_startsAt_endsAt_idx" ON "ScheduleBlock"("resourceId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRoom" ADD CONSTRAINT "ServiceRoom_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRoom" ADD CONSTRAINT "ServiceRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItemResource" ADD CONSTRAINT "AppointmentItemResource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AppointmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItemResource" ADD CONSTRAINT "AppointmentItemResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
