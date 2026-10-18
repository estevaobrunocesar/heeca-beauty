/**
 * Verificação local do upload de imagens contra um `next dev` rodando (regra da plataforma: só upload).
 *   npx tsx --env-file=.env scripts/verify-uploads.ts http://localhost:3190
 * Assina um cookie de sessão com o AUTH_SECRET local (dono e profissional da seed) e exercita
 * /api/uploads: sem sessão, permissão por perfil, formato, tamanho, resultado servido e actions.
 */
import { SignJWT } from "jose";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const base = process.argv[2] ?? "http://localhost:3190";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => { results.push([name, ok, detail]); console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`); };

async function cookieFor(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`usuário ${email} não existe (rode o seed)`);
  const token = await new SignJWT({ userId: user.id, tenantId: user.tenantId })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  return { cookie: `heeca_session=${token}`, user };
}

async function upload(cookie: string | null, kind: string, file: Blob | null, name = "foto.png") {
  const fd = new FormData();
  if (file) fd.set("file", file, name);
  fd.set("kind", kind);
  const r = await fetch(`${base}/api/uploads`, { method: "POST", body: fd, headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = await r.json().catch(() => null) as { ok?: boolean; url?: string; error?: string; width?: number; height?: number } | null;
  return { status: r.status, body };
}

async function main() {
  const png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: { r: 150, g: 60, b: 180 } } }).png().toBuffer();
  const owner = await cookieFor("demo@heeca.app");
  const staff = await cookieFor("mariana@heeca.app");

  // 1. sem sessão → 401 JSON (não redirect HTML)
  const anon = await upload(null, "portfolio", new Blob([new Uint8Array(png)], { type: "image/png" }));
  check("sem sessão → 401 JSON", anon.status === 401 && anon.body?.ok === false, `status ${anon.status}`);

  // 2. dono envia foto de portfólio → URL do nosso storage, WebP, ≤1600px
  const ok = await upload(owner.cookie, "portfolio", new Blob([new Uint8Array(png)], { type: "image/png" }));
  check("dono envia portfólio → 200 + url", ok.status === 200 && !!ok.body?.url, `status ${ok.status} ${ok.body?.error ?? ""}`);
  const url = ok.body?.url ?? "";
  check("chave começa pelo tenant e é .webp", url.includes(`/uploads/${owner.user.tenantId}/portfolio/`) && url.endsWith(".webp"), url);
  check("redimensionou para ≤1600px", (ok.body?.width ?? 9999) <= 1600 && (ok.body?.height ?? 9999) <= 1600, `${ok.body?.width}x${ok.body?.height}`);
  // A URL usa APP_URL (do .env); o servidor de teste pode estar em outra porta — busca pelo host do teste.
  const served = await fetch(url.replace(/^https?:\/\/[^/]+/, base));
  const buf = Buffer.from(await served.arrayBuffer());
  check("arquivo servido é WebP de verdade", served.status === 200 && (await sharp(buf).metadata()).format === "webp", `status ${served.status}, ${buf.length} bytes`);

  // 3. permissões por perfil
  const staffLogo = await upload(staff.cookie, "logo", new Blob([new Uint8Array(png)], { type: "image/png" }));
  check("profissional (STAFF) não envia logo → 403", staffLogo.status === 403, `status ${staffLogo.status}`);
  const staffAvatar = await upload(staff.cookie, "professional", new Blob([new Uint8Array(png)], { type: "image/png" }));
  check("profissional (STAFF) envia a própria foto → 200", staffAvatar.status === 200, `status ${staffAvatar.status}`);

  // 4. validações
  const svg = await upload(owner.cookie, "logo", new Blob(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], { type: "image/svg+xml" }), "x.svg");
  check("SVG recusado (415)", svg.status === 415, `status ${svg.status}`);
  const fake = await upload(owner.cookie, "logo", new Blob(["isto não é imagem"], { type: "image/png" }));
  check("arquivo que finge ser PNG recusado (422)", fake.status === 422, `status ${fake.status}`);
  const kind = await upload(owner.cookie, "../etc", new Blob([new Uint8Array(png)], { type: "image/png" }));
  check("kind inválido recusado (400)", kind.status === 400, `status ${kind.status}`);
  const big = await upload(owner.cookie, "logo", new Blob([new Uint8Array(9 * 1024 * 1024)], { type: "image/png" }));
  check("arquivo > 8 MB recusado (413)", big.status === 413, `status ${big.status}`);
  const none = await upload(owner.cookie, "logo", null);
  check("sem arquivo recusado (400)", none.status === 400, `status ${none.status}`);

  console.log(`\n${results.filter((r) => r[1]).length}/${results.length} verificações ok`);
  if (results.some((r) => !r[1])) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
