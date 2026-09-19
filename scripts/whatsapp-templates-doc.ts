/**
 * Gera docs/whatsapp-meta.md a partir de src/lib/whatsapp/meta-templates.ts.
 * Uso: npm run whatsapp:docs
 */
import { writeFileSync } from "node:fs";
import { META_TEMPLATES, type OutboundKind } from "../src/lib/whatsapp/meta-templates";
import { TEMPLATE_LABELS } from "../src/lib/whatsapp/templates";

const kinds = Object.keys(META_TEMPLATES) as OutboundKind[];

const sections = kinds.map((kind) => {
  const t = META_TEMPLATES[kind];
  const params = t.params.map((p, i) => `| {{${i + 1}}} | \`${p}\` | ${t.example[i]} |`).join("\n");
  const buttons = t.buttons?.length
    ? t.buttons
        .map((b, i) =>
          b.type === "quick_reply"
            ? `${i + 1}. **Resposta rápida** — texto: \`${b.text}\` (o payload é dinâmico, preenchido pelo sistema com \`confirm:<token>\` / \`cancel:<token>\`)`
            : `${i + 1}. **Acessar site** — texto: \`${b.text}\`, tipo de URL: **Dinâmica**, URL: \`${"{APP_URL}"}${b.urlPrefix}{{1}}\` (exemplo: \`https://app.seudominio.com.br${b.urlPrefix}salao-bela-vista\`)`,
        )
        .join("\n")
    : "_Sem botões._";

  return `### ${TEMPLATE_LABELS[kind]} — \`${t.defaultName}\`

- **Categoria:** ${t.category === "UTILITY" ? "Utilidade (Utility)" : t.category}
- **Idioma:** Português (BR) — \`pt_BR\`
- **Variável de ambiente para outro nome:** \`WHATSAPP_TEMPLATE_${kind}\`

**Corpo** (cole exatamente assim):

\`\`\`
${t.body}
\`\`\`

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
${params}

**Botões:**

${buttons}
`;
});

const doc = `# WhatsApp — Meta Cloud API

> Gerado por \`npm run whatsapp:docs\` a partir de \`src/lib/whatsapp/meta-templates.ts\`. Não edite à mão.

## Por que templates?

A Meta só permite mensagens livres dentro de **24 horas** após a última mensagem que o *cliente* enviou ao seu número.
Quem agenda pela página pública nunca escreveu para você — então a solicitação de confirmação, o lembrete e as demais
mensagens precisam ser **templates pré-aprovados**. O sistema envia templates automaticamente quando
\`WHATSAPP_PROVIDER=meta\` (\`WHATSAPP_USE_TEMPLATES\` controla isso).

## Passo a passo

1. **Criar o app na Meta**
   - Acesse https://developers.facebook.com/apps → *Criar app* → tipo **Empresa** → adicione o produto **WhatsApp**.
   - Em *WhatsApp → Configuração da API* anote o **ID do número de telefone** (\`WHATSAPP_PHONE_NUMBER_ID\`) e o
     **ID da conta do WhatsApp Business** (\`WHATSAPP_BUSINESS_ACCOUNT_ID\`).
   - O token temporário expira em 24h. Para produção, crie um **usuário do sistema** no Business Manager
     (Configurações do negócio → Usuários → Usuários do sistema), dê acesso ao app e gere um token permanente com as
     permissões \`whatsapp_business_messaging\` e \`whatsapp_business_management\` → \`WHATSAPP_ACCESS_TOKEN\`.
   - Em *Configurações do app → Básico* copie a **Chave secreta do app** → \`WHATSAPP_APP_SECRET\` (valida a assinatura dos webhooks).

2. **Cadastrar os templates** (Gerenciador do WhatsApp → Ferramentas da conta → Modelos de mensagem → *Criar modelo*).
   Use os nomes, categoria, corpo e botões listados abaixo. A aprovação costuma levar de minutos a algumas horas.
   Nos exemplos de variáveis use os valores da coluna "Exemplo para aprovação".

3. **Configurar o webhook** (*WhatsApp → Configuração → Webhook*):
   - URL de callback: \`https://SEU_DOMINIO/api/webhooks/whatsapp\`
   - Verify token: o valor de \`WHATSAPP_VERIFY_TOKEN\` no seu \`.env\`
   - Assine o campo **messages**.
   - Em desenvolvimento, exponha o localhost com um túnel (ex.: \`npx cloudflared tunnel --url http://localhost:3000\`) e use a URL do túnel também em \`APP_URL\`.

4. **Preencher o \`.env\`**

\`\`\`bash
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_BUSINESS_ACCOUNT_ID=1234567890
WHATSAPP_ACCESS_TOKEN=EAAB...
WHATSAPP_APP_SECRET=abc123...
WHATSAPP_VERIFY_TOKEN=um-segredo-qualquer
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
# Só se você cadastrou os templates com nomes diferentes dos padrões:
# WHATSAPP_TEMPLATE_REQUEST_CONFIRMATION=meu_nome
\`\`\`

5. **Conferir no painel**: *Configurações → WhatsApp* mostra o número conectado, a qualidade e o status de cada template
   (Aprovado / Em análise / Não cadastrado) quando \`WHATSAPP_BUSINESS_ACCOUNT_ID\` está preenchido.

6. **Testar**: faça um agendamento pela página pública com o seu próprio número. Enquanto o app estiver em modo de
   desenvolvimento na Meta, só números adicionados em *Configuração da API → Para → Gerenciar lista* recebem mensagens.

## Templates

${sections.join("\n")}
## Observações

- Parâmetros de corpo não podem conter quebras de linha nem mais de 4 espaços seguidos (o sistema já normaliza).
- Os botões de resposta rápida chegam ao webhook como \`type: "button"\` com o \`payload\` dinâmico; o sistema confirma
  ou cancela o agendamento com base nele. Respostas em texto ("sim", "não") também são entendidas.
- Se um template for rejeitado, ajuste o texto na Meta e, se mudar o número/ordem das variáveis, atualize
  \`META_TEMPLATES\` no código para manter os parâmetros alinhados.
- Custos: templates de categoria *Utilidade* são cobrados por conversa de 24h iniciada pela empresa; respostas do
  cliente dentro da janela não geram nova cobrança.
`;

writeFileSync("docs/whatsapp-meta.md", doc);
console.log("docs/whatsapp-meta.md gerado.");
