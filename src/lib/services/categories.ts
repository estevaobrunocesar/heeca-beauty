import type { ServiceCategory } from "@/generated/prisma/enums";

/** Ordem de exibição das categorias na página pública e no painel. */
export const CATEGORY_ORDER: ServiceCategory[] = ["MANICURE", "PEDICURE", "ALONGAMENTO", "ADICIONAL", "OUTROS"];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MANICURE: "Manicure",
  PEDICURE: "Pedicure",
  ALONGAMENTO: "Alongamentos",
  ADICIONAL: "Procedimentos adicionais",
  OUTROS: "Outros",
};

export const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  MANICURE: "💅",
  PEDICURE: "🦶",
  ALONGAMENTO: "✨",
  ADICIONAL: "💎",
  OUTROS: "🌸",
};

/** Agrupa preservando a ordem das categorias e a ordem interna dos itens. */
export function groupByCategory<T extends { category: ServiceCategory }>(items: T[]): { category: ServiceCategory; items: T[] }[] {
  return CATEGORY_ORDER
    .map((category) => ({ category, items: items.filter((i) => i.category === category) }))
    .filter((g) => g.items.length > 0);
}

/** Exemplos que aparecem como sugestão no cadastro (seção 3.2). */
export const CATEGORY_EXAMPLES: Record<ServiceCategory, string[]> = {
  MANICURE: ["Manicure tradicional", "Esmaltação comum", "Esmaltação em gel", "Francesinha", "Nail art", "Remoção de esmaltação"],
  PEDICURE: ["Pedicure tradicional", "Pedicure com esmaltação em gel", "Spa dos pés", "Esfoliação", "Hidratação dos pés"],
  ALONGAMENTO: ["Alongamento em fibra de vidro", "Alongamento em gel", "Alongamento em molde F1", "Alongamento acrílico", "Manutenção de alongamento", "Reposição de unha", "Remoção de alongamento"],
  ADICIONAL: ["Blindagem", "Banho de gel", "Encapsulada", "Nail art personalizada", "Decoração especial", "Reparação de unha quebrada"],
  OUTROS: [],
};
