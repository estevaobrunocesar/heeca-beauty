/**
 * Categorias de serviço (SPEC §7). São criadas pelo salão (tabela `ServiceCategory`, por tenant);
 * aqui ficam só os padrões que o seed/bootstrap instala e os helpers de agrupamento.
 */

export type CategoryRef = { id: string; name: string; slug: string; sortOrder: number };

export type DefaultCategory = { slug: string; name: string; icon: string; examples: string[] };

/** As cinco categorias do spec, na ordem de exibição. Ícone é só decoração do painel. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    slug: "cabelo", name: "Cabelo", icon: "💇",
    examples: ["Corte", "Escova", "Hidratação", "Reconstrução", "Coloração", "Mechas", "Luzes", "Progressiva", "Botox capilar", "Penteado"],
  },
  {
    slug: "unhas", name: "Unhas", icon: "💅",
    examples: ["Manicure", "Pedicure", "Esmaltação", "Esmaltação em gel", "Alongamento", "Manutenção", "Nail art", "Blindagem"],
  },
  {
    slug: "sobrancelhas", name: "Sobrancelhas", icon: "🪞",
    examples: ["Design de sobrancelhas", "Henna", "Micropigmentação"],
  },
  {
    slug: "cilios", name: "Cílios", icon: "👁️",
    examples: ["Extensão de cílios", "Manutenção de cílios", "Lash lifting"],
  },
  {
    slug: "estetica", name: "Estética", icon: "🌿",
    examples: ["Limpeza de pele", "Massagem", "Drenagem linfática", "Depilação"],
  },
];

const ICON_BY_SLUG = new Map(DEFAULT_CATEGORIES.map((c) => [c.slug, c.icon]));
const EXAMPLES_BY_SLUG = new Map(DEFAULT_CATEGORIES.map((c) => [c.slug, c.examples]));

/** Ícone para categorias padrão; categorias criadas pelo salão usam um genérico. */
export const categoryIcon = (slug: string): string => ICON_BY_SLUG.get(slug) ?? "✨";

/** Sugestões de nome no cadastro de serviço (vazio para categorias personalizadas). */
export const categoryExamples = (slug: string | null | undefined): string[] => (slug ? EXAMPLES_BY_SLUG.get(slug) ?? [] : []);

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
