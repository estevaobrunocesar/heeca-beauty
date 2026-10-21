import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { todayKey } from "@/lib/dates";
import { whatsappLink } from "@/lib/phone";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { aniversariantes, clientesParaReativar, type Destinataria } from "@/lib/campaigns/db";
import { DEFAULT_BIRTHDAY, DEFAULT_REACTIVATION, montarMensagem, type CampaignKind } from "@/lib/campaigns/rules";
import { RecipientRow } from "./recipient-row";
import { CampaignSettings } from "./campaign-settings";

export const metadata: Metadata = { title: "Campanhas" };

const JANELAS = [{ dias: 7, rotulo: "Próximos 7 dias" }, { dias: 30, rotulo: "Próximos 30 dias" }, { dias: 0, rotulo: "Só hoje" }];

export default async function CampanhasPage({ searchParams }: PageProps<"/app/campanhas">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  if (!ctx.seesTeam) redirect("/app");
  const { tenant } = ctx;
  const hoje = todayKey(tenant.timezone);
  const tipo: CampaignKind = sp.tipo === "reativacao" ? "REACTIVATION" : "BIRTHDAY";
  const diasParam = Number(typeof sp.dias === "string" ? sp.dias : "7");
  const janela = JANELAS.some((j) => j.dias === diasParam) ? diasParam : 7;

  const lista: Destinataria[] = tipo === "BIRTHDAY"
    ? await aniversariantes(tenant.id, hoje, janela)
    : await clientesParaReativar(tenant.id, hoje, tenant.reactivationDays);
  const modelo = tipo === "BIRTHDAY" ? tenant.birthdayMessage || DEFAULT_BIRTHDAY : tenant.reactivationMessage || DEFAULT_REACTIVATION;
  const pendentes = lista.filter((l) => !l.enviada && l.phone).length;

  return (
    <>
      <PageHeader title="Campanhas" description="Quem merece uma mensagem agora: aniversariantes e clientes que sumiram. O envio sai pelo WhatsApp do estabelecimento, uma cliente por vez, e fica registrado para não repetir." />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/app/campanhas?tipo=aniversario" className={`rounded-full border px-3 py-1 ${tipo === "BIRTHDAY" ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700"}`}>🎂 Aniversariantes</Link>
        <Link href="/app/campanhas?tipo=reativacao" className={`rounded-full border px-3 py-1 ${tipo === "REACTIVATION" ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700"}`}>💛 Sumiram ({tenant.reactivationDays}+ dias)</Link>
        {tipo === "BIRTHDAY" && (
          <span className="ml-auto flex gap-1.5 text-xs">
            {JANELAS.map((j) => <Link key={j.dias} href={`/app/campanhas?tipo=aniversario&dias=${j.dias}`} className={`rounded-full border px-2.5 py-1 ${j.dias === janela ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700"}`}>{j.rotulo}</Link>)}
          </span>
        )}
      </div>

      <section className="card mb-6">
        <div className="border-b border-zinc-100 px-4 py-3">
          <h2 className="font-medium">{lista.length} cliente{lista.length === 1 ? "" : "s"} <span className="font-normal text-zinc-500">· {pendentes} para enviar</span></h2>
        </div>
        {lista.length === 0 ? (
          <EmptyState title={tipo === "BIRTHDAY" ? "Nenhum aniversário nesse período" : "Ninguém sumiu por esse tempo"} description={tipo === "BIRTHDAY" ? "A data de aniversário é preenchida na ficha da cliente." : "Quando uma cliente passar do prazo sem voltar, ela aparece aqui."} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {lista.map((l) => {
              const mensagem = montarMensagem(modelo, { nome: l.name, estabelecimento: tenant.businessName });
              return (
                <RecipientRow key={l.id} r={{
                  id: l.id, name: l.name, detalhe: l.detalhe, enviada: l.enviada, kind: tipo,
                  whatsappHref: l.phone ? whatsappLink(l.phone, mensagem) : null,
                  dia: l.dia,
                }} />
              );
            })}
          </ul>
        )}
      </section>

      {ctx.canManage && <CampaignSettings birthdayMessage={tenant.birthdayMessage ?? ""} reactivationMessage={tenant.reactivationMessage ?? ""} reactivationDays={tenant.reactivationDays} />}
      <p className="mt-3 text-xs text-mut">Envio automático em massa depende de modelos de mensagem aprovados pela Meta; enquanto isso, o envio é assistido, direto do WhatsApp da casa.</p>
    </>
  );
}
