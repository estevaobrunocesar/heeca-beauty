-- Tabela de comissões padrão por serviço (vale para todos); o acordo individual continua em ProfessionalService.
ALTER TABLE "Service" ADD COLUMN "commissionPercent" INTEGER,
ADD COLUMN "commissionFixedCents" INTEGER;

-- A comissão geral do profissional deixa de ser lida. Para não mudar o que cada pessoa recebe hoje, ela vira
-- acordo nos serviços que executa e ainda não tinham comissão própria.
UPDATE "ProfessionalService" ps
SET "commissionPercent" = p."commissionPercent"
FROM "Professional" p
WHERE ps."professionalId" = p."id"
  AND ps."commissionPercent" IS NULL
  AND ps."commissionFixedCents" IS NULL
  AND p."commissionPercent" IS NOT NULL;
