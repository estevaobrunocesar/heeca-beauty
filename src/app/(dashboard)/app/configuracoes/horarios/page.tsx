import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { Avatar } from "@/components/dashboard/avatar";
import { ScheduleForm } from "./schedule-form";

export default async function ScheduleSettingsPage() {
  const ctx = await requireAuth();
  // STAFF não altera regras do estabelecimento; seus horários ficam na própria página.
  if (!ctx.isOwner) redirect(`/app/equipe/${ctx.professional.id}`);
  const { tenant } = ctx;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-medium">Horários de atendimento</h2>
        <p className="mt-1 text-sm text-zinc-500">Cada profissional tem sua própria semana. Clique para editar.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ctx.professionals.map((p) => (
            <li key={p.id}>
              <Link href={`/app/equipe/${p.id}`} className="btn-secondary gap-2 pl-2">
                <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                {p.name}
              </Link>
            </li>
          ))}
          <li><Link href="/app/equipe/novo" className="btn-ghost">+ Adicionar profissional</Link></li>
        </ul>
      </section>

      <ScheduleForm
        rules={{
          slotIntervalMinutes: tenant.slotIntervalMinutes,
          bufferMinutes: tenant.bufferMinutes,
          minAdvanceMinutes: tenant.minAdvanceMinutes,
          maxAdvanceDays: tenant.maxAdvanceDays,
          pendingExpiryMinutes: tenant.pendingExpiryMinutes ?? 0,
          cancelDeadlineHours: tenant.cancelDeadlineHours,
          reminderHoursBefore: tenant.reminderHoursBefore,
          maxConcurrentAppointments: tenant.maxConcurrentAppointments,
          maxDailyAppointments: tenant.maxDailyAppointments,
          requireWhatsappConfirmation: tenant.requireWhatsappConfirmation,
        }}
      />
    </div>
  );
}
