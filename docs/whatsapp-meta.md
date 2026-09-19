# WhatsApp — Meta Cloud API

> Gerado por `npm run whatsapp:docs` a partir de `src/lib/whatsapp/meta-templates.ts`. Não edite à mão.

## Por que templates?

A Meta só permite mensagens livres dentro de **24 horas** após a última mensagem que o *cliente* enviou ao seu número.
Quem agenda pela página pública nunca escreveu para você — então a solicitação de confirmação, o lembrete e as demais
mensagens precisam ser **templates pré-aprovados**. O sistema envia templates automaticamente quando
`WHATSAPP_PROVIDER=meta` (`WHATSAPP_USE_TEMPLATES` controla isso).

## Passo a passo

1. **Criar o app na Meta**
   - Acesse https://developers.facebook.com/apps → *Criar app* → tipo **Empresa** → adicione o produto **WhatsApp**.
   - Em *WhatsApp → Configuração da API* anote o **ID do número de telefone** (`WHATSAPP_PHONE_NUMBER_ID`) e o
     **ID da conta do WhatsApp Business** (`WHATSAPP_BUSINESS_ACCOUNT_ID`).
   - O token temporário expira em 24h. Para produção, crie um **usuário do sistema** no Business Manager
     (Configurações do negócio → Usuários → Usuários do sistema), dê acesso ao app e gere um token permanente com as
     permissões `whatsapp_business_messaging` e `whatsapp_business_management` → `WHATSAPP_ACCESS_TOKEN`.
   - Em *Configurações do app → Básico* copie a **Chave secreta do app** → `WHATSAPP_APP_SECRET` (valida a assinatura dos webhooks).

2. **Cadastrar os templates** (Gerenciador do WhatsApp → Ferramentas da conta → Modelos de mensagem → *Criar modelo*).
   Use os nomes, categoria, corpo e botões listados abaixo. A aprovação costuma levar de minutos a algumas horas.
   Nos exemplos de variáveis use os valores da coluna "Exemplo para aprovação".

3. **Configurar o webhook** (*WhatsApp → Configuração → Webhook*):
   - URL de callback: `https://SEU_DOMINIO/api/webhooks/whatsapp`
   - Verify token: o valor de `WHATSAPP_VERIFY_TOKEN` no seu `.env`
   - Assine o campo **messages**.
   - Em desenvolvimento, exponha o localhost com um túnel (ex.: `npx cloudflared tunnel --url http://localhost:3000`) e use a URL do túnel também em `APP_URL`.

4. **Preencher o `.env`**

```bash
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_BUSINESS_ACCOUNT_ID=1234567890
WHATSAPP_ACCESS_TOKEN=EAAB...
WHATSAPP_APP_SECRET=abc123...
WHATSAPP_VERIFY_TOKEN=um-segredo-qualquer
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
# Só se você cadastrou os templates com nomes diferentes dos padrões:
# WHATSAPP_TEMPLATE_REQUEST_CONFIRMATION=meu_nome
```

5. **Conferir no painel**: *Configurações → WhatsApp* mostra o número conectado, a qualidade e o status de cada template
   (Aprovado / Em análise / Não cadastrado) quando `WHATSAPP_BUSINESS_ACCOUNT_ID` está preenchido.

6. **Testar**: faça um agendamento pela página pública com o seu próprio número. Enquanto o app estiver em modo de
   desenvolvimento na Meta, só números adicionados em *Configuração da API → Para → Gerenciar lista* recebem mensagens.

## Templates

### Solicitação de confirmação — `heeca_solicitacao_agendamento`

- **Categoria:** Utilidade (Utility)
- **Idioma:** Português (BR) — `pt_BR`
- **Variável de ambiente para outro nome:** `WHATSAPP_TEMPLATE_REQUEST_CONFIRMATION`

**Corpo** (cole exatamente assim):

```
Olá, {{1}}! 💅 Recebemos sua solicitação de agendamento. Procedimento: {{2}}. Profissional: {{3}}. Data: {{4}} às {{5}}. Toque em Confirmar para garantir seu horário.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `cliente` | Maria |
| {{2}} | `servico` | Alongamento em Fibra de Vidro |
| {{3}} | `profissional` | Ana |
| {{4}} | `data` | 20/09/2026 |
| {{5}} | `hora` | 14:00 |

**Botões:**

1. **Resposta rápida** — texto: `Confirmar` (o payload é dinâmico, preenchido pelo sistema com `confirm:<token>` / `cancel:<token>`)
2. **Resposta rápida** — texto: `Remarcar` (o payload é dinâmico, preenchido pelo sistema com `confirm:<token>` / `cancel:<token>`)
3. **Resposta rápida** — texto: `Cancelar` (o payload é dinâmico, preenchido pelo sistema com `confirm:<token>` / `cancel:<token>`)

### Agendamento confirmado — `heeca_agendamento_confirmado`

- **Categoria:** Utilidade (Utility)
- **Idioma:** Português (BR) — `pt_BR`
- **Variável de ambiente para outro nome:** `WHATSAPP_TEMPLATE_CONFIRMED`

**Corpo** (cole exatamente assim):

```
✨ Agendamento confirmado! Procedimento: {{1}}. Profissional: {{2}}. Data: {{3}} às {{4}}. {{5}}Estamos te esperando! 💅
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `servico` | Alongamento em Fibra de Vidro |
| {{2}} | `profissional` | Ana |
| {{3}} | `data` | 20/09/2026 |
| {{4}} | `hora` | 14:00 |
| {{5}} | `orientacoes` | Chegue alguns minutos antes e venha sem esmalte.  |

