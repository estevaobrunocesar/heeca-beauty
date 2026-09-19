/** Formato padrão de retorno das server actions usadas com useActionState. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> } | null;

export const fail = (error: string, fields?: Record<string, string>): ActionResult => ({ ok: false, error, fields });
export const success = (message?: string): ActionResult => ({ ok: true, message });
