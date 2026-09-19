import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ params }: PageProps<"/redefinir-senha/[token]">) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-xl font-semibold">Nova senha</h1>
      <p className="mt-1 text-sm text-zinc-500">Escolha uma senha com ao menos 8 caracteres.</p>
      <div className="mt-6">
        <ResetForm token={token} />
      </div>
    </>
  );
}
