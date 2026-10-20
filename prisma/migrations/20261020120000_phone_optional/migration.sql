-- Telefone da cliente opcional por estabelecimento (padrão: continua obrigatório)
ALTER TABLE "Tenant" ADD COLUMN "requirePhone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Client" ALTER COLUMN "phone" DROP NOT NULL;
