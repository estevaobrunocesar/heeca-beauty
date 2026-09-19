-- Comissão: quando o salão acertou o valor com o profissional (SPEC §17: valores pagos/pendentes)
ALTER TABLE "AppointmentItem" ADD COLUMN "commissionPaidAt" TIMESTAMP(3);
CREATE INDEX "AppointmentItem_professionalId_commissionPaidAt_idx" ON "AppointmentItem"("professionalId", "commissionPaidAt");
