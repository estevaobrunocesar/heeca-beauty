-- Perfis de acesso (SPEC §6): gerente e recepcionista
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'RECEPTION';
