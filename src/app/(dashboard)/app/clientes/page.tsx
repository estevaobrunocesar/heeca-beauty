import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { perfilDoTenant } from "@/lib/marca-atual";
import { lerFicha, resumoFicha } from "@/lib/clients/ficha";
import { fmtDate } from "@/lib/dates";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/app/clientes">) {
  const sp = await searchParams;
  const { tenant } = await requireAuth();
  const { ficha } = perfilDoTenant(tenant);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const clients = await db.client.findMany({
    where: {
      tenantId: tenant.id,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { appointments: true } },
      appointments: { where: { status: "COMPLETED" }, orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true, serviceName: true } },
    },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Clientes" description="Cadastrados automaticamente a cada agendamento." />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" className="input max-w-sm" />
        <button className="btn-secondary">Buscar</button>
      </form>

      {clients.length === 0 ? (
        <EmptyState title={q ? "Nenhuma cliente encontrada" : "Nenhuma cliente ainda"} description="As clientes aparecem aqui assim que fazem o primeiro agendamento." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium">Ficha</th>
                <th className="px-4 py-2 font-medium">Atendimentos</th>
                <th className="px-4 py-2 font-medium">Último atendimento</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2 font-medium"><Link href={`/app/clientes/${c.id}`} className="hover:underline">{c.name}</Link></td>
                  <td className="px-4 py-2"><a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{formatPhone(c.phone)}</a></td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {resumoFicha(ficha, lerFicha(c.ficha, ficha)) || "—"}
                    {c.allergies && <span className="ml-1 text-rose-600" title={c.allergies}>⚠️</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{c._count.appointments}</td>
                  <td className="px-4 py-2 text-zinc-600">{c.appointments[0] ? `${fmtDate(c.appointments[0].startsAt, tenant.timezone)} · ${c.appointments[0].serviceName}` : "—"}</td>
                  <td className="px-4 py-2 text-right"><Link href={`/app/agenda/novo?cliente=${encodeURIComponent(c.phone)}`} className="btn-ghost px-2 py-1 text-xs">Agendar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
