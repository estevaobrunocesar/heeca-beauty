import { db } from "@/lib/db";
import { fmtDate, toDateKey } from "@/lib/dates";
import { destinoDoAviso, mensagemDoAviso, usuariosDoAviso, type TipoAviso } from "./rules";
import { enviarPush, fcmConfigurado } from "./fcm";

/**
 * Avisa no celular as profissionais da visita (novo agendamento, cancelamento).
 * Nunca lança: aviso é conforto, não pode derrubar o agendamento nem a mudança de status.
 */
export async function avisarProfissionais(appointmentId: string, tipo: TipoAviso): Promise<void> {
  try {
    if (!fcmConfigurado()) return;
    const appt = await db.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        startsAt: true, serviceName: true, tenant: { select: { timezone: true } }, client: { select: { name: true } },
        items: { select: { professional: { select: { userId: true } } } },
      },
    });
    if (!appt) return;
    const usuarios = usuariosDoAviso(appt.items);
    if (usuarios.length === 0) return;
    const tz = appt.tenant.timezone;
    const aviso = {
      ...mensagemDoAviso(tipo, { cliente: appt.client.name, servico: appt.serviceName, quando: fmtDate(appt.startsAt, tz, "EEE, dd/MM 'às' HH:mm") }),
      destino: destinoDoAviso(toDateKey(appt.startsAt, tz)),
    };
    const aparelhos = await db.deviceToken.findMany({ where: { userId: { in: usuarios } }, select: { id: true, token: true } });
    const mortos: string[] = [];
    await Promise.all(aparelhos.map(async (a) => { if ((await enviarPush(a.token, aviso)) === "token-invalido") mortos.push(a.id); }));
    if (mortos.length) await db.deviceToken.deleteMany({ where: { id: { in: mortos } } });
  } catch (err) {
    console.error("[push] aviso falhou", appointmentId, err);
  }
}
