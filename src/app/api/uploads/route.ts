// Processamento de imagem (sharp) pode passar de 10 s em uploads grandes.
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSession, requireAuth, type AuthContext } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { ACCEPTED_TYPES, IMAGE_KINDS, MAX_UPLOAD_BYTES, processImage, type ImageKind } from "@/lib/images";

/**
 * Quem pode enviar cada tipo (SPEC §6): a foto do profissional também é do próprio profissional
 * (STAFF edita o próprio perfil); logo, serviços, portfólio e fotos do espaço são de gestão;
 * a recepção não edita cadastro.
 */
function canUpload(ctx: AuthContext, kind: ImageKind): boolean {
  if (kind === "professional") return ctx.role !== "RECEPTION";
  return ctx.canManage;
}

// Limite simples por usuário (em memória; o container é de instância única — ver CRON_INPROCESS).
const hits = new Map<string, number[]>();
function limited(userId: string, max = 30, windowMs = 5 * 60_000) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > max;
}

const unauthorized = () => NextResponse.json({ ok: false, error: "Sessão expirada. Entre novamente." }, { status: 401 });

/**
 * POST /api/uploads — multipart: `file` (imagem) e `kind` (logo | professional | service | portfolio | space).
 * Devolve { ok, url }. A chave começa pelo estabelecimento: um salão nunca sobrescreve arquivo de outro.
 */
export async function POST(req: Request) {
  if (!(await getSession())) return unauthorized();
  const ctx = await requireAuth();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "") as ImageKind;
  if (!(file instanceof File) || !IMAGE_KINDS.includes(kind)) return NextResponse.json({ ok: false, error: "Envie uma imagem." }, { status: 400 });
  if (!canUpload(ctx, kind)) return NextResponse.json({ ok: false, error: "Você não tem permissão para enviar este tipo de imagem." }, { status: 403 });
  if (limited(ctx.user.id)) return NextResponse.json({ ok: false, error: "Muitos envios em pouco tempo. Aguarde um pouco." }, { status: 429 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, error: "Imagem muito grande (máximo 8 MB)." }, { status: 413 });
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return NextResponse.json({ ok: false, error: "Formato não suportado. Use JPG, PNG, WebP ou HEIC." }, { status: 415 });

  try {
    const processed = await processImage(Buffer.from(await file.arrayBuffer()), kind);
    const key = `${ctx.tenant.id}/${kind}/${nanoid(16)}.webp`;
    const url = await getStorage().put(key, processed.data, processed.contentType);
    return NextResponse.json({ ok: true, url, width: processed.width, height: processed.height });
  } catch (err) {
    console.error("[uploads]", { kind, tenantId: ctx.tenant.id, size: file.size, type: file.type }, err);
    return NextResponse.json({ ok: false, error: "Não foi possível processar a imagem. Tente outro arquivo." }, { status: 422 });
  }
}

// Não há DELETE: o arquivo substituído ou removido é apagado pelo servidor, na action, depois que o
// registro é gravado (lib/storage/guard.ts → discardReplaced). Apagar do navegador deixaria o
// cadastro apontando para um arquivo inexistente se a pessoa abandonasse o formulário sem salvar.
