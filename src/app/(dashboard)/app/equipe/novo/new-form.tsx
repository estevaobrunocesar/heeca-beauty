"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProfessionalAction } from "@/actions/professionals";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { ImageField } from "@/components/ui/image-field";

export function NewProfessionalForm() {
  const router = useRouter();
  const [state, action] = useActionState(createProfessionalAction, null);
  useEffect(() => { if (state?.ok) router.push(`/app/equipe/${state.message}`); }, [state, router]);

  return (
    <form action={action} className="card max-w-xl space-y-4 p-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="name">Nome</label>
        <input id="name" name="name" required className="input" placeholder="Ana Souza" />
      </div>
      <div>
        <label className="label" htmlFor="bio">Descrição curta (opcional)</label>
        <input id="bio" name="bio" className="input" placeholder="Especialista em alongamento em fibra e nail art" />
      </div>
      <ImageField name="photoUrl" kind="professional" shape="circle" label="Foto (opcional)" hint="Aparece na página pública ao escolher o profissional." />
      <div className="flex gap-2 pt-2">
        <SubmitButton pendingText="Criando...">Criar profissional</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  );
}
