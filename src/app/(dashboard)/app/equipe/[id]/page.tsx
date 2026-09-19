import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { minutesToHHMM } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { WeeklyHoursForm, type DayValue } from "@/components/dashboard/weekly-hours-form";
import { ProfileForm } from "./profile-form";
import { AccessForm } from "./access-form";

export default async function ProfessionalPage({ params }: PageProps<"/app/equipe/[id]">) {
  const { id } = await params;
  const ctx = await requireAuth();
  const pro = ctx.professionals.find((p) => p.id === id);
  if (!pro) notFound();
  if (!ctx.canManage && ctx.user.professional?.id !== id) redirect("/app");

  const [services, rules, user] = await Promise.all([
    db.service.findMany({ where: { tenantId: ctx.tenant.id, deletedAt: null }, orderBy: { sortOrder: "asc" }, include: { professionals: { where: { professionalId: id }, select: { professionalId: true, commissionPercent: true } } } }),
    db.availabilityRule.findMany({ where: { professionalId: id } }),
    pro.userId ? db.user.findUnique({ where: { id: pro.userId }, select: { email: true, role: true } }) : null,
  ]);

  const days: DayValue[] = Array.from({ length: 7 }, (_, weekday) => {
    const r = rules.find((x) => x.weekday === weekday);
    return {
      weekday, enabled: !!r,
      start: r ? minutesToHHMM(r.startMinutes) : "09:00",
      end: r ? minutesToHHMM(r.endMinutes) : "18:00",
      breakStart: r?.breakStartMinutes != null ? minutesToHHMM(r.breakStartMinutes) : "",
      breakEnd: r?.breakEndMinutes != null ? minutesToHHMM(r.breakEndMinutes) : "",
    };
  });

  return (
    <>
      {ctx.canManage && <div className="mb-4"><Link href="/app/equipe" className="text-sm text-zinc-500 hover:underline">‹ Equipe</Link></div>}
      <PageHeader title={pro.name} description={ctx.canManage ? "Perfil, serviços que executa, horários e acesso ao painel." : "Seu perfil e seus horários de atendimento."} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <ProfileForm
            id={pro.id}
            canManage={ctx.canManage}
            initial={{ name: pro.name, bio: pro.bio ?? "", photoUrl: pro.photoUrl ?? "", phone: pro.phone ?? "", email: pro.email ?? "", specialties: pro.specialties ?? "", commissionPercent: pro.commissionPercent, active: pro.active }}
            services={services.map((s) => ({ id: s.id, name: s.name, active: s.active, checked: s.professionals.length > 0, commissionPercent: s.professionals[0]?.commissionPercent ?? null }))}
          />
        </div>

        <aside className="space-y-6">
          {/* Acessos e perfis são só do dono (SPEC §6) */}
          {ctx.isOwner && (
            <AccessForm
              id={pro.id}
              email={user?.email ?? ""}
              hasAccess={!!pro.userId}
              isOwnerAccount={user?.role === "OWNER"}
              role={user?.role === "MANAGER" || user?.role === "RECEPTION" ? user.role : "STAFF"}
            />
          )}
          <section className="card p-5 text-sm text-zinc-600">
            <h2 className="font-medium text-zinc-900">Folgas, bloqueios e férias</h2>
            <p className="mt-1">São registrados pela <Link href={`/app/agenda?pro=${pro.id}`} className="underline">agenda</Link>, com o profissional selecionado.</p>
          </section>
        </aside>
      </div>

      <div className="mt-6">
        <WeeklyHoursForm professionalId={pro.id} days={days} />
      </div>
    </>
  );
}
