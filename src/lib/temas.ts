// Identidade visual própria de um estabelecimento, por cima do motor (cor da página pública, painel, confirmação e pagamento).
// Puro (sem servidor): páginas, layout e testes usam as mesmas funções.
//
// Hoje o tema é uma tabela por slug (decisão de 2026-11-11, docs/DECISOES.md): só o Studio 21 tem. Ele não é uma cor da
// paleta da marca: é uma pele escura inteira, então a troca é feita sobrescrevendo as variáveis de cor do Tailwind
// (--color-brand-*, --color-zinc-*, --color-white…) num contêiner. Todas as classes já existentes passam a valer na pele
// escura sem mudar, e a página dos demais estabelecimentos não muda.

export type Tema = {
  /** Logo clara (feita para fundo escuro), em /public. Aparece na barra da página pública e na lateral do painel. */
  logo: string;
  /** Cor de ação do painel (tom 600 da paleta do painel). Grafite quente: o painel fica claro, com ação escura. */
  painel: string;
};

const TEMAS: Record<string, Tema> = {
  studio21: { logo: "/tenants/studio21/logo.png", painel: "#201f1d" },
};

export const temaDoTenant = (tenant: { slug: string }): Tema | null => TEMAS[tenant.slug] ?? null;

/** Fundo, texto e demais cores do site do Studio 21 (salaostudio21.com.br): grafite quase preto e off-white. */
export const CORES_ESCURAS = { fundo: "#0a0a0a", texto: "#f5f5f5", acento: "#e8e6e1" } as const;

/**
 * Escala para os trechos que já são escuros na página pública (barra fixa, capa, pacotes): aqui 950 é o fundo e 50 o texto,
 * como na paleta normal, só que em grafite neutro em vez de uma cor.
 */
export const ESCALA_CAPA: Record<string, string> = {
  "--color-brand-50": "#f5f5f5",
  "--color-brand-100": "#d9d7d2",
  "--color-brand-200": "#b9b6b0",
  "--color-brand-300": "#8a8a8a",
  "--color-brand-400": "#6f6f6f",
  "--color-brand-500": "#4a4a4a",
  "--color-brand-600": CORES_ESCURAS.acento,
  "--color-brand-700": "#262626",
  "--color-brand-800": "#1c1c1c",
  "--color-brand-900": "#141414",
  "--color-brand-950": CORES_ESCURAS.fundo,
};

/**
 * Pele escura para o corpo da página e do painel: a escala inverte (50 = superfície, 950 = texto, 600 = acento claro) e os
 * neutros do sistema (branco, zinc, linha, tinta) viram os tons do site. `white` passa a ser o fundo escuro: o texto
 * `text-white` de um botão de acento claro fica escuro, que é o que se quer.
 */
export const PELE_ESCURA: Record<string, string> = {
  "--color-brand-50": "#1f1f1f",
  "--color-brand-100": "#2a2a2a",
  "--color-brand-200": "#333333",
  "--color-brand-300": "#4a4a4a",
  "--color-brand-400": "#666666",
  "--color-brand-500": "#bdbab4",
  "--color-brand-600": CORES_ESCURAS.acento,
  "--color-brand-700": "#ffffff",
  "--color-brand-800": CORES_ESCURAS.texto,
  "--color-brand-900": "#d6d4cf",
  "--color-brand-950": CORES_ESCURAS.texto,
  "--color-white": "#0c0c0c",
  "--color-zinc-50": "#1a1a1a",
  "--color-zinc-100": "#1c1c1c",
  "--color-zinc-200": "#2a2a2a",
  "--color-zinc-300": "#3a3a3a",
  "--color-zinc-400": "#6f6f6f",
  "--color-zinc-500": "#9a9a9a",
  "--color-zinc-600": "#b5b5b5",
  "--color-zinc-700": "#cfcfcf",
  "--color-zinc-800": "#e5e5e5",
  "--color-zinc-900": "#f5f5f5",
  "--color-canvas": "#0a0a0a",
  "--color-ink": CORES_ESCURAS.texto,
  "--color-ink-2": "#cfcfcf",
  "--color-mut": "#9a9a9a",
  "--color-mut-2": "#6f6f6f",
  "--color-line": "#2a2a2a",
  "--color-line-2": "#222222",
  colorScheme: "dark",
};
