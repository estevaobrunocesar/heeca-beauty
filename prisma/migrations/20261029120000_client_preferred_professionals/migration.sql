-- CreateTable
CREATE TABLE "ClientProfessional" (
    "clientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,

    CONSTRAINT "ClientProfessional_pkey" PRIMARY KEY ("clientId","professionalId")
);

-- CreateIndex
CREATE INDEX "ClientProfessional_professionalId_idx" ON "ClientProfessional"("professionalId");

-- AddForeignKey
ALTER TABLE "ClientProfessional" ADD CONSTRAINT "ClientProfessional_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfessional" ADD CONSTRAINT "ClientProfessional_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A preferência única que já existia vira a primeira linha da lista.
INSERT INTO "ClientProfessional" ("clientId", "professionalId")
SELECT "id", "preferredProfessionalId" FROM "Client" WHERE "preferredProfessionalId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_preferredProfessionalId_fkey";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "preferredProfessionalId";
