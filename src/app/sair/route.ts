import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

/**
 * Encerra a sessão e manda para o login.
 *
 * Existe porque apagar cookie é proibido durante o render de uma página: o
 * `requireAuth` precisa descartar uma sessão órfã (usuário apagado, tenant de
 * outra marca) e não pode fazer isso ali — mandava um 500 no lugar do login, e
 * como o cookie sobrevivia, a pessoa ficava presa no erro. Route Handler pode
 * escrever cookie, então a limpeza acontece aqui.
 */
export async function GET(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login?sessao=encerrada", req.url));
}
