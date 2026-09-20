/**
 * Motor Heeca Schedule — marcas e segmentos.
 *
 * Uma MARCA é um produto da prateleira (Heeca Beauty, Heeca Wellness): host próprio, container e
 * banco próprios em produção (MARCA_DEFAULT), item no catálogo do portal. A marca é resolvida pelo host
 * na entrada (lib/marca-atual.ts) e gravada em Tenant.marca no provisionamento.
 *
 * Um SEGMENTO é o que o estabelecimento faz dentro da marca (cabelo e barba, unhas, cílios…). Não é
 * produto: é configuração do tenant (Tenant.segmentos). O segmento traz as categorias de serviço
 * sugeridas, a ficha técnica da cliente, exemplos para o cadastro de serviço e o vocabulário das
 * mensagens. Um salão marca vários; uma nail designer marca um. Segmentos vazios = "ainda não
 * escolheu": o painel trata como todos e pede para escolher.
 *
 * Códigos de ficha são prefixados pelo segmento (`unhas.formato`) para nunca colidirem entre
 * segmentos. Puro (sem server-only): também é importado por client components.
 */

export type CategoriaSugerida = { slug: string; nome: string; icone: string; exemplos: string[] };
/** Campo da ficha técnica da cliente (e do registro de cada atendimento). Sugestões alimentam um datalist. */
export type CampoFicha = { codigo: string; rotulo: string; sugestoes: string[]; placeholder?: string; segmento?: string; /** Mesmo campo em vários segmentos da marca: aparece uma vez, no primeiro segmento ativo que o declara. */ compartilhado?: boolean };

export type Segmento = {
  slug: string;
  nome: string;
  icone: string;
  /** Quem trabalha nesse segmento, em plural ("nail designers"). */
  publico: string;
  /** Categorias de serviço criadas no estabelecimento quando o segmento é ligado. */
  categorias: CategoriaSugerida[];
  /** Placeholders do formulário de serviço. */
  exemplos: { procedimento: string; adicional: string; descricaoProcedimento: string; descricaoAdicional: string };
  /** Frase com vocabulário do segmento usada na mensagem sugerida de retorno. */
  retorno: string;
  /** Ficha técnica: o que a profissional consulta antes do atendimento e registra depois. Códigos SEM prefixo. */
  ficha: Omit<CampoFicha, "segmento">[];
};

export type Marca = {
  slug: string;
  /** Nome de prateleira, igual ao catálogo do portal. */
  nome: string;
  /** Público em plural, para metadados e taglines. */
  publico: string;
  tagline: string;
  descricao: string;
  /** Cor de acento = cor da FAMÍLIA no kit de marca (brand/products.csv). As tonalidades saem de `paleta()`. */
  cor: string;
  segmentos: Segmento[];
};

// ─── Segmentos de beleza ───────────────────────────────────────────────────────────────────────

const cabelo: Segmento = {
  slug: "cabelo",
  nome: "Cabelo e barba",
  icone: "💇",
  publico: "cabeleireiros e barbeiros",
  categorias: [
    { slug: "cabelo", nome: "Cabelo", icone: "💇", exemplos: ["Corte feminino", "Corte masculino", "Corte infantil", "Escova", "Hidratação", "Reconstrução", "Coloração", "Mechas", "Luzes", "Progressiva", "Botox capilar", "Penteado"] },
    { slug: "barba", nome: "Barba", icone: "🪒", exemplos: ["Barba completa", "Barba na navalha", "Aparar barba", "Corte + barba", "Sobrancelha na navalha", "Pigmentação de barba"] },
  ],
  exemplos: { procedimento: "corte, coloração", adicional: "hidratação, finalização", descricaoProcedimento: "Corte com lavagem e finalização.", descricaoAdicional: "Hidratação profunda com máscara após o corte." },
  retorno: "Está chegando a hora de renovar o corte.",
  ficha: [
    { codigo: "tipo", rotulo: "Tipo de cabelo", sugestoes: ["Liso", "Ondulado", "Cacheado", "Crespo"] },
    { codigo: "corte", rotulo: "Corte / estilo", sugestoes: ["Degradê", "Social", "Undercut", "Long bob", "Camadas", "Franja", "Repicado"] },
    { codigo: "cor", rotulo: "Cor / fórmula", sugestoes: [], placeholder: "Ex.: 7.1 + ox 20 vol, mechas finas" },
    { codigo: "quimica", rotulo: "Química recente", sugestoes: ["Nenhuma", "Coloração", "Descoloração", "Progressiva", "Relaxamento"] },
  ],
};

