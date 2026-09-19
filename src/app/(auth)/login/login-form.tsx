"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

export function LoginForm({ portalSsoUrl, ssoError }: { portalSsoUrl: string | null; ssoError?: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      {ssoError && <Alert>{ssoError}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      {portalSsoUrl && (
        <>
          <a href={portalSsoUrl} className="btn-primary w-full text-center block">Entrar com a conta Heeca</a>
          <div className="flex items-center gap-3 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200" />ou com e-mail e senha<span className="h-px flex-1 bg-zinc-200" /></div>
        </>
      )}
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">Senha</label>
          <Link href="/recuperar-senha" className="text-xs text-zinc-500 hover:underline">Esqueci a senha</Link>
        </div>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Entrando...">Entrar</SubmitButton>
    </form>
  );
}
