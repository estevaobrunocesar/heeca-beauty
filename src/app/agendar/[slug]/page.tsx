import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { minutesToHHMM, todayKey } from "@/lib/dates";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { formatCents } from "@/lib/money";
import { computeDepositCents } from "@/lib/payments/deposit";
import { policyItems, hasPolicies } from "@/lib/policies";
import { BookingWizard } from "./booking-wizard";
import { marcaDoTenant, mesmaMarcaDoHost, paletaDoTenant } from "@/lib/marca-atual";
import { HEECA_PRODUCTS, HeecaAppIcon, type HeecaProduct } from "@/components/brand/logo";
import { Gallery } from "./gallery";
import { groupByCategory, UNCATEGORIZED_LABEL } from "@/lib/services/categories";
import { Fraunces } from "next/font/google";

// Serifa de títulos da página pública: dá personalidade de vitrine sem tocar no restante do painel.
const serif = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], display: "swap" });

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
      units: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, address: true } },
      portfolio: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }], take: 24, include: { category: { select: { name: true } } } },
      packages: { where: { active: true, onlineVisible: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, description: true, sessionsCount: true, validityDays: true, priceCents: true } },
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
  // Isolamento entre produtos: a página de um estabelecimento só existe no host da marca dele.
  if (!tenant || tenant.professionals.length === 0 || !(await mesmaMarcaDoHost(tenant))) notFound();
  const marca = marcaDoTenant(tenant);

  const main = tenant.services.filter((s) => !s.isAddOn);
  const addOns = tenant.services.filter((s) => s.isAddOn);
  const policies = policyItems(tenant);
  const hours = openingHours(tenant.professionals[0].availability);
  const single = tenant.professionals.length === 1;

  // Imagens do próprio estabelecimento (só upload): fotos do espaço primeiro, depois os trabalhos.
  const pics = [...tenant.photoUrls, ...tenant.portfolio.map((p) => p.imageUrl)];
  const [heroPic, sidePic, thirdPic] = pics;
  const grupos = groupByCategory(main, tenant.categories);
  const desde = main.length ? Math.min(...main.map((s) => s.priceCents)) : 0;
  const mostrar = tenant.portfolio.slice(0, 9);
  const horarioCurto = tenant.openingHours ?? hours[0] ?? null;
  const endereco = [tenant.address, tenant.city].filter(Boolean).join(" · ");
  const urlSite = tenant.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  return (
    <div className="min-h-full bg-white text-brand-950" style={paletaDoTenant(tenant) as React.CSSProperties}>
      {/* Barra fixa: identidade + chamada para agendar */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-brand-950/85 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-2.5">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt={tenant.businessName} className="h-9 w-auto max-w-[10rem] object-contain" />
          ) : (
            <span className={`${serif.className} flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm`}>{tenant.businessName.slice(0, 1).toUpperCase()}</span>
          )}
          {/* Com logo, a logo é o nome (o alt já o diz): sem o texto ao lado. Sem logo, aparece o nome. */}
          {tenant.logoUrl ? <span className="flex-1" aria-hidden /> : <span className="min-w-0 flex-1 truncate text-sm font-medium">{tenant.businessName}</span>}
          <a href="#agendar" className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand-900 transition hover:bg-brand-50">Agendar</a>
        </div>
      </div>

      {/* Abertura */}
      <header className="relative isolate overflow-hidden bg-brand-950 text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_85%_10%,var(--color-brand-700),transparent_70%),radial-gradient(50%_60%_at_0%_100%,var(--color-brand-900),transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 md:grid-cols-[1.15fr_1fr] md:pb-24 md:pt-20">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-200">
              {single ? tenant.professionals[0].name : `${tenant.professionals.length} profissionais`}{tenant.city ? ` · ${tenant.city}` : ""}
            </p>
            <h1 className={`${serif.className} mt-4 text-[clamp(2.75rem,9vw,5.5rem)] font-medium leading-[0.95] tracking-tight`}>{tenant.businessName}</h1>
            {tenant.description && <p className="mt-6 max-w-md text-base leading-relaxed text-brand-50/85">{tenant.description}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#agendar" className="rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-brand-900 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-brand-50">Agendar meu horário</a>
              {tenant.phone && (
                <a href={whatsappLink(tenant.phone, "Olá! Vi sua página de agendamento e queria tirar uma dúvida.")} target="_blank" rel="noreferrer" className="rounded-full border border-white/30 px-6 py-3.5 text-[15px] font-medium transition hover:bg-white/10">Falar no WhatsApp</a>
              )}
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/15 pt-6">
              <div><dt className="text-[11px] uppercase tracking-widest text-brand-200">Serviços</dt><dd className={`${serif.className} text-3xl`}>{main.length}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-widest text-brand-200">Equipe</dt><dd className={`${serif.className} text-3xl`}>{tenant.professionals.length}</dd></div>
              {desde > 0 && <div><dt className="text-[11px] uppercase tracking-widest text-brand-200">A partir de</dt><dd className={`${serif.className} text-3xl`}>{formatCents(desde)}</dd></div>}
            </dl>
          </div>

          {/* Arco: a moldura de um espelho de salão, com as fotos do próprio estabelecimento */}
          <div className="relative mx-auto w-full max-w-sm md:max-w-none">
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[2rem] bg-gradient-to-b from-brand-700 to-brand-900 ring-1 ring-white/20">
              {heroPic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroPic} alt="" className="h-full w-full object-cover" />
              ) : tenant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt="" className="h-full w-full object-contain p-16" />
              ) : (
                <div className={`${serif.className} flex h-full items-center justify-center text-[10rem] text-white/20`}>{tenant.businessName.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            {sidePic && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sidePic} alt="" className="absolute -bottom-6 -left-3 h-32 w-28 rounded-2xl object-cover shadow-2xl ring-4 ring-brand-950 sm:-left-8 sm:h-40 sm:w-32" />
            )}
            {thirdPic && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thirdPic} alt="" className="absolute -right-2 top-1/3 hidden h-28 w-24 rounded-2xl object-cover shadow-2xl ring-4 ring-brand-950 sm:block md:-right-6" />
            )}
          </div>
        </div>

        {/* Faixa de contato */}
        <div className="border-t border-white/10 bg-black/15">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-2 px-5 py-4 text-sm text-brand-50/90">
            {endereco && <span>📍 {endereco}</span>}
            {horarioCurto && <span>🕘 {horarioCurto}</span>}
            {tenant.instagram && <a href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noreferrer" className="hover:text-white">📸 @{tenant.instagram}</a>}
            {tenant.phone && <a href={whatsappLink(tenant.phone)} target="_blank" rel="noreferrer" className="hover:text-white">💬 {formatPhone(tenant.phone)}</a>}
            {tenant.website && urlSite && <a href={tenant.website} target="_blank" rel="noreferrer" className="hover:text-white">🌐 {urlSite}</a>}
          </div>
        </div>
      </header>

      {/* Serviços por categoria */}
      {grupos.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">Serviços</p>
          <h2 className={`${serif.className} mt-2 max-w-xl text-4xl font-medium leading-tight md:text-5xl`}>O que a gente faz por você</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grupos.map((g) => {
              const min = Math.min(...g.items.map((i) => i.priceCents));
              return (
                <li key={g.category?.id ?? "outros"}>
                  <a href="#agendar" className="group flex h-full flex-col justify-between rounded-3xl border border-brand-100 bg-brand-50/50 p-6 transition hover:-translate-y-1 hover:border-brand-300 hover:bg-brand-50">
                    <div>
                      <h3 className={`${serif.className} text-2xl font-medium`}>{g.category?.name ?? UNCATEGORIZED_LABEL}</h3>
                      <p className="mt-2 text-sm text-brand-900/70">{g.items.slice(0, 3).map((i) => i.name).join(" · ")}{g.items.length > 3 ? " …" : ""}</p>
                    </div>
                    <div className="mt-6 flex items-end justify-between text-sm">
                      <span className="text-brand-900/60">{g.items.length} opç{g.items.length > 1 ? "ões" : "ão"}</span>
                      <span className="font-semibold text-brand-700">a partir de {formatCents(min)} <span aria-hidden className="inline-block transition group-hover:translate-x-1">→</span></span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Equipe */}
      <section className="bg-brand-50/60 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">Equipe</p>
          <h2 className={`${serif.className} mt-2 text-4xl font-medium leading-tight md:text-5xl`}>Quem cuida de você</h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {tenant.professionals.slice(0, 12).map((p) => (
              <li key={p.id}>
                <div className="aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-200 to-brand-400">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className={`${serif.className} flex h-full items-center justify-center text-6xl text-white/80`}>{p.name.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <p className={`${serif.className} mt-3 text-xl font-medium`}>{p.name}</p>
                {p.bio && <p className="mt-0.5 line-clamp-2 text-sm text-brand-900/65">{p.bio}</p>}
              </li>
            ))}
          </ul>
          {tenant.professionals.length > 12 && <p className="mt-8 text-sm text-brand-900/60">e mais {tenant.professionals.length - 12} profissionais — você escolhe ao agendar.</p>}
        </div>
      </section>

      {/* Trabalhos */}
      {mostrar.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">Portfólio</p>
          <h2 className={`${serif.className} mt-2 mb-10 text-4xl font-medium leading-tight md:text-5xl`}>Trabalhos que falam por nós</h2>
          <Gallery grid items={mostrar.map((p) => ({ id: p.id, imageUrl: p.imageUrl, title: p.title, description: p.description, category: p.category?.name ?? null }))} />
        </section>
      )}

      {/* Pacotes (vitrine → WhatsApp) */}
      {tenant.packages.length > 0 && (
        <section className="bg-brand-950 py-16 text-white md:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-200">Pacotes</p>
            <h2 className={`${serif.className} mt-2 text-4xl font-medium leading-tight md:text-5xl`}>Mais sessões, menos por sessão</h2>
            <ul className="mt-10 grid gap-4 md:grid-cols-2">
              {tenant.packages.map((p) => (
                <li key={p.id} className="flex flex-col justify-between rounded-3xl border border-white/15 bg-white/5 p-6">
                  <div>
                    <h3 className={`${serif.className} text-2xl`}>{p.name}</h3>
                    <p className="mt-1 text-sm text-brand-100/80">{p.sessionsCount} sessões{p.validityDays ? ` · válido por ${p.validityDays} dias` : ""}</p>
                    {p.description && <p className="mt-2 text-sm text-brand-100/70">{p.description}</p>}
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <span className={`${serif.className} text-3xl`}>{formatCents(p.priceCents)}</span>
                    {tenant.phone && <a href={whatsappLink(tenant.phone, `Olá! Tenho interesse no pacote "${p.name}".`)} target="_blank" rel="noreferrer" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50">Quero este</a>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Agendamento */}
      <section id="agendar" className="scroll-mt-14 bg-gradient-to-b from-white to-brand-50 py-16 md:py-24">
        <div className="mx-auto max-w-2xl px-5">
          <p className="text-center text-xs font-medium uppercase tracking-[0.22em] text-brand-600">Agendamento online</p>
          <h2 className={`${serif.className} mt-2 text-center text-4xl font-medium leading-tight md:text-5xl`}>Reserve seu horário</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-brand-900/65">Escolha os serviços, o melhor horário e pronto. A confirmação chega no seu WhatsApp.</p>
          <div className="mt-10 rounded-[1.75rem] border border-brand-100 bg-white p-5 shadow-xl shadow-brand-900/5 sm:p-8">
            {main.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">Este estabelecimento ainda não liberou serviços para agendamento online.</p>
            ) : (
              <BookingWizard
                slug={tenant.slug}
                todayKey={todayKey(tenant.timezone)}
                maxAdvanceDays={tenant.maxAdvanceDays}
                requireConfirmation={tenant.requireWhatsappConfirmation}
                requirePolicyAcceptance={tenant.requirePolicyAcceptance && hasPolicies(tenant)}
                policies={policies}
                categories={tenant.categories}
                professionals={tenant.professionals.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl, bio: p.bio, unitId: p.unitId, serviceIds: p.services.map((s) => s.serviceId) }))}
                units={tenant.units.length >= 2 ? tenant.units : []}
                services={main.map((s) => ({
                  id: s.id, name: s.name, categoryId: s.categoryId, description: s.description, clientNotes: s.clientNotes,
                  durationMinutes: s.durationMinutes, priceCents: s.priceCents, imageUrl: s.imageUrl,
                  depositCents: computeDepositCents(tenant, s.priceCents),
                }))}
                addOns={addOns.map((s) => ({ id: s.id, name: s.name, description: s.description, clientNotes: s.clientNotes, durationMinutes: s.durationMinutes, priceCents: s.priceCents }))}
                depositMode={tenant.depositMode}
                depositValue={tenant.depositValue}
                requirePhone={tenant.requirePhone}
              />
            )}
          </div>
        </div>
      </section>

      {/* Informações */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 text-sm md:grid-cols-3 md:py-20">
        <div>
          <h2 className={`${serif.className} text-2xl font-medium`}>{tenant.openingHours ? "Horário de funcionamento" : "Horário de atendimento"}</h2>
          {tenant.openingHours ? (
            <p className="mt-3 whitespace-pre-line text-brand-900/70">{tenant.openingHours}</p>
          ) : hours.length > 0 ? (
            <ul className="mt-3 space-y-0.5 text-brand-900/70">{hours.map((h) => <li key={h}>{h}</li>)}</ul>
          ) : null}
          {tenant.professionals.length > 1 && <p className="mt-2 text-xs text-brand-900/45">Cada profissional tem a própria agenda; os horários livres aparecem ao escolher os serviços.</p>}
          {endereco && <p className="mt-5 text-brand-900/70">📍 {endereco}</p>}
        </div>
        {(tenant.extraInfo || policies.length > 0) && (
          <div className="md:col-span-2">
            {tenant.extraInfo && (
              <>
                <h2 className={`${serif.className} text-2xl font-medium`}>Bom saber</h2>
                <p className="mt-3 whitespace-pre-line text-brand-900/70">{tenant.extraInfo}</p>
              </>
            )}
            {policies.length > 0 && (
              <>
                <h2 className={`${serif.className} text-2xl font-medium ${tenant.extraInfo ? "mt-8" : ""}`}>Políticas de atendimento</h2>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {policies.map((p) => (
                    <li key={p.title} className="flex gap-2 rounded-2xl bg-brand-50/60 p-4 text-brand-900/75">
                      <span aria-hidden className="shrink-0">{p.icon}</span>
                      <span><span className="font-medium text-brand-950">{p.title}:</span> {p.text}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <footer className="border-t border-brand-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-brand-900/50">
          <span>© {new Date().getFullYear()} {tenant.businessName}</span>
          <span className="flex items-center gap-2">
            <HeecaAppIcon product={(marca.slug in HEECA_PRODUCTS ? marca.slug : "heeca") as HeecaProduct} size={20} radius={5} />
            Agendamento online por <span className="font-medium text-brand-900/70">{marca.nome}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
