// Processamento de imagem (sharp) pode passar de 10 s em uploads grandes.
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSession, requireAuth, type AuthContext } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { processImage } from "@/lib/images";
import { ACCEPTED_LABEL, ACCEPTED_TYPES, IMAGE_KINDS, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, SVG_REFUSED, type ImageKind } from "@/lib/image-spec";

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
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, error: `Imagem muito grande (máximo ${MAX_UPLOAD_LABEL}).` }, { status: 413 });
  if (file.type === "image/svg+xml") return NextResponse.json({ ok: false, error: SVG_REFUSED }, { status: 415 });
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return NextResponse.json({ ok: false, error: `Formato não suportado. Use ${ACCEPTED_LABEL}.` }, { status: 415 });

  // O storage é verificado ANTES de processar: se o ambiente não o tem configurado, o motivo é do servidor,
  // e a mensagem não pode culpar o arquivo (era o erro "tente outro arquivo" que a pessoa via em produção).
  let storage;
  try {
    storage = getStorage();
  } catch (err) {
    console.error("[uploads] storage não configurado", err);
    return NextResponse.json({ ok: false, code: "storage_not_configured", error: "O envio de imagens ainda não está configurado neste ambiente. O problema não é a sua imagem: avise o suporte da Heeca." }, { status: 503 });
  }

  let processed;
  try {
    processed = await processImage(Buffer.from(await file.arrayBuffer()), kind);
  } catch (err) {
    console.error("[uploads] imagem ilegível", { kind, tenantId: ctx.tenant.id, size: file.size, type: file.type }, err);
    return NextResponse.json({ ok: false, error: `Não foi possível ler esta imagem. Tente outro arquivo (${ACCEPTED_LABEL}).` }, { status: 422 });
  }

  try {
    const key = `${ctx.tenant.id}/${kind}/${nanoid(16)}.webp`;
    const url = await storage.put(key, processed.data, processed.contentType);
    return NextResponse.json({ ok: true, url, width: processed.width, height: processed.height });
  } catch (err) {
    console.error("[uploads] falha ao guardar", { kind, tenantId: ctx.tenant.id, size: file.size }, err);
    return NextResponse.json({ ok: false, code: "storage_failed", error: "Não foi possível guardar a imagem agora. Tente de novo em instantes; se continuar, avise o suporte da Heeca." }, { status: 502 });
  }
}

// Não há DELETE: o arquivo substituído ou removido é apagado pelo servidor, na action, depois que o
// registro é gravado (lib/storage/guard.ts → discardReplaced). Apagar do navegador deixaria o
// cadastro apontando para um arquivo inexistente se a pessoa abandonasse o formulário sem salvar.
