import { requireAuth } from "@/lib/auth/session";
import { policyItems } from "@/lib/policies";
import { PoliciesForm } from "./policies-form";

export default async function PoliciesSettingsPage() {
  const { tenant } = await requireAuth();
  const preview = policyItems(tenant);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <PoliciesForm
        initial={{
          lateToleranceMinutes: tenant.lateToleranceMinutes,
          cancellationPolicy: tenant.cancellationPolicy ?? "",
          reschedulePolicy: tenant.reschedulePolicy ?? "",
          noShowPolicy: tenant.noShowPolicy ?? "",
          preServiceInstructions: tenant.preServiceInstructions ?? "",
          companionsAllowed: tenant.companionsAllowed,
          requirePolicyAcceptance: tenant.requirePolicyAcceptance,
        }}
      />
      <aside className="card h-fit p-5">
        <h2 className="font-medium">Como a cliente vê</h2>
        <p className="mt-1 text-sm text-zinc-500">Estas regras aparecem na sua página de agendamento{tenant.requirePolicyAcceptance ? " e precisam ser aceitas ao agendar" : ""}.</p>
        <ul className="mt-4 space-y-3">
          {preview.map((p) => (
            <li key={p.title} className="flex gap-2 text-sm">
              <span aria-hidden>{p.icon}</span>
              <div>
                <p className="font-medium text-zinc-800">{p.title}</p>
                <p className="text-zinc-600">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