**Botões:**

_Sem botões._

### Lembrete — `heeca_lembrete`

- **Categoria:** Utilidade (Utility)
- **Idioma:** Português (BR) — `pt_BR`
- **Variável de ambiente para outro nome:** `WHATSAPP_TEMPLATE_REMINDER`

**Corpo** (cole exatamente assim):

```
Oi, {{1}}! 💖 Lembrando que seu horário em {{3}} está agendado para {{4}}, às {{5}}. Procedimento: {{2}}. Até lá! ✨
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `cliente` | Maria |
| {{2}} | `servico` | Alongamento em Fibra de Vidro |
| {{3}} | `estabelecimento` | Salão Bela Vista |
| {{4}} | `quando` | amanhã |
| {{5}} | `hora` | 14:00 |

**Botões:**

1. **Resposta rápida** — texto: `Remarcar` (o payload é dinâmico, preenchido pelo sistema com `confirm:<token>` / `cancel:<token>`)
2. **Resposta rápida** — texto: `Cancelar` (o payload é dinâmico, preenchido pelo sistema com `confirm:<token>` / `cancel:<token>`)

### Cancelamento — `heeca_agendamento_cancelado`

- **Categoria:** Utilidade (Utility)
- **Idioma:** Português (BR) — `pt_BR`
- **Variável de ambiente para outro nome:** `WHATSAPP_TEMPLATE_CANCELLED`

**Corpo** (cole exatamente assim):

```
Seu agendamento de {{1}} em {{2}} às {{3}} foi cancelado. Caso queira, é só marcar um novo horário pelo botão abaixo.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `servico` | Alongamento em Fibra de Vidro |
| {{2}} | `data` | 20/09/2026 |
| {{3}} | `hora` | 14:00 |

**Botões:**

1. **Acessar site** — texto: `Agendar novamente`, tipo de URL: **Dinâmica**, URL: `{APP_URL}/agendar/{{1}}` (exemplo: `https://app.seudominio.com.br/agendar/salao-bela-vista`)

### Pedido de pagamento (sinal) — `heeca_pedido_sinal`

- **Categoria:** Utilidade (Utility)
- **Idioma:** Português (BR) — `pt_BR`
- **Variável de ambiente para outro nome:** `WHATSAPP_TEMPLATE_PAYMENT_REQUEST`

**Corpo** (cole exatamente assim):

```
Olá, {{1}}! Para garantir seu horário de *{{2}}* em {{3}} às {{4}}, pague o sinal de {{5}} via Pix em até {{6}}. Toque no botão para ver o QR Code.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `cliente` | Maria |
| {{2}} | `servico` | Alongamento em Fibra de Vidro |
| {{3}} | `data` | 20/09/2026 |
| {{4}} | `hora` | 14:00 |
| {{5}} | `valor_sinal` | R$ 20,00 |
| {{6}} | `prazo_pagamento` | 30 minutos |

**Botões:**

1. **Acessar site** — texto: `Pagar sinal`, tipo de URL: **Dinâmica**, URL: `{APP_URL}/pagar/{{1}}` (exemplo: `https://app.seudominio.com.br/pagar/salao-bela-vista`)

### Reagendamento — `heeca_agendamento_remarcado`

- **Categoria:** Utilidade (Utility)
- **Idioma:** Português (BR) — `pt_BR`
- **Variável de ambiente para outro nome:** `WHATSAPP_TEMPLATE_RESCHEDULED`

**Corpo** (cole exatamente assim):

```
🔁 Seu horário de {{1}} foi remarcado para {{2}} às {{3}}. Qualquer dúvida, é só responder esta mensagem. 💅
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `servico` | Alongamento em Fibra de Vidro |
| {{2}} | `data` | 21/09/2026 |
| {{3}} | `hora` | 15:00 |

**Botões:**

_Sem botões._

## Observações

- Parâmetros de corpo não podem conter quebras de linha nem mais de 4 espaços seguidos (o sistema já normaliza).
- Os botões de resposta rápida chegam ao webhook como `type: "button"` com o `payload` dinâmico; o sistema confirma
  ou cancela o agendamento com base nele. Respostas em texto ("sim", "não") também são entendidas.
- Se um template for rejeitado, ajuste o texto na Meta e, se mudar o número/ordem das variáveis, atualize
  `META_TEMPLATES` no código para manter os parâmetros alinhados.
- Custos: templates de categoria *Utilidade* são cobrados por conversa de 24h iniciada pela empresa; respostas do
  cliente dentro da janela não geram nova cobrança.
