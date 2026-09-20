/**
 * Roda uma vez quando o servidor Next sobe:
 *  1) valida as variáveis críticas — falhar o boot é mais seguro que subir sem segredo de sessão;
 *  2) com CRON_INPROCESS=true, executa as rotinas (lembretes e expiração de pendentes) no próprio
 *     processo. Serve para deploy de instância única (Coolify). Com várias instâncias, desligue e
 *     chame GET /api/cron/reminders e /api/cron/expire por um cron externo (ver vercel.json).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.NODE_ENV === "production") {
    const missing = ["DATABASE_URL", "AUTH_SECRET", "APP_URL"].filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
    if ((process.env.AUTH_SECRET ?? "").length < 32) throw new Error("AUTH_SECRET precisa ter ao menos 32 caracteres em produção");
    if (!process.env.CRON_SECRET) console.warn("[boot] CRON_SECRET vazio: os endpoints /api/cron/* ficam bloqueados (só o cron interno roda)");
    if ((process.env.WHATSAPP_PROVIDER ?? "console") === "console") console.warn("[boot] WHATSAPP_PROVIDER=console: as mensagens só aparecem no log, não chegam às clientes");
  }

  if (process.env.CRON_INPROCESS !== "true") return;
  const { expirePendingAppointments, sendDueReminders } = await import("@/lib/appointments/service");
  const { expirarPacotes } = await import("@/lib/packages/service");
  const every = (label: string, ms: number, fn: () => Promise<number>) => {
    const tick = async () => {
      try {
        const n = await fn();
        if (n > 0) console.log(`[cron] ${label}: ${n}`);
      } catch (e) {
        console.error(`[cron] ${label} falhou:`, e);
      }
    };
    setTimeout(tick, 10_000);
    setInterval(tick, ms);
  };
  every("lembretes enviados", 15 * 60_000, () => sendDueReminders());
  every("pendentes expirados", 5 * 60_000, () => expirePendingAppointments());
  every("pacotes vencidos", 6 * 60 * 60_000, () => expirarPacotes());
  console.log("[cron] interno ativo: lembretes a cada 15 min, expiração a cada 5 min");
}
