import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { platformEnabled, portalProductUrl } from "@/lib/heeca/service";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  // Em produção a venda é pelo portal heeca.com.br (conta, plano e cobrança lá; o estabelecimento
  // é provisionado por /api/heeca/provision). O cadastro local fica só para ambientes sem integração.
  if (platformEnabled()) redirect(portalProductUrl());

  return (
    <>
      <h1 className="text-xl font-semibold">Criar conta</h1>
      <p className="mt-1 text-sm text-zinc-500">Em 1 minuto você já tem seu link de agendamento.</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
