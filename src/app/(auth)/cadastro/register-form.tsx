"use client";

import { useActionState } from "react";
import { registerAction } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="businessName">Nome do estabelecimento</label>
        <input id="businessName" name="businessName" required className="input" placeholder="Studio Ana Nails" />
      </div>
      <div>
        <label className="label" htmlFor="ownerName">Seu nome</label>
        <input id="ownerName" name="ownerName" required className="input" placeholder="Carlos Silva" />
      </div>
      <div>
        <label className="label" htmlFor="phone">WhatsApp</label>
        <input id="phone" name="phone" required inputMode="tel" className="input" placeholder="(11) 99999-8888" />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Criando conta...">Criar minha conta</SubmitButton>
    </form>
  );
}
