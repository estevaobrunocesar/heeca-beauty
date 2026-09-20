import { NextResponse, type NextRequest } from "next/server";
import { redirecionamentoDeHost } from "@/lib/marca";

/**
 * Hosts de produtos absorvidos (nail/lash/brow/cut/skin → beauty; massage → wellness, lib/marca.ts):
 * redireciona em definitivo para o host da marca, mantendo caminho e query — links antigos no
 * WhatsApp da cliente (/agendar/<slug>, /pagar/<token>) continuam funcionando.
 * Sem APP_URL_TEMPLATE (dev) não há hosts por marca e nada acontece.
 */
export function proxy(req: NextRequest) {
  const template = process.env.APP_URL_TEMPLATE;
  if (!template) return NextResponse.next();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const marca = redirecionamentoDeHost(host);
  if (!marca) return NextResponse.next();
  const destino = new URL(req.nextUrl.pathname + req.nextUrl.search, template.replace("{marca}", marca.slug));
  return NextResponse.redirect(destino, 301);
}

export const config = {
  // Tudo menos assets estáticos; /api/health responde no host antigo para o monitor não acusar queda durante a transição.
  matcher: ["/((?!_next/static|_next/image|brand/|favicon.ico|api/health).*)"],
};
