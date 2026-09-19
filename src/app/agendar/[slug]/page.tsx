import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { minutesToHHMM, todayKey } from "@/lib/dates";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { computeDepositCents } from "@/lib/payments/deposit";
import { policyItems, hasPolicies } from "@/lib/policies";
import { BookingWizard } from "./booking-wizard";
import { Gallery } from "./gallery";

async function loadTenant(slug: string) {
  return db.tenant.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true, deletedAt: null }, orderBy: { sortOrder: "asc" } },
      categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, sortOrder: true } },
      professionals: {
        where: { active: true }, orderBy: { sortOrder: "asc" },
        include: { services: { select: { serviceId: true } }, availability: { orderBy: { weekday: "asc" } } },
      },
      portfolio: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }], take: 24, include: { category: { select: { name: true } } } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/agendar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await db.tenant.findUnique({ where: { slug }, select: { businessName: true, description: true, logoUrl: true } });
  if (!t) return { title: "Não encontrado" };
  return {
    title: `Agendar · ${t.businessName}`,
    description: t.description ?? `Agende seu horário com ${t.businessName}`,
    openGraph: { title: t.businessName, description: t.description ?? undefined, images: t.logoUrl ? [t.logoUrl] : undefined },
  };
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Seg–Sex 09:00–18:00 · Sáb 09:00–14:00" a partir das regras semanais de um profissional. */
function openingHours(rules: { weekday: number; startMinutes: number; endMinutes: number }[]): string[] {
  const lines: string[] = [];
  let run: { from: number; to: number; hours: string } | null = null;
  const flush = () => { if (run) lines.push(`${WEEKDAYS[run.from]}${run.to !== run.from ? `–${WEEKDAYS[run.to]}` : ""} ${run.hours}`); };
  for (let d = 0; d <= 6; d++) {
    const r = rules.find((x) => x.weekday === d);
    const hours = r ? `${minutesToHHMM(r.startMinutes)}–${minutesToHHMM(r.endMinutes)}` : null;
    if (hours && run && run.hours === hours && run.to === d - 1) run.to = d;
    else { flush(); run = hours ? { from: d, to: d, hours } : null; }
  }
  flush();
  return lines;
}

export default async function PublicBookingPage({ params }: PageProps<"/agendar/[slug]">) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  if (!tenant || tenant.professionals.length === 0) notFound();

  const main = tenant.services.filter((s) => !s.isAddOn);
  const addOns = tenant.services.filter((s) => s.isAddOn);
  const policies = policyItems(tenant);
  const hours = openingHours(tenant.professionals[0].availability);
  const single = tenant.professionals.length === 1;

  return (
    <div className="min-h-full bg-[#f7f1ee]">
      <main className="mx-auto min-h-full max-w-lg bg-white shadow-[0_0_60px_-20px_rgba(120,40,70,0.25)]">
        {/* Cabeçalho */}
        <header className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-5 pb-10 pt-10 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-4">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.businessName} className="h-20 w-20 rounded-full object-cover ring-4 ring-white/20" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 font-display text-3xl font-semibold ring-4 ring-white/20">
                {tenant.businessName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-semibold leading-tight">{tenant.businessName}</h1>
              <p className="mt-0.5 text-sm text-brand-100">
                {single ? `Nail Designer · ${tenant.professionals[0].name}` : `${tenant.professionals.length} profissionais`}
              </p>
            </div>
          </div>
          {tenant.description && <p className="relative mt-5 text-sm leading-relaxed text-brand-50/90">{tenant.description}</p>}
          <div className="relative mt-5 flex flex-wrap gap-2 text-xs">
            {tenant.instagram && (
              <a href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noreferrer" className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur hover:bg-white/25">
                📸 @{tenant.instagram}
              </a>
            )}
            {tenant.phone && (
              <a href={whatsappLink(tenant.phone)} target="_blank" rel="noreferrer" className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur hover:bg-white/25">
                💬 {formatPhone(tenant.phone)}
              </a>
            )}
            {(tenant.address || tenant.city) && (
              <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">📍 {[tenant.address, tenant.city].filter(Boolean).join(" · ")}</span>
            )}
          </div>
        </header>

        {/* Portfólio */}
        {tenant.portfolio.length > 0 && (
          <section className="border-b border-brand-100 bg-brand-50/40 py-5">
            <div className="mb-3 flex items-baseline justify-between px-5">
              <h2 className="font-display text-2xl font-semibold text-brand-950">Trabalhos</h2>
              <span className="text-xs text-zinc-500">{tenant.portfolio.length} foto{tenant.portfolio.length > 1 ? "s" : ""}</span>
            </div>
            <Gallery items={tenant.portfolio.map((p) => ({ id: p.id, imageUrl: p.imageUrl, title: p.title, description: p.description, category: p.category?.name ?? null }))} />
          </section>
        )}

        {/* Agendamento */}
        <div className="px-5 py-6" id="agendar">
          {main.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">Este salão ainda não liberou serviços para agendamento online.</p>
          ) : (
            <BookingWizard
              slug={tenant.slug}
              todayKey={todayKey(tenant.timezone)}
              maxAdvanceDays={tenant.maxAdvanceDays}
              requireConfirmation={tenant.requireWhatsappConfirmation}
              requirePolicyAcceptance={tenant.requirePolicyAcceptance && hasPolicies(tenant)}
              policies={policies}
              categories={tenant.categories}
              professionals={tenant.professionals.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl, bio: p.bio, serviceIds: p.services.map((s) => s.serviceId) }))}
              services={main.map((s) => ({
                id: s.id, name: s.name, categoryId: s.categoryId, description: s.description, clientNotes: s.clientNotes,
                durationMinutes: s.durationMinutes, priceCents: s.priceCents, imageUrl: s.imageUrl,
                depositCents: computeDepositCents(tenant, s.priceCents),
              }))}
              addOns={addOns.map((s) => ({ id: s.id, name: s.name, description: s.description, clientNotes: s.clientNotes, durationMinutes: s.durationMinutes, priceCents: s.priceCents }))}
              depositMode={tenant.depositMode}
              depositValue={tenant.depositValue}
            />
          )}
        </div>

        {/* Informações */}
        <section className="space-y-6 border-t border-zinc-100 bg-zinc-50/60 px-5 py-6 text-sm">
          {hours.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-brand-950">Horário de atendimento</h2>
              <ul className="mt-2 space-y-0.5 text-zinc-600">
                {hours.map((h) => <li key={h}>{h}</li>)}
              </ul>
              {tenant.professionals.length > 1 && <p className="mt-1 text-xs text-zinc-400">Horários de {tenant.professionals[0].name}; cada profissional tem a própria agenda.</p>}
            </div>
          )}
          {policies.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-brand-950">Políticas de atendimento</h2>
              <ul className="mt-2 space-y-2">
                {policies.map((p) => (
                  <li key={p.title} className="flex gap-2 text-zinc-600">
                    <span aria-hidden className="shrink-0">{p.icon}</span>
                    <span><span className="font-medium text-zinc-800">{p.title}:</span> {p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tenant.phone && (
            <a href={whatsappLink(tenant.phone, `Olá! Vi sua página de agendamento e queria tirar uma dúvida.`)} target="_blank" rel="noreferrer" className="btn w-full border border-emerald-200 bg-emerald-50 py-3 text-emerald-800 hover:bg-emerald-100">
              💬 Falar no WhatsApp
            </a>
          )}
        </section>

        <footer className="px-5 py-5 text-center text-xs text-zinc-400">
          Agendamento online por <span className="font-medium text-zinc-500">Heeca Beauty</span>
        </footer>
      </main>
    </div>
  );
}