const unhas: Segmento = {
  slug: "unhas",
  nome: "Unhas",
  icone: "💅",
  publico: "nail designers e manicures",
  categorias: [
    { slug: "unhas", nome: "Unhas", icone: "💅", exemplos: ["Manicure tradicional", "Pedicure tradicional", "Esmaltação em gel", "Francesinha", "Spa dos pés", "Alongamento em fibra de vidro", "Alongamento em gel", "Alongamento em molde F1", "Manutenção de alongamento", "Blindagem", "Banho de gel", "Nail art", "Remoção"] },
  ],
  exemplos: { procedimento: "manicure, alongamento", adicional: "nail art, blindagem", descricaoProcedimento: "Alongamento resistente e natural, com acabamento em gel.", descricaoAdicional: "Desenhos delicados à mão livre em até 4 unhas." },
  retorno: "Está chegando o momento de renovar suas unhas.",
  ficha: [
    { codigo: "formato", rotulo: "Formato", sugestoes: ["Almond", "Quadrado", "Quadrado arredondado", "Oval", "Stiletto", "Bailarina", "Redondo", "Squoval"] },
    { codigo: "tamanho", rotulo: "Tamanho", sugestoes: ["Curto", "Médio", "Longo", "Extra longo"] },
    { codigo: "tecnica", rotulo: "Técnica", sugestoes: ["Fibra de vidro", "Gel", "Molde F1", "Acrílico", "Esmaltação em gel", "Banho de gel"] },
    { codigo: "cor", rotulo: "Cor / estilo", sugestoes: ["Nude", "Francesinha", "Baby boomer", "Vermelho", "Nail art"] },
  ],
};

const cilios: Segmento = {
  slug: "cilios",
  nome: "Cílios",
  icone: "👁️",
  publico: "lash designers",
  categorias: [
    { slug: "cilios", nome: "Cílios", icone: "👁️", exemplos: ["Fio a fio clássico", "Volume brasileiro", "Volume russo", "Híbrido", "Mega volume", "Efeito fox", "Efeito boneca", "Manutenção 15 dias", "Manutenção 21 dias", "Lash lifting", "Lash lifting com tintura", "Remoção"] },
  ],
  exemplos: { procedimento: "volume brasileiro, lash lifting", adicional: "tintura, cílios coloridos", descricaoProcedimento: "Volume leve e natural, fio a fio, com duração de até 4 semanas.", descricaoAdicional: "Fios coloridos aplicados nas pontas externas." },
  retorno: "Está chegando o momento de fazer a manutenção dos seus cílios.",
  ficha: [
    { codigo: "tecnica", rotulo: "Técnica", sugestoes: ["Fio a fio clássico", "Volume brasileiro", "Volume russo", "Híbrido", "Mega volume", "Lash lifting"] },
    { codigo: "curvatura", rotulo: "Curvatura", sugestoes: ["J", "B", "C", "CC", "D", "L", "M"] },
    { codigo: "espessura", rotulo: "Espessura", sugestoes: ["0.03", "0.05", "0.07", "0.10", "0.12", "0.15"] },
    { codigo: "comprimento", rotulo: "Comprimento", sugestoes: ["8–10", "9–11", "10–12", "11–13", "12–14"] },
    { codigo: "efeito", rotulo: "Efeito", sugestoes: ["Natural", "Boneca", "Fox", "Esquilo", "Gatinho", "Wet"] },
    { codigo: "mapeamento", rotulo: "Mapeamento", sugestoes: [], placeholder: "Ex.: 9-10-11-12-11 (interno → externo)" },
  ],
};

