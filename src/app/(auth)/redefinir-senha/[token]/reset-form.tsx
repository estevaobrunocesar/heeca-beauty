"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <SubmitButton className="btn-primary w-full">Redefinir senha</SubmitButton>
    </form>
  );
}
