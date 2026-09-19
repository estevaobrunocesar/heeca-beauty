import "server-only";
import { db } from "@/lib/db";
import type { CategoryRef } from "./categories";

/** Categorias do tenant na ordem de exibição. */
export async function listCategories(tenantId: string): Promise<CategoryRef[]> {
  return db.serviceCategory.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, sortOrder: true },
  });
}

/**
 * Devolve o id se a categoria existe E pertence ao tenant; senão `null`.
 * Usado pelas actions antes de gravar `categoryId` — um id de outro salão vira "sem categoria".
 */
export async function ownedCategoryId(tenantId: string, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const found = await db.serviceCategory.findFirst({ where: { id, tenantId }, select: { id: true } });
  return found?.id ?? null;
}