const sobrancelhas: Segmento = {
  slug: "sobrancelhas",
  nome: "Sobrancelhas",
  icone: "🪞",
  publico: "designers de sobrancelhas",
  categorias: [
    { slug: "sobrancelhas", nome: "Sobrancelhas", icone: "🪞", exemplos: ["Design de sobrancelhas", "Design com pinça", "Design com linha", "Design + Henna", "Henna", "Tintura de sobrancelhas", "Brow lamination", "Brow lamination + Design", "Reconstrução", "Micropigmentação", "Buço"] },
  ],
  exemplos: { procedimento: "design, brow lamination", adicional: "henna, buço", descricaoProcedimento: "Mapeamento facial, medição e design com pinça, respeitando o formato natural.", descricaoAdicional: "Coloração com henna para preencher falhas e realçar o desenho." },
  retorno: "Está chegando o momento de cuidar novamente das suas sobrancelhas.",
  ficha: [
    { codigo: "formato", rotulo: "Formato", sugestoes: ["Arqueado", "Reto", "Angular", "Curvo", "Ascendente", "Natural"] },
    { codigo: "tecnica", rotulo: "Técnica", sugestoes: ["Pinça", "Linha", "Cera", "Pinça + Henna", "Pinça + Tintura", "Brow lamination"] },
    { codigo: "acabamento", rotulo: "Acabamento", sugestoes: ["Natural", "Marcado", "Esfumado", "Preenchido"] },
    { codigo: "cor", rotulo: "Cor de henna", sugestoes: ["Castanho claro", "Castanho médio", "Castanho escuro", "Loiro", "Grafite"] },
    { codigo: "produtos", rotulo: "Produtos utilizados", sugestoes: [] },
  ],
};

const estetica: Segmento = {
  slug: "estetica",
  nome: "Estética",
  icone: "🌿",
  publico: "esteticistas",
  categorias: [
    { slug: "estetica-facial", nome: "Estética facial", icone: "🌿", exemplos: ["Limpeza de pele", "Peeling", "Microagulhamento", "Hidratação facial", "Radiofrequência facial", "Máscara de LED", "Dermaplaning"] },
    { slug: "estetica-corporal", nome: "Estética corporal", icone: "✨", exemplos: ["Drenagem linfática", "Massagem modeladora", "Criolipólise", "Radiofrequência corporal", "Depilação", "Depilação a laser", "Pós-operatório"] },
  ],
  exemplos: { procedimento: "limpeza de pele, drenagem", adicional: "máscara de LED, hidratação", descricaoProcedimento: "Limpeza profunda com extração, alta frequência e máscara calmante.", descricaoAdicional: "Sessão de LED após o procedimento para acelerar a recuperação." },
  retorno: "Está chegando a hora da sua próxima sessão.",
  ficha: [
    { codigo: "pele", rotulo: "Tipo de pele", sugestoes: ["Normal", "Seca", "Oleosa", "Mista", "Sensível"] },
    { codigo: "fototipo", rotulo: "Fototipo", sugestoes: ["I", "II", "III", "IV", "V", "VI"] },
    { codigo: "objetivo", rotulo: "Objetivo", sugestoes: ["Acne", "Manchas", "Rejuvenescimento", "Hidratação", "Gordura localizada", "Flacidez", "Celulite"] },
    { codigo: "contraindicacoes", rotulo: "Contraindicações", sugestoes: ["Nenhuma", "Gestante", "Lactante", "Diabetes", "Uso de ácidos", "Isotretinoína", "Marca-passo"] },
  ],
};

const maquiagem: Segmento = {
  slug: "maquiagem",
  nome: "Maquiagem",
  icone: "💄",
  publico: "maquiadores",
  categorias: [
    { slug: "maquiagem", nome: "Maquiagem", icone: "💄", exemplos: ["Maquiagem social", "Maquiagem de noiva", "Madrinha", "Formatura", "Maquiagem + penteado", "Pele", "Olho esfumado", "Automaquiagem (aula)", "Prova de maquiagem"] },
  ],
  exemplos: { procedimento: "maquiagem social, noiva", adicional: "cílios postiços, prova", descricaoProcedimento: "Maquiagem completa com preparação de pele e fixação para longa duração.", descricaoAdicional: "Aplicação de cílios postiços de tufo ou tira." },
  retorno: "Tem evento chegando? Garanta seu horário com antecedência.",
  ficha: [
    { codigo: "base", rotulo: "Tom de base", sugestoes: [], placeholder: "Ex.: marca e numeração" },
    { codigo: "subtom", rotulo: "Subtom", sugestoes: ["Quente", "Frio", "Neutro", "Oliva"] },
    { codigo: "pele", rotulo: "Tipo de pele", sugestoes: ["Normal", "Seca", "Oleosa", "Mista", "Sensível"] },
    { codigo: "estilo", rotulo: "Estilo preferido", sugestoes: ["Natural", "Clássica", "Glam", "Esfumado", "Iluminada"] },
  ],
};

// ─── Segmentos de bem-estar ────────────────────────────────────────────────────────────────────

