-- Valores adicionais do atendimento (produtos usados, lançados ao concluir)
CREATE TABLE "AppointmentCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentCharge_appointmentId_idx" ON "AppointmentCharge"("appointmentId");
CREATE INDEX "AppointmentCharge_tenantId_createdAt_idx" ON "AppointmentCharge"("tenantId", "createdAt");

ALTER TABLE "AppointmentCharge" ADD CONSTRAINT "AppointmentCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentCharge" ADD CONSTRAINT "AppointmentCharge_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
