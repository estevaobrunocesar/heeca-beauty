import type { Metadata } from "next";
import { portalUrl } from "@/lib/heeca/service";
import { logoutAction } from "@/actions/auth";

export const metadata: Metadata = { title: "Acesso bloqueado" };

/**
 * Assinatura bloqueada no portal Heeca (inadimplência ou cancelamento). O painel fecha;
 * a página pública de agendamento continua. Regularização é no portal — aqui não há cobrança.
 */
export default function BloqueadoPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold">Acesso bloqueado</h1>
      <p className="mt-2 text-sm text-zinc-600">
        A assinatura do Heeca Beauty deste estabelecimento está bloqueada. Regularize o pagamento na sua conta Heeca para voltar a usar o painel.
      </p>
      <a href={`${portalUrl()}/conta`} className="btn-primary mt-6 block text-center">Abrir minha conta Heeca</a>
      <form action={logoutAction} className="mt-3">
        <button type="submit" className="w-full text-sm text-zinc-500 hover:underline">Sair</button>
      </form>
    </main>
  );
}
