// Permissões de usuários. Puro: o perfil (dono, gerente, recepção, profissional) dá o ponto de partida e o dono
// liga ou desliga cada módulo por pessoa. O servidor confere a permissão em toda página e ação; o menu só reflete.

export type Role = "OWNER" | "MANAGER" | "RECEPTION" | "STAFF";
export const ROLES: Role[] = ["OWNER", "MANAGER", "RECEPTION", "STAFF"];

export const PERMISSION_KEYS = [
  "agenda_equipe", "servicos", "equipe", "configuracoes", "pacotes", "portfolio", "salas",
  "comissoes", "comissoes_acertar", "financeiro", "caixa", "relatorios", "estoque", "campanhas", "cashback_ajustar",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionInfo = { key: PermissionKey; label: string; hint: string; group: string };

/** O que cada permissão libera, na ordem em que aparece na tela de acessos. */
export const PERMISSIONS: PermissionInfo[] = [
  { key: "agenda_equipe", group: "Agenda e clientes", label: "Ver a agenda de toda a equipe", hint: "Sem isto, a pessoa vê e opera só a própria agenda." },
  { key: "campanhas", group: "Agenda e clientes", label: "Campanhas", hint: "Aniversariantes e clientes que sumiram; registrar envios." },
  { key: "cashback_ajustar", group: "Agenda e clientes", label: "Ajustar cashback da cliente", hint: "Dar bônus ou corrigir o saldo. Registrar o uso do saldo é de quem vê a equipe." },
  { key: "caixa", group: "Dinheiro", label: "Caixa", hint: "Abrir e fechar o caixa, sangria, suprimento e forma de pagamento do atendimento." },
  { key: "financeiro", group: "Dinheiro", label: "Financeiro", hint: "Receitas, despesas e resultado do período." },
  { key: "comissoes", group: "Dinheiro", label: "Ver comissões", hint: "Quem vê a equipe toda vê todas; os demais veem só a própria." },
  { key: "comissoes_acertar", group: "Dinheiro", label: "Acertar comissões", hint: "Marcar comissões como pagas." },
  { key: "relatorios", group: "Gestão", label: "Relatórios e exportação", hint: "Números do período e arquivos CSV." },
  { key: "estoque", group: "Gestão", label: "Estoque", hint: "Produtos, entradas, saídas e produtos usados por serviço." },
  { key: "servicos", group: "Cadastros", label: "Serviços e categorias", hint: "Criar e editar serviços, preços e categorias." },
  { key: "pacotes", group: "Cadastros", label: "Pacotes", hint: "Criar pacotes e vender para clientes." },
  { key: "portfolio", group: "Cadastros", label: "Portfólio", hint: "Fotos da página pública." },
  { key: "salas", group: "Cadastros", label: "Salas e recursos", hint: "Cadastro de salas, recursos e bloqueios." },
  { key: "equipe", group: "Administração", label: "Gerenciar a equipe", hint: "Cadastrar e editar profissionais, serviços e horários. Acessos ao painel continuam só do dono." },
  { key: "configuracoes", group: "Administração", label: "Configurações do negócio", hint: "Dados, horários, políticas, aparência, unidades e fidelidade." },
];

const TODAS = new Set<PermissionKey>(PERMISSION_KEYS);
const GESTAO: PermissionKey[] = [...PERMISSION_KEYS];
const RECEPCAO: PermissionKey[] = ["agenda_equipe", "campanhas", "caixa"];
const PROFISSIONAL: PermissionKey[] = ["comissoes"];

/** Ponto de partida de cada perfil (o gerente tem tudo, como antes; o dono sempre tem tudo). */
export const ROLE_DEFAULTS: Record<Role, ReadonlySet<PermissionKey>> = {
  OWNER: TODAS,
  MANAGER: new Set(GESTAO),
  RECEPTION: new Set(RECEPCAO),
  STAFF: new Set(PROFISSIONAL),
};

export type Overrides = Partial<Record<PermissionKey, boolean>>;

export const isPermissionKey = (v: unknown): v is PermissionKey => typeof v === "string" && (PERMISSION_KEYS as readonly string[]).includes(v);

/** Lê o JSON gravado no usuário ignorando chaves desconhecidas e valores que não sejam verdadeiro/falso. */
export function lerOverrides(raw: unknown): Overrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Overrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (isPermissionKey(k) && typeof v === "boolean") out[k] = v;
  return out;
}

/** O dono nunca perde nada (senão ninguém conseguiria desfazer); os demais: ajuste da pessoa, senão o padrão do perfil. */
export function permissoesEfetivas(role: Role, overrides: Overrides): Set<PermissionKey> {
  if (role === "OWNER") return new Set(TODAS);
  const efetivas = new Set(ROLE_DEFAULTS[role]);
  for (const key of PERMISSION_KEYS) {
    const o = overrides[key];
    if (o === true) efetivas.add(key);
    else if (o === false) efetivas.delete(key);
  }
  return efetivas;
}

export const podeFazer = (role: Role, overrides: Overrides, key: PermissionKey) => permissoesEfetivas(role, overrides).has(key);

/** Do que a pessoa marcou na tela, guarda só o que difere do padrão do perfil (mudar de perfil depois não deixa lixo). */
export function overridesDoMarcado(role: Role, marcadas: ReadonlySet<PermissionKey>): Overrides {
  const out: Overrides = {};
  for (const key of PERMISSION_KEYS) {
    const padrao = ROLE_DEFAULTS[role].has(key);
    const marcou = marcadas.has(key);
    if (marcou !== padrao) out[key] = marcou;
  }
  return out;
}

/**
 * Dependências: acertar comissões exige ver comissões; ajustar cashback e acertar comissão não fazem sentido sem os módulos
 * que os mostram. Corrige o que foi marcado de forma incoerente.
 */
export function normalizarMarcadas(marcadas: ReadonlySet<PermissionKey>): Set<PermissionKey> {
  const s = new Set(marcadas);
  if (s.has("comissoes_acertar")) s.add("comissoes");
  return s;
}

/** Resumo curto para listas: quantos módulos além do padrão do perfil. */
export function resumoDeAcesso(role: Role, overrides: Overrides): { total: number; extras: number; removidos: number } {
  const efetivas = permissoesEfetivas(role, overrides);
  const padrao = ROLE_DEFAULTS[role];
  return {
    total: efetivas.size,
    extras: [...efetivas].filter((k) => !padrao.has(k)).length,
    removidos: [...padrao].filter((k) => !efetivas.has(k)).length,
  };
}
