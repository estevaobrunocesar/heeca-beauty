import type { WhatsappProvider } from "./provider";
import { ConsoleProvider } from "./providers/console";
import { MetaCloudProvider } from "./providers/meta";

let cached: WhatsappProvider | null = null;

export function getWhatsappProvider(): WhatsappProvider {
  if (cached) return cached;
  const name = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase();
  cached = name === "meta" ? new MetaCloudProvider() : new ConsoleProvider();
  return cached;
}
