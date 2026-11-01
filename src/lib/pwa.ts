import type { Marca } from "@/lib/marca";

/**
 * Manifesto do app instalável (PWA) de cada marca. Abre direto no painel (/app), em tela cheia, com a cor e o
 * ícone da família. Nada de nome fixo: vem de `marca` (beauty.heeca.com.br, wellness.heeca.com.br).
 */
export function manifestoDaMarca(marca: Pick<Marca, "slug" | "nome" | "tagline" | "cor">) {
  const icone = (tamanho: number) => ({ src: `/brand/${marca.slug}/icon-${tamanho}.png`, sizes: `${tamanho}x${tamanho}`, type: "image/png", purpose: "any" as const });
  return {
    id: "/app",
    name: marca.nome,
    short_name: marca.nome,
    description: marca.tagline,
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone" as const,
    orientation: "portrait" as const,
    background_color: "#ffffff",
    theme_color: marca.cor,
    icons: [icone(192), icone(512)],
  };
}

/** O app instalado já abre em tela cheia: o convite de instalar só faz sentido no navegador comum. */
export type AmbienteDeInstalacao = { standalone: boolean; nativo: boolean; dispensado: boolean };
export const convidarParaInstalar = (a: AmbienteDeInstalacao) => !a.standalone && !a.nativo && !a.dispensado;

/** iPhone/iPad não têm o botão "Instalar": a instalação é pelo menu Compartilhar do Safari. */
export function ehIos(userAgent: string, maxTouchPoints = 0) {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