const massagem: Segmento = {
  slug: "massagem",
  nome: "Massagem",
  icone: "💆",
  publico: "massoterapeutas",
  categorias: [
    { slug: "relaxante", nome: "Massagens relaxantes", icone: "🌿", exemplos: ["Massagem relaxante 60 min", "Massagem relaxante 90 min", "Pedras quentes", "Aromaterapia", "Shiatsu"] },
    { slug: "terapeutica", nome: "Terapêuticas", icone: "💆", exemplos: ["Massagem terapêutica", "Liberação miofascial", "Massagem desportiva", "Ventosaterapia", "Reflexologia"] },
    { slug: "drenagem", nome: "Estéticas e drenagem", icone: "✨", exemplos: ["Drenagem linfática", "Modeladora", "Pós-operatório", "Bambuterapia"] },
  ],
  exemplos: { procedimento: "relaxante 60 min, drenagem", adicional: "escalda-pés, tempo extra", descricaoProcedimento: "Massagem de corpo inteiro com óleos vegetais e pressão moderada.", descricaoAdicional: "Escalda-pés com sais e ervas antes da sessão." },
  retorno: "Está chegando a hora da sua próxima sessão de massagem.",
  ficha: [
    { codigo: "pressao", rotulo: "Pressão", sugestoes: ["Leve", "Moderada", "Forte"], compartilhado: true },
    { codigo: "foco", rotulo: "Áreas de foco", sugestoes: ["Lombar", "Cervical", "Ombros", "Pernas", "Pés", "Corpo inteiro"], compartilhado: true },
    { codigo: "aroma", rotulo: "Óleo / aroma", sugestoes: ["Lavanda", "Eucalipto", "Laranja doce", "Neutro", "Sem óleo"], compartilhado: true },
    { codigo: "restricoes", rotulo: "Restrições informadas", sugestoes: ["Gestante", "Hipertensão", "Varizes", "Pós-operatório", "Alergia a óleos/frutos secos", "Nenhuma"], compartilhado: true },
  ],
};

// Spa: pacote de segmento do chat Heeca_Spa (heeca_spa/docs/SEGMENTO-SPA.md, 20/09/2026). Com massagem + spa ligados,
// as categorias de massagem vêm do segmento Massagem e aqui entram só experiências e tratamentos corporais.
const spa: Segmento = {
  slug: "spa",
  nome: "Spa",
  icone: "🧖",
  publico: "spas e day spas",
  categorias: [
    { slug: "experiencias", nome: "Experiências Spa", icone: "🛁", exemplos: ["Day Spa", "Banho relaxante", "Banho de ofurô", "Sauna", "Hidroterapia", "Escalda-pés", "Ritual relaxante", "Ritual corporal", "Envolvimento corporal", "Experiência para casal", "Experiência romântica"] },
    { slug: "corporais", nome: "Tratamentos corporais", icone: "🌿", exemplos: ["Esfoliação corporal", "Máscara corporal", "Argiloterapia", "Bambuterapia", "Ventosaterapia", "Reiki"] },
  ],
  exemplos: { procedimento: "massagem relaxante, day spa", adicional: "aromaterapia, esfoliação", descricaoProcedimento: "Toques longos e suaves com óleo morno para soltar o corpo e aquietar a mente.", descricaoAdicional: "Óleos essenciais escolhidos conforme o seu momento." },
  retorno: "Está chegando a hora do seu próximo ritual de bem-estar.",
  ficha: [
    { codigo: "ritual", rotulo: "Ritual / serviço preferido", sugestoes: ["Massagem relaxante", "Pedras quentes", "Day Spa", "Banho relaxante", "Ritual corporal", "Escalda-pés"], placeholder: "O que o cliente mais gosta de fazer aqui" },
    { codigo: "pressao", rotulo: "Pressão", sugestoes: ["Leve", "Moderada", "Forte"], compartilhado: true },
    { codigo: "foco", rotulo: "Áreas de foco", sugestoes: ["Ombros", "Cervical", "Lombar", "Pernas", "Pés", "Corpo inteiro"], compartilhado: true },
    { codigo: "evitar", rotulo: "Áreas a evitar", sugestoes: ["Abdômen", "Lombar", "Pescoço", "Nenhuma"], placeholder: "Regiões que o cliente prefere não trabalhar" },
    { codigo: "temperatura", rotulo: "Temperatura da sala", sugestoes: ["Mais quente", "Neutra", "Mais fresca"] },
    { codigo: "aroma", rotulo: "Óleo / aroma", sugestoes: ["Lavanda", "Eucalipto", "Laranja doce", "Neutro", "Sem óleo"], compartilhado: true },
    { codigo: "ambiente", rotulo: "Música e luz", sugestoes: ["Música instrumental baixa", "Sons da natureza", "Silêncio", "Luz baixa", "Velas"] },
    { codigo: "restricoes", rotulo: "Restrições informadas", sugestoes: ["Gestante", "Hipertensão", "Varizes", "Pós-operatório", "Alergia a óleos/frutos secos", "Nenhuma"], compartilhado: true },
  ],
};

