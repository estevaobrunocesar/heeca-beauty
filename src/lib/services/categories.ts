/**
 * Categorias de serviço (SPEC §7). São criadas pelo salão (tabela `ServiceCategory`, por tenant);
 * aqui ficam as sugestões que o bootstrap instala a partir dos SEGMENTOS do estabelecimento
 * (lib/marca.ts) e os helpers de agrupamento.
 */
import { CATEGORIAS_CONHECIDAS, categoriasSugeridas, type CategoriaSugerida, type Segmento } from "@/lib/marca";

export type CategoryRef = { id: string; name: string; slug: string; sortOrder: number };

export type DefaultCategory = { slug: string; name: string; icon: string; examples: string[] };

// Categorias criadas antes dos segmentos (bootstrap antigo do Beauty): ícone e exemplos continuam valendo.
const LEGADO: Record<string, CategoriaSugerida> = {
  estetica: { slug: "estetica", nome: "Estética", icone: "🌿", exemplos: ["Limpeza de pele", "Peeling", "Drenagem linfática", "Depilação"] },
};

const conhecida = (slug: string): CategoriaSugerida | undefined => CATEGORIAS_CONHECIDAS[slug] ?? LEGADO[slug];

/** Categorias padrão para um conjunto de segmentos, na ordem de exibição. */
export const defaultCategories = (segmentos: Segmento[]): DefaultCategory[] =>
  categoriasSugeridas(segmentos).map((c) => ({ slug: c.slug, name: c.nome, icon: c.icone, examples: c.exemplos }));

/** Ícone para categorias sugeridas pelos segmentos; categorias criadas pelo salão usam um genérico. */
export const categoryIcon = (slug: string): string => conhecida(slug)?.icone ?? "✨";

/** Sugestões de nome no cadastro de serviço (vazio para categorias personalizadas). */
export const categoryExamples = (slug: string | null | undefined): string[] => (slug ? conhecida(slug)?.exemplos ?? [] : []);

/** Slug de URL a partir do nome ("Cílios & Sobrancelhas" → "cilios-sobrancelhas"). */
export function categorySlug(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "categoria";
}

export type CategoryGroup<T> = { category: CategoryRef | null; items: T[] };

/**
 * Agrupa por categoria preservando a ordem das categorias (sortOrder) e a ordem interna dos itens.
 * Itens sem categoria (ou de categoria removida) vão para um grupo final `category: null`.
 */
export function groupByCategory<T extends { categoryId: string | null }>(items: T[], categories: CategoryRef[]): CategoryGroup<T>[] {
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const groups: CategoryGroup<T>[] = ordered
    .map((category) => ({ category, items: items.filter((i) => i.categoryId === category.id) }))
    .filter((g) => g.items.length > 0);
  const known = new Set(ordered.map((c) => c.id));
  const orphans = items.filter((i) => !i.categoryId || !known.has(i.categoryId));
  if (orphans.length) groups.push({ category: null, items: orphans });
  return groups;
}

/** Rótulo do grupo sem categoria. */
export const UNCATEGORIZED_LABEL = "Outros serviços";
