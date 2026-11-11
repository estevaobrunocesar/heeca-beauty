import { db } from "@/lib/db";

/**
 * Unificação de cadastros duplicados de clientes. Todo agendamento sem telefone cria uma cliente nova
 * (`createAppointment`), então a mesma pessoa aparece várias vezes. Aqui: achar os grupos prováveis e juntá-los.
 */

export type ClienteResumo = { id: string; name: string; phone: string | null; atendimentos: number; createdAt: Date };

/** Nome comparável: sem acento, caixa ou espaços repetidos ("  Adriana  " = "adriana"). */
export function chaveDeNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Quem fica: a que tem telefone; depois a com mais atendimentos; depois a mais antiga. */
export function escolherPrincipal<T extends ClienteResumo>(grupo: T[]): T {
  return [...grupo].sort((a, b) => Number(!!b.phone) - Number(!!a.phone) || b.atendimentos - a.atendimentos || a.createdAt.getTime() - b.createdAt.getTime())[0];
}

/**
 * Grupos de cadastros com o mesmo nome que podem ser juntados sem dúvida: no máximo UMA delas tem telefone.
 * Duas com telefones diferentes são pessoas diferentes e nunca entram.
 */
export function gruposDuplicados<T extends ClienteResumo>(clientes: T[]): { principal: T; duplicadas: T[] }[] {
  const porNome = new Map<string, T[]>();
  for (const c of clientes) {
    const k = chaveDeNome(c.name);
    if (k) porNome.set(k, [...(porNome.get(k) ?? []), c]);
  }
  const grupos: { principal: T; duplicadas: T[] }[] = [];
  for (const g of porNome.values()) {
    if (g.length < 2 || g.filter((c) => c.phone).length > 1) continue;
    const principal = escolherPrincipal(g);
    grupos.push({ principal, duplicadas: g.filter((c) => c.id !== principal.id) });
  }
  return grupos.sort((a, b) => a.principal.name.localeCompare(b.principal.name, "pt-BR"));
}

/** Junta os textos de observação sem repetir. */
export function juntarTexto(a: string | null, b: string | null): string | null {
  const partes = [a, b].map((t) => t?.trim()).filter((t): t is string => !!t);
  return partes.length ? [...new Set(partes)].join("\n") : null;
}

/** Ficha técnica: os valores da principal prevalecem; as chaves que só a outra tem são aproveitadas. */
export function juntarFicha(principal: unknown, outra: unknown): Record<string, unknown> | null {
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const r = { ...obj(outra), ...obj(principal) };
  return Object.keys(r).length ? r : null;
}

/**
 * Move tudo das duplicadas para a principal (agendamentos, cashback, pacotes, avaliações, mensagens, preferências e envios
 * de campanha), completa os dados que faltam e apaga as duplicadas. Tudo em uma transação: ou junta tudo ou nada.
 */
export async function unificarClientes(tenantId: string, principalId: string, duplicadasIds: string[]) {
  const ids = [...new Set(duplicadasIds)].filter((i) => i !== principalId);
  if (!ids.length) return { unificadas: 0 };
  return db.$transaction(
    async (tx) => {
      const principal = await tx.client.findFirst({ where: { id: principalId, tenantId } });
      const outras = await tx.client.findMany({ where: { id: { in: ids }, tenantId }, orderBy: { createdAt: "asc" } });
      if (!principal || outras.length !== ids.length) throw new Error("Cadastro não encontrado.");
      if (outras.some((o) => o.phone && principal.phone && o.phone !== principal.phone)) throw new Error("Cadastros com telefones diferentes não podem ser unificados.");

      // Completa a principal com o que só as outras têm.
      const dados = { phone: principal.phone, email: principal.email, cpf: principal.cpf, birthDate: principal.birthDate, allergies: principal.allergies, maintenanceIntervalDays: principal.maintenanceIntervalDays, notes: principal.notes, ficha: principal.ficha as unknown };
      for (const o of outras) {
        dados.phone ??= o.phone; dados.email ??= o.email; dados.cpf ??= o.cpf; dados.birthDate ??= o.birthDate;
        dados.allergies ??= o.allergies; dados.maintenanceIntervalDays ??= o.maintenanceIntervalDays;
        dados.notes = juntarTexto(dados.notes, o.notes);
        dados.ficha = juntarFicha(dados.ficha, o.ficha);
      }
      // O telefone é único por estabelecimento: sai da duplicada antes de ir para a principal.
      if (!principal.phone && dados.phone) await tx.client.updateMany({ where: { id: { in: ids } }, data: { phone: null } });

      await tx.appointment.updateMany({ where: { clientId: { in: ids } }, data: { clientId: principalId } });
      await tx.cashbackEntry.updateMany({ where: { clientId: { in: ids } }, data: { clientId: principalId } });
      await tx.clientPackage.updateMany({ where: { clientId: { in: ids } }, data: { clientId: principalId } });
      await tx.assessment.updateMany({ where: { clientId: { in: ids } }, data: { clientId: principalId } });
      await tx.whatsappMessage.updateMany({ where: { clientId: { in: ids } }, data: { clientId: principalId } });

      // Preferências e envios de campanha têm chave única: só passa o que a principal ainda não tem.
      const jaPref = new Set((await tx.clientProfessional.findMany({ where: { clientId: principalId }, select: { professionalId: true } })).map((r) => r.professionalId));
      const prefs = await tx.clientProfessional.findMany({ where: { clientId: { in: ids } }, select: { professionalId: true } });
      for (const pid of new Set(prefs.map((p) => p.professionalId))) if (!jaPref.has(pid)) await tx.clientProfessional.create({ data: { clientId: principalId, professionalId: pid } });
      const envios = await tx.campaignSend.findMany({ where: { clientId: { in: ids } } });
      const jaEnvio = new Set((await tx.campaignSend.findMany({ where: { clientId: principalId } })).map((e) => `${e.kind}|${e.periodKey}`));
      for (const e of envios) {
        const k = `${e.kind}|${e.periodKey}`;
        if (jaEnvio.has(k)) continue;
        jaEnvio.add(k);
        await tx.campaignSend.update({ where: { id: e.id }, data: { clientId: principalId } });
      }

      await tx.client.deleteMany({ where: { id: { in: ids }, tenantId } }); // preferências e envios restantes saem em cascata
      await tx.client.update({
        where: { id: principalId },
        data: { phone: dados.phone, email: dados.email, cpf: dados.cpf, birthDate: dados.birthDate, allergies: dados.allergies, maintenanceIntervalDays: dados.maintenanceIntervalDays, notes: dados.notes, ficha: (dados.ficha ?? undefined) as never },
      });
      return { unificadas: ids.length };
    },
    { timeout: 30_000 },
  );
}
