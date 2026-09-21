import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { marcaDoTenant } from "@/lib/marca-atual";
import { paleta } from "@/lib/marca";
import { fmtDate } from "@/lib/dates";
import { AppShell } from "@/components/dashboard/shell";

const PAPEIS = { OWNER: "dona", MANAGER: "gerente", RECEPTION: "recepção", STAFF: "profissional" } as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant, user, role, canManage, professional, professionals } = await requireAuth();
  const marca = marcaDoTenant(tenant);
  // Pendências do sino: visitas da minha equipe ainda sem confirmação da cliente.
  const pendentes = await db.appointment.count({
    where: { tenantId: tenant.id, status: { in: ["PENDING", "AWAITING_CONFIRMATION", "RESCHEDULE_REQUESTED"] }, startsAt: { gte: new Date() }, items: { some: { professionalId: { in: professionals.map((p) => p.id) } } } },
  });
  const hoje = fmtDate(new Date(), tenant.timezone, "EEE, d 'de' MMM").replace(".", "");
  const especialidade = user.professional?.specialties?.split(",")[0]?.trim();

  return (
    <div className="flex min-h-full flex-1" style={paleta(marca) as React.CSSProperties}>
      <AppShell
        marca={marca}
        tenant={{ slug: tenant.slug, businessName: tenant.businessName, heecaPlan: tenant.heecaPlan, salasAtivas: tenant.salasAtivas }}
        user={{ name: user.name, email: user.email }}
        role={role}
        canManage={canManage}
        professionalId={professional.id}
        professionalLabel={[especialidade, PAPEIS[role]].filter(Boolean).join(" · ")}
        pendentes={pendentes}
        hoje={hoje.charAt(0).toUpperCase() + hoje.slice(1)}
      >
        {children}
      </AppShell>
    </div>
  );
}
