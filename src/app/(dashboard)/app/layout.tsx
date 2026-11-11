import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { moduloClinicoAtivo } from "@/lib/treatments/rules";
import { marcaDoTenant } from "@/lib/marca-atual";
import { paleta } from "@/lib/marca";
import { paletaDeCor } from "@/lib/cor-pagina";
import { temaDoTenant } from "@/lib/temas";
import { cormorant } from "@/lib/fonts-tema";
import { fmtDate } from "@/lib/dates";
import { AppShell } from "@/components/dashboard/shell";
import { NativeShell } from "@/components/dashboard/native-shell";
import { InstalarApp } from "@/components/dashboard/instalar-app";

const PAPEIS = { OWNER: "dona", MANAGER: "gerente", RECEPTION: "recepção", STAFF: "profissional" } as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant, user, role, permissions, professional, professionals } = await requireAuth();
  const marca = marcaDoTenant(tenant);
  const tema = temaDoTenant(tenant);
  // Pendências do sino: visitas da minha equipe ainda sem confirmação da cliente.
  const pendentes = await db.appointment.count({
    where: { tenantId: tenant.id, status: { in: ["PENDING", "AWAITING_CONFIRMATION", "RESCHEDULE_REQUESTED"] }, startsAt: { gte: new Date() }, items: { some: { professionalId: { in: professionals.map((p) => p.id) } } } },
  });
  const hoje = fmtDate(new Date(), tenant.timezone, "EEE, d 'de' MMM").replace(".", "");
  const especialidade = user.professional?.specialties?.split(",")[0]?.trim();

  return (
    // Estabelecimento com tema (lib/temas.ts): ação grafite, títulos na serifa do site e lateral escura com a logo.
    <div
      className={`flex min-h-full flex-1 ${tema ? `${cormorant.variable} [font-variant-numeric:lining-nums]` : ""}`}
      style={(tema ? { ...paletaDeCor(tema.painel), "--font-display": "var(--font-cormorant), ui-serif, Georgia, serif" } : paleta(marca)) as React.CSSProperties}
    >
      <AppShell
        marca={marca}
        tema={tema}
        tenant={{ slug: tenant.slug, businessName: tenant.businessName, heecaPlan: tenant.heecaPlan, salasAtivas: tenant.salasAtivas, clinicoAtivo: moduloClinicoAtivo(tenant.segmentos) }}
        user={{ name: user.name, email: user.email }}
        role={role}
        permitidos={[...permissions]}
        professionalId={professional.id}
        professionalLabel={[especialidade, PAPEIS[role]].filter(Boolean).join(" · ")}
        pendentes={pendentes}
        hoje={hoje.charAt(0).toUpperCase() + hoje.slice(1)}
      >
        <NativeShell />
        <InstalarApp nome={marca.nome} />
        {children}
      </AppShell>
    </div>
  );
}
