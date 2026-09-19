import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { SettingsTabs } from "./tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  // Configurações do estabelecimento são do responsável; STAFF gerencia só o próprio perfil.
  if (!ctx.isOwner) redirect(`/app/equipe/${ctx.professional.id}`);
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Configurações</h1>
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