const terapias: Segmento = {
  slug: "terapias",
  nome: "Terapias corporais",
  icone: "🌸",
  publico: "terapeutas corporais",
  categorias: [
    { slug: "terapias", nome: "Terapias", icone: "🌸", exemplos: ["Reiki", "Reflexologia", "Auriculoterapia", "Ventosaterapia", "Acupuntura", "Quick massage", "Alongamento assistido"] },
  ],
  exemplos: { procedimento: "reiki, reflexologia", adicional: "auriculoterapia", descricaoProcedimento: "Sessão de 50 minutos com foco em equilíbrio e relaxamento.", descricaoAdicional: "Aplicação de sementes nos pontos auriculares." },
  retorno: "Está chegando a hora da sua próxima sessão.",
  ficha: [
    { codigo: "queixa", rotulo: "Queixa principal", sugestoes: ["Ansiedade", "Dor lombar", "Insônia", "Estresse", "Enxaqueca"] },
    { codigo: "restricoes", rotulo: "Restrições", sugestoes: ["Gestante", "Hipertensão", "Marca-passo", "Nenhuma"] },
  ],
};

// ─── Marcas ────────────────────────────────────────────────────────────────────────────────────

export const MARCAS: Record<string, Marca> = {
  beauty: {
    slug: "beauty",
    nome: "Heeca Beauty",
    publico: "salões, studios e profissionais de beleza",
    tagline: "sua agenda de beleza, do seu jeito",
    descricao: "Agendamento e gestão para salões, studios e profissionais de beleza: cabelo e barba, unhas, cílios, sobrancelhas, estética e maquiagem na mesma agenda, com confirmação por WhatsApp, ficha por segmento e retorno inteligente.",
    cor: "#c8306f",
    segmentos: [cabelo, unhas, cilios, sobrancelhas, estetica, maquiagem],
  },
  wellness: {
    slug: "wellness",
    nome: "Heeca Wellness",
    publico: "spas, massoterapeutas e espaços de bem-estar",
    tagline: "organize sua agenda, encante seus clientes",
    descricao: "Agendamento e gestão para spas, massoterapeutas e espaços de bem-estar: massagem, spa e terapias corporais na mesma agenda, com confirmação por WhatsApp, ficha do cliente e retorno inteligente.",
    cor: "#c8306f",
    segmentos: [massagem, spa, terapias],
  },
};

export const MARCA_PADRAO = "beauty";

/**
 * Hosts de produtos absorvidos (20/09/2026): nail/lash/brow/cut/skin.heeca.com.br → Heeca Beauty;
 * massage.heeca.com.br → Heeca Wellness. Quem chega por eles é redirecionado ao host da marca (src/proxy.ts).
 */
export const HOSTS_LEGADOS: Record<string, string> = { nail: "beauty", lash: "beauty", brow: "beauty", cut: "beauty", skin: "beauty", massage: "wellness" };

export function marcaPorSlug(slug: string | null | undefined): Marca {
  return MARCAS[slug ?? ""] ?? MARCAS[MARCA_PADRAO];
}

/** Marca pelo host: "beauty.heeca.com.br" → beauty; host legado → marca que o absorveu; localhost/IP/desconhecido → MARCA_DEFAULT ou beauty. */
export function marcaDoHost(host: string | null | undefined): Marca {
  const sub = subdominio(host);
  return MARCAS[sub] ?? MARCAS[HOSTS_LEGADOS[sub] ?? ""] ?? marcaPorSlug(process.env.MARCA_DEFAULT);
}

/** Marca a que um host legado deveria redirecionar, ou null se o host já é canônico (ou desconhecido). */
export function redirecionamentoDeHost(host: string | null | undefined): Marca | null {
  const alvo = HOSTS_LEGADOS[subdominio(host)];
  return alvo ? MARCAS[alvo] : null;
}

