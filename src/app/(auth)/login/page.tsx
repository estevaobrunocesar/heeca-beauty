import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Alert } from "@/components/ui/alert";
import { platformEnabled, portalProductUrl, portalSsoUrl } from "@/lib/heeca/service";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-zinc-500">Acesse o painel do seu estabelecimento.</p>
      {sp.redefinida && (
        <div className="mt-4">
          <Alert kind="success">Senha redefinida! Faça login.</Alert>
        </div>
      )}
      <div className="mt-6">
        <LoginForm portalSsoUrl={platformEnabled() ? portalSsoUrl() : null} ssoError={typeof sp.sso_error === "string" ? sp.sso_error : undefined} />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Ainda não tem conta?{" "}
        <Link href={platformEnabled() ? portalProductUrl() : "/cadastro"} className="font-medium text-brand-600 hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </>
  );
}
