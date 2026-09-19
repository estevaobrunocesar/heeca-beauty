-- Cadastro do salão (SPEC §4): razão social, CNPJ, e-mail, site, fotos, horário de funcionamento, informações adicionais
ALTER TABLE "Tenant"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "cnpj" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "openingHours" TEXT,
  ADD COLUMN "extraInfo" TEXT;
