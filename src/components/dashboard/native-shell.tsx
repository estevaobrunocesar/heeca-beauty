"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Ponte com o app Heeca instalado no celular (Capacitor). No navegador comum não faz nada.
 * Dentro do app: pede permissão de aviso, entrega o token do aparelho ao servidor e abre a agenda do dia
 * quando a profissional toca num aviso. Usa o `window.Capacitor` que o app injeta, sem dependência no site.
 */

type Plugin = {
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  createChannel?(c: { id: string; name: string; importance: number }): Promise<void>;
  addListener(ev: string, cb: (e: never) => void): Promise<{ remove(): void }>;
};
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: { PushNotifications?: Plugin } };

export function NativeShell() {
  const router = useRouter();
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    const push = cap?.Plugins?.PushNotifications;
    if (!cap?.isNativePlatform?.() || !push) return;
    const platform = cap.getPlatform?.() === "ios" ? "ios" : "android";
    const handles: { remove(): void }[] = [];
    let ativo = true;
    (async () => {
      try {
        await push.createChannel?.({ id: "agenda", name: "Agenda", importance: 4 });
        handles.push(await push.addListener("registration", ((e: { value: string }) => {
          void fetch("/api/mobile/push-token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: e.value, platform }) });
        }) as never));
        handles.push(await push.addListener("pushNotificationActionPerformed", ((e: { notification: { data?: { destino?: string } } }) => {
          const destino = e.notification.data?.destino;
          if (destino?.startsWith("/app/")) router.push(destino);
        }) as never));
        const perm = await push.requestPermissions();
        if (ativo && perm.receive === "granted") await push.register();
      } catch (err) {
        console.error("[app] avisos indisponíveis", err);
      }
    })();
    return () => { ativo = false; handles.forEach((h) => h.remove()); };
  }, [router]);
  return null;
}