const subdominio = (host: string | null | undefined) => (host ?? "").toLowerCase().split(":")[0].split(".")[0];

// ─── Segmentos do estabelecimento ──────────────────────────────────────────────────────────────

export function segmentoPorSlug(marca: Marca, slug: string): Segmento | undefined {
  return marca.segmentos.find((s) => s.slug === slug);
}

/**
 * Segmentos ativos do estabelecimento. Lista vazia (ainda não escolheu) = todos os da marca, para o
 * painel funcionar desde o primeiro acesso; `escolheuSegmentos()` diz se ainda falta escolher.
 * Slugs desconhecidos (segmento removido do motor) são ignorados.
 */
export function segmentosDe(marca: Marca, tenant: { segmentos: string[] }): Segmento[] {
  const ativos = marca.segmentos.filter((s) => tenant.segmentos.includes(s.slug));
  return ativos.length > 0 ? ativos : marca.segmentos;
}

export const escolheuSegmentos = (marca: Marca, tenant: { segmentos: string[] }) => marca.segmentos.some((s) => tenant.segmentos.includes(s.slug));

/**
 * Ficha técnica do estabelecimento: união das fichas dos segmentos ativos, códigos prefixados (`unhas.formato`).
 * Campo `compartilhado` (pressão, foco… em massagem e spa) entra uma vez, com o prefixo do primeiro segmento ativo.
 */
export function fichaDe(segmentos: Segmento[]): CampoFicha[] {
  const compartilhados = new Set<string>();
  return segmentos.flatMap((s) =>
    s.ficha
      .filter((c) => !c.compartilhado || (!compartilhados.has(c.codigo) && compartilhados.add(c.codigo)))
      .map((c) => ({ ...c, codigo: `${s.slug}.${c.codigo}`, segmento: s.slug })),
  );
}

/** Categorias sugeridas para os segmentos (sem repetir slug quando dois segmentos sugerem a mesma). */
export function categoriasSugeridas(segmentos: Segmento[]): CategoriaSugerida[] {
  const vistas = new Set<string>();
  return segmentos.flatMap((s) => s.categorias).filter((c) => !vistas.has(c.slug) && vistas.add(c.slug));
}

/**
 * Frase de retorno para a mensagem sugerida. Com um segmento só, o vocabulário dele; com vários,
 * uma frase neutra — a profissional edita antes de enviar.
 */
export function fraseDeRetorno(segmentos: Segmento[]): string {
  return segmentos.length === 1 ? segmentos[0].retorno : "Está chegando a hora do seu próximo atendimento.";
}

/** Placeholders do cadastro de serviço: do primeiro segmento ativo. */
export const exemplosDe = (segmentos: Segmento[]) => segmentos[0].exemplos;

/** Todas as categorias sugeridas de todas as marcas, por slug — para ícone e exemplos de categorias já criadas. */
export const CATEGORIAS_CONHECIDAS: Record<string, CategoriaSugerida> = Object.fromEntries(Object.values(MARCAS).flatMap((m) => m.segmentos.flatMap((s) => s.categorias)).map((c) => [c.slug, c]));

// ─── Paleta ────────────────────────────────────────────────────────────────────────────────────
// Tailwind referencia --color-brand-50…950; derivamos todas da cor 600 da marca misturando com
// branco (claras) e preto (escuras), para não manter 11 hexadecimais por marca à mão.
const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
function mistura(cor: string, alvo: [number, number, number], t: number) {
  const r = parseInt(cor.slice(1, 3), 16), g = parseInt(cor.slice(3, 5), 16), b = parseInt(cor.slice(5, 7), 16);
  return `#${hex(r + (alvo[0] - r) * t)}${hex(g + (alvo[1] - g) * t)}${hex(b + (alvo[2] - b) * t)}`;
}
const TONS: [number, number][] = [[50, 0.94], [100, 0.88], [200, 0.75], [300, 0.55], [400, 0.3], [500, 0.12], [600, 0], [700, 0.18], [800, 0.32], [900, 0.44], [950, 0.66]];

/** Variáveis CSS (--color-brand-*) para aplicar inline no <html> ou num wrapper. */
export function paleta(marca: Marca): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tom, t] of TONS) out[`--color-brand-${tom}`] = tom < 600 ? mistura(marca.cor, [255, 255, 255], t) : tom === 600 ? marca.cor : mistura(marca.cor, [0, 0, 0], t);
  return out;
}
