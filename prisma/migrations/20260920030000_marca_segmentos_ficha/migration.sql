-- Motor Heeca Schedule: marca (produto) + segmentos por estabelecimento + ficha por segmento (20/09/2026).
ALTER TABLE "Tenant" ADD COLUMN "marca" TEXT NOT NULL DEFAULT 'beauty',
                     ADD COLUMN "segmentos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Tenant_marca_idx" ON "Tenant"("marca");

-- Ficha técnica: formato/tamanho de unha viram campos do segmento "unhas" no JSON.
ALTER TABLE "Client" ADD COLUMN "ficha" JSONB;
UPDATE "Client" SET "ficha" = jsonb_strip_nulls(jsonb_build_object('unhas.formato', "nailShape", 'unhas.tamanho', "nailSize"))
  WHERE "nailShape" IS NOT NULL OR "nailSize" IS NOT NULL;
ALTER TABLE "Client" DROP COLUMN "nailShape", DROP COLUMN "nailSize";

-- Registro do atendimento (o que foi feito na visita), mesmos códigos da ficha.
ALTER TABLE "Appointment" ADD COLUMN "registro" JSONB;
