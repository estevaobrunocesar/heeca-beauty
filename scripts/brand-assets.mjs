// Copia a marca de cada MARCA do motor de ../brand/dist para public/brand/<slug>/ (favicon, ícones, OG).
// O layout raiz aponta para /brand/<marca>/… conforme o host. Rode após `node ../brand/build.mjs`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const KIT = join(here, "..", "..", "brand", "dist");
const OUT = join(here, "..", "public", "brand");
const MARCAS = ["beauty", "wellness"]; // manter igual a src/lib/marca.ts
// Marca ainda "planned" no kit (brand/products.csv): usa os arquivos desta como provisórios (mesma família/cor).
const PROVISORIA = "nail";

const FILES = (m) => ({
  "favicon.svg": `favicon/heeca-${m}.svg`,
  "favicon-32.png": `favicon/heeca-${m}-32.png`,
  "apple-touch-icon.png": `icon/heeca-${m}-app-icon-180.png`,
  "icon-192.png": `icon/heeca-${m}-app-icon-192.png`,
  "og.png": `social/heeca-${m}-og.png`,
});
if (!existsSync(join(KIT, FILES(PROVISORIA)["favicon.svg"]))) { console.error(`kit não encontrado em ${KIT}; rode node ../brand/build.mjs`); process.exit(1); }
let n = 0;
const provisorios = [];
for (const m of MARCAS) {
  mkdirSync(join(OUT, m), { recursive: true });
  for (const [dest, src] of Object.entries(FILES(m))) {
    const origem = existsSync(join(KIT, src)) ? src : FILES(PROVISORIA)[dest];
    if (origem !== src) provisorios.push(`${m}/${dest}`);
    cpSync(join(KIT, origem), join(OUT, m, dest)); n++;
  }
}
console.log(`ok: public/brand/{${MARCAS.join(",")}} (${n} arquivos)`);
if (provisorios.length) console.warn(`! ${provisorios.length} arquivo(s) provisórios copiados do ${PROVISORIA} (marca planned no kit): ${provisorios.slice(0, 3).join(", ")}…`);
