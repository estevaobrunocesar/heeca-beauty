-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "cpf" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "pixWebhookToken" TEXT;


-- O único meio de pagamento é o Asaas: o provedor Mercado Pago deixa de existir.
-- Quem tinha "mercadopago" volta ao padrão do ambiente e a credencial antiga (inútil agora) é descartada.
UPDATE "Tenant" SET "pixProvider" = NULL, "pixCredentialsEnc" = NULL WHERE "pixProvider" = 'mercadopago';
