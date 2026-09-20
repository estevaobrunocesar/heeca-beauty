import type { WhatsappProvider } from "./provider";
import { ConsoleProvider } from "./providers/console";
import { MetaCloudProvider } from "./providers/meta";
import { HeecaNotifyProvider } from "./providers/notify";

let cached: WhatsappProvider | null = null;

export function getWhatsappProvider(): WhatsappProvider {
  if (cached) return cached;
  const name = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase();
  // "notify" = Heeca Notify (padrão da plataforma: nenhum produto fala com a Meta); "meta" fica só para desenvolvimento/legado.
  cached = name === "notify" ? new HeecaNotifyProvider() : name === "meta" ? new MetaCloudProvider() : new ConsoleProvider();
  return cached;
}
