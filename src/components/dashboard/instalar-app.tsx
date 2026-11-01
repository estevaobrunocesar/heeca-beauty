"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { convidarParaInstalar, ehIos } from "@/lib/pwa";

type EventoDeInstalacao = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const CHAVE = "heeca-instalar-dispensado";

/** Lê do navegador, em texto simples (estável entre leituras): "standalone|nativo|dispensado|ios". No servidor é vazio. */
function lerAmbiente() {
  const nativo = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  let dispensado = false;
  try { dispensado = localStorage.getItem(CHAVE) === "1"; } catch { /* navegação privada: convida sempre */ }
  return [standalone, nativo, dispensado, ehIos(navigator.userAgent, navigator.maxTouchPoints)].map(Number).join("|");
}
const semAssinatura = () => () => {};

/**
 * Registra o service worker e, no navegador comum, convida a instalar o painel como app (Android/Chrome: botão
 * "Instalar"; iPhone: passo a passo do Safari). Some quando já está instalado, dentro do app da loja ou se dispensado.
 */
export function InstalarApp({ nome }: { nome: string }) {
  const [standalone, nativo, dispensado, ios] = useSyncExternalStore(semAssinatura, lerAmbiente, () => "").split("|").map((v) => v === "1");
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [agoraNao, setAgoraNao] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("[pwa] service worker", e));
  }, []);

  useEffect(() => {
    const aoOferecer = (e: Event) => { e.preventDefault(); setEvento(e as EventoDeInstalacao); };
    const aoInstalar = () => { setEvento(null); setAgoraNao(true); };
    window.addEventListener("beforeinstallprompt", aoOferecer);
    window.addEventListener("appinstalled", aoInstalar);
    return () => { window.removeEventListener("beforeinstallprompt", aoOferecer); window.removeEventListener("appinstalled", aoInstalar); };
  }, []);

  function dispensar() {
    try { localStorage.setItem(CHAVE, "1"); } catch { /* sem armazenamento: some só até recarregar */ }
    setAgoraNao(true);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === "accepted") setAgoraNao(true);
  }

  if (agoraNao || !convidarParaInstalar({ standalone, nativo, dispensado }) || (!evento && !ios)) return null;
  return (
    <div className="card mb-4 flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <p className="min-w-0 flex-1 text-zinc-700">
        {ios
          ? <>Instale o {nome} no iPhone: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</>
          : <>Instale o {nome} e abra a agenda direto da tela inicial.</>}
      </p>
      {!ios && <button type="button" onClick={instalar} className="btn-primary shrink-0">Instalar app</button>}
      <button type="button" onClick={dispensar} className="shrink-0 text-xs text-zinc-500 hover:underline">Agora não</button>
    </div>
  );
}
