import { db } from "@/lib/db";
import { baixaPendente, estornoPendente, usoDoAtendimento } from "./rules";

/** Saldo de cada produto do estabelecimento (soma das movimentações). Produto sem movimentação = 0. */
export async function saldosDoTenant(tenantId: string, productIds?: string[]): Promise<Map<string, number>> {
  const rows = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { tenantId, ...(productIds ? { productId: { in: productIds } } : {}) },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

/** Líquido já baixado por produto para um atendimento (USAGE − RETURN; positivo = quanto já saiu). */
async function jaBaixadoDoAtendimento(appointmentId: string): Promise<Map<string, number>> {
  const rows = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { appointmentId, kind: { in: ["USAGE", "RETURN"] } },
    _sum: { quantity: true },
  });
  // quantity é negativa na saída: o líquido que saiu é o oposto da soma.
  return new Map(rows.map((r) => [r.productId, -(r._sum.quantity ?? 0)]));
}

/**
 * Concluiu o atendimento: baixa o que os serviços consomem (receitas de ServiceProduct). Idempotente e sem bloquear:
 * a baixa pode deixar o saldo negativo (a recepção não pode ficar impedida de concluir por falta de lançamento de
 * entrada); o produto aparece como "negativo" no estoque para ser acertado.
 */
export async function baixarEstoqueDoAtendimento(appointmentId: string) {
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: { tenantId: true, items: { select: { serviceId: true } } },
  });
  if (!appt || appt.items.length === 0) return;
  const receitas = await db.serviceProduct.findMany({
    where: { serviceId: { in: [...new Set(appt.items.map((i) => i.serviceId))] }, product: { active: true } },
    select: { serviceId: true, productId: true, quantity: true },
  });
  if (receitas.length === 0) return;

  const falta = baixaPendente(usoDoAtendimento(appt.items, receitas), await jaBaixadoDoAtendimento(appointmentId));
  if (falta.size === 0) return;
  await db.stockMovement.createMany({
    data: [...falta].map(([productId, quantity]) => ({ tenantId: appt.tenantId, productId, kind: "USAGE" as const, quantity: -quantity, appointmentId })),
  });
}

/** Reabriu um atendimento concluído: devolve ao estoque o que havia saído dele. */
export async function estornarEstoqueDoAtendimento(appointmentId: string) {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, select: { tenantId: true } });
  if (!appt) return;
  const volta = estornoPendente(await jaBaixadoDoAtendimento(appointmentId));
  if (volta.size === 0) return;
  await db.stockMovement.createMany({
    data: [...volta].map(([productId, quantity]) => ({ tenantId: appt.tenantId, productId, kind: "RETURN" as const, quantity, appointmentId })),
  });
}
