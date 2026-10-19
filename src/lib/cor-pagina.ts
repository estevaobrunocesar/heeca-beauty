// Cor da página pública do estabelecimento. Puro (sem servidor): o formulário de Configurações usa as
// mesmas funções para a prévia ao vivo e a action usa para validar e ajustar antes de gravar.
//
// A página inteira sai de UMA cor-base (o tom 600): os demais tons são misturas com branco e preto,
// o mesmo princípio da paleta da marca (marca.ts → paleta()).

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

type Rgb = [number, number, number];
const rgbDe = (cor: string): Rgb => [parseInt(cor.slice(1, 3), 16), parseInt(cor.slice(3, 5), 16), parseInt(cor.slice(5, 7), 16)];

/** Mistura `cor` com `alvo` (t = 0 mantém a cor, t = 1 vira o alvo). */
export function mistura(cor: string, alvo: Rgb, t: number): string {
  const [r, g, b] = rgbDe(cor);
  return `#${hex(r + (alvo[0] - r) * t)}${hex(g + (alvo[1] - g) * t)}${hex(b + (alvo[2] - b) * t)}`;
}

const TONS: [number, number][] = [[50, 0.94], [100, 0.88], [200, 0.75], [300, 0.55], [400, 0.3], [500, 0.12], [600, 0], [700, 0.18], [800, 0.32], [900, 0.44], [950, 0.66]];

/** Variáveis CSS --color-brand-50…950 a partir da cor-base (tom 600). */
export function paletaDeCor(cor: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tom, t] of TONS) out[`--color-brand-${tom}`] = tom < 600 ? mistura(cor, [255, 255, 255], t) : tom === 600 ? cor : mistura(cor, [0, 0, 0], t);
  return out;
}

/** "#abc", "ABC", "#A1B2C3" → "#a1b2c3"; qualquer outra coisa → null. */
export function normalizarHex(raw: string): string | null {
  const s = raw.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  return null;
}

/** Luminância relativa (WCAG 2.x). */
function luminancia(cor: string): number {
  const [r, g, b] = rgbDe(cor).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste (1 a 21) entre duas cores. */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texto branco sobre botões e abertura: o mínimo do WCAG AA para texto normal. */
export const CONTRASTE_MINIMO = 4.5;

// HSL: escurecer pela luminosidade preserva o matiz e a saturação. Misturar com preto tiraria a cor de
// tons pastel (um rosa claro viraria marrom acinzentado).
function paraHsl([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function deHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${hex((r + m) * 255)}${hex((g + m) * 255)}${hex((b + m) * 255)}`;
}

/**
 * Garante que o texto branco sobre a cor fique legível: se a cor for clara demais, reduz a luminosidade aos
 * poucos (mesmo matiz e saturação) até atingir o contraste mínimo. Cores já escuras ficam como estão.
 */
export function ajustarCor(cor: string): { cor: string; ajustada: boolean } {
  if (contraste(cor, "#ffffff") >= CONTRASTE_MINIMO) return { cor, ajustada: false };
  const [h, s, l] = paraHsl(rgbDe(cor));
  for (let nl = l - 0.01; nl >= 0; nl -= 0.01) {
    const atual = deHsl(h, s, nl);
    if (contraste(atual, "#ffffff") >= CONTRASTE_MINIMO) return { cor: atual, ajustada: true };
  }
  return { cor: "#000000", ajustada: true };
}

/** Cores prontas (todas já passam no contraste mínimo, sem ajuste). */
export const CORES_PRONTAS: { nome: string; cor: string }[] = [
  { nome: "Rosa", cor: "#c8306f" },
  { nome: "Vinho", cor: "#7a1f3d" },
  { nome: "Coral", cor: "#c2410c" },
  { nome: "Dourado", cor: "#8a6a1f" },
  { nome: "Verde-sálvia", cor: "#3f6b5a" },
  { nome: "Petróleo", cor: "#0f5f73" },
  { nome: "Azul", cor: "#2f4fb5" },
  { nome: "Violeta", cor: "#6b3fa0" },
  { nome: "Grafite", cor: "#2f3640" },
];

/**
 * Cor que a página usa: a escolhida pelo estabelecimento (já normalizada e ajustada ao gravar) ou, se não
 * houver, a da marca. Um valor inválido vindo do banco cai na cor da marca em vez de quebrar a página.
 */
export function corDaPagina(pageColor: string | null | undefined, corDaMarca: string): string {
  const n = pageColor ? normalizarHex(pageColor) : null;
  return n ?? corDaMarca;
}
