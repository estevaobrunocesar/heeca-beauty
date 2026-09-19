import type { Tenant } from "@/generated/prisma/client";

/** Campos de políticas de atendimento (seção 14) que a profissional configura. */
export type PolicyFields = Pick<
  Tenant,
  | "lateToleranceMinutes" | "cancellationPolicy" | "noShowPolicy" | "reschedulePolicy"
  | "companionsAllowed" | "preServiceInstructions" | "cancelDeadlineHours"
>;

export type PolicyItem = { icon: string; title: string; text: string };

/**
 * Monta a lista de políticas exibida na página pública e no resumo do agendamento.
 * Só entram as regras que a profissional preencheu; a tolerância de atraso e o prazo
 * de cancelamento têm texto padrão porque sempre existem como número.
 */
export function policyItems(t: PolicyFields): PolicyItem[] {
  const items: PolicyItem[] = [];
  if (t.lateToleranceMinutes > 0) {
    items.push({
      icon: "⏰",
      title: "Tolerância de atraso",
      text: `${t.lateToleranceMinutes} minutos. Após esse período, o atendimento poderá ser cancelado conforme a disponibilidade da profissional.`,
    });
  }
  items.push({
    icon: "📅",
    title: "Cancelamento",
    text: t.cancellationPolicy?.trim() || (t.cancelDeadlineHours > 0
      ? `Cancelamentos devem ser feitos com pelo menos ${t.cancelDeadlineHours}h de antecedência pelo link enviado no WhatsApp.`
      : "Cancelamentos podem ser feitos pelo link enviado no WhatsApp."),
  });
  if (t.reschedulePolicy?.trim()) items.push({ icon: "🔁", title: "Reagendamento", text: t.reschedulePolicy.trim() });
  if (t.noShowPolicy?.trim()) items.push({ icon: "🚫", title: "Não comparecimento", text: t.noShowPolicy.trim() });
  if (!t.companionsAllowed) items.push({ icon: "👤", title: "Acompanhantes", text: "Para o conforto de todas, pedimos que venha sem acompanhantes." });
  if (t.preServiceInstructions?.trim()) items.push({ icon: "💅", title: "Antes do atendimento", text: t.preServiceInstructions.trim() });
  return items;
}

/** Há alguma política configurada além dos padrões? Define se a cliente precisa aceitar ao agendar. */
export function hasPolicies(t: PolicyFields): boolean {
  return Boolean(
    t.lateToleranceMinutes > 0 || t.cancellationPolicy?.trim() || t.noShowPolicy?.trim() ||
    t.reschedulePolicy?.trim() || !t.companionsAllowed || t.preServiceInstructions?.trim(),
  );
}
