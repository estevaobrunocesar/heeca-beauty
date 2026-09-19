"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordResetAction, null);
  return (
    <>
      <h1 className="text-xl font-semibold">Recuperar senha</h1>
      <p className="mt-1 text-sm text-zinc-500">Informe seu e-mail e enviaremos um link para redefinir.</p>
      <form action={action} className="mt-6 space-y-4">
        {state?.ok && <Alert kind="success">{state.message}</Alert>}
        {state && !state.ok && <Alert>{state.error}</Alert>}
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Enviando...">Enviar link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link href="/login" className="hover:underline">Voltar ao login</Link>
      </p>
    </>
  );
}
